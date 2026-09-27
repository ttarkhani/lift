import { z } from "zod";
import { EVIDENCE_KINDS, MESSAGE_KINDS, type RequestStatus } from "./types";

// The help request state machine. Pure: services load the request, ask this module
// whether the actor's team may make the move, and then write the change.

export const REQUEST_ACTIONS = [
  "accept",
  "release",
  "cancel",
  "submit_outcome",
  "reject_outcome",
  "confirm",
  "reopen",
] as const;
export type RequestAction = (typeof REQUEST_ACTIONS)[number];

/** How the actor's team relates to a request. */
export type Party = "requester" | "helper" | "other";

type Transition = { from: readonly RequestStatus[]; to: RequestStatus; by: Party };

export const TRANSITIONS: Record<RequestAction, Transition> = {
  accept: { from: ["open"], to: "accepted", by: "other" },
  release: { from: ["accepted"], to: "open", by: "helper" },
  cancel: { from: ["open", "accepted"], to: "cancelled", by: "requester" },
  submit_outcome: { from: ["accepted"], to: "outcome_submitted", by: "helper" },
  reject_outcome: { from: ["outcome_submitted"], to: "accepted", by: "requester" },
  confirm: { from: ["outcome_submitted"], to: "resolved", by: "requester" },
  reopen: { from: ["resolved"], to: "open", by: "requester" },
};

export type RequestParties = { requestingTeamId: string; helpingTeamId: string | null };

/** The actor's relation to a request. No team, or a team not involved, is "other". */
export function partyOf(teamId: string | null | undefined, request: RequestParties): Party {
  if (teamId && teamId === request.requestingTeamId) return "requester";
  if (teamId && teamId === request.helpingTeamId) return "helper";
  return "other";
}

export type TransitionCheck =
  | { ok: true; to: RequestStatus }
  /** wrong_team: this team may never make the move (403). wrong_status: not from this status (409). */
  | { ok: false; reason: "wrong_team" | "wrong_status" };

/** Whether `party` may take `action` on a request in `status`. The team is checked first. */
export function checkTransition(action: RequestAction, status: RequestStatus, party: Party): TransitionCheck {
  const transition = TRANSITIONS[action];
  if (transition.by !== party) return { ok: false, reason: "wrong_team" };
  if (!transition.from.includes(status)) return { ok: false, reason: "wrong_status" };
  return { ok: true, to: transition.to };
}

/** The actions `party` can take right now, for showing the right buttons. */
export function availableActions(status: RequestStatus, party: Party): RequestAction[] {
  return REQUEST_ACTIONS.filter((action) => checkTransition(action, status, party).ok);
}

/** The thread is open for messages while a team is helping, and only the two teams write in it. */
export function canSendMessage(status: RequestStatus, party: Party): boolean {
  return (status === "accepted" || status === "outcome_submitted") && party !== "other";
}

// Input schemas for the request API.

const tag = z
  .string()
  .trim()
  .min(1)
  .max(30, "Keep each tag under 30 characters.")
  .regex(/^[\p{L}\p{N}][\p{L}\p{N} .+#-]*$/u, "Use letters, digits, spaces, and . + # - in tags.");

/** Tags arrive as an array or a comma-separated string. Duplicates are dropped, ignoring case. */
const tags = z
  .union([z.array(z.string()), z.string()])
  .transform((value) => (Array.isArray(value) ? value : value.split(",")).map((t) => t.trim()).filter(Boolean))
  .pipe(z.array(tag).max(8, "Use at most 8 tags."))
  .transform((list) => list.filter((t, i) => list.findIndex((u) => u.toLowerCase() === t.toLowerCase()) === i));

export const postRequestSchema = z.object({
  title: z.string().trim().min(1, "Give your blocker a title.").max(120, "Keep the title under 120 characters."),
  description: z
    .string()
    .trim()
    .min(1, "Describe what's happening.")
    .max(4000, "Keep the description under 4,000 characters."),
  tags: tags.default([]),
  tried: z.string().trim().max(2000, "Keep this under 2,000 characters.").default(""),
});
export type PostRequestInput = z.infer<typeof postRequestSchema>;

export const USER_MESSAGE_KINDS = MESSAGE_KINDS.filter((kind) => kind !== "system") as ["text", "snippet"];

export const sendMessageSchema = z.object({
  kind: z.enum(USER_MESSAGE_KINDS).default("text"),
  body: z
    .string()
    .max(8000, "Keep messages under 8,000 characters.")
    .refine((body) => body.trim() !== "", "Write a message first."),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

const httpUrl = z.url({ protocol: /^https?$/, error: "Use a full link starting with https://." });

export const submitOutcomeSchema = z
  .object({
    summary: z
      .string()
      .trim()
      .min(1, "Say what you did.")
      .max(500, "Keep the summary under 500 characters."),
    evidenceKind: z.enum(EVIDENCE_KINDS),
    evidence: z.string().trim().min(1, "Add your evidence.").max(20000, "Keep the evidence under 20,000 characters."),
    inPerson: z.boolean().default(false),
  })
  .superRefine((input, ctx) => {
    if (input.evidenceKind === "link" || input.evidenceKind === "screenshot_link") {
      const result = httpUrl.safeParse(input.evidence);
      if (!result.success) ctx.addIssue({ code: "custom", path: ["evidence"], message: result.error.issues[0].message });
    }
  });
export type SubmitOutcomeInput = z.infer<typeof submitOutcomeSchema>;

export const listRequestsSchema = z.object({
  tag: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined),
  mine: z
    .enum(["0", "1"])
    .optional()
    .transform((value) => value === "1"),
});
export type ListRequestsInput = z.infer<typeof listRequestsSchema>;
