// Mock data for the step 1 page layouts. Step 3 replaces it with real queries.

import type {
  EvidenceKind,
  MessageKind,
  RequestStatus,
  Skill,
} from "@/domain/types";

export type MockTeam = {
  slug: string;
  name: string;
  table: string;
  isDemo: boolean;
  members: string[];
  skills: Skill[];
};

export type MockMessage = {
  id: number;
  kind: MessageKind;
  /** Null for system messages. */
  author: { name: string; team: string } | null;
  body: string;
  at: string;
};

export type MockOutcome = {
  summary: string;
  evidenceKind: EvidenceKind;
  evidence: string;
  inPerson: boolean;
  submittedBy: string;
  submittedAt: string;
  confirmedBy: string | null;
  confirmedAt: string | null;
};

export type MockRequest = {
  id: number;
  title: string;
  description: string;
  tags: string[];
  tried: string;
  status: RequestStatus;
  requestingTeam: string;
  helpingTeam: string | null;
  postedBy: string;
  postedAt: string;
  messages: MockMessage[];
  outcome: MockOutcome | null;
};

export type AwardState = "counted" | "under_review" | "reversed";

export type MockAward = {
  requestId: number;
  helper: string;
  helped: string;
  /** Completes "Helped Team X …". */
  summary: string;
  points: number;
  /** 1 for the first confirmed resolution between the two teams, 2 for the second, and so on. */
  pairIndex: number;
  confirmedBy: string;
  confirmedAt: string;
  state: AwardState;
};

export type LeaderboardRow = {
  team: MockTeam;
  points: number;
  teamsHelped: number;
  resolutions: number;
};

export type ReviewCard = {
  id: number;
  title: string;
  detectors: string[];
  explanation: string;
  recommendation: "accept" | "organizer_review";
  evidence: { label: string; href: string }[];
  award: MockAward;
  teamResponse: { body: string; by: string; team: string } | null;
  raisedAt: string;
};

/** The "now" the mock screens are rendered at: Saturday afternoon of the event. */
export const MOCK_NOW = "2026-10-03T15:00:00-04:00";

/** Event time zone for the mock screens. */
export const MOCK_TIMEZONE = "America/Toronto";

/** The signed-in viewer's team until step 2 adds real sessions. */
export const CURRENT_TEAM_SLUG = "maple";

const teams: MockTeam[] = [
  { slug: "maple", name: "Maple", table: "Table 12", isDemo: false, members: ["Sam Okafor", "Lina Haddad", "Jonah Reid"], skills: ["deployment", "debugging", "APIs"] },
  { slug: "aurora", name: "Aurora", table: "Table 4", isDemo: false, members: ["Priya Nair", "Tom Becker", "Aisha Mensah"], skills: ["hardware", "design"] },
  { slug: "orbit", name: "Orbit", table: "Table 9", isDemo: false, members: ["Diego Ramos", "Mei Chen"], skills: ["APIs", "debugging"] },
  { slug: "cedar", name: "Cedar", table: "Table 15", isDemo: false, members: ["Noah Tremblay", "Fatima Ali"], skills: ["design", "deployment"] },
  { slug: "quartz", name: "Quartz", table: "Demo", isDemo: true, members: ["Demo member"], skills: ["debugging"] },
  { slug: "nimbus", name: "Nimbus", table: "Demo", isDemo: true, members: ["Demo member"], skills: ["APIs"] },
  { slug: "ember", name: "Ember", table: "Demo", isDemo: true, members: ["Demo member"], skills: ["design"] },
  { slug: "birch", name: "Birch", table: "Demo", isDemo: true, members: ["Demo member"], skills: ["hardware"] },
  { slug: "delta", name: "Delta", table: "Demo", isDemo: true, members: ["Demo member"], skills: ["deployment"] },
];

