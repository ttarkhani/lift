import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { postRequestSchema, submitOutcomeSchema } from "@/domain/requests";
import type { TeamViewer } from "@/server/auth/access";
import { createSql, type Sql, type Tx } from "@/server/db/client";
import { inRollback, makeOrganizer, makeTeam, removeTeams } from "../../../test/fixtures";
import {
  acceptRequest,
  cancelRequest,
  confirmOutcome,
  getRequestView,
  listMessages,
  listRequests,
  postRequest,
  rejectOutcome,
  releaseRequest,
  reopenRequest,
  sendMessage,
  submitOutcome,
} from "./requests";

const onResolutionConfirmed = vi.fn();
vi.mock("./awards", () => ({ onResolutionConfirmed: (...args: unknown[]) => onResolutionConfirmed(...args) }));

const blocker = postRequestSchema.parse({
  title: "Container exits on the VM",
  description: "Works locally, exits right after boot on the VM.",
  tags: "Deployment, docker",
  tried: "Rebuilt the image.",
});
const outcome = submitOutcomeSchema.parse({
  summary: "Bound the server to 0.0.0.0 instead of localhost.",
  evidenceKind: "link",
  evidence: "https://github.com/example/app/pull/7",
});

describe.skipIf(!process.env.TEST_DATABASE_URL)("request services", () => {
  let sql: Sql;

  beforeAll(() => {
    sql = createSql(process.env.TEST_DATABASE_URL!, { max: 4 });
  });

  afterAll(async () => {
    await sql?.end();
  });

  beforeEach(() => {
    onResolutionConfirmed.mockReset();
  });

  async function state(tx: Tx, requestId: string) {
    const [row] = await tx`
      select status, helping_team_id, reopen_count, accepted_at is not null as accepted, resolved_at is not null as resolved
      from help_requests where id = ${requestId}
    `;
    return row;
  }

  async function eventTypes(tx: Tx, requestId: string): Promise<string[]> {
    const rows = await tx<{ event_type: string }[]>`
      select event_type from activity_events where request_id = ${requestId} order by time, event_type
    `;
    return rows.map((r) => r.event_type);
  }

  async function confirmedCount(tx: Tx, requestId: string): Promise<number> {
    const [{ n }] = await tx<{ n: number }[]>`
      select count(*)::int as n from outcomes where request_id = ${requestId} and confirmed_at is not null
    `;
    return n;
  }

  async function systemMessages(tx: Tx, requestId: string): Promise<string[]> {
    const rows = await tx<{ body: string }[]>`
      select body from messages where request_id = ${requestId} and kind = 'system' order by id
    `;
    return rows.map((r) => r.body);
  }

  /** Maple posts a blocker, Aurora helps, and Aurora submits an outcome. */
  async function toSubmitted(tx: Tx) {
    const maple = await makeTeam(tx, "Maple");
    const aurora = await makeTeam(tx, "Aurora");
    const { id } = await postRequest(tx, maple, blocker);
    await acceptRequest(tx, aurora, id);
    await submitOutcome(tx, aurora, id, outcome);
    return { maple, aurora, id };
  }

  it("runs the happy path with one event per state change", async () => {
    await inRollback(sql, async (tx) => {
      const maple = await makeTeam(tx, "Maple");
      const aurora = await makeTeam(tx, "Aurora");

      const posted = await postRequest(tx, maple, blocker);
      expect(await state(tx, posted.id)).toMatchObject({ status: "open", helping_team_id: null });

      const accepted = await acceptRequest(tx, aurora, posted.id);
      expect(accepted).toEqual({ id: posted.id, requestingTeam: maple.team.name, helpingTeam: aurora.team.name });
      expect(await state(tx, posted.id)).toMatchObject({ status: "accepted", helping_team_id: aurora.team.id, accepted: true });

      await sendMessage(tx, aurora, posted.id, { kind: "text", body: "Which port does it listen on?" });
      await sendMessage(tx, maple, posted.id, { kind: "snippet", body: "app.listen(3000, 'localhost')" });

      await submitOutcome(tx, aurora, posted.id, outcome);
      expect(await state(tx, posted.id)).toMatchObject({ status: "outcome_submitted" });

      const confirmed = await confirmOutcome(tx, maple, posted.id);
      expect(confirmed.reconfirmed).toBe(false);
      expect(await state(tx, posted.id)).toMatchObject({ status: "resolved", resolved: true });
      expect(await confirmedCount(tx, posted.id)).toBe(1);

      expect(onResolutionConfirmed).toHaveBeenCalledOnce();
      expect(onResolutionConfirmed.mock.calls[0][1]).toMatchObject({
        requestId: posted.id,
        requestingTeamId: maple.team.id,
        helpingTeamId: aurora.team.id,
      });

      expect(await eventTypes(tx, posted.id)).toEqual([
        // All in one transaction, so they share a timestamp and sort by type.
        "message_sent",
        "message_sent",
        "outcome_submitted",
        "request_accepted",
        "request_posted",
        "resolution_confirmed",
      ]);
      const [accept] = await tx`
        select team_id, counterpart_team_id, duration_s from activity_events
        where request_id = ${posted.id} and event_type = 'request_accepted'
      `;
      expect(accept).toEqual({ team_id: aurora.team.id, counterpart_team_id: maple.team.id, duration_s: 0 });
      const [resolution] = await tx`
        select team_id, counterpart_team_id, duration_s from activity_events
        where request_id = ${posted.id} and event_type = 'resolution_confirmed'
      `;
      expect(resolution).toEqual({ team_id: maple.team.id, counterpart_team_id: aurora.team.id, duration_s: 0 });

      expect(await systemMessages(tx, posted.id)).toEqual([
        `Team ${maple.team.name} posted this blocker`,
        `Team ${aurora.team.name} is helping`,
        `Team ${aurora.team.name} submitted an outcome`,
        `Team ${maple.team.name} confirmed the fix`,
      ]);
    });
  });

  it("rejects a confirm from any team but the requesting one with 403", async () => {
    await inRollback(sql, async (tx) => {
      const { aurora, id } = await toSubmitted(tx);
      const orbit = await makeTeam(tx, "Orbit");
      const before = await eventTypes(tx, id);

      await expect(confirmOutcome(tx, aurora, id)).rejects.toMatchObject({ status: 403 });
      await expect(confirmOutcome(tx, orbit, id)).rejects.toMatchObject({ status: 403 });

      expect(await state(tx, id)).toMatchObject({ status: "outcome_submitted" });
      expect(await confirmedCount(tx, id)).toBe(0);
      expect(await eventTypes(tx, id)).toEqual(before);
      expect(onResolutionConfirmed).not.toHaveBeenCalled();
    });
  });

  it("rejects a second confirm with 409 and changes nothing", async () => {
    await inRollback(sql, async (tx) => {
      const { maple, id } = await toSubmitted(tx);
      await confirmOutcome(tx, maple, id);
      const before = { events: await eventTypes(tx, id), messages: await systemMessages(tx, id) };

      await expect(confirmOutcome(tx, maple, id)).rejects.toMatchObject({ status: 409 });

      expect(await confirmedCount(tx, id)).toBe(1);
      expect(await eventTypes(tx, id)).toEqual(before.events);
      expect(await systemMessages(tx, id)).toEqual(before.messages);
      expect(onResolutionConfirmed).toHaveBeenCalledOnce();
    });
  });

  it("stops a team from accepting its own request", async () => {
    await inRollback(sql, async (tx) => {
      const maple = await makeTeam(tx, "Maple");
      const { id } = await postRequest(tx, maple, blocker);
      await expect(acceptRequest(tx, maple, id)).rejects.toMatchObject({ status: 403 });
      expect(await state(tx, id)).toMatchObject({ status: "open" });
    });
  });

  it("lets exactly one of two teams accepting at once win", async () => {
    // Needs two real transactions, so this data is committed and removed afterwards.
    const teams: TeamViewer[] = [];
    try {
      const maple = await makeTeam(sql, "Maple");
      const aurora = await makeTeam(sql, "Aurora");
      const orbit = await makeTeam(sql, "Orbit");
      teams.push(maple, aurora, orbit);
      const { id } = await sql.begin((tx) => postRequest(tx, maple, blocker));

      const results = await Promise.allSettled([
        sql.begin((tx) => acceptRequest(tx, aurora, id)),
        sql.begin((tx) => acceptRequest(tx, orbit, id)),
      ]);

      const won = results.filter((r) => r.status === "fulfilled");
      const lost = results.filter((r) => r.status === "rejected");
      expect(won).toHaveLength(1);
      expect(lost).toHaveLength(1);
      expect((lost[0] as PromiseRejectedResult).reason).toMatchObject({ status: 409 });

      const winner = results[0].status === "fulfilled" ? aurora : orbit;
      const [row] = await sql`select status, helping_team_id from help_requests where id = ${id}`;
      expect(row).toEqual({ status: "accepted", helping_team_id: winner.team.id });
      const accepts = await sql`select team_id from activity_events where request_id = ${id} and event_type = 'request_accepted'`;
      expect(accepts).toEqual([{ team_id: winner.team.id }]);
    } finally {
      await removeTeams(sql, teams);
    }
  });

  it("reopens without a second confirmed outcome or a second award", async () => {
    await inRollback(sql, async (tx) => {
      const { maple, aurora, id } = await toSubmitted(tx);
      await confirmOutcome(tx, maple, id);

      await expect(reopenRequest(tx, aurora, id)).rejects.toMatchObject({ status: 403 });
      await reopenRequest(tx, maple, id);
      expect(await state(tx, id)).toMatchObject({ status: "open", helping_team_id: null, reopen_count: 1, resolved: false });
      expect(await confirmedCount(tx, id)).toBe(1);

      // Another team helps the second time round, and Maple confirms again.
      const orbit = await makeTeam(tx, "Orbit");
      await acceptRequest(tx, orbit, id);
      await submitOutcome(tx, orbit, id, outcome);
      const again = await confirmOutcome(tx, maple, id);

      expect(again.reconfirmed).toBe(true);
      expect(await state(tx, id)).toMatchObject({ status: "resolved", resolved: true });
      expect(await confirmedCount(tx, id)).toBe(1);
      const [{ n: reconfirmed }] = await tx`
        select count(*)::int as n from outcomes where request_id = ${id} and reconfirmed_at is not null
      `;
      expect(reconfirmed).toBe(1);
      expect(onResolutionConfirmed).toHaveBeenCalledOnce();

      const types = await eventTypes(tx, id);
      expect(types.filter((t) => t === "resolution_confirmed")).toHaveLength(1);
      expect(types.filter((t) => t === "resolution_reconfirmed")).toHaveLength(1);
      expect(types.filter((t) => t === "request_reopened")).toHaveLength(1);
    });
  });

  it("sends an outcome back with not fixed yet, then accepts a new one", async () => {
    await inRollback(sql, async (tx) => {
      const { maple, aurora, id } = await toSubmitted(tx);
      await expect(rejectOutcome(tx, aurora, id)).rejects.toMatchObject({ status: 403 });

      await rejectOutcome(tx, maple, id);
      expect(await state(tx, id)).toMatchObject({ status: "accepted", helping_team_id: aurora.team.id });
      const [first] = await tx`select rejected_at is not null as rejected from outcomes where request_id = ${id}`;
      expect(first.rejected).toBe(true);

      await submitOutcome(tx, aurora, id, { ...outcome, evidenceKind: "text", evidence: "Changed the bind address." });
      await confirmOutcome(tx, maple, id);
      expect(await confirmedCount(tx, id)).toBe(1);
      expect((await eventTypes(tx, id)).filter((t) => t === "outcome_rejected")).toHaveLength(1);
    });
  });

  it("releases and cancels only for the right team and status", async () => {
    await inRollback(sql, async (tx) => {
      const maple = await makeTeam(tx, "Maple");
      const aurora = await makeTeam(tx, "Aurora");
      const { id } = await postRequest(tx, maple, blocker);
      await acceptRequest(tx, aurora, id);

      await expect(releaseRequest(tx, maple, id)).rejects.toMatchObject({ status: 403 });
      await releaseRequest(tx, aurora, id);
      expect(await state(tx, id)).toMatchObject({ status: "open", helping_team_id: null, accepted: false });

      await expect(cancelRequest(tx, aurora, id)).rejects.toMatchObject({ status: 403 });
      await cancelRequest(tx, maple, id);
      expect(await state(tx, id)).toMatchObject({ status: "cancelled" });
      await expect(cancelRequest(tx, maple, id)).rejects.toMatchObject({ status: 409 });
      await expect(acceptRequest(tx, aurora, id)).rejects.toMatchObject({ status: 409 });

      expect(await eventTypes(tx, id)).toEqual(["request_accepted", "request_cancelled", "request_posted", "request_released"]);
    });
  });

  it("keeps the thread to the two teams and organizers", async () => {
    await inRollback(sql, async (tx) => {
      const maple = await makeTeam(tx, "Maple");
      const aurora = await makeTeam(tx, "Aurora");
      const orbit = await makeTeam(tx, "Orbit");
      const organizer = await makeOrganizer(tx);
      const { id } = await postRequest(tx, maple, blocker);

      // Nobody writes in an open request's thread, and only the requesting team reads it.
      await expect(sendMessage(tx, maple, id, { kind: "text", body: "Anyone?" })).rejects.toMatchObject({ status: 409 });
      await expect(listMessages(tx, aurora, id)).rejects.toMatchObject({ status: 403 });

      await acceptRequest(tx, aurora, id);
      const sent = await sendMessage(tx, aurora, id, { kind: "text", body: "On our way." });
      await expect(sendMessage(tx, orbit, id, { kind: "text", body: "Me too" })).rejects.toMatchObject({ status: 403 });
      await expect(listMessages(tx, orbit, id)).rejects.toMatchObject({ status: 403 });

      const forOrganizer = await listMessages(tx, organizer, id);
      expect(forOrganizer.map((m) => m.body)).toEqual([
        `Team ${maple.team.name} posted this blocker`,
        `Team ${aurora.team.name} is helping`,
        "On our way.",
      ]);
      expect(forOrganizer[2].author).toEqual({ userId: aurora.userId, name: aurora.displayName, team: aurora.team.name });
      expect(await listMessages(tx, maple, id, sent.id)).toEqual([]);

      const other = await getRequestView(tx, orbit, id);
      expect(other).toMatchObject({ canViewThread: false, outcomes: null, actions: [], canSendMessage: false });
      const helper = await getRequestView(tx, aurora, id);
      expect(helper).toMatchObject({ canViewThread: true, actions: ["release", "submit_outcome"], canSendMessage: true });
      expect((await getRequestView(tx, organizer, id)).actions).toEqual([]);
    });
  });

  it("lists open blockers, the team's own requests, and filters by tag ignoring case", async () => {
    await inRollback(sql, async (tx) => {
      const maple = await makeTeam(tx, "Maple");
      const aurora = await makeTeam(tx, "Aurora");
      const orbit = await makeTeam(tx, "Orbit");
      const mapleOpen = await postRequest(tx, maple, blocker);
      const orbitAsk = await postRequest(tx, orbit, { ...blocker, tags: ["hardware"] });
      await acceptRequest(tx, maple, orbitAsk.id);
      const auroraOpen = await postRequest(tx, aurora, { ...blocker, tags: ["design"] });

      const board = await listRequests(tx, maple, { mine: false });
      const openIds = board.requests.map((r) => r.id);
      expect(openIds).toContain(mapleOpen.id);
      expect(openIds).toContain(auroraOpen.id);
      expect(openIds).not.toContain(orbitAsk.id);

      const mine = await listRequests(tx, maple, { mine: true });
      expect(mine.requests.map((r) => [r.id, r.party])).toEqual([
        [orbitAsk.id, "helper"],
        [mapleOpen.id, "requester"],
      ]);
      expect(mine.tags).toEqual(["Deployment", "docker", "hardware"]);

      const tagged = await listRequests(tx, maple, { mine: true, tag: "DEPLOYMENT" });
      expect(tagged.requests.map((r) => r.id)).toEqual([mapleOpen.id]);
    });
  });
});
