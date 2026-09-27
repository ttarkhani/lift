import { randomInt } from "node:crypto";
import type { Sql, Tx } from "@/server/db/client";
import { emitActivity } from "@/server/events";

type SeedTeam = {
  slug: string;
  name: string;
  table: string | null;
  isDemo: boolean;
  members: { name: string; skills: string[] }[];
};

export const SEED_TEAMS: SeedTeam[] = [
  { slug: "maple", name: "Maple", table: "Table 12", isDemo: false, members: [
    { name: "Sam Okafor", skills: ["deployment", "debugging"] },
    { name: "Lina Haddad", skills: ["APIs"] },
    { name: "Jonah Reid", skills: ["debugging", "design"] },
  ] },
  { slug: "aurora", name: "Aurora", table: "Table 4", isDemo: false, members: [
    { name: "Priya Nair", skills: ["hardware"] },
    { name: "Tom Becker", skills: ["hardware", "APIs"] },
    { name: "Aisha Mensah", skills: ["design"] },
  ] },
  { slug: "orbit", name: "Orbit", table: "Table 9", isDemo: false, members: [
    { name: "Diego Ramos", skills: ["APIs", "debugging"] },
    { name: "Mei Chen", skills: ["deployment"] },
  ] },
  { slug: "cedar", name: "Cedar", table: "Table 15", isDemo: false, members: [
    { name: "Noah Tremblay", skills: ["design"] },
    { name: "Fatima Ali", skills: ["deployment", "APIs"] },
  ] },
  ...["Quartz", "Nimbus", "Ember", "Birch", "Delta"].map((name) => ({
    slug: name.toLowerCase(),
    name,
    table: null,
    isDemo: true,
    members: [
      { name: `${name} demo 1`, skills: ["debugging"] },
      { name: `${name} demo 2`, skills: ["APIs"] },
    ],
  })),
];

export const SEED_REQUESTS = [
  {
    team: "orbit",
    title: "Our backend works locally but fails on deployment",
    description: "The Express API starts fine on our laptops. On the VM the container exits right after boot with no useful log line.",
    tags: ["deployment", "docker"],
    tried: "Rebuilt the image, checked that every env var is set on the VM, and ran the container interactively.",
  },
  {
    team: "cedar",
    title: "Login callback says the state doesn't match",
    description: "After signing in, the callback page throws a state mismatch error, but only on the deployed site.",
    tags: ["auth", "APIs"],
    tried: "Cleared cookies, double-checked the callback URL, and tried a private window.",
  },
  {
    team: "aurora",
    title: "ESP32 drops off Wi-Fi after about 30 seconds",
    description: "The board connects, sends two readings, then disconnects. Venue Wi-Fi works fine for our phones.",
    tags: ["hardware", "networking"],
    tried: "Tried a phone hotspot (same result) and lowered the send rate.",
  },
  {
    team: "maple",
    title: "Gemini returns an empty object with structured output",
    description: "Our schema validates, but every response comes back as {} once we add an enum field.",
    tags: ["APIs", "gemini"],
    tried: "Simplified the schema and logged the raw response.",
  },
  {
    team: "birch",
    title: "Landing page layout breaks on iPhone Safari",
    description: "The hero section overflows sideways on iPhone. Chrome on Android looks right.",
    tags: ["design", "css"],
    tried: "Removed our fixed widths and checked the viewport meta tag.",
  },
];

// No 0/O or 1/I/L, so codes survive being read aloud or copied off a screen.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function inviteCode(slug: string): string {
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `${slug.toUpperCase()}-${suffix}`;
}

export type SeedResult = { invites: { team: string; code: string }[] };

/** Fills an empty database with teams, members, invite codes, and open requests. */
export async function seed(sql: Sql): Promise<SeedResult> {
  return (await sql.begin(async (tx) => {
    const [{ count }] = await tx<{ count: number }[]>`select count(*)::int as count from teams`;
    if (count > 0) {
      throw new Error("The database already has teams. Run npm run db:reset to start over (local only).");
    }

    const teamIds = new Map<string, string>();
    const firstMember = new Map<string, string>();
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
        if (i === 0) firstMember.set(team.slug, userId);
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
