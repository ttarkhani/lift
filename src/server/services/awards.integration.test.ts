import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { postRequestSchema, submitOutcomeSchema } from "@/domain/requests";
import type { TeamViewer } from "@/server/auth/access";
import { createSql, type Sql, type Tx } from "@/server/db/client";
import { inRollback, makeOrganizer, makeTeam, removeTeams } from "../../../test/fixtures";
import {
  getLeaderboard,
  getReceipt,
  onResolutionConfirmed,
  recomputePair,
  restoreAward,
  reverseAward,
  verifyLedger,
} from "./awards";
import { acceptRequest, confirmOutcome, postRequest, reopenRequest, submitOutcome } from "./requests";

const blocker = postRequestSchema.parse({
  title: "API times out behind the venue proxy",
  description: "Requests hang for 30 seconds, then fail.",
  tags: "APIs",
  tried: "Raised the client timeout.",
});
const outcome = submitOutcomeSchema.parse({
  summary: "Moved the API call to the server so it skips the proxy.",
  evidenceKind: "link",
  evidence: "https://github.com/example/app/pull/12",
});

describe.skipIf(!process.env.TEST_DATABASE_URL)("award services", () => {
  let sql: Sql;

  beforeAll(() => {
    sql = createSql(process.env.TEST_DATABASE_URL!, { max: 4 });
  });

  afterAll(async () => {
    await sql?.end();
  });

  /** `requester` posts a blocker, `helper` fixes it, and `requester` confirms. */
  async function resolve(tx: Tx, helper: TeamViewer, requester: TeamViewer) {
    const { id } = await postRequest(tx, requester, blocker);
    await acceptRequest(tx, helper, id);
    await submitOutcome(tx, helper, id, outcome);
    const confirmed = await confirmOutcome(tx, requester, id);
    return { requestId: id, award: confirmed.award! };
  }

  async function pointsOf(tx: Tx, awardIds: string[]): Promise<number[]> {
    const rows = await tx<{ id: string; points: number }[]>`select id, points from awards where id in ${tx(awardIds)}`;
    return awardIds.map((id) => rows.find((row) => row.id === id)!.points);
  }

  async function ledger(tx: Tx, awardId: string) {
    return tx<{ delta: number; points_after: number; reason: string; organizer_action_id: string | null }[]>`
      select delta, points_after, reason, organizer_action_id from points_ledger where award_id = ${awardId} order by id
    `;
  }

  async function expectLedgerBalanced(tx: Tx) {
    const check = await verifyLedger(tx);
    expect(check.problems).toEqual([]);
  }

  function boardPoints(entries: Awaited<ReturnType<typeof getLeaderboard>>, team: TeamViewer): number | undefined {
    return entries.find((entry) => entry.team.id === team.team.id)?.points;
  }

  it("A helps B, B, C, then B: 20, 5, 20, 0 for 45", async () => {
    await inRollback(sql, async (tx) => {
      const a = await makeTeam(tx, "Maple");
      const b = await makeTeam(tx, "Aurora");
      const c = await makeTeam(tx, "Orbit");

      const awards = [
        await resolve(tx, a, b),
        await resolve(tx, a, b),
        await resolve(tx, a, c),
        await resolve(tx, a, b),
      ].map((r) => r.award);

      expect(awards.map((award) => award.points)).toEqual([20, 5, 20, 0]);
      expect(awards.map((award) => award.pairSequence)).toEqual([1, 2, 1, 3]);
      expect(awards[3].explanation).toBe(
        `3rd confirmed resolution between ${a.team.name} and ${b.team.name}: 0 points, still recorded.`,
      );
      expect(boardPoints(await getLeaderboard(tx), a)).toBe(45);
      await expectLedgerBalanced(tx);
    });
  });

  it("A helps B, then B helps A: A gets 20 and B gets 5", async () => {
    await inRollback(sql, async (tx) => {
      const a = await makeTeam(tx, "Maple");
      const b = await makeTeam(tx, "Aurora");

      const first = await resolve(tx, a, b);
      const second = await resolve(tx, b, a);

      expect(first.award.points).toBe(20);
      expect(second.award).toMatchObject({ points: 5, pairSequence: 2 });
      expect(second.award.explanation).toBe(`2nd confirmed resolution between ${b.team.name} and ${a.team.name}: 5 points.`);
      const board = await getLeaderboard(tx);
      expect([boardPoints(board, a), boardPoints(board, b)]).toEqual([20, 5]);
      await expectLedgerBalanced(tx);
    });
  });

  it("doesn't reset A–B when A helps C in between", async () => {
    await inRollback(sql, async (tx) => {
      const a = await makeTeam(tx, "Maple");
      const b = await makeTeam(tx, "Aurora");
      const c = await makeTeam(tx, "Orbit");

      const points = [];
      for (const recipient of [b, c, b, c, b]) points.push((await resolve(tx, a, recipient)).award.points);

      expect(points).toEqual([20, 20, 5, 5, 0]);
      await expectLedgerBalanced(tx);
    });
  });

  it("promotes the second award when the first is reversed, and moves it back on restore, with every change in the ledger", async () => {
    await inRollback(sql, async (tx) => {
      const a = await makeTeam(tx, "Maple");
      const b = await makeTeam(tx, "Aurora");
      const organizer = await makeOrganizer(tx);
      const first = (await resolve(tx, a, b)).award;
      const second = (await resolve(tx, a, b)).award;

      const reversed = await reverseAward(tx, organizer, first.id, { reason: "Same fix submitted twice" });
      expect(reversed).toMatchObject({
        status: "reversed",
        points: 0,
        pairSequence: null,
        explanation: "Reversed by an organizer: Same fix submitted twice.",
      });
      expect(await pointsOf(tx, [first.id, second.id])).toEqual([0, 20]);
      expect(boardPoints(await getLeaderboard(tx), a)).toBe(20);

      const restored = await restoreAward(tx, organizer, first.id, { reason: "Checked with both teams: separate bugs" });
      expect(restored).toMatchObject({ status: "awarded", points: 20, pairSequence: 1 });
      expect(await pointsOf(tx, [first.id, second.id])).toEqual([20, 5]);

      const actions = await tx<{ id: string; action: string; reason: string }[]>`
        select id, action, reason from organizer_actions where target_type = 'award' and target_id = ${first.id} order by id
      `;
      expect(actions.map((row) => [row.action, row.reason])).toEqual([
        ["reverse_award", "Same fix submitted twice"],
        ["restore_award", "Checked with both teams: separate bugs"],
      ]);
      const [reverseId, restoreId] = actions.map((row) => row.id);

      expect(await ledger(tx, first.id)).toEqual([
        { delta: 20, points_after: 20, reason: "awarded", organizer_action_id: null },
        { delta: -20, points_after: 0, reason: "reversed", organizer_action_id: reverseId },
        { delta: 20, points_after: 20, reason: "restored", organizer_action_id: restoreId },
      ]);
      expect(await ledger(tx, second.id)).toEqual([
        { delta: 5, points_after: 5, reason: "awarded", organizer_action_id: null },
        { delta: 15, points_after: 20, reason: "resequenced", organizer_action_id: reverseId },
        { delta: -15, points_after: 5, reason: "resequenced", organizer_action_id: restoreId },
      ]);

      const events = await tx<{ reason: string }[]>`
        select payload->>'reason' as reason from activity_events
        where event_type = 'award_changed' and team_id = ${a.team.id}
        order by payload->>'awardId', (payload->>'pointsAfter')::int
      `;
      expect(events).toHaveLength(6);
      await expectLedgerBalanced(tx);
    });
  });

  it("lets only organizers reverse or restore, once each", async () => {
    await inRollback(sql, async (tx) => {
      const a = await makeTeam(tx, "Maple");
      const b = await makeTeam(tx, "Aurora");
      const organizer = await makeOrganizer(tx);
      const { award } = await resolve(tx, a, b);

      await expect(reverseAward(tx, b, award.id, { reason: "We changed our minds" })).rejects.toMatchObject({ status: 403 });
      await expect(restoreAward(tx, organizer, award.id, { reason: "Nothing to restore" })).rejects.toMatchObject({ status: 409 });
      await reverseAward(tx, organizer, award.id, { reason: "Duplicate" });
      await expect(reverseAward(tx, organizer, award.id, { reason: "Duplicate" })).rejects.toMatchObject({ status: 409 });
      await expect(reverseAward(tx, organizer, "999999999", { reason: "Missing" })).rejects.toMatchObject({ status: 404 });
      await expectLedgerBalanced(tx);
    });
  });

  it("creates one award however often a request is confirmed", async () => {
    await inRollback(sql, async (tx) => {
      const a = await makeTeam(tx, "Maple");
      const b = await makeTeam(tx, "Aurora");
      const { requestId, award } = await resolve(tx, a, b);

      await expect(confirmOutcome(tx, b, requestId)).rejects.toMatchObject({ status: 409 });
      const [confirmed] = await tx<{ id: string; confirmed_at: Date }[]>`
        select id, confirmed_at from outcomes where request_id = ${requestId} and confirmed_at is not null
      `;
      const again = await onResolutionConfirmed(tx, {
        requestId,
        requestingTeamId: b.team.id,
        helpingTeamId: a.team.id,
        outcomeId: confirmed.id,
        confirmedBy: b.userId,
        confirmedAt: confirmed.confirmed_at,
      });
      expect(again).toBeNull();

      // Reopened, helped, and confirmed again: still one award, unchanged.
      await reopenRequest(tx, b, requestId);
      await acceptRequest(tx, a, requestId);
      await submitOutcome(tx, a, requestId, outcome);
      const reconfirmed = await confirmOutcome(tx, b, requestId);
      expect(reconfirmed).toMatchObject({ reconfirmed: true, award: null });

      const awards = await tx<{ id: string; points: number }[]>`select id, points from awards where request_id = ${requestId}`;
      expect(awards).toEqual([{ id: award.id, points: 20 }]);
      expect(await ledger(tx, award.id)).toHaveLength(1);
      await expectLedgerBalanced(tx);
    });
  });

  it("sequences two confirmations for the same pair at the same moment as 20, then 5", async () => {
    // Needs two real transactions, so this data is committed and removed afterwards.
    const teams: TeamViewer[] = [];
    try {
      const a = await makeTeam(sql, "Maple");
      const b = await makeTeam(sql, "Aurora");
      teams.push(a, b);
      const requestIds = await sql.begin(async (tx) => {
        const ids = [];
        for (let i = 0; i < 2; i++) {
          const { id } = await postRequest(tx, b, blocker);
          await acceptRequest(tx, a, id);
          await submitOutcome(tx, a, id, outcome);
          ids.push(id);
        }
        return ids;
      });

      // Hold both confirmations at the award insert, then let them go together, so their
      // recomputes really overlap. Without the pair lock, each would see only its own award.
      const gate = await sql.reserve();
      let confirms: Promise<unknown>[] = [];
      try {
        await gate`begin`;
        await gate`lock table awards in share mode`;
        confirms = requestIds.map((id) => sql.begin((tx) => confirmOutcome(tx, b, id)));
        for (let waiting = 0; waiting < 2; ) {
          await new Promise((resolve) => setTimeout(resolve, 10));
          [{ waiting }] = await sql<{ waiting: number }[]>`
            select count(*)::int as waiting from pg_locks where relation = 'awards'::regclass and not granted
          `;
        }
      } finally {
        await gate`commit`;
        gate.release();
      }
      await Promise.all(confirms);

      const awards = await sql<{ id: string; points: number; pair_sequence: number }[]>`
        select id, points, pair_sequence from awards where request_id in ${sql(requestIds)} order by confirmed_at, id
      `;
      expect(awards.map((award) => [award.pair_sequence, award.points])).toEqual([
        [1, 20],
        [2, 5],
      ]);
      await sql.begin((tx) => expectLedgerBalanced(tx));
    } finally {
      await removeTeams(sql, teams);
    }
  });

  it("breaks leaderboard ties by distinct teams helped, then by who got there first, and hides demo teams", async () => {
    await inRollback(sql, async (tx) => {
      const [x, y, z, p, q, s] = await Promise.all(
        ["Xenon", "Yarrow", "Zinnia", "Pine", "Quill", "Sage"].map((label) => makeTeam(tx, label)),
      );
      // Q helps X first, so X helping Q is the pair's 2nd resolution.
      await resolve(tx, q, x);
      await resolve(tx, x, p); // X: 20
      await resolve(tx, x, q); // X: 25, 2 teams helped
      await resolve(tx, y, s); // Y: 20
      await resolve(tx, y, s); // Y: 25, 1 team helped
      await resolve(tx, z, p); // Z: 20, 1 team helped

      // Everything in one transaction shares a timestamp; give Q's and Z's fixes distinct ones.
      await tx`update awards set confirmed_at = confirmed_at - interval '1 hour' where helping_team_id = ${z.team.id}`;

      const mine = (entries: Awaited<ReturnType<typeof getLeaderboard>>) =>
        entries.filter((e) => [x, y, z, q].some((t) => t.team.id === e.team.id)).map((e) => [e.team.id, e.points]);
      expect(mine(await getLeaderboard(tx))).toEqual([
        [x.team.id, 25],
        [y.team.id, 25],
        [z.team.id, 20],
        [q.team.id, 20],
      ]);

      await tx`update teams set is_demo = true where id = ${x.team.id}`;
      expect(mine(await getLeaderboard(tx)).map(([id]) => id)).not.toContain(x.team.id);
      expect(mine(await getLeaderboard(tx, { includeDemo: true })).map(([id]) => id)).toContain(x.team.id);
    });
  });

  it("builds a receipt with explanations, agreed summaries, and links", async () => {
    await inRollback(sql, async (tx) => {
      const a = await makeTeam(tx, "Maple");
      const b = await makeTeam(tx, "Aurora");
      const organizer = await makeOrganizer(tx);
      const first = await resolve(tx, a, b);
      const second = await resolve(tx, a, b);
      await reverseAward(tx, organizer, second.award.id, { reason: "Duplicate" });

      const receipt = await getReceipt(tx, a.team.slug);
      expect(receipt.team).toMatchObject({ slug: a.team.slug, name: a.team.name });
      expect(receipt.total).toBe(20);
      expect(receipt.lines).toHaveLength(2);
      expect(receipt.lines[0]).toMatchObject({
        requestId: first.requestId,
        requestTitle: blocker.title,
        helpedTeam: { slug: b.team.slug, name: b.team.name },
        points: 20,
        status: "awarded",
        summary: outcome.summary,
        confirmedBy: "Aurora member",
        links: { request: `/requests/${first.requestId}`, evidence: outcome.evidence },
      });
      expect(receipt.lines[0].links.outcome).toMatch(new RegExp(`^/requests/${first.requestId}#outcome-\\d+$`));
      expect(receipt.lines[1]).toMatchObject({ status: "reversed", points: 0, explanation: "Reversed by an organizer: Duplicate." });

      const received = await getReceipt(tx, b.team.slug);
      expect(received.lines).toEqual([]);
      expect(received.helpReceived.map((h) => h.requestId)).toEqual([second.requestId, first.requestId]);

      await expect(getReceipt(tx, "no-such-team")).rejects.toMatchObject({ status: 404 });
    });
  });

  it("changes nothing when a pair is recomputed without news", async () => {
    await inRollback(sql, async (tx) => {
      const a = await makeTeam(tx, "Maple");
      const b = await makeTeam(tx, "Aurora");
      await resolve(tx, a, b);
      expect(await recomputePair(tx, b.team.id, a.team.id)).toEqual([]);
    });
  });

  it("keeps the ledger append-only", async () => {
    await inRollback(sql, async (tx) => {
      const a = await makeTeam(tx, "Maple");
      const b = await makeTeam(tx, "Aurora");
      const { award } = await resolve(tx, a, b);
      await tx`savepoint before_update`;
      await expect(tx`update points_ledger set delta = 100 where award_id = ${award.id}`).rejects.toThrow(/append-only/);
      await tx`rollback to savepoint before_update`;
      await expect(tx`delete from points_ledger where award_id = ${award.id}`).rejects.toThrow(/append-only/);
    });
  });

  it("reports awards whose points don't match the ledger", async () => {
    await inRollback(sql, async (tx) => {
      const a = await makeTeam(tx, "Maple");
      const b = await makeTeam(tx, "Aurora");
      const { award } = await resolve(tx, a, b);
      await tx`update awards set points = 99 where id = ${award.id}`;
      const check = await verifyLedger(tx);
      expect(check.problems).toContain(`Award ${award.id} has 99 points, but its ledger adds up to 20.`);
      expect(check.problems.some((p) => p.startsWith(`Team ${a.team.name} has 99 points`))).toBe(true);
    });
  });
});
