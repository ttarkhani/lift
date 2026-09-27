import { describe, expect, it } from "vitest";
import { withRunningTotals } from "./receipt";

describe("withRunningTotals", () => {
  it("adds up Team Maple's receipt to 65", () => {
    const rows = withRunningTotals([
      { points: 20, state: "counted" as const },
      { points: 20, state: "counted" as const },
      { points: 20, state: "counted" as const },
      { points: 5, state: "under_review" as const },
    ]);
    expect(rows.map((row) => row.running)).toEqual([20, 40, 60, 65]);
  });

  it("keeps reversed lines out of the total", () => {
    const rows = withRunningTotals([
      { points: 20, state: "counted" as const },
      { points: 20, state: "reversed" as const },
      { points: 5, state: "counted" as const },
    ]);
    expect(rows.map((row) => row.running)).toEqual([20, 20, 25]);
  });
});
