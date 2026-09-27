import {
  inviteCode,
  slugify,
  type CreateTeamInput,
  type IssueInviteInput,
  type JoinTeamInput,
  type MoveMemberInput,
} from "@/domain/teams";
import { assertOrganizer, assertUser } from "@/server/auth/access";
import type { Viewer, ViewerTeam } from "@/server/auth/viewer";
import { isUniqueViolation, type Tx } from "@/server/db/client";
import { ConflictError, NotFoundError } from "@/server/errors";
import { emitActivity } from "@/server/events";
import { recordOrganizerAction } from "./organizer-actions";

type TeamRow = { id: string; slug: string; name: string; is_demo: boolean };

function toTeam(row: TeamRow): ViewerTeam {
  return { id: row.id, slug: row.slug, name: row.name, isDemo: row.is_demo };
}

async function findTeam(tx: Tx, teamId: string): Promise<ViewerTeam> {
  const [row] = await tx<TeamRow[]>`select id, slug, name, is_demo from teams where id = ${teamId}`;
  if (!row) throw new NotFoundError("That team doesn't exist.");
  return toTeam(row);
}

/** Organizers only. Registers a team; the slug comes from the name. */
export async function createTeam(tx: Tx, actor: Viewer, input: CreateTeamInput): Promise<ViewerTeam> {
  const organizer = assertOrganizer(actor);
  const slug = slugify(input.name);
  let row: TeamRow;
  try {
    [row] = await tx<TeamRow[]>`
      insert into teams (slug, name, table_location, is_demo)
      values (${slug}, ${input.name}, ${input.tableLocation}, ${input.isDemo})
      returning id, slug, name, is_demo
    `;
  } catch (error) {
    if (isUniqueViolation(error)) throw new ConflictError(`There's already a team called ${input.name}.`);
    throw error;
  }
  await recordOrganizerAction(tx, {
    organizerUserId: organizer.userId,
    action: "create_team",
    targetType: "team",
    targetId: row.id,
    reason: `Registered Team ${row.name}`,
  });
  await emitActivity(tx, { type: "team_created", teamId: row.id, actorUserId: organizer.userId, payload: { slug } });
  return toTeam(row);
}

export type Invite = { code: string; teamId: string; maxUses: number; uses: number };

/** Organizers only. Issues a new invite code for a team. */
export async function issueInvite(tx: Tx, actor: Viewer, teamId: string, input: IssueInviteInput): Promise<Invite> {
  const organizer = assertOrganizer(actor);
  const team = await findTeam(tx, teamId);
  // Codes are random, so a collision is rare; try a few before giving up.
  for (let attempt = 0; attempt < 5; attempt++) {
    const [row] = await tx<{ code: string }[]>`
      insert into invites (code, team_id, max_uses, created_by)
      values (${inviteCode(team.slug)}, ${team.id}, ${input.maxUses}, ${organizer.userId})
      on conflict (code) do nothing
      returning code
    `;
    if (!row) continue;
    await recordOrganizerAction(tx, {
      organizerUserId: organizer.userId,
      action: "issue_invite",
      targetType: "team",
      targetId: team.id,
      reason: `Issued an invite code for Team ${team.name} with ${input.maxUses} uses`,
    });
    await emitActivity(tx, {
      type: "invite_issued",
      teamId: team.id,
      actorUserId: organizer.userId,
      payload: { maxUses: input.maxUses },
    });
    return { code: row.code, teamId: team.id, maxUses: input.maxUses, uses: 0 };
  }
  throw new Error("Couldn't generate a unique invite code.");
}

/**
 * Joins the actor to the team an invite code belongs to. Each person joins one team,
 * once: after that only an organizer can move them.
 */
