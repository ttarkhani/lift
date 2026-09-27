import {
  availableActions,
  canSendMessage,
  checkTransition,
  partyOf,
  type ListRequestsInput,
  type Party,
  type PostRequestInput,
  type RequestAction,
  type SendMessageInput,
  type SubmitOutcomeInput,
} from "@/domain/requests";
import type { EvidenceKind, MessageKind, RequestStatus } from "@/domain/types";
import { assertCanViewThread, assertTeamMember, assertUser, type TeamViewer } from "@/server/auth/access";
import type { Viewer } from "@/server/auth/viewer";
import type postgres from "postgres";
import type { Tx } from "@/server/db/client";
import { ConflictError, ForbiddenError, NotFoundError } from "@/server/errors";
import { emitActivity } from "@/server/events";
import { onResolutionConfirmed } from "./awards";

// Every state change here runs in the caller's transaction: it locks the request, asks the
// state machine whether the actor's team may make the move, writes the change, adds a
// system message to the thread, and records one activity event.

type RequestRow = {
  id: string;
  requesting_team_id: string;
  helping_team_id: string | null;
  status: RequestStatus;
  accepted_at: Date | null;
  requesting_team_name: string;
  helping_team_name: string | null;
};

async function loadRequest(tx: Tx, requestId: string, lock: boolean): Promise<RequestRow> {
  const [row] = await tx<RequestRow[]>`
    select
      r.id, r.requesting_team_id, r.helping_team_id, r.status, r.accepted_at,
      rt.name as requesting_team_name, ht.name as helping_team_name
    from help_requests r
    join teams rt on rt.id = r.requesting_team_id
    left join teams ht on ht.id = r.helping_team_id
    where r.id = ${requestId}
    ${lock ? tx`for update of r` : tx``}
  `;
  if (!row) throw new NotFoundError("That blocker doesn't exist.");
  return row;
}

function parties(row: RequestRow) {
  return { requestingTeamId: row.requesting_team_id, helpingTeamId: row.helping_team_id };
}

const WRONG_STATUS: Record<RequestAction, string> = {
  accept: "Another team is already helping with this blocker.",
  release: "Your team isn't helping with this blocker right now.",
  cancel: "Only open blockers, or ones a team is helping with, can be cancelled.",
  submit_outcome: "An outcome is already waiting for confirmation.",
  reject_outcome: "There's no outcome waiting for confirmation.",
  confirm: "There's no outcome waiting for confirmation. It may already be confirmed.",
  reopen: "Only resolved blockers can be reopened.",
};

/** Checks the state machine for the actor's team: 403 for the wrong team, 409 for the wrong status. */
function authorize(action: RequestAction, row: RequestRow, actor: TeamViewer): void {
  const check = checkTransition(action, row.status, partyOf(actor.team.id, parties(row)));
  if (check.ok) return;
  if (check.reason === "wrong_status") throw new ConflictError(WRONG_STATUS[action]);
  if (action === "accept") {
    if (row.helping_team_id === actor.team.id) throw new ConflictError("Your team is already helping with this blocker.");
    throw new ForbiddenError("Your team can't help with its own blocker.");
  }
  const owner = action === "release" || action === "submit_outcome" ? row.helping_team_name : row.requesting_team_name;
  throw new ForbiddenError(owner ? `Only Team ${owner} can do that.` : "Your team can't do that.");
}

async function systemMessage(tx: Tx, requestId: string, body: string): Promise<void> {
  await tx`insert into messages (request_id, kind, body) values (${requestId}, 'system', ${body})`;
}

function secondsSince(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 1000));
}

async function transactionNow(tx: Tx): Promise<Date> {
  const [{ now }] = await tx<{ now: Date }[]>`select now() as now`;
  return now;
}

export type RequestRef = { id: string; requestingTeam: string; helpingTeam: string | null };

function ref(row: RequestRow): RequestRef {
  return { id: row.id, requestingTeam: row.requesting_team_name, helpingTeam: row.helping_team_name };
}

export async function postRequest(tx: Tx, actor: Viewer, input: PostRequestInput): Promise<RequestRef> {
  const member = assertTeamMember(actor);
  const [{ id }] = await tx<{ id: string }[]>`
    insert into help_requests (requesting_team_id, created_by, title, description, tags, tried)
    values (${member.team.id}, ${member.userId}, ${input.title}, ${input.description}, ${input.tags}, ${input.tried})
    returning id
  `;
  await systemMessage(tx, id, `Team ${member.team.name} posted this blocker`);
  await emitActivity(tx, { type: "request_posted", teamId: member.team.id, requestId: id, actorUserId: member.userId });
  return { id, requestingTeam: member.team.name, helpingTeam: null };
}

