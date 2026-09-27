// Values shared by the database schema (db/migrations/0001_core.sql) and the UI.

export const REQUEST_STATUSES = [
  "open",
  "accepted",
  "outcome_submitted",
  "resolved",
  "cancelled",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const MESSAGE_KINDS = ["text", "snippet", "system"] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

export const EVIDENCE_KINDS = [
  "link",
  "code_diff",
  "text",
  "screenshot_link",
] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export const EVIDENCE_KIND_LABELS: Record<EvidenceKind, string> = {
  link: "Link",
  code_diff: "Code diff",
  text: "Written explanation",
  screenshot_link: "Screenshot link",
};

/** Skills a member can list when joining a team. */
export const SKILLS = [
  "deployment",
  "design",
  "hardware",
  "APIs",
  "debugging",
] as const;
export type Skill = (typeof SKILLS)[number];
