import { rolesFromClaims, type Role } from "@/domain/roles";
import type { Tx } from "@/server/db/client";
import { emitActivity } from "@/server/events";

export type ViewerTeam = { id: string; slug: string; name: string; isDemo: boolean };

/** The signed-in person as services see them: their users row, team, and roles. */
export type Viewer = {
  userId: string;
  displayName: string;
  email: string | null;
  team: ViewerTeam | null;
  roles: Role[];
};

/** The session's user claims. Only `sub` is guaranteed. */
export type SessionUser = {
  sub: string;
  name?: string;
  nickname?: string;
  email?: string;
  [claim: string]: unknown;
};

export function isOrganizer(viewer: Viewer): boolean {
  return viewer.roles.includes("organizer");
}

type ViewerRow = {
  user_id: string;
  display_name: string;
  email: string | null;
  team_id: string | null;
  team_slug: string | null;
  team_name: string | null;
  team_is_demo: boolean | null;
};

function selectViewer(tx: Tx, sub: string) {
  return tx<ViewerRow[]>`
    select
      u.id as user_id, u.display_name, u.email,
      t.id as team_id, t.slug as team_slug, t.name as team_name, t.is_demo as team_is_demo
    from users u
    left join team_members m on m.user_id = u.id
    left join teams t on t.id = m.team_id
    where u.auth0_sub = ${sub}
  `;
}

function displayNameOf(user: SessionUser): string {
  for (const value of [user.name, user.nickname, user.email]) {
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return "Participant";
}

/**
 * Finds the users row for a session, creating it on first sign-in. Roles come from the
 * session's claims, never from the database or the client.
 */
export async function loadViewer(tx: Tx, user: SessionUser): Promise<Viewer> {
  let [row] = await selectViewer(tx, user.sub);
  if (!row) {
    const email = typeof user.email === "string" ? user.email : null;
    const [created] = await tx<{ id: string }[]>`
      insert into users (auth0_sub, email, display_name)
      values (${user.sub}, ${email}, ${displayNameOf(user)})
      on conflict (auth0_sub) do nothing
      returning id
    `;
    // A parallel request may have created it first; only the creator records the event.
    if (created) await emitActivity(tx, { type: "user_created", actorUserId: created.id });
    [row] = await selectViewer(tx, user.sub);
  }
  return {
    userId: row.user_id,
    displayName: row.display_name,
    email: row.email,
    team: row.team_id
      ? { id: row.team_id, slug: row.team_slug!, name: row.team_name!, isDemo: row.team_is_demo! }
      : null,
    roles: rolesFromClaims(user),
  };
}