/** Race-safe: only one team's conditional update can move the request out of open. */
export async function acceptRequest(tx: Tx, actor: Viewer, requestId: string): Promise<RequestRef> {
  const member = assertTeamMember(actor);
  const [accepted] = await tx<{ id: string; requesting_team_id: string; open_since: Date; accepted_at: Date }[]>`
    update help_requests r
    set status = 'accepted', helping_team_id = ${member.team.id}, accepted_at = now()
    where r.id = ${requestId} and r.status = 'open' and r.requesting_team_id <> ${member.team.id}
    returning r.id, r.requesting_team_id, r.accepted_at, greatest(r.created_at, (
      select max(e.time) from activity_events e
      where e.request_id = r.id and e.event_type in ('request_released', 'request_reopened')
    )) as open_since
  `;
  if (!accepted) {
    // Explain why: a missing request, the team's own request, or someone else got there first.
    authorize("accept", await loadRequest(tx, requestId, false), member);
    throw new ConflictError(WRONG_STATUS.accept);
  }

  const row = await loadRequest(tx, requestId, false);
  await systemMessage(tx, requestId, `Team ${member.team.name} is helping`);
  await emitActivity(tx, {
    type: "request_accepted",
    teamId: member.team.id,
    counterpartTeamId: accepted.requesting_team_id,
    requestId,
    actorUserId: member.userId,
    durationS: secondsSince(accepted.open_since, accepted.accepted_at),
  });
  return ref(row);
}

export async function releaseRequest(tx: Tx, actor: Viewer, requestId: string): Promise<RequestRef> {
  const member = assertTeamMember(actor);
  const row = await loadRequest(tx, requestId, true);
  authorize("release", row, member);
  await tx`
    update help_requests set status = 'open', helping_team_id = null, accepted_at = null where id = ${requestId}
  `;
  await systemMessage(tx, requestId, `Team ${member.team.name} stopped helping`);
  await emitActivity(tx, {
    type: "request_released",
    teamId: member.team.id,
    counterpartTeamId: row.requesting_team_id,
    requestId,
    actorUserId: member.userId,
  });
  return ref(row);
}

export async function cancelRequest(tx: Tx, actor: Viewer, requestId: string): Promise<RequestRef> {
  const member = assertTeamMember(actor);
  const row = await loadRequest(tx, requestId, true);
  authorize("cancel", row, member);
  await tx`update help_requests set status = 'cancelled' where id = ${requestId}`;
  await systemMessage(tx, requestId, `Team ${member.team.name} cancelled this blocker`);
  await emitActivity(tx, {
    type: "request_cancelled",
    teamId: member.team.id,
    counterpartTeamId: row.helping_team_id,
    requestId,
    actorUserId: member.userId,
  });
  return ref(row);
}

export type ThreadMessage = {
  id: string;
  kind: MessageKind;
  body: string;
  createdAt: Date;
  /** Null for system messages. */
  author: { userId: string; name: string; team: string | null } | null;
};

export async function sendMessage(
  tx: Tx,
  actor: Viewer,
  requestId: string,
  input: SendMessageInput,
): Promise<ThreadMessage> {
  const member = assertTeamMember(actor);
  const row = await loadRequest(tx, requestId, false);
  const party = partyOf(member.team.id, parties(row));
  if (party === "other") throw new ForbiddenError("Only the two teams can write in this thread.");
  if (!canSendMessage(row.status, party)) throw new ConflictError("This thread is closed. Messages open again when a team is helping.");

  const [message] = await tx<{ id: string; created_at: Date }[]>`
    insert into messages (request_id, author_user_id, kind, body)
    values (${requestId}, ${member.userId}, ${input.kind}, ${input.body})
    returning id, created_at
  `;
  await emitActivity(tx, {
    type: "message_sent",
    teamId: member.team.id,
    counterpartTeamId: party === "requester" ? row.helping_team_id : row.requesting_team_id,
    requestId,
    actorUserId: member.userId,
    payload: { messageId: message.id, kind: input.kind },
  });
  return {
    id: message.id,
    kind: input.kind,
    body: input.body,
    createdAt: message.created_at,
    author: { userId: member.userId, name: member.displayName, team: member.team.name },
  };
}

