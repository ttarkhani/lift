import { describe, expect, it } from "vitest";
import { formatTime, ordinal, timeAgo } from "./format";

describe("timeAgo", () => {
  const now = "2026-10-03T15:00:00-04:00";

  it("uses minutes, then hours, then a date", () => {
    expect(timeAgo("2026-10-03T14:59:40-04:00", now)).toBe("just now");
    expect(timeAgo("2026-10-03T14:48:00-04:00", now)).toBe("12 min ago");
    expect(timeAgo("2026-10-03T12:00:00-04:00", now)).toBe("3 h ago");
    expect(timeAgo("2026-10-01T12:00:00-04:00", now)).toMatch(/Oct/);
  });
});

describe("formatTime", () => {
  it("formats in the given time zone", () => {
    expect(formatTime("2026-10-03T18:14:00Z", "America/Toronto")).toMatch(/^2:14/);
  });
});

describe("ordinal", () => {
  it.each([
    [1, "1st"],
    [2, "2nd"],
    [3, "3rd"],
    [4, "4th"],
    [11, "11th"],
    [12, "12th"],
    [21, "21st"],
  ])("%i → %s", (n, expected) => {
    expect(ordinal(n)).toBe(expected);
  });
});
