import { describe, expect, it } from "vitest";
import {
  awardDecisionSchema,
  confirmMessage,
  explainReversal,
  orderPair,
  pairKey,
  pointsForSequence,
  scoreAwards,
  sequencePair,
  type PairAward,
} from "./scoring";

const NAMES: Record<string, string> = { "1": "Maple", "2": "Aurora", "3": "Orbit", "10": "Cedar" };
const A = "1";
const B = "2";
const C = "3";

let nextId = 1;
let minute = 0;

/** An award confirmed one minute after the previous one, unless a time is given. */
function award(helper: string, recipient: string, extra: Partial<PairAward> = {}): PairAward {
  minute += 1;
  return {
    id: String(nextId++),
    helpingTeamId: helper,
    recipientTeamId: recipient,
    helperName: NAMES[helper],
    recipientName: NAMES[recipient],
    confirmedAt: new Date(Date.UTC(2026, 9, 3, 12, minute)),
    status: "awarded",
    reversalReason: null,
    ...extra,
  };
}

function pointsById(awards: PairAward[]) {
  const scored = scoreAwards(awards);
  return awards.map((a) => scored.get(a.id)!.points);
}

describe("pairKey", () => {
  it("is the same in either direction", () => {
    expect(pairKey("7", "3")).toBe("3:7");
    expect(pairKey("3", "7")).toBe("3:7");
  });

  it("compares ids as numbers, not text", () => {
    expect(pairKey("9", "10")).toBe("9:10");
    expect(orderPair("10", "9")).toEqual(["9", "10"]);
  });

  it("rejects a team paired with itself", () => {
    expect(() => pairKey("4", "4")).toThrow();
  });
});

describe("pointsForSequence", () => {
  it("gives 20, then 5, then 0 for every later resolution", () => {
    expect([1, 2, 3, 4, 10].map(pointsForSequence)).toEqual([20, 5, 0, 0, 0]);
  });

  it("rejects anything but a positive integer", () => {
    expect(() => pointsForSequence(0)).toThrow();
    expect(() => pointsForSequence(1.5)).toThrow();
  });
});

describe("scoring rule", () => {
  it("A helps B, B, C, then B: 20, 5, 20, 0 for 45", () => {
    const awards = [award(A, B), award(A, B), award(A, C), award(A, B)];
    const points = pointsById(awards);
    expect(points).toEqual([20, 5, 20, 0]);
    expect(points.reduce((sum, p) => sum + p, 0)).toBe(45);
  });

  it("A helps B, then B helps A: A gets 20 and B gets 5, because the pair shares one allowance", () => {
    const awards = [award(A, B), award(B, A)];
    expect(pointsById(awards)).toEqual([20, 5]);
  });

  it("helping C between A–B resolutions doesn't reset A–B", () => {
    const awards = [award(A, B), award(A, C), award(A, B), award(A, C), award(A, B)];
    expect(pointsById(awards)).toEqual([20, 20, 5, 5, 0]);
  });

  it("orders by confirmation time, not by the order awards arrive in", () => {
    const first = award(A, B);
    const second = award(A, B);
    const [s1, s2] = sequencePair([second, first]);
    expect(s1).toMatchObject({ id: first.id, pairSequence: 1, points: 20 });
    expect(s2).toMatchObject({ id: second.id, pairSequence: 2, points: 5 });
  });

  it("orders equal confirmation times by award id, numerically", () => {
    const at = new Date("2026-10-03T12:00:00Z");
    const later = { ...award(A, B), id: "10", confirmedAt: at };
    const earlier = { ...award(A, B), id: "9", confirmedAt: at };
    expect(sequencePair([later, earlier]).map((s) => [s.id, s.points])).toEqual([
      ["9", 20],
      ["10", 5],
    ]);
  });

  it("reversing the first award promotes the second to 20, and restoring it moves the second back to 5", () => {
    const first = award(A, B);
    const second = award(A, B);

    const reversed = sequencePair([{ ...first, status: "reversed", reversalReason: "Same fix posted twice" }, second]);
    expect(reversed).toEqual([
      { id: first.id, pairSequence: null, points: 0, explanation: "Reversed by an organizer: Same fix posted twice." },
      { id: second.id, pairSequence: 1, points: 20, explanation: "1st confirmed resolution between Maple and Aurora: 20 points." },
    ]);

    const restored = sequencePair([first, second]);
    expect(restored.map((s) => [s.pairSequence, s.points])).toEqual([
      [1, 20],
      [2, 5],
    ]);
  });

  it("throws when the helper is the recipient", () => {
    expect(() => sequencePair([award(A, A)])).toThrow(/helping itself/);
    expect(() => scoreAwards([award(A, A)])).toThrow(/helping itself/);
  });

  it("refuses awards from more than one pair", () => {
    expect(() => sequencePair([award(A, B), award(A, C)])).toThrow(/one pair/);
  });
});

describe("explanations", () => {
  it("say which resolution between the two teams it was, and what it earned", () => {
    const explanations = sequencePair([award(A, B), award(B, A), award(A, B)]).map((s) => s.explanation);
    expect(explanations).toEqual([
      "1st confirmed resolution between Maple and Aurora: 20 points.",
      "2nd confirmed resolution between Aurora and Maple: 5 points.",
      "3rd confirmed resolution between Maple and Aurora: 0 points, still recorded.",
    ]);
  });

  it("quote the organizer's reason for a reversal without doubling its full stop", () => {
    expect(explainReversal("Duplicate request")).toBe("Reversed by an organizer: Duplicate request.");
    expect(explainReversal("Duplicate request.")).toBe("Reversed by an organizer: Duplicate request.");
  });
});

describe("confirmMessage", () => {
  it("names the helping team and the points it earned", () => {
    expect(confirmMessage({ helpingTeam: { name: "Maple" }, points: 20 })).toBe(
      "Fix confirmed. Team Maple earned 20 points.",
    );
  });

  it("says only that the fix is confirmed when there's no new award", () => {
    expect(confirmMessage(null)).toBe("Fix confirmed.");
  });
});

describe("awardDecisionSchema", () => {
  it("requires a non-blank reason", () => {
    expect(awardDecisionSchema.safeParse({ reason: "   " }).success).toBe(false);
    expect(awardDecisionSchema.parse({ reason: "  Evidence checks out " })).toEqual({ reason: "Evidence checks out" });
  });
});
