import { cache } from "react";
import { withTx } from "@/server/db/client";
import { getAuth0, isAuth0Configured } from "./auth0";
import { assertOrganizer, assertTeamMember, assertUser, type TeamViewer } from "./access";
import { loadViewer, type SessionUser, type Viewer } from "./viewer";

export * from "./access";

/** The request's viewer, or null when signed out. Cached for the length of one request. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (!isAuth0Configured()) return null;
  const session = await getAuth0().getSession();
  if (!session) return null;
  return withTx((tx) => loadViewer(tx, session.user as SessionUser));
});

export async function requireUser(): Promise<Viewer> {
  return assertUser(await getViewer());
}

export async function requireTeamMember(): Promise<TeamViewer> {
  return assertTeamMember(await getViewer());
}

export async function requireOrganizer(): Promise<Viewer> {
  return assertOrganizer(await getViewer());
}
