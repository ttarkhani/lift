import {
  orderPair,
  pairKey,
  sequencePair,
  type AwardDecisionInput,
  type AwardStatus,
  type PairAward,
} from "@/domain/scoring";
import type { EvidenceKind } from "@/domain/types";
import { assertOrganizer } from "@/server/auth/access";
import type { Viewer } from "@/server/auth/viewer";
import type postgres from "postgres";
import type { Tx } from "@/server/db/client";
import { ConflictError, NotFoundError } from "@/server/errors";
import { emitActivity } from "@/server/events";
import { recordOrganizerAction } from "./organizer-actions";

// Awards and the points ledger. recomputePair is the only code that writes awards.points or
// awards.pair_sequence: everything else changes an award's status and then recomputes its pair.

export type LedgerReason = "awarded" | "resequenced" | "reversed" | "restored";

type TeamRef = { slug: string; name: string };

export type AwardView = {
  id: string;
  requestId: string;
  helpingTeam: TeamRef;
  recipientTeam: TeamRef;
  points: number;
  /** Null while reversed. */
  pairSequence: number | null;
  status: AwardStatus;
  explanation: string;
  confirmedAt: Date;
};

type AwardViewRow = {
  id: string;
  request_id: string;
  helping_team: TeamRef;
  recipient_team: TeamRef;
  points: number;
  pair_sequence: number | null;
  status: AwardStatus;
  explanation: string;
  confirmed_at: Date;
};

async function selectAwardViews(tx: Tx, where: postgres.Fragment): Promise<AwardView[]> {
  const rows = await tx<AwardViewRow[]>`
    select
      a.id, a.request_id, a.points, a.pair_sequence, a.status, a.explanation, a.confirmed_at,
      json_build_object('slug', ht.slug, 'name', ht.name) as helping_team,
      json_build_object('slug', rt.slug, 'name', rt.name) as recipient_team
    from awards a
    join teams ht on ht.id = a.helping_team_id
    join teams rt on rt.id = a.recipient_team_id
    where ${where}
  `;
  return rows.map((row) => ({
    id: row.id,
    requestId: row.request_id,
    helpingTeam: row.helping_team,
    recipientTeam: row.recipient_team,
    points: row.points,
    pairSequence: row.pair_sequence,
    status: row.status,
    explanation: row.explanation,
    confirmedAt: row.confirmed_at,
  }));
}

/** A request's award, if its fix has been confirmed. */
export async function getAwardForRequest(tx: Tx, requestId: string): Promise<AwardView | null> {
  const [award] = await selectAwardViews(tx, tx`a.request_id = ${requestId}`);
  return award ?? null;
}

async function getAward(tx: Tx, awardId: string): Promise<AwardView> {
  const [award] = await selectAwardViews(tx, tx`a.id = ${awardId}`);
  if (!award) throw new NotFoundError("That award doesn't exist.");
  return award;
}

/**
 * Serializes every scoring change for one pair of teams until the transaction ends. Taking it
 * again in the same transaction is fine: advisory locks stack.
 */
async function lockPair(tx: Tx, teamA: string, teamB: string): Promise<void> {
  await tx`select pg_advisory_xact_lock(hashtextextended(${`awards:${pairKey(teamA, teamB)}`}::text, 0))`;
}

export type RecomputeOptions = {
  /** Who caused the change, for the activity event. */
  actorUserId?: string | null;
  /** The organizer decision behind the change, recorded on each ledger row. */
  organizerActionId?: string | null;
};

export type AwardChange = {
  awardId: string;
  reason: LedgerReason;
  delta: number;
  pointsAfter: number;
  pairSequence: number | null;
};

type PairRow = {
  id: string;
  request_id: string;
  helping_team_id: string;
  recipient_team_id: string;
  helper_name: string;
  recipient_name: string;
  confirmed_at: Date;
  status: AwardStatus;
  reversal_reason: string | null;
  pair_sequence: number | null;
  points: number;
  explanation: string;
  has_ledger: boolean;
};

