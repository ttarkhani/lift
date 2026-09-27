import { describe, expect, it } from "vitest";
import { createTeamSchema, inviteCode, issueInviteSchema, joinTeamSchema, moveMemberSchema, slugify } from "./teams";

describe("inviteCode", () => {
  it("prefixes the team slug and avoids look-alike characters", () => {
    for (let i = 0; i < 50; i++) expect(inviteCode("maple")).toMatch(/^MAPLE-[A-HJ-KMNP-Z2-9]{4}$/);
  });
});

describe("slugify", () => {
  it("turns a team name into a URL slug", () => {
    expect(slugify("Maple")).toBe("maple");
    expect(slugify("  Team Byte Me! 2 ")).toBe("team-byte-me-2");
    expect(slugify("Érable")).toBe("erable");
    expect(slugify("!!!")).toBe("");
  });
});

describe("joinTeamSchema", () => {
  it("normalizes the code and removes duplicate skills", () => {
    expect(joinTeamSchema.parse({ code: " maple-7k3q ", skills: ["design", "design", "APIs"] })).toEqual({
      code: "MAPLE-7K3Q",
      skills: ["design", "APIs"],
    });
  });

  it("rejects a blank code and unknown skills", () => {
    expect(joinTeamSchema.safeParse({ code: "  " }).success).toBe(false);
    expect(joinTeamSchema.safeParse({ code: "MAPLE-7K3Q", skills: ["juggling"] }).success).toBe(false);
  });
});

describe("createTeamSchema", () => {
  it("requires a name with a letter or digit", () => {
    expect(createTeamSchema.parse({ name: "Maple", tableLocation: "" })).toEqual({
      name: "Maple",
      tableLocation: null,
      isDemo: false,
    });
    expect(createTeamSchema.safeParse({ name: "!!!" }).success).toBe(false);
  });
});

describe("issueInviteSchema", () => {
  it("defaults to 4 uses and caps the limit", () => {
    expect(issueInviteSchema.parse({})).toEqual({ maxUses: 4 });
    expect(issueInviteSchema.safeParse({ maxUses: 0 }).success).toBe(false);
    expect(issueInviteSchema.safeParse({ maxUses: 21 }).success).toBe(false);
  });
});

describe("moveMemberSchema", () => {
  it("requires a team id and a reason", () => {
    expect(moveMemberSchema.parse({ teamId: 3, reason: " Joined the wrong team " })).toEqual({
      teamId: "3",
      reason: "Joined the wrong team",
    });
    expect(moveMemberSchema.safeParse({ teamId: "3", reason: "   " }).success).toBe(false);
    expect(moveMemberSchema.safeParse({ teamId: "x", reason: "Because" }).success).toBe(false);
  });
});
