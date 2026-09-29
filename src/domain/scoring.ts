import { z } from "zod";
import { ordinal } from "@/lib/format";

// The scoring rule: points go to the helping team, counted per unordered pair of teams across
// the whole event. The pair's 1st confirmed resolution, in either direction, is worth 20, the
// 2nd 5, and every later one 0. Reversed awards use none of the allowance.

export const AWARD_STATUSES = ["awarded", "reversed"] as const;
export type AwardStatus = (typeof AWARD_STATUSES)[number];

/** Database ids are bigints carried as digit strings, so they compare as numbers, not text. */
function compareIds(a: string, b: string): number {
  const x = BigInt(a);
  const y = BigInt(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

/** The pair's two team ids, lowest first. */
export function orderPair(teamA: string, teamB: string): [low: string, high: string] {
  if (teamA === teamB) throw new Error("A team can't be paired with itself.");
  return compareIds(teamA, teamB) < 0 ? [teamA, teamB] : [teamB, teamA];
}

/** The same key for (A, B) and (B, A), such as "3:7". */
export function pairKey(teamA: string, teamB: string): string {
  return orderPair(teamA, teamB).join(":");
}

/** 1 → 20, 2 → 5, 3 and later → 0. */
export function pointsForSequence(n: number): number {
  if (!Number.isInteger(n) || n < 1) throw new Error(`Pair sequence must be a positive integer, got ${n}.`);
  if (n === 1) return 20;
  if (n === 2) return 5;
  return 0;
}

export type PairAward = {
  id: string;
  helpingTeamId: string;
  recipientTeamId: string;
  helperName: string;
  recipientName: string;
  confirmedAt: Date;
  status: AwardStatus;
  reversalReason: string | null;
};

export type SequencedAward = {
  id: string;
  /** Null while reversed. */
  pairSequence: number | null;
  points: number;
  explanation: string;
};

export function explainAward(award: Pick<PairAward, "helperName" | "recipientName">, pairSequence: number): string {
  const points = pointsForSequence(pairSequence);
  const between = `${ordinal(pairSequence)} confirmed resolution between ${award.helperName} and ${award.recipientName}`;
  return `${between}: ${points} points${points === 0 ? ", still recorded" : ""}.`;
}

/**
 * The result message for "Confirm it's fixed": "Fix confirmed. Team Maple earned 20 points."
 * A reconfirmation after a reopen has no new award, so it only says "Fix confirmed."
 */
export function confirmMessage(award: { helpingTeam: { name: string }; points: number } | null): string {
  return award ? `Fix confirmed. Team ${award.helpingTeam.name} earned ${award.points} points.` : "Fix confirmed.";
}

export function explainReversal(reason: string): string {
  const trimmed = reason.trim();
  return `Reversed by an organizer: ${trimmed}${/[.!?]$/.test(trimmed) ? "" : "."}`;
}

function byConfirmation(a: PairAward, b: PairAward): number {
  return a.confirmedAt.getTime() - b.confirmedAt.getTime() || compareIds(a.id, b.id);
}

/**
 * Sequences one pair's awards: by confirmation time, then award id. Reversed awards get
 * 0 points and no sequence, and don't use up the allowance, so the awards after them move up.
 * Returns one entry per award, in sequence order.
 */
export function sequencePair(awards: PairAward[]): SequencedAward[] {
  let key: string | null = null;
  for (const award of awards) {
    if (award.helpingTeamId === award.recipientTeamId) {
      throw new Error(`Award ${award.id}: a team can't be awarded for helping itself.`);
    }
    const awardKey = pairKey(award.helpingTeamId, award.recipientTeamId);
    if (key !== null && awardKey !== key) throw new Error("sequencePair takes awards from one pair of teams.");
    key = awardKey;
  }

  let counted = 0;
  return [...awards].sort(byConfirmation).map((award) => {
    if (award.status === "reversed") {
      return { id: award.id, pairSequence: null, points: 0, explanation: explainReversal(award.reversalReason ?? "") };
    }
    counted += 1;
    return {
      id: award.id,
      pairSequence: counted,
      points: pointsForSequence(counted),
      explanation: explainAward(award, counted),
    };
  });
}

/** Sequences awards from any number of pairs. Returns the results keyed by award id. */
export function scoreAwards(awards: PairAward[]): Map<string, SequencedAward> {
  const pairs = new Map<string, PairAward[]>();
  for (const award of awards) {
    if (award.helpingTeamId === award.recipientTeamId) {
      throw new Error(`Award ${award.id}: a team can't be awarded for helping itself.`);
    }
    const key = pairKey(award.helpingTeamId, award.recipientTeamId);
    pairs.set(key, [...(pairs.get(key) ?? []), award]);
  }
  const results = new Map<string, SequencedAward>();
  for (const pair of pairs.values()) {
    for (const result of sequencePair(pair)) results.set(result.id, result);
  }
  return results;
}

export const awardDecisionSchema = z.object({
  reason: z.string().trim().min(1, "Give a reason. It's kept on record.").max(500, "Keep the reason under 500 characters."),
});
export type AwardDecisionInput = z.infer<typeof awardDecisionSchema>;