function ledgerReason(row: PairRow): LedgerReason {
  if (row.status === "reversed") return "reversed";
  if (row.pair_sequence === null) return row.has_ledger ? "restored" : "awarded";
  return "resequenced";
}

/**
 * Re-sequences every award between two teams under a per-pair advisory lock. Updates only the
 * awards whose points, sequence, or explanation changed, and appends a ledger row and an
 * award_changed event for each change in points or sequence. The only writer of award points.
 */
export async function recomputePair(
  tx: Tx,
  teamA: string,
  teamB: string,
  options: RecomputeOptions = {},
): Promise<AwardChange[]> {
  const [low, high] = orderPair(teamA, teamB);
  await lockPair(tx, low, high);

  // Read after taking the lock, so awards committed by the pair's previous holder are included.
  const rows = await tx<PairRow[]>`
    select
      a.id, a.request_id, a.helping_team_id, a.recipient_team_id, a.confirmed_at, a.status,
      a.reversal_reason, a.pair_sequence, a.points, a.explanation,
      ht.name as helper_name, rt.name as recipient_name,
      exists (select 1 from points_ledger l where l.award_id = a.id) as has_ledger
    from awards a
    join teams ht on ht.id = a.helping_team_id
    join teams rt on rt.id = a.recipient_team_id
    where a.team_low_id = ${low} and a.team_high_id = ${high}
    order by a.confirmed_at, a.id
    for update of a
  `;
  const current = new Map(rows.map((row) => [row.id, row]));
  const sequenced = sequencePair(
    rows.map(
      (row): PairAward => ({
        id: row.id,
        helpingTeamId: row.helping_team_id,
        recipientTeamId: row.recipient_team_id,
        helperName: row.helper_name,
        recipientName: row.recipient_name,
        confirmedAt: row.confirmed_at,
        status: row.status,
        reversalReason: row.reversal_reason,
      }),
    ),
  );

  const changes: AwardChange[] = [];
  for (const next of sequenced) {
    const row = current.get(next.id)!;
    const moved = row.points !== next.points || row.pair_sequence !== next.pairSequence;
    if (!moved && row.explanation === next.explanation) continue;

    await tx`
      update awards
      set points = ${next.points}, pair_sequence = ${next.pairSequence}, explanation = ${next.explanation},
          updated_at = now()
      where id = ${row.id}
    `;
    if (!moved) continue;

    const change: AwardChange = {
      awardId: row.id,
      reason: ledgerReason(row),
      delta: next.points - row.points,
      pointsAfter: next.points,
      pairSequence: next.pairSequence,
    };
    await tx`
      insert into points_ledger (award_id, team_id, delta, points_after, reason, organizer_action_id)
      values (
        ${row.id}, ${row.helping_team_id}, ${change.delta}, ${change.pointsAfter}, ${change.reason},
        ${options.organizerActionId ?? null}
      )
    `;
    await emitActivity(tx, {
      type: "award_changed",
      teamId: row.helping_team_id,
      counterpartTeamId: row.recipient_team_id,
      requestId: row.request_id,
      actorUserId: options.actorUserId ?? null,
      payload: {
        awardId: row.id,
        reason: change.reason,
        delta: change.delta,
        pointsAfter: change.pointsAfter,
        pairSequence: change.pairSequence,
      },
    });
    changes.push(change);
  }
  return changes;
}

export type ConfirmedResolution = {
  requestId: string;
  requestingTeamId: string;
  helpingTeamId: string;
  outcomeId: string;
  /** The requesting-team member who confirmed. */
  confirmedBy: string;
  confirmedAt: Date;
};

/**
 * Runs in confirmOutcome's transaction, once per request: a reconfirmation after a reopen
 * never calls it. Creates the request's one award with 0 points, then lets recomputePair
 * set its points. Returns null if the request already has an award.
 */
