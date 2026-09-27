// Mock data for the review queue, which step 5 makes real. The leaderboard and receipts use real awards.

import type { Skill } from "@/domain/types";

export type MockTeam = {
  slug: string;
  name: string;
  table: string;
  isDemo: boolean;
  members: string[];
  skills: Skill[];
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

/** Event time zone for the mock screens. */
export const MOCK_TIMEZONE = "America/Toronto";

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

export function getTeam(slug: string): MockTeam | undefined {
  return teams.find((team) => team.slug === slug);
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
