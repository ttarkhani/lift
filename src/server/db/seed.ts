import { SEED_REQUESTS, SEED_RESOLUTIONS, SEED_TEAMS } from "@/demo/story";
import { postRequestSchema, submitOutcomeSchema } from "@/domain/requests";
import { inviteCode } from "@/domain/teams";
import type { Viewer } from "@/server/auth/viewer";
import type { Sql, Tx } from "@/server/db/client";
import { emitActivity } from "@/server/events";
import { acceptRequest, confirmOutcome, postRequest, submitOutcome } from "@/server/services/requests";

// Re-exported so the seed and its tests keep one import.
export { SEED_REQUESTS, SEED_RESOLUTIONS, SEED_TEAMS };

export type SeedResult = { invites: { team: string; code: string }[] };

/** Fills an empty database with teams, members, invite codes, open requests, and Team Maple's four fixes. */
export async function seed(sql: Sql): Promise<SeedResult> {
  return (await sql.begin(async (tx) => {
    const [{ count }] = await tx<{ count: number }[]>`select count(*)::int as count from teams`;
    if (count > 0) {
      throw new Error("The database already has teams. Run npm run db:reset to start over (local only).");
    }

    const teamIds = new Map<string, string>();
    const firstMember = new Map<string, string>();
    const viewers = new Map<string, Viewer>();
    const invites: SeedResult["invites"] = [];

    for (const team of SEED_TEAMS) {
      const [{ id: teamId }] = await tx<{ id: string }[]>`
        insert into teams (slug, name, table_location, is_demo)
        values (${team.slug}, ${team.name}, ${team.table}, ${team.isDemo})
        returning id
      `;
      teamIds.set(team.slug, teamId);
      await emitActivity(tx, { type: "team_created", teamId, payload: { slug: team.slug } });

      for (const [i, member] of team.members.entries()) {
        const userId = await addMember(tx, teamId, `seed|${team.slug}-${i + 1}`, member);
        if (i === 0) {
          firstMember.set(team.slug, userId);
          viewers.set(team.slug, {
            userId,
            displayName: member.name,
            email: null,
            team: { id: teamId, slug: team.slug, name: team.name, isDemo: team.isDemo },
            roles: [],
          });
        }
      }

      const code = inviteCode(team.slug);
      await tx`insert into invites (code, team_id) values (${code}, ${teamId})`;
      invites.push({ team: team.name, code });
    }

    for (const request of SEED_REQUESTS) {
      const teamId = teamIds.get(request.team)!;
      const userId = firstMember.get(request.team)!;
      const [{ id: requestId }] = await tx<{ id: string }[]>`
        insert into help_requests (requesting_team_id, created_by, title, description, tags, tried)
        values (${teamId}, ${userId}, ${request.title}, ${request.description}, ${request.tags}, ${request.tried})
        returning id
      `;
      await emitActivity(tx, { type: "request_posted", teamId, requestId, actorUserId: userId });
    }

    // Resolved through the real services, so the awards and ledger are exactly what the app writes.
    const maple = viewers.get("maple")!;
    for (const resolution of SEED_RESOLUTIONS) {
      const requester = viewers.get(resolution.team)!;
      const { id } = await postRequest(tx, requester, postRequestSchema.parse(resolution));
      await acceptRequest(tx, maple, id);
      await submitOutcome(tx, maple, id, submitOutcomeSchema.parse(resolution.outcome));
      await confirmOutcome(tx, requester, id);
    }

    return { invites };
  })) as SeedResult;
}

async function addMember(
  tx: Tx,
  teamId: string,
  auth0Sub: string,
  member: { name: string; skills: string[] },
): Promise<string> {
  const email = `${auth0Sub.replace("seed|", "")}@example.test`;
  const [{ id: userId }] = await tx<{ id: string }[]>`
    insert into users (auth0_sub, email, display_name)
    values (${auth0Sub}, ${email}, ${member.name})
    returning id
  `;
  await tx`insert into team_members (user_id, team_id, skills) values (${userId}, ${teamId}, ${member.skills})`;
  await emitActivity(tx, { type: "member_joined", teamId, actorUserId: userId });
  return userId;
}