export async function submitOutcome(
  tx: Tx,
  actor: Viewer,
  requestId: string,
  input: SubmitOutcomeInput,
): Promise<RequestRef & { outcomeId: string }> {
  const member = assertTeamMember(actor);
  const row = await loadRequest(tx, requestId, true);
  authorize("submit_outcome", row, member);
  const [outcome] = await tx<{ id: string }[]>`
    insert into outcomes (request_id, helper_summary, evidence_kind, evidence, in_person, submitted_by)
    values (${requestId}, ${input.summary}, ${input.evidenceKind}, ${input.evidence}, ${input.inPerson}, ${member.userId})
    returning id
  `;
  await tx`update help_requests set status = 'outcome_submitted' where id = ${requestId}`;
  await systemMessage(tx, requestId, `Team ${member.team.name} submitted an outcome`);
  await emitActivity(tx, {
    type: "outcome_submitted",
    teamId: member.team.id,
    counterpartTeamId: row.requesting_team_id,
    requestId,
    actorUserId: member.userId,
    payload: { outcomeId: outcome.id, evidenceKind: input.evidenceKind, inPerson: input.inPerson },
  });
  return { ...ref(row), outcomeId: outcome.id };
}

/** The outcome waiting for the requesting team's decision. */
async function pendingOutcome(tx: Tx, requestId: string): Promise<{ id: string }> {
  const [outcome] = await tx<{ id: string }[]>`
    select id from outcomes
    where request_id = ${requestId} and confirmed_at is null and reconfirmed_at is null and rejected_at is null
    order by submitted_at desc, id desc
    limit 1
  `;
  if (!outcome) throw new ConflictError(WRONG_STATUS.confirm);
  return outcome;
}

/** "Not fixed yet": the outcome goes back to the helping team, who keep working in the thread. */
export async function rejectOutcome(tx: Tx, actor: Viewer, requestId: string): Promise<RequestRef> {
  const member = assertTeamMember(actor);
  const row = await loadRequest(tx, requestId, true);
  authorize("reject_outcome", row, member);
  const outcome = await pendingOutcome(tx, requestId);
  await tx`update outcomes set rejected_at = now() where id = ${outcome.id}`;
  await tx`update help_requests set status = 'accepted' where id = ${requestId}`;
  await systemMessage(tx, requestId, `Team ${member.team.name} says it's not fixed yet`);
  await emitActivity(tx, {
    type: "outcome_rejected",
    teamId: member.team.id,
    counterpartTeamId: row.helping_team_id,
    requestId,
    actorUserId: member.userId,
    payload: { outcomeId: outcome.id },
  });
  return ref(row);
}

/**
 * Only the requesting team confirms, once. The first confirmation is the request's one
 * confirmed outcome and goes on to awards. After a reopen, a later confirmation resolves the
 * request again but is recorded as reconfirmed_at, and never awards.
 */
export async function confirmOutcome(
  tx: Tx,
  actor: Viewer,
  requestId: string,
): Promise<RequestRef & { reconfirmed: boolean }> {
  const member = assertTeamMember(actor);
  const row = await loadRequest(tx, requestId, true);
  authorize("confirm", row, member);
  const outcome = await pendingOutcome(tx, requestId);
  const now = await transactionNow(tx);
  const helpingTeamId = row.helping_team_id!;

  const [earlier] = await tx`
    select 1 from outcomes where request_id = ${requestId} and confirmed_at is not null
  `;
  const reconfirmed = Boolean(earlier);
  if (reconfirmed) {
    await tx`update outcomes set reconfirmed_by = ${member.userId}, reconfirmed_at = ${now} where id = ${outcome.id}`;
  } else {
    await tx`update outcomes set confirmed_by = ${member.userId}, confirmed_at = ${now} where id = ${outcome.id}`;
  }
  await tx`update help_requests set status = 'resolved', resolved_at = ${now} where id = ${requestId}`;
  await systemMessage(
    tx,
    requestId,
    reconfirmed
      ? `Team ${member.team.name} confirmed the fix again. The first confirmation is the one that counts.`
      : `Team ${member.team.name} confirmed the fix`,
  );
  await emitActivity(tx, {
    type: reconfirmed ? "resolution_reconfirmed" : "resolution_confirmed",
    teamId: member.team.id,
    counterpartTeamId: helpingTeamId,
    requestId,
    actorUserId: member.userId,
    durationS: row.accepted_at ? secondsSince(row.accepted_at, now) : null,
    payload: { outcomeId: outcome.id },
  });

  if (!reconfirmed) {
    await onResolutionConfirmed(tx, {
      requestId,
      requestingTeamId: row.requesting_team_id,
      helpingTeamId,
      outcomeId: outcome.id,
      confirmedAt: now,
    });
  }
  return { ...ref(row), reconfirmed };
}

