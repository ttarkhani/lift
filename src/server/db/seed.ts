import { postRequestSchema, submitOutcomeSchema } from "@/domain/requests";
import { inviteCode } from "@/domain/teams";
import type { EvidenceKind } from "@/domain/types";
import type { Viewer } from "@/server/auth/viewer";
import type { Sql, Tx } from "@/server/db/client";
import { emitActivity } from "@/server/events";
import { acceptRequest, confirmOutcome, postRequest, submitOutcome } from "@/server/services/requests";

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

type SeedResolution = {
  team: string;
  title: string;
  description: string;
  tags: string[];
  tried: string;
  outcome: { summary: string; evidenceKind: EvidenceKind; evidence: string; inPerson?: boolean };
};

/**
 * Blockers Team Maple fixed, in the order they're confirmed: Aurora, Orbit, Cedar, then
 * Aurora again, for 20 + 20 + 20 + 5 = 65 points.
 */
export const SEED_RESOLUTIONS: SeedResolution[] = [
  {
    team: "aurora",
    title: "Container restarts in a loop after deploying",
    description: "The dashboard container starts, then restarts every few seconds on the VM.",
    tags: ["deployment", "docker"],
    tried: "Checked the logs and rebuilt the image.",
    outcome: {
      summary: "Repaired the deployment configuration: the health check pointed at the wrong port, so the container kept being restarted.",
      evidenceKind: "code_diff",
      evidence: "-      test: [\"CMD\", \"curl\", \"-f\", \"http://localhost:8080/health\"]\n+      test: [\"CMD\", \"curl\", \"-f\", \"http://localhost:3000/health\"]",
    },
  },
  {
    team: "orbit",
    title: "API can't reach the database after a few minutes",
    description: "Queries work at first, then every request fails with a connection timeout.",
    tags: ["APIs", "debugging"],
    tried: "Restarted the server, which fixes it for a few minutes.",
    outcome: {
      summary: "Identified a database connection leak: connections weren't released after errors, so the pool ran out.",
      evidenceKind: "text",
      evidence: "Wrapped each query in try/finally so the client is always released, and capped the pool at 10.",
      inPerson: true,
    },
  },
  {
    team: "cedar",
    title: "Keyboard users can't reach the submit button",
    description: "Tabbing through the form skips the submit button entirely.",
    tags: ["design", "accessibility"],
    tried: "Added tabindex to the button.",
    outcome: {
      summary: "Tested the keyboard navigation with them and replaced the clickable div with a real button.",
      evidenceKind: "text",
      evidence: "The submit control was a div with an onClick handler. A button element is focusable and works with Enter and Space.",
      inPerson: true,
    },
  },
  {
    team: "aurora",
    title: "Weather API calls time out at the venue",
    description: "Calls to the weather API hang for 30 seconds and then fail, only on venue Wi-Fi.",
    tags: ["APIs", "networking"],
    tried: "Raised the client timeout.",
    outcome: {
      summary: "Resolved a separate API issue: moved the weather call to the server, which skips the venue proxy.",
      evidenceKind: "link",
      evidence: "https://github.com/example/aurora/pull/14",
    },
  },
];

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