const awards: MockAward[] = [
  { requestId: 104, helper: "maple", helped: "aurora", summary: "repair its deployment configuration", points: 20, pairIndex: 1, confirmedBy: "Priya Nair", confirmedAt: "2026-10-03T11:20:00-04:00", state: "counted" },
  { requestId: 110, helper: "maple", helped: "orbit", summary: "identify a database connection issue", points: 20, pairIndex: 1, confirmedBy: "Diego Ramos", confirmedAt: "2026-10-03T12:05:00-04:00", state: "counted" },
  { requestId: 111, helper: "maple", helped: "cedar", summary: "test its keyboard navigation", points: 20, pairIndex: 1, confirmedBy: "Fatima Ali", confirmedAt: "2026-10-03T13:10:00-04:00", state: "counted" },
  { requestId: 112, helper: "maple", helped: "aurora", summary: "resolve a separate API issue", points: 5, pairIndex: 2, confirmedBy: "Tom Becker", confirmedAt: "2026-10-03T13:55:00-04:00", state: "under_review" },
  { requestId: 120, helper: "aurora", helped: "orbit", summary: "wire up its sensor readings", points: 20, pairIndex: 1, confirmedBy: "Mei Chen", confirmedAt: "2026-10-03T10:40:00-04:00", state: "counted" },
  { requestId: 121, helper: "aurora", helped: "cedar", summary: "pick a readable color palette", points: 20, pairIndex: 1, confirmedBy: "Noah Tremblay", confirmedAt: "2026-10-03T11:45:00-04:00", state: "counted" },
  { requestId: 122, helper: "orbit", helped: "cedar", summary: "fix a CORS error on its API", points: 20, pairIndex: 1, confirmedBy: "Noah Tremblay", confirmedAt: "2026-10-03T12:30:00-04:00", state: "counted" },
  { requestId: 123, helper: "orbit", helped: "aurora", summary: "parse a paginated API response", points: 5, pairIndex: 2, confirmedBy: "Aisha Mensah", confirmedAt: "2026-10-03T14:00:00-04:00", state: "counted" },
  { requestId: 124, helper: "cedar", helped: "orbit", summary: "fix its mobile layout", points: 5, pairIndex: 2, confirmedBy: "Mei Chen", confirmedAt: "2026-10-03T14:10:00-04:00", state: "counted" },
  { requestId: 125, helper: "cedar", helped: "aurora", summary: "deploy its landing page", points: 5, pairIndex: 2, confirmedBy: "Priya Nair", confirmedAt: "2026-10-03T14:20:00-04:00", state: "counted" },
  { requestId: 201, helper: "quartz", helped: "nimbus", summary: "fix a build error", points: 20, pairIndex: 1, confirmedBy: "Demo member", confirmedAt: "2026-10-03T14:31:00-04:00", state: "under_review" },
  { requestId: 202, helper: "quartz", helped: "ember", summary: "fix a build error", points: 20, pairIndex: 1, confirmedBy: "Demo member", confirmedAt: "2026-10-03T14:32:00-04:00", state: "under_review" },
  { requestId: 203, helper: "nimbus", helped: "ember", summary: "fix a build failure", points: 20, pairIndex: 1, confirmedBy: "Demo member", confirmedAt: "2026-10-03T14:33:00-04:00", state: "under_review" },
  { requestId: 204, helper: "ember", helped: "quartz", summary: "fix a build error", points: 20, pairIndex: 1, confirmedBy: "Demo member", confirmedAt: "2026-10-03T14:34:00-04:00", state: "under_review" },
  { requestId: 205, helper: "quartz", helped: "nimbus", summary: "fix another build error", points: 5, pairIndex: 2, confirmedBy: "Demo member", confirmedAt: "2026-10-03T14:35:00-04:00", state: "under_review" },
];