export async function onResolutionConfirmed(tx: Tx, resolution: ConfirmedResolution): Promise<AwardView | null> {
  const [low, high] = orderPair(resolution.helpingTeamId, resolution.requestingTeamId);
  const [inserted] = await tx<{ id: string }[]>`
    insert into awards (
      request_id, outcome_id, helping_team_id, recipient_team_id, team_low_id, team_high_id, confirmed_at
    )
    values (
      ${resolution.requestId}, ${resolution.outcomeId}, ${resolution.helpingTeamId},
      ${resolution.requestingTeamId}, ${low}, ${high}, ${resolution.confirmedAt}
    )
    on conflict (request_id) do nothing
    returning id
  `;
  if (!inserted) return null;
  await recomputePair(tx, low, high, { actorUserId: resolution.confirmedBy });
  return getAward(tx, inserted.id);
}

/** Finds an award and takes its pair's lock before locking the row, the same order recomputePair uses. */
async function lockAward(tx: Tx, awardId: string) {
  const [teams] = await tx<{ helping_team_id: string; recipient_team_id: string }[]>`
    select helping_team_id, recipient_team_id from awards where id = ${awardId}
  `;
  if (!teams) throw new NotFoundError("That award doesn't exist.");
  await lockPair(tx, teams.helping_team_id, teams.recipient_team_id);
  const [row] = await tx<{ status: AwardStatus }[]>`select status from awards where id = ${awardId} for update`;
  return { ...teams, status: row.status };
}

/** Organizers only. The award stops counting and the pair's later awards move up. */
export async function reverseAward(
  tx: Tx,
  actor: Viewer,
  awardId: string,
  input: AwardDecisionInput,
): Promise<AwardView> {
  const organizer = assertOrganizer(actor);
  const award = await lockAward(tx, awardId);
  if (award.status === "reversed") throw new ConflictError("This award is already reversed.");

  const actionId = await recordOrganizerAction(tx, {
    organizerUserId: organizer.userId,
    action: "reverse_award",
    targetType: "award",
    targetId: awardId,
    reason: input.reason,
  });
  await tx`
    update awards set status = 'reversed', reversal_reason = ${input.reason}, updated_at = now() where id = ${awardId}
  `;
  await recomputePair(tx, award.helping_team_id, award.recipient_team_id, {
    actorUserId: organizer.userId,
    organizerActionId: actionId,
  });
  return getAward(tx, awardId);
}

/** Organizers only. A reversed award counts again, in its original place in the pair's order. */
export async function restoreAward(
  tx: Tx,
  actor: Viewer,
  awardId: string,
  input: AwardDecisionInput,
): Promise<AwardView> {
  const organizer = assertOrganizer(actor);
  const award = await lockAward(tx, awardId);
  if (award.status !== "reversed") throw new ConflictError("Only a reversed award can be restored.");

  const actionId = await recordOrganizerAction(tx, {
    organizerUserId: organizer.userId,
    action: "restore_award",
    targetType: "award",
    targetId: awardId,
    reason: input.reason,
  });
  await tx`
    update awards set status = 'awarded', reversal_reason = null, updated_at = now() where id = ${awardId}
  `;
  await recomputePair(tx, award.helping_team_id, award.recipient_team_id, {
    actorUserId: organizer.userId,
    organizerActionId: actionId,
  });
  return getAward(tx, awardId);
}

// Reads. Both are public: they show points and agreed summaries, never threads.

export type LeaderboardTeam = { id: string; slug: string; name: string; isDemo: boolean };

export type LeaderboardEntry = {
  rank: number;
  team: LeaderboardTeam;
  points: number;
  /** Distinct teams helped with awards that still count. */
  teamsHelped: number;
  /** Awards that still count, including those worth 0. */
  resolutions: number;
  /** When the team reached its current score: its last confirmation that earned points. */
  reachedAt: Date | null;
};

/**
 * Teams with at least one award that counts, from awards only. Ties go to more distinct teams
 * helped, then to whoever reached the score first. Demo teams are left out unless asked for.
 */