/** Back to the board for anyone to take. The confirmed outcome, and any award, stay. */
export async function reopenRequest(tx: Tx, actor: Viewer, requestId: string): Promise<RequestRef> {
  const member = assertTeamMember(actor);
  const row = await loadRequest(tx, requestId, true);
  authorize("reopen", row, member);
  await tx`
    update help_requests
    set status = 'open', helping_team_id = null, accepted_at = null, resolved_at = null,
        reopen_count = reopen_count + 1
    where id = ${requestId}
  `;
  await systemMessage(tx, requestId, `Team ${member.team.name} reopened this blocker`);
  await emitActivity(tx, {
    type: "request_reopened",
    teamId: member.team.id,
    counterpartTeamId: row.helping_team_id,
    requestId,
    actorUserId: member.userId,
  });
  return ref(row);
}

// Reads.

export type TeamSummary = { id: string; slug: string; name: string; isDemo: boolean; tableLocation: string | null };

export type RequestSummary = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  tried: string;
  status: RequestStatus;
  reopenCount: number;
  createdAt: Date;
  postedBy: string;
  requestingTeam: TeamSummary;
  helpingTeam: TeamSummary | null;
  /** How the viewer's team relates to it. */
  party: Party;
};

type SummaryRow = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  tried: string;
  status: RequestStatus;
  reopen_count: number;
  created_at: Date;
  posted_by: string;
  requesting_team: TeamSummary;
  helping_team: TeamSummary | null;
};

function selectSummaries(tx: Tx, where: postgres.Fragment) {
  const team = (alias: string) => tx.unsafe(
    `json_build_object('id', ${alias}.id::text, 'slug', ${alias}.slug, 'name', ${alias}.name, 'isDemo', ${alias}.is_demo, 'tableLocation', ${alias}.table_location)`,
  );
  return tx<SummaryRow[]>`
    select
      r.id, r.title, r.description, r.tags, r.tried, r.status, r.reopen_count, r.created_at,
      u.display_name as posted_by,
      ${team("rt")} as requesting_team,
      case when ht.id is null then null else ${team("ht")} end as helping_team
    from help_requests r
    join teams rt on rt.id = r.requesting_team_id
    left join teams ht on ht.id = r.helping_team_id
    join users u on u.id = r.created_by
    where ${where}
    order by r.created_at desc, r.id desc
    limit 200
  `;
}

function toSummary(row: SummaryRow, viewerTeamId: string | undefined): RequestSummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    tags: row.tags,
    tried: row.tried,
    status: row.status,
    reopenCount: row.reopen_count,
    createdAt: row.created_at,
    postedBy: row.posted_by,
    requestingTeam: row.requesting_team,
    helpingTeam: row.helping_team,
    party: partyOf(viewerTeamId, { requestingTeamId: row.requesting_team.id, helpingTeamId: row.helping_team?.id ?? null }),
  };
}

export type Board = { requests: RequestSummary[]; tags: string[] };

/**
 * The board: open blockers from every team, or with `mine`, everything the viewer's team
 * posted or is helping with, in any status. `tag` matches ignoring case.
 */
export async function listRequests(tx: Tx, actor: Viewer, input: ListRequestsInput): Promise<Board> {
  const viewer = assertUser(actor);
  const teamId = viewer.team?.id;
  if (input.mine && !teamId) throw new ForbiddenError("Join your team first.");

  const scope = input.mine
    ? tx`(r.requesting_team_id = ${teamId!} or r.helping_team_id = ${teamId!})`
    : tx`r.status = 'open'`;
  const tagFilter = input.tag
    ? tx`and exists (select 1 from unnest(r.tags) t where lower(t) = lower(${input.tag}))`
    : tx``;
  const rows = await selectSummaries(tx, tx`${scope} ${tagFilter}`);

  // Tags to filter by: those on the same set of requests, before the tag filter.
  const tagRows = await tx<{ tag: string }[]>`
    select min(t) as tag
    from help_requests r, unnest(r.tags) t
    where ${scope}
    group by lower(t)
    order by lower(t)
  `;
  return { requests: rows.map((row) => toSummary(row, teamId)), tags: tagRows.map((r) => r.tag) };
}