const requests: MockRequest[] = [
  {
    id: 101,
    title: "Our backend works locally but fails on deployment",
    description: "The Express API starts fine on our laptops. On the VM the container exits right after boot with no useful log line.",
    tags: ["deployment", "docker"],
    tried: "Rebuilt the image, checked that every env var is set on the VM, and ran the container interactively.",
    status: "open",
    requestingTeam: "orbit",
    helpingTeam: null,
    postedBy: "Diego Ramos",
    postedAt: "2026-10-03T14:48:00-04:00",
    messages: [],
    outcome: null,
  },
  {
    id: 105,
    title: "Login callback says the state doesn't match",
    description: "After signing in, the callback page throws a state mismatch error, but only on the deployed site.",
    tags: ["auth", "APIs"],
    tried: "Cleared cookies, double-checked the callback URL, and tried a private window.",
    status: "open",
    requestingTeam: "cedar",
    helpingTeam: null,
    postedBy: "Fatima Ali",
    postedAt: "2026-10-03T14:35:00-04:00",
    messages: [],
    outcome: null,
  },
  {
    id: 106,
    title: "ESP32 drops off Wi-Fi after about 30 seconds",
    description: "The board connects, sends two readings, then disconnects. Venue Wi-Fi works fine for our phones.",
    tags: ["hardware", "networking"],
    tried: "Tried a phone hotspot (same result) and lowered the send rate.",
    status: "open",
    requestingTeam: "aurora",
    helpingTeam: null,
    postedBy: "Tom Becker",
    postedAt: "2026-10-03T14:20:00-04:00",
    messages: [],
    outcome: null,
  },
  {
    id: 107,
    title: "Landing page layout breaks on iPhone Safari",
    description: "The hero section overflows sideways on iPhone. Chrome on Android looks right.",
    tags: ["design", "css"],
    tried: "Removed our fixed widths and checked the viewport meta tag.",
    status: "open",
    requestingTeam: "birch",
    helpingTeam: null,
    postedBy: "Demo member",
    postedAt: "2026-10-03T13:58:00-04:00",
    messages: [],
    outcome: null,
  },
  {
    id: 108,
    title: "Gemini returns an empty object with structured output",
    description: "Our schema validates, but every response comes back as {} once we add an enum field.",
    tags: ["APIs", "gemini"],
    tried: "Simplified the schema and logged the raw response.",
    status: "open",
    requestingTeam: "maple",
    helpingTeam: null,
    postedBy: "Lina Haddad",
    postedAt: "2026-10-03T14:52:00-04:00",
    messages: [],
    outcome: null,
  },
  {
    id: 102,
    title: "Image uploads time out on the deployed app",
    description: "Uploads over about 5 MB fail after 30 seconds on our VM. Locally they're fine.",
    tags: ["deployment", "uploads"],
    tried: "Raised the Next.js body size limit and retried from two networks.",
    status: "accepted",
    requestingTeam: "cedar",
    helpingTeam: "maple",
    postedBy: "Noah Tremblay",
    postedAt: "2026-10-03T14:05:00-04:00",
    messages: [
      { id: 801, kind: "system", author: null, body: "Team Maple is helping with this blocker.", at: "2026-10-03T14:09:00-04:00" },
      { id: 802, kind: "text", author: { name: "Noah Tremblay", team: "cedar" }, body: "Anything over 5 MB dies at exactly 30 seconds. Here's our proxy config:", at: "2026-10-03T14:11:00-04:00" },
      { id: 803, kind: "snippet", author: { name: "Noah Tremblay", team: "cedar" }, body: "cedar.example.dev {\n  reverse_proxy localhost:3000\n}", at: "2026-10-03T14:11:30-04:00" },
      { id: 804, kind: "text", author: { name: "Sam Okafor", team: "maple" }, body: "That looks like the proxy, not the app. Try a body limit and a longer read timeout:", at: "2026-10-03T14:16:00-04:00" },
      { id: 805, kind: "snippet", author: { name: "Sam Okafor", team: "maple" }, body: "cedar.example.dev {\n  request_body {\n    max_size 20MB\n  }\n  reverse_proxy localhost:3000 {\n    transport http {\n      read_timeout 2m\n    }\n  }\n}", at: "2026-10-03T14:16:30-04:00" },
      { id: 806, kind: "system", author: null, body: "Team Maple asked to meet at Table 12.", at: "2026-10-03T14:20:00-04:00" },
    ],
    outcome: null,
  },
  {
    id: 103,
    title: "Our results list re-renders every second",
    description: "The list flickers and the fan spins up. React DevTools shows every row rendering on each poll.",
    tags: ["debugging", "react"],
    tried: "Wrapped the rows in React.memo, which didn't change anything.",
    status: "outcome_submitted",
    requestingTeam: "orbit",
    helpingTeam: "maple",
    postedBy: "Mei Chen",
    postedAt: "2026-10-03T13:30:00-04:00",
    messages: [
      { id: 811, kind: "system", author: null, body: "Team Maple is helping with this blocker.", at: "2026-10-03T13:34:00-04:00" },
      { id: 812, kind: "text", author: { name: "Jonah Reid", team: "maple" }, body: "The poll creates a new array every time, so memo never matches. Keying the rows by id and keeping the old array when nothing changed should fix it.", at: "2026-10-03T13:41:00-04:00" },
      { id: 813, kind: "text", author: { name: "Mei Chen", team: "orbit" }, body: "Trying it now.", at: "2026-10-03T13:44:00-04:00" },
    ],
    outcome: {
      summary: "Moved polling into one hook that keeps the previous array when the data is unchanged, and keyed rows by id. Renders dropped from one per second to one per real change.",
      evidenceKind: "link",
      evidence: "https://github.com/example-orbit/results/pull/14",
      inPerson: false,
      submittedBy: "Jonah Reid",
      submittedAt: "2026-10-03T14:02:00-04:00",
      confirmedBy: null,
      confirmedAt: null,
    },
  },
];

function titleCase(summary: string): string {
  return summary.charAt(0).toUpperCase() + summary.slice(1);
}