export async function getLeaderboard(tx: Tx, { includeDemo = false }: { includeDemo?: boolean } = {}): Promise<LeaderboardEntry[]> {
  const rows = await tx<
    { id: string; slug: string; name: string; is_demo: boolean; points: number; teams_helped: number; resolutions: number; reached_at: Date | null }[]
  >`
    select
      t.id, t.slug, t.name, t.is_demo,
      sum(a.points)::int as points,
      count(distinct a.recipient_team_id)::int as teams_helped,
      count(*)::int as resolutions,
      max(a.confirmed_at) filter (where a.points > 0) as reached_at
    from awards a
    join teams t on t.id = a.helping_team_id
    where a.status = 'awarded' ${includeDemo ? tx`` : tx`and not t.is_demo`}
    group by t.id
    order by points desc, teams_helped desc, reached_at asc nulls last, t.name
  `;
  return rows.map((row, i) => ({
    rank: i + 1,
    team: { id: row.id, slug: row.slug, name: row.name, isDemo: row.is_demo },
    points: row.points,
    teamsHelped: row.teams_helped,
    resolutions: row.resolutions,
    reachedAt: row.reached_at,
  }));
}

export type ReceiptLine = {
  awardId: string;
  requestId: string;
  requestTitle: string;
  helpedTeam: TeamRef;
  points: number;
  pairSequence: number | null;
  status: AwardStatus;
  explanation: string;
  /** The helping team's summary of the fix, which the requesting team confirmed. */
  summary: string;
  inPerson: boolean;
  confirmedBy: string | null;
  confirmedAt: Date;
  links: {
    request: string;
    outcome: string;
    confirmation: string;
    /** The evidence URL for link evidence, otherwise the outcome, where the evidence is shown. */
    evidence: string;
  };
};

export type HelpReceived = {
  awardId: string;
  requestId: string;
  requestTitle: string;
  helpingTeam: TeamRef;
  points: number;
  status: AwardStatus;
  confirmedAt: Date;
};

export type Receipt = {
  team: TeamRef & { isDemo: boolean; tableLocation: string | null };
  /** Points from awards that still count. */
  total: number;
  /** Awards the team earned, in confirmation order. */
  lines: ReceiptLine[];
  /** Help the team received, newest first. */
  helpReceived: HelpReceived[];
};

const LINK_EVIDENCE: EvidenceKind[] = ["link", "screenshot_link"];

/** A team's contribution receipt. 404 for an unknown slug. */
export async function getReceipt(tx: Tx, teamSlug: string): Promise<Receipt> {
  const [team] = await tx<{ id: string; slug: string; name: string; is_demo: boolean; table_location: string | null }[]>`
    select id, slug, name, is_demo, table_location from teams where slug = ${teamSlug}
  `;
  if (!team) throw new NotFoundError("That team doesn't exist.");

  const rows = await tx<
    {
      id: string;
      request_id: string;
      title: string;
      helped_slug: string;
      helped_name: string;
      points: number;
      pair_sequence: number | null;
      status: AwardStatus;
      explanation: string;
      confirmed_at: Date;
      outcome_id: string;
      helper_summary: string;
      evidence_kind: EvidenceKind;
      evidence: string;
      in_person: boolean;
      confirmed_by: string | null;
    }[]
  >`
    select
      a.id, a.request_id, r.title, rt.slug as helped_slug, rt.name as helped_name, a.points,
      a.pair_sequence, a.status, a.explanation, a.confirmed_at,
      o.id as outcome_id, o.helper_summary, o.evidence_kind, o.evidence, o.in_person,
      cu.display_name as confirmed_by
    from awards a
    join help_requests r on r.id = a.request_id
    join teams rt on rt.id = a.recipient_team_id
    join outcomes o on o.id = a.outcome_id
    left join users cu on cu.id = o.confirmed_by
    where a.helping_team_id = ${team.id}
    order by a.confirmed_at, a.id
  `;
  const lines = rows.map((row): ReceiptLine => {
    const request = `/requests/${row.request_id}`;
    const outcome = `${request}#outcome-${row.outcome_id}`;
    return {
      awardId: row.id,
      requestId: row.request_id,
      requestTitle: row.title,
      helpedTeam: { slug: row.helped_slug, name: row.helped_name },
      points: row.points,
      pairSequence: row.pair_sequence,
      status: row.status,
      explanation: row.explanation,
      summary: row.helper_summary,
      inPerson: row.in_person,
      confirmedBy: row.confirmed_by,
      confirmedAt: row.confirmed_at,
      links: {
        request,
        outcome,
        confirmation: `${request}#confirmation-${row.outcome_id}`,
        evidence: LINK_EVIDENCE.includes(row.evidence_kind) ? row.evidence : outcome,
      },
    };
  });

  const helpReceived = await tx<HelpReceived[]>`
    select
      a.id as "awardId", a.request_id as "requestId", r.title as "requestTitle", a.points, a.status,
      a.confirmed_at as "confirmedAt",
      json_build_object('slug', ht.slug, 'name', ht.name) as "helpingTeam"
    from awards a
    join help_requests r on r.id = a.request_id
    join teams ht on ht.id = a.helping_team_id
    where a.recipient_team_id = ${team.id}
    order by a.confirmed_at desc, a.id desc
  `;

  return {
    team: { slug: team.slug, name: team.name, isDemo: team.is_demo, tableLocation: team.table_location },
    total: lines.reduce((sum, line) => sum + (line.status === "awarded" ? line.points : 0), 0),
    lines,
    helpReceived: [...helpReceived],
  };
}