export async function joinTeam(tx: Tx, actor: Viewer, input: JoinTeamInput): Promise<ViewerTeam> {
  const user = assertUser(actor);
  const [current] = await tx<{ name: string }[]>`
    select t.name from team_members m join teams t on t.id = m.team_id where m.user_id = ${user.userId}
  `;
  if (current) {
    throw new ConflictError(`You're already on Team ${current.name}. Ask an organizer if you need to switch.`);
  }

  const [invite] = await tx<(TeamRow & { max_uses: number })[]>`
    select t.id, t.slug, t.name, t.is_demo, i.max_uses
    from invites i join teams t on t.id = i.team_id
    where i.code = ${input.code}
  `;
  if (!invite) throw new NotFoundError("That invite code doesn't match any team. Check it with an organizer.");

  const claimed = await tx`
    update invites set uses = uses + 1 where code = ${input.code} and uses < max_uses returning code
  `;
  if (claimed.length === 0) {
    throw new ConflictError(`That invite code has been used ${invite.max_uses} times already. Ask an organizer for a new one.`);
  }

  try {
    await tx`insert into team_members (user_id, team_id, skills) values (${user.userId}, ${invite.id}, ${input.skills})`;
  } catch (error) {
    // Another request from the same person joined first.
    if (isUniqueViolation(error, "team_members_pkey")) throw new ConflictError("You're already on a team.");
    throw error;
  }
  await emitActivity(tx, { type: "member_joined", teamId: invite.id, actorUserId: user.userId });
  return toTeam(invite);
}

/** Organizers only. Moves a member to another team, with a reason that's kept on record. */
export async function moveMember(
  tx: Tx,
  actor: Viewer,
  userId: string,
  input: MoveMemberInput,
): Promise<{ from: ViewerTeam; to: ViewerTeam }> {
  const organizer = assertOrganizer(actor);
  const [membership] = await tx<{ team_id: string }[]>`
    select team_id from team_members where user_id = ${userId} for update
  `;
  if (!membership) throw new NotFoundError("That person isn't on a team.");
  const from = await findTeam(tx, membership.team_id);
  const to = await findTeam(tx, input.teamId);
  if (from.id === to.id) throw new ConflictError(`They're already on Team ${to.name}.`);

  await tx`update team_members set team_id = ${to.id} where user_id = ${userId}`;
  await recordOrganizerAction(tx, {
    organizerUserId: organizer.userId,
    action: "move_member",
    targetType: "user",
    targetId: userId,
    reason: input.reason,
  });
  await emitActivity(tx, {
    type: "member_moved",
    teamId: to.id,
    counterpartTeamId: from.id,
    actorUserId: organizer.userId,
    payload: { userId, reason: input.reason },
  });
  return { from, to };
}

export type OrganizerTeam = ViewerTeam & {
  tableLocation: string | null;
  invites: { code: string; uses: number; maxUses: number }[];
  members: { userId: string; displayName: string; email: string | null; skills: string[] }[];
};

/** Organizers only. Every team with its invite codes and members, for /organizer/teams. */
export async function listTeamsForOrganizer(tx: Tx, actor: Viewer): Promise<OrganizerTeam[]> {
  assertOrganizer(actor);
  const rows = await tx<
    (TeamRow & { table_location: string | null; invites: OrganizerTeam["invites"]; members: OrganizerTeam["members"] })[]
  >`
    select
      t.id, t.slug, t.name, t.is_demo, t.table_location,
      coalesce((
        select json_agg(json_build_object('code', i.code, 'uses', i.uses, 'maxUses', i.max_uses) order by i.created_at)
        from invites i where i.team_id = t.id
      ), '[]') as invites,
      coalesce((
        select json_agg(json_build_object(
          'userId', u.id::text, 'displayName', u.display_name, 'email', u.email, 'skills', m.skills
        ) order by m.joined_at)
        from team_members m join users u on u.id = m.user_id where m.team_id = t.id
      ), '[]') as members
    from teams t
    order by t.is_demo, t.name
  `;
  return rows.map((row) => ({ ...toTeam(row), tableLocation: row.table_location, invites: row.invites, members: row.members }));
}
