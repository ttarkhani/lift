import { redirect } from "next/navigation";
import type { TeamViewer } from "./access";
import { getViewer } from "./guards";
import { isOrganizer, type Viewer } from "./viewer";

// Guards for pages. Pages redirect where API routes return 401/403.

/** The login link, returning to `path` afterwards. Use it in a plain <a>, not <Link>. */
export function loginHref(path: string): string {
  return `/auth/login?returnTo=${encodeURIComponent(path)}`;
}

/**
 * For pages anyone can see. A signed-in participant without a team is sent to /join first;
 * organizers don't need a team.
 */
export async function getPageViewer(): Promise<Viewer | null> {
  const viewer = await getViewer();
  if (viewer && !viewer.team && !isOrganizer(viewer)) redirect("/join");
  return viewer;
}

/** For pages that act as a team: signed-out viewers log in, teamless ones join. */
export async function requireTeamPage(path: string): Promise<TeamViewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(loginHref(path));
  if (!viewer.team) redirect("/join");
  return viewer as TeamViewer;
}

/** For organizer pages. Signed-out viewers log in; returns null for anyone without the role. */
export async function requireOrganizerPage(path: string): Promise<Viewer | null> {
  const viewer = await getViewer();
  if (!viewer) redirect(loginHref(path));
  return isOrganizer(viewer) ? viewer : null;
}