export type LedgerCheck = { awards: number; teams: number; problems: string[] };

/**
 * Checks the ledger against awards: each award's deltas add up to its points and end on them,
 * belong to its helping team, and each team's ledger total matches its leaderboard points.
 */
export async function verifyLedger(tx: Tx): Promise<LedgerCheck> {
  const problems: string[] = [];

  const awards = await tx<
    { id: string; points: number; rows: number; ledger_points: number; last_after: number | null; other_team: boolean }[]
  >`
    select
      a.id, a.points,
      count(l.id)::int as rows,
      coalesce(sum(l.delta), 0)::int as ledger_points,
      (select l2.points_after from points_ledger l2 where l2.award_id = a.id order by l2.id desc limit 1) as last_after,
      coalesce(bool_or(l.team_id <> a.helping_team_id), false) as other_team
    from awards a
    left join points_ledger l on l.award_id = a.id
    group by a.id
    order by a.id
  `;
  for (const award of awards) {
    if (award.rows === 0) problems.push(`Award ${award.id} has no ledger rows.`);
    if (award.ledger_points !== award.points) {
      problems.push(`Award ${award.id} has ${award.points} points, but its ledger adds up to ${award.ledger_points}.`);
    }
    if (award.rows > 0 && award.last_after !== award.points) {
      problems.push(`Award ${award.id} has ${award.points} points, but its last ledger row says ${award.last_after}.`);
    }
    if (award.other_team) problems.push(`Award ${award.id} has ledger rows for a team other than its helper.`);
  }

  const ledgerTotals = await tx<{ team_id: string; name: string; total: number }[]>`
    select l.team_id, t.name, sum(l.delta)::int as total
    from points_ledger l join teams t on t.id = l.team_id
    group by l.team_id, t.name
  `;
  const board = new Map((await getLeaderboard(tx, { includeDemo: true })).map((entry) => [entry.team.id, entry]));
  const teamIds = new Set([...board.keys(), ...ledgerTotals.map((row) => row.team_id)]);
  for (const teamId of teamIds) {
    const ledger = ledgerTotals.find((row) => row.team_id === teamId);
    const entry = board.get(teamId);
    const ledgerPoints = ledger?.total ?? 0;
    const boardPoints = entry?.points ?? 0;
    if (ledgerPoints !== boardPoints) {
      const name = entry?.team.name ?? ledger?.name ?? teamId;
      problems.push(`Team ${name} has ${boardPoints} points on the leaderboard, but ${ledgerPoints} in the ledger.`);
    }
  }

  return { awards: awards.length, teams: teamIds.size, problems };
}
