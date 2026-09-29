import { describe, expect, it } from "vitest";
import { confirmMessage, scoreAwards, type PairAward } from "@/domain/scoring";
import {
  beforeConfirmation,
  canonicalExample,
  DEMO_REQUESTS,
  DEMO_TEAMS,
  demoHelpReceived,
  demoLeaderboard,
  demoReceiptLines,
  getDemoRequest,
  getDemoTeam,
  openDemoRequests,
  WORKED_REQUEST_ID,
} from "./fixtures";
import { SEED_REQUESTS, SEED_RESOLUTIONS, SEED_TEAMS } from "./story";

/**
 * The seed's points, worked out the way the seed produces them: Maple's four fixes are
 * confirmed in one transaction, so they share a time and are ordered by award id.
 */
function seedTotals(): Map<string, number> {
  const idOf = (slug: string) => String(SEED_TEAMS.findIndex((team) => team.slug === slug) + 1);
  const confirmedAt = new Date("2026-09-26T12:00:00Z");
  const awards: PairAward[] = SEED_RESOLUTIONS.map((resolution, i) => ({
    id: String(i + 1),
    helpingTeamId: idOf("maple"),
    recipientTeamId: idOf(resolution.team),
    helperName: "Maple",
    recipientName: resolution.team,
    confirmedAt,
    status: "awarded",
    reversalReason: null,
  }));
  const scored = scoreAwards(awards);
  const totals = new Map<string, number>();
  for (const award of awards) {
    const slug = SEED_TEAMS[Number(award.helpingTeamId) - 1].slug;
    totals.set(slug, (totals.get(slug) ?? 0) + scored.get(award.id)!.points);
  }
  return totals;
}

describe("demo points", () => {
  it("match the seed's totals, with Team Maple at 65", () => {
    const seed = seedTotals();
    expect(seed.get("maple")).toBe(65);
    const demo = new Map(demoLeaderboard().map((row) => [row.team.slug, row.points]));
    expect(demo).toEqual(seed);
  });

  it("add up on Team Maple's receipt: 20, 20, 20, then 5 for helping Aurora again", () => {
    const lines = demoReceiptLines(getDemoTeam("maple")!);
    expect(lines.map((line) => line.points)).toEqual([20, 20, 20, 5]);
    expect(lines.map((line) => line.helpedTeam)).toEqual(["Aurora", "Orbit", "Cedar", "Aurora"]);
    expect(lines[3].explanation).toBe("2nd confirmed resolution between Maple and Aurora: 5 points.");
  });

  it("score the canonical example, A helps B, B, C, then B, to 45", () => {
    const { steps, total } = canonicalExample();
    expect(steps.map((step) => step.points)).toEqual([20, 5, 20, 0]);
    expect(total).toBe(45);
  });

  it("rank the leaderboard with Team Maple first", () => {
    expect(demoLeaderboard()).toEqual([
      { rank: 1, team: { slug: "maple", name: "Maple", isDemo: true }, points: 65, teamsHelped: 3, resolutions: 4 },
    ]);
  });
});

describe("demo story", () => {
  it("has the seed's teams, tables, and members", () => {
    expect(
      DEMO_TEAMS.map((team) => ({ slug: team.slug, name: team.name, table: team.tableLocation, members: team.members })),
    ).toEqual(
      SEED_TEAMS.map((team) => ({
        slug: team.slug,
        name: team.name,
        table: team.table,
        members: team.members.map((member) => member.name),
      })),
    );
  });

  it("labels every team Demo", () => {
    expect(DEMO_TEAMS.every((team) => team.isDemo)).toBe(true);
  });

  it("has the seed's open blockers", () => {
    expect(
      openDemoRequests().map((r) => ({ team: r.requestingTeam.slug, title: r.title, description: r.description, tags: r.tags, tried: r.tried })),
    ).toEqual(SEED_REQUESTS);
  });

  it("has the seed's resolved blockers and outcomes, all fixed by Team Maple", () => {
    const resolved = DEMO_REQUESTS.filter((request) => request.status === "resolved");
    expect(
      resolved.map((r) => ({
        team: r.requestingTeam.slug,
        title: r.title,
        description: r.description,
        tags: r.tags,
        tried: r.tried,
        outcome: {
          summary: r.outcome!.summary,
          evidenceKind: r.outcome!.evidenceKind,
          evidence: r.outcome!.evidence,
          ...(r.outcome!.inPerson ? { inPerson: true } : {}),
        },
      })),
    ).toEqual(SEED_RESOLUTIONS);
    expect(resolved.every((r) => r.helpingTeam?.slug === "maple")).toBe(true);
  });

  it("numbers requests in the seed's insert order", () => {
    expect(DEMO_REQUESTS.map((request) => request.id)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
  });

  it("gives every message a unique id", () => {
    const ids = DEMO_REQUESTS.flatMap((request) => request.messages.map((message) => message.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("lists help received, newest first", () => {
    expect(demoHelpReceived(getDemoTeam("aurora")!).map((request) => request.title)).toEqual([
      "Weather API calls time out at the venue",
      "Container restarts in a loop after deploying",
    ]);
  });

  it("keeps every receipt link inside the demo", () => {
    const links = demoReceiptLines(getDemoTeam("maple")!).flatMap((line) => Object.values(line.links));
    expect(links.every((link) => link.startsWith("/demo/"))).toBe(true);
  });
});

describe("the worked thread", () => {
  const worked = getDemoRequest(WORKED_REQUEST_ID)!;

  it("has chat with a code snippet, an outcome with evidence, and a confirmation", () => {
    expect(worked.messages.some((message) => message.kind === "snippet")).toBe(true);
    expect(worked.messages.some((message) => message.body === "Meet at our table: Table 12.")).toBe(true);
    expect(worked.outcome).toMatchObject({ state: "confirmed", evidenceKind: "code_diff", decidedBy: "Priya Nair" });
    expect(worked.messages.at(-1)?.body).toBe("Team Aurora confirmed the fix");
  });

  it("confirms with the real result message and scoring explanation", () => {
    expect(confirmMessage(worked.award)).toBe("Fix confirmed. Team Maple earned 20 points.");
    expect(worked.award?.explanation).toBe("1st confirmed resolution between Maple and Aurora: 20 points.");
  });

  it("can be shown as it was before Team Aurora confirmed it", () => {
    const before = beforeConfirmation(worked);
    expect(before.status).toBe("outcome_submitted");
    expect(before.outcome).toMatchObject({ state: "pending", decidedBy: null, decidedAt: null });
    expect(before.award).toBeNull();
    expect(before.messages).toEqual(worked.messages.slice(0, -1));
  });
});
