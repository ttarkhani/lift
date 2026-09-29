import type { Award, Message, Outcome, Team } from "@/app/requests/[id]/thread-parts";
import type { LeaderboardListRow } from "@/components/leaderboard-list";
import type { ReceiptLine } from "@/components/receipt";
import { scoreAwards, type PairAward } from "@/domain/scoring";
import type { RequestStatus } from "@/domain/types";
import { SEED_REQUESTS, SEED_RESOLUTIONS, SEED_TEAMS } from "./story";

// The public demo's data: the seed's story (./story) plus what the seed doesn't have, such as
// times and the chat in one help thread. Points always come from src/domain/scoring.ts.
// Nothing here reads the database, the env, or the session.

/** The demo shows every time in the event's time zone, fixed so it never depends on the server. */
export const DEMO_TIME_ZONE = "America/Toronto";

export type DemoTeam = Team & { members: string[]; skills: string[] };

export type DemoRequest = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  tried: string;
  status: RequestStatus;
  createdAt: string;
  postedBy: string;
  requestingTeam: DemoTeam;
  helpingTeam: DemoTeam | null;
  messages: Message[];
  outcome: Outcome | null;
  award: Award | null;
};

/** Saturday of Hack the Hill III, in Ottawa (EDT, UTC−4). */
function at(time: string): string {
  return new Date(`2026-09-26T${time}:00-04:00`).toISOString();
}

// Ids follow the seed's insert order, so they match what `npm run db:seed` creates.
export const DEMO_TEAMS: DemoTeam[] = SEED_TEAMS.map((team, i) => ({
  id: String(i + 1),
  slug: team.slug,
  name: team.name,
  // Every team in the demo is invented, so every one is labelled Demo.
  isDemo: true,
  tableLocation: team.table,
  members: team.members.map((member) => member.name),
  skills: [...new Set(team.members.flatMap((member) => member.skills))].sort((a, b) => a.localeCompare(b)),
}));

function teamBySlug(slug: string): DemoTeam {
  const found = DEMO_TEAMS.find((t) => t.slug === slug);
  if (!found) throw new Error(`No demo team ${slug}.`);
  return found;
}

const maple = teamBySlug("maple");

/** When each open blocker was posted, in SEED_REQUESTS order. */
const OPEN_POSTED_AT = ["09:05", "09:18", "09:26", "09:40", "09:51"];

/** The times of each of Maple's fixes, in SEED_RESOLUTIONS order. */
const RESOLUTION_TIMES = [
  { posted: "10:02", accepted: "10:06", submitted: "10:41", confirmed: "10:48" },
  { posted: "11:15", accepted: "11:20", submitted: "12:05", confirmed: "12:12" },
  { posted: "13:30", accepted: "13:34", submitted: "14:02", confirmed: "14:10" },
  { posted: "15:10", accepted: "15:18", submitted: "15:52", confirmed: "16:01" },
];

/** The fully worked thread: Maple fixing Aurora's restart loop. Times are between accepting and submitting. */
function workedChat(requester: DemoTeam): Omit<Message, "id">[] {
  const [priya, tom] = requester.members;
  const [sam] = maple.members;
  const say = (time: string, name: string, from: DemoTeam, kind: "text" | "snippet", body: string) => ({
    kind,
    body,
    createdAt: at(time),
    author: { userId: `${from.slug}-${from.members.indexOf(name) + 1}`, name, team: from.name },
  });
  return [
    say("10:08", sam, maple, "text", "Hi! Can you paste the health check from your compose file?"),
    say(
      "10:11",
      priya,
      requester,
      "snippet",
      'healthcheck:\n  test: ["CMD", "curl", "-f", "http://localhost:8080/health"]\n  interval: 10s\n  retries: 3',
    ),
    say("10:13", tom, requester, "text", "Our server listens on 3000 now. We changed it on Friday night."),
    say(
      "10:15",
      sam,
      maple,
      "text",
      "That's it. The health check still calls port 8080, so it fails and Docker keeps restarting the container. Point it at 3000 and redeploy.",
    ),
    say("10:16", sam, maple, "text", `Meet at our table: ${maple.tableLocation}.`),
    say("10:39", priya, requester, "text", "Redeployed. It's been up for 20 minutes with no restarts."),
  ];
}

function system(time: string, body: string): Omit<Message, "id"> {
  return { kind: "system", body, createdAt: at(time), author: null };
}

