// Roles come from Auth0 RBAC. A post-login Action copies the user's roles into the ID token
// under this claim (see docs/auth0-setup.md).

export const ROLES_CLAIM = "https://lifts.app/roles";

export const ROLES = ["organizer"] as const;
export type Role = (typeof ROLES)[number];

/** Reads the roles Lifts knows about from ID token claims. Anything malformed or unknown is ignored. */
export function rolesFromClaims(claims: Record<string, unknown> | null | undefined): Role[] {
  const value = claims?.[ROLES_CLAIM];
  if (!Array.isArray(value)) return [];
  return ROLES.filter((role) => value.includes(role));
}