export type OutcomeView = {
  id: string;
  summary: string;
  evidenceKind: EvidenceKind;
  evidence: string;
  inPerson: boolean;
  submittedBy: string;
  /** The submitter's team: the helping team at the time. */
  team: { name: string; slug: string } | null;
  submittedAt: Date;
  state: "pending" | "confirmed" | "reconfirmed" | "rejected";
  decidedBy: string | null;
  decidedAt: Date | null;
};

export type RequestView = {
  request: RequestSummary;
  /** What the viewer's team can do next. Empty for organizers without a team. */
  actions: RequestAction[];
  canViewThread: boolean;
  canSendMessage: boolean;
  /** Only for viewers who can see the thread. */
  outcomes: OutcomeView[] | null;
};

/** A request's details. Anyone signed in sees the blocker; outcomes need thread access. */
export async function getRequestView(tx: Tx, actor: Viewer, requestId: string): Promise<RequestView> {
  const viewer = assertUser(actor);
  const [row] = await selectSummaries(tx, tx`r.id = ${requestId}`);
  if (!row) throw new NotFoundError("That blocker doesn't exist.");
  const request = toSummary(row, viewer.team?.id);
  const threadAccess = { requestingTeamId: request.requestingTeam.id, helpingTeamId: request.helpingTeam?.id ?? null };

  let canViewThread = true;
  try {
    assertCanViewThread(viewer, threadAccess);
  } catch {
    canViewThread = false;
  }

  const outcomes = canViewThread
    ? await tx<OutcomeView[]>`
        select
          o.id, o.helper_summary as summary, o.evidence_kind as "evidenceKind", o.evidence,
          o.in_person as "inPerson", s.display_name as "submittedBy", o.submitted_at as "submittedAt",
          case when st.id is null then null else json_build_object('name', st.name, 'slug', st.slug) end as team,
          case
            when o.confirmed_at is not null then 'confirmed'
            when o.reconfirmed_at is not null then 'reconfirmed'
            when o.rejected_at is not null then 'rejected'
            else 'pending'
          end as state,
          d.display_name as "decidedBy",
          coalesce(o.confirmed_at, o.reconfirmed_at, o.rejected_at) as "decidedAt"
        from outcomes o
        join users s on s.id = o.submitted_by
        left join team_members sm on sm.user_id = s.id
        left join teams st on st.id = sm.team_id
        left join users d on d.id = coalesce(o.confirmed_by, o.reconfirmed_by)
        where o.request_id = ${requestId}
        order by o.submitted_at, o.id
      `
    : null;

  return {
    request,
    actions: viewer.team ? availableActions(request.status, request.party) : [],
    canViewThread,
    canSendMessage: Boolean(viewer.team) && canSendMessage(request.status, request.party),
    outcomes,
  };
}

/** The thread's messages, oldest first, optionally only those after a message id (for polling). */
export async function listMessages(
  tx: Tx,
  actor: Viewer,
  requestId: string,
  afterId?: string,
): Promise<ThreadMessage[]> {
  const row = await loadRequest(tx, requestId, false);
  assertCanViewThread(actor, parties(row));
  const rows = await tx<
    { id: string; kind: MessageKind; body: string; created_at: Date; user_id: string | null; name: string | null; team: string | null }[]
  >`
    select m.id, m.kind, m.body, m.created_at, u.id as user_id, u.display_name as name, t.name as team
    from messages m
    left join users u on u.id = m.author_user_id
    left join team_members tm on tm.user_id = u.id
    left join teams t on t.id = tm.team_id
    where m.request_id = ${requestId} ${afterId ? tx`and m.id > ${afterId}` : tx``}
    order by m.id
  `;
  return rows.map((m) => ({
    id: m.id,
    kind: m.kind,
    body: m.body,
    createdAt: m.created_at,
    author: m.user_id ? { userId: m.user_id, name: m.name!, team: m.team } : null,
  }));
}