function build(): DemoRequest[] {
  const open: DemoRequest[] = SEED_REQUESTS.map((request, i) => {
    const requester = teamBySlug(request.team);
    const createdAt = at(OPEN_POSTED_AT[i]);
    return {
      id: String(i + 1),
      title: request.title,
      description: request.description,
      tags: request.tags,
      tried: request.tried,
      status: "open",
      createdAt,
      postedBy: requester.members[0],
      requestingTeam: requester,
      helpingTeam: null,
      messages: [{ ...system(OPEN_POSTED_AT[i], `Team ${requester.name} posted this blocker`), id: "" }],
      outcome: null,
      award: null,
    };
  });

  // Maple's fixes are scored by the real rule, from the confirmation times below.
  const pairAwards: PairAward[] = SEED_RESOLUTIONS.map((resolution, i) => ({
    id: String(i + 1),
    helpingTeamId: maple.id,
    recipientTeamId: teamBySlug(resolution.team).id,
    helperName: maple.name,
    recipientName: teamBySlug(resolution.team).name,
    confirmedAt: new Date(at(RESOLUTION_TIMES[i].confirmed)),
    status: "awarded",
    reversalReason: null,
  }));
  const scored = scoreAwards(pairAwards);

  const resolved: DemoRequest[] = SEED_RESOLUTIONS.map((resolution, i) => {
    const requester = teamBySlug(resolution.team);
    const times = RESOLUTION_TIMES[i];
    const awardId = pairAwards[i].id;
    const score = scored.get(awardId)!;
    const id = String(SEED_REQUESTS.length + i + 1);
    return {
      id,
      title: resolution.title,
      description: resolution.description,
      tags: resolution.tags,
      tried: resolution.tried,
      status: "resolved",
      createdAt: at(times.posted),
      postedBy: requester.members[0],
      requestingTeam: requester,
      helpingTeam: maple,
      messages: [
        system(times.posted, `Team ${requester.name} posted this blocker`),
        system(times.accepted, `Team ${maple.name} is helping`),
        ...(i === 0 ? workedChat(requester) : []),
        system(times.submitted, `Team ${maple.name} submitted an outcome`),
        system(times.confirmed, `Team ${requester.name} confirmed the fix`),
      ].map((message) => ({ ...message, id: "" })),
      outcome: {
        id: String(i + 1),
        summary: resolution.outcome.summary,
        evidenceKind: resolution.outcome.evidenceKind,
        evidence: resolution.outcome.evidence,
        inPerson: resolution.outcome.inPerson ?? false,
        submittedBy: maple.members[0],
        team: { name: maple.name, slug: maple.slug },
        submittedAt: at(times.submitted),
        state: "confirmed",
        decidedBy: requester.members[0],
        decidedAt: at(times.confirmed),
      },
      award: {
        id: awardId,
        requestId: id,
        helpingTeam: { slug: maple.slug, name: maple.name },
        recipientTeam: { slug: requester.slug, name: requester.name },
        points: score.points,
        pairSequence: score.pairSequence,
        status: "awarded",
        explanation: score.explanation,
        confirmedAt: at(times.confirmed),
      },
    };
  });

  // Message ids run across the whole demo in the order the messages were written.
  const all = [...open, ...resolved];
  const byTime = all
    .flatMap((request) => request.messages)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  byTime.forEach((message, i) => {
    message.id = String(i + 1);
  });
  return all;
}

export const DEMO_REQUESTS: DemoRequest[] = build();

/** The blocker with the full chat, whose "Confirm it's fixed" works in the page. */
export const WORKED_REQUEST_ID = String(SEED_REQUESTS.length + 1);

export function getDemoRequest(id: string): DemoRequest | null {
  return DEMO_REQUESTS.find((request) => request.id === id) ?? null;
}

export function getDemoTeam(slug: string): DemoTeam | null {
  return DEMO_TEAMS.find((t) => t.slug === slug) ?? null;
}

export function openDemoRequests(): DemoRequest[] {
  return DEMO_REQUESTS.filter((request) => request.status === "open");
}

/**
 * A resolved request as it was just before the requesting team confirmed it: the outcome is
 * waiting, and there's no confirmation message or award yet.
 */
export function beforeConfirmation(request: DemoRequest): DemoRequest {
  if (!request.outcome || !request.award) throw new Error(`Demo request ${request.id} has no confirmed outcome.`);
  return {
    ...request,
    status: "outcome_submitted",
    messages: request.messages.filter(
      (message) => !(message.kind === "system" && message.body === `Team ${request.requestingTeam.name} confirmed the fix`),
    ),
    outcome: { ...request.outcome, state: "pending", decidedBy: null, decidedAt: null },
    award: null,
  };
}