/** Builds a resolved request for awards that don't have a hand-written thread. */
function requestFromAward(award: MockAward): MockRequest {
  const helper = getTeam(award.helper)!;
  return {
    id: award.requestId,
    title: titleCase(award.summary.replace(/\bits\b/, "our")),
    description: "Resolved earlier in the event.",
    tags: [],
    tried: "",
    status: "resolved",
    requestingTeam: award.helped,
    helpingTeam: award.helper,
    postedBy: award.confirmedBy,
    postedAt: award.confirmedAt,
    messages: [
      { id: award.requestId * 10, kind: "system", author: null, body: `Team ${helper.name} is helping with this blocker.`, at: award.confirmedAt },
    ],
    outcome: {
      summary: `Helped Team ${getTeam(award.helped)!.name} ${award.summary}.`,
      evidenceKind: "text",
      evidence: "Walked through the fix together and checked it on their machine.",
      inPerson: true,
      submittedBy: helper.members[0],
      submittedAt: award.confirmedAt,
      confirmedBy: award.confirmedBy,
      confirmedAt: award.confirmedAt,
    },
  };
}

export function getTeam(slug: string): MockTeam | undefined {
  return teams.find((team) => team.slug === slug);
}

export function getTeams(): MockTeam[] {
  return teams;
}

export function getOpenBlockers(): MockRequest[] {
  return requests
    .filter((request) => request.status === "open")
    .sort((a, b) => b.postedAt.localeCompare(a.postedAt));
}

export function getRequest(id: number): MockRequest | undefined {
  const request = requests.find((r) => r.id === id);
  if (request) return request;
  const award = awards.find((a) => a.requestId === id);
  return award ? requestFromAward(award) : undefined;
}

/** Awards the team earned, in confirmation order. */
export function getReceipt(slug: string): MockAward[] {
  return awards
    .filter((award) => award.helper === slug)
    .sort((a, b) => a.confirmedAt.localeCompare(b.confirmedAt));
}

/** Help the team received, newest first. */
export function getHelpReceived(slug: string): MockAward[] {
  return awards
    .filter((award) => award.helped === slug)
    .sort((a, b) => b.confirmedAt.localeCompare(a.confirmedAt));
}

export function getLeaderboard({ includeDemo }: { includeDemo: boolean }): LeaderboardRow[] {
  return teams
    .filter((team) => includeDemo || !team.isDemo)
    .map((team) => {
      const earned = awards.filter((a) => a.helper === team.slug && a.state !== "reversed");
      return {
        team,
        points: earned.reduce((sum, a) => sum + a.points, 0),
        teamsHelped: new Set(earned.map((a) => a.helped)).size,
        resolutions: earned.length,
      };
    })
    .sort((a, b) => b.points - a.points || b.teamsHelped - a.teamsHelped);
}

export function getReviewQueue(): ReviewCard[] {
  const award = (requestId: number) => awards.find((a) => a.requestId === requestId)!;
  return [
    {
      id: 1,
      title: "Three demo teams trading fixes in a loop",
      detectors: ["Burst", "Cycle", "Near-duplicate descriptions"],
      explanation:
        "Quartz, Nimbus, and Ember confirmed 5 resolutions within 4 minutes (requests #201–#205). Requests #201, #203, and #204 form a cycle: Quartz helped Nimbus, Nimbus helped Ember, Ember helped Quartz. Four of the five descriptions are nearly identical, and messages #2011 and #2031 contain only \"done\".",
      recommendation: "organizer_review",
      evidence: [
        { label: "Request #201", href: "/requests/201" },
        { label: "Request #203", href: "/requests/203" },
        { label: "Request #204", href: "/requests/204" },
        { label: "Request #205", href: "/requests/205" },
      ],
      award: award(201),
      teamResponse: null,
      raisedAt: "2026-10-03T14:38:00-04:00",
    },
    {
      id: 2,
      title: "Second resolution between Maple and Aurora",
      detectors: ["Concentrated pair"],
      explanation:
        "Maple helped Aurora twice in under three hours (requests #104 and #112). The outcomes describe different problems, a deployment configuration and an API timeout, cite different files, and were confirmed by different Aurora members. This looks like repeat collaboration rather than one problem split in two.",
      recommendation: "accept",
      evidence: [
        { label: "Request #104", href: "/requests/104" },
        { label: "Request #112", href: "/requests/112" },
      ],
      award: award(112),
      teamResponse: {
        body: "These were separate problems: the first was our Docker config, the second a timeout in our weather API client.",
        by: "Priya Nair",
        team: "aurora",
      },
      raisedAt: "2026-10-03T14:05:00-04:00",
    },
  ];
}
