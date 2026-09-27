import { Auth0Client, filterDefaultIdTokenClaims } from "@auth0/nextjs-auth0/server";
import type { SessionData } from "@auth0/nextjs-auth0/types";
import { ROLES_CLAIM } from "@/domain/roles";
import { env } from "@/server/env";

const AUTH0_ENV_KEYS = ["AUTH0_DOMAIN", "AUTH0_CLIENT_ID", "AUTH0_CLIENT_SECRET", "AUTH0_SECRET"] as const;

/**
 * True when every Auth0 variable is set. Without them the app runs signed out, so builds,
 * CI, and pages that don't need a login keep working.
 */
export function isAuth0Configured(): boolean {
  return AUTH0_ENV_KEYS.every((key) => Boolean(process.env[key]));
}

/**
 * v4 keeps only the default ID token claims in the session. Keep them, plus the roles
 * the post-login Action adds under ROLES_CLAIM.
 */
export async function beforeSessionSaved(session: SessionData): Promise<SessionData> {
  const user = filterDefaultIdTokenClaims(session.user);
  const roles = session.user[ROLES_CLAIM];
  return { ...session, user: roles === undefined ? user : { ...user, [ROLES_CLAIM]: roles } };
}

// Kept on globalThis so dev-server reloads reuse one client.
const globalForAuth = globalThis as { liftsAuth0?: Auth0Client };

/** The shared Auth0 client, created on first use from validated environment variables. */
export function getAuth0(): Auth0Client {
  globalForAuth.liftsAuth0 ??= new Auth0Client({
    domain: env.auth0Domain,
    clientId: env.auth0ClientId,
    clientSecret: env.auth0ClientSecret,
    secret: env.auth0Secret,
    appBaseUrl: env.appBaseUrl,
    beforeSessionSaved,
  });
  return globalForAuth.liftsAuth0;
}