function awardsOf(helper: DemoTeam): DemoRequest[] {
  return DEMO_REQUESTS.filter((request) => request.award?.helpingTeam.slug === helper.slug);
}

/** Link to a demo request, or to its outcome or confirmation. The worked one opens confirmed. */
export function demoRequestHref(request: DemoRequest, anchor?: "outcome" | "confirmation"): string {
  const base = `/demo/requests/${request.id}`;
  if (!anchor || !request.outcome) return base;
  const confirmed = anchor === "confirmation" && request.id === WORKED_REQUEST_ID ? "?confirmed=1" : "";
  return `${base}${confirmed}#${anchor}-${request.outcome.id}`;
}

/** A team's receipt lines, in confirmation order, in the shape the Receipt component takes. */
export function demoReceiptLines(helper: DemoTeam): ReceiptLine[] {
  return awardsOf(helper)
    .sort((a, b) => a.award!.confirmedAt.localeCompare(b.award!.confirmedAt) || Number(a.award!.id) - Number(b.award!.id))
    .map((request) => {
      const award = request.award!;
      const outcome = request.outcome!;
      return {
        awardId: award.id,
        requestId: request.id,
        requestTitle: request.title,
        helpedTeam: request.requestingTeam.name,
        summary: outcome.summary,
        points: award.points,
        explanation: award.explanation,
        confirmedBy: outcome.decidedBy,
        confirmedAt: award.confirmedAt,
        state: "counted",
        links: {
          request: demoRequestHref(request),
          outcome: demoRequestHref(request, "outcome"),
          confirmation: demoRequestHref(request, "confirmation"),
          // Evidence links in the demo point at invented URLs, so they go to the outcome instead.
          evidence: demoRequestHref(request, "outcome"),
        },
      };
    });
}

/** Help a team received, newest first. */
export function demoHelpReceived(recipient: DemoTeam): DemoRequest[] {
  return DEMO_REQUESTS.filter((request) => request.award?.recipientTeam.slug === recipient.slug).sort((a, b) =>
    b.award!.confirmedAt.localeCompare(a.award!.confirmedAt),
  );
}

/**
 * Teams with at least one award, ranked like the leaderboard: points, then distinct teams
 * helped, then whoever reached the score first, then name.
 */
export function demoLeaderboard(): LeaderboardListRow[] {
  const rows = DEMO_TEAMS.map((helper) => {
    const awards = awardsOf(helper).map((request) => request.award!);
    const earning = awards.filter((award) => award.points > 0).map((award) => award.confirmedAt);
    return {
      team: helper,
      points: awards.reduce((sum, award) => sum + award.points, 0),
      teamsHelped: new Set(awards.map((award) => award.recipientTeam.slug)).size,
      resolutions: awards.length,
      reachedAt: earning.sort().at(-1) ?? null,
    };
  }).filter((row) => row.resolutions > 0);

  rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.teamsHelped - a.teamsHelped ||
      (a.reachedAt ?? "￿").localeCompare(b.reachedAt ?? "￿") ||
      a.team.name.localeCompare(b.team.name),
  );
  return rows.map((row, i) => ({
    rank: i + 1,
    team: { slug: row.team.slug, name: row.team.name, isDemo: row.team.isDemo },
    points: row.points,
    teamsHelped: row.teamsHelped,
    resolutions: row.resolutions,
  }));
}

/** The brief's example, scored by the real rule: A helps B, B, C, then B. */
export function canonicalExample(): { steps: { helped: string; points: number }[]; total: number } {
  const helped = ["B", "B", "C", "B"];
  const awards: PairAward[] = helped.map((recipient, i) => ({
    id: String(i + 1),
    helpingTeamId: "1",
    recipientTeamId: recipient === "B" ? "2" : "3",
    helperName: "A",
    recipientName: recipient,
    confirmedAt: new Date(Date.UTC(2026, 8, 26, 12, i)),
    status: "awarded",
    reversalReason: null,
  }));
  const scored = scoreAwards(awards);
  const steps = awards.map((award, i) => ({ helped: helped[i], points: scored.get(award.id)!.points }));
  return { steps, total: steps.reduce((sum, step) => sum + step.points, 0) };
}
