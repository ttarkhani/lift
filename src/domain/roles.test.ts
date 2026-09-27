import { describe, expect, it } from "vitest";
import { ROLES_CLAIM, rolesFromClaims } from "./roles";

describe("rolesFromClaims", () => {
  it("reads the organizer role from the namespaced claim", () => {
    expect(rolesFromClaims({ sub: "auth0|1", [ROLES_CLAIM]: ["organizer"] })).toEqual(["organizer"]);
  });

  it("returns no roles when the claim is missing or empty", () => {
    expect(rolesFromClaims({ sub: "auth0|1" })).toEqual([]);
    expect(rolesFromClaims({ [ROLES_CLAIM]: [] })).toEqual([]);
    expect(rolesFromClaims(null)).toEqual([]);
    expect(rolesFromClaims(undefined)).toEqual([]);
  });

  it("ignores unknown roles and malformed values", () => {
    expect(rolesFromClaims({ [ROLES_CLAIM]: ["admin", "Organizer"] })).toEqual([]);
    expect(rolesFromClaims({ [ROLES_CLAIM]: "organizer" })).toEqual([]);
    expect(rolesFromClaims({ [ROLES_CLAIM]: { organizer: true } })).toEqual([]);
  });

  it("ignores a roles claim under a different name", () => {
    expect(rolesFromClaims({ roles: ["organizer"] })).toEqual([]);
  });
});
