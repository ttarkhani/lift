import { ForbiddenError, UnauthenticatedError } from "@/server/errors";
import { isOrganizer, type Viewer, type ViewerTeam } from "./viewer";

export type TeamViewer = Viewer & { team: ViewerTeam };

// The assert functions check a viewer that's already loaded. Services use them too,
// so a rule holds whether the call comes from a route, a script, or the worker.

/** 401 when signed out. */
export function assertUser(viewer: Viewer | null): Viewer {
  if (!viewer) throw new UnauthenticatedError();
  return viewer;
}

/** 401 when signed out, 403 without a team. */
export function assertTeamMember(viewer: Viewer | null): TeamViewer {
  const user = assertUser(viewer);
  if (!user.team) throw new ForbiddenError("Join your team first.");
  return user as TeamViewer;
}

/** 401 when signed out, 403 without the organizer role. */
export function assertOrganizer(viewer: Viewer | null): Viewer {
  const user = assertUser(viewer);
  if (!isOrganizer(user)) throw new ForbiddenError("Only organizers can do this.");
  return user;
}

/** The parts of a help request that decide who can read its thread. */
export type ThreadAccess = {
  requestingTeamId: string;
  /** Set once a team accepts the request. */
  helpingTeamId: string | null;
};

/**
 * A help thread is visible to the requesting team, the helping team once it has
 * accepted, and organizers. 401 when signed out, 403 for anyone else.
 */
export function assertCanViewThread(viewer: Viewer | null, request: ThreadAccess): Viewer {
  const user = assertUser(viewer);
  if (isOrganizer(user)) return user;
  const teamId = user.team?.id;
  if (teamId && (teamId === request.requestingTeamId || teamId === request.helpingTeamId)) return user;
  throw new ForbiddenError("Only the two teams and organizers can see this thread.");
}
