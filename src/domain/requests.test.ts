import { describe, expect, it } from "vitest";
import {
  availableActions,
  canSendMessage,
  checkTransition,
  partyOf,
  postRequestSchema,
  REQUEST_ACTIONS,
  sendMessageSchema,
  submitOutcomeSchema,
  type Party,
  type RequestAction,
} from "./requests";
import { REQUEST_STATUSES, type RequestStatus } from "./types";

const PARTIES: Party[] = ["requester", "helper", "other"];

// The whole table of allowed moves: [action, from, party, to]. Everything else is forbidden.
const ALLOWED: [RequestAction, RequestStatus, Party, RequestStatus][] = [
  ["accept", "open", "other", "accepted"],
  ["release", "accepted", "helper", "open"],
  ["cancel", "open", "requester", "cancelled"],
  ["cancel", "accepted", "requester", "cancelled"],
  ["submit_outcome", "accepted", "helper", "outcome_submitted"],
  ["reject_outcome", "outcome_submitted", "requester", "accepted"],
  ["confirm", "outcome_submitted", "requester", "resolved"],
  ["reopen", "resolved", "requester", "open"],
];

describe("checkTransition", () => {
  it.each(ALLOWED)("allows %s from %s by the %s team, to %s", (action, from, party, to) => {
    expect(checkTransition(action, from, party)).toEqual({ ok: true, to });
  });

  const forbidden = REQUEST_ACTIONS.flatMap((action) =>
    REQUEST_STATUSES.flatMap((status) =>
      PARTIES.filter((party) => !ALLOWED.some(([a, s, p]) => a === action && s === status && p === party)).map(
        (party) => [action, status, party] as const,
      ),
    ),
  );

  it("covers every other combination", () => {
    expect(forbidden.length + ALLOWED.length).toBe(REQUEST_ACTIONS.length * REQUEST_STATUSES.length * PARTIES.length);
  });

  it.each(forbidden)("forbids %s from %s by the %s team", (action, status, party) => {
    const result = checkTransition(action, status, party);
    expect(result.ok).toBe(false);
  });

  it("reports the wrong team before the wrong status", () => {
    // A confirm from the helping team is a 403 whatever the status.
    expect(checkTransition("confirm", "resolved", "helper")).toEqual({ ok: false, reason: "wrong_team" });
    // A second confirm from the requesting team is a 409.
    expect(checkTransition("confirm", "resolved", "requester")).toEqual({ ok: false, reason: "wrong_status" });
  });

  it("never lets the requesting team accept its own request", () => {
    expect(checkTransition("accept", "open", "requester")).toEqual({ ok: false, reason: "wrong_team" });
  });

  it("never lets anything leave cancelled", () => {
    for (const action of REQUEST_ACTIONS) {
      for (const party of PARTIES) expect(checkTransition(action, "cancelled", party).ok).toBe(false);
    }
  });
});

describe("partyOf", () => {
  const request = { requestingTeamId: "1", helpingTeamId: "2" };

  it("tells the requesting team, the helping team, and everyone else apart", () => {
    expect(partyOf("1", request)).toBe("requester");
    expect(partyOf("2", request)).toBe("helper");
    expect(partyOf("3", request)).toBe("other");
    expect(partyOf(null, request)).toBe("other");
    expect(partyOf("2", { requestingTeamId: "1", helpingTeamId: null })).toBe("other");
  });
});

describe("availableActions", () => {
  it("lists the moves each party has", () => {
    expect(availableActions("open", "other")).toEqual(["accept"]);
    expect(availableActions("open", "requester")).toEqual(["cancel"]);
    expect(availableActions("accepted", "helper")).toEqual(["release", "submit_outcome"]);
    expect(availableActions("outcome_submitted", "requester")).toEqual(["reject_outcome", "confirm"]);
    expect(availableActions("resolved", "requester")).toEqual(["reopen"]);
    expect(availableActions("resolved", "helper")).toEqual([]);
  });
});

describe("canSendMessage", () => {
  it("lets both teams write while someone is helping", () => {
    for (const status of ["accepted", "outcome_submitted"] as const) {
      expect(canSendMessage(status, "requester")).toBe(true);
      expect(canSendMessage(status, "helper")).toBe(true);
      expect(canSendMessage(status, "other")).toBe(false);
    }
  });

  it("closes the thread otherwise", () => {
    for (const status of ["open", "resolved", "cancelled"] as const) {
      for (const party of PARTIES) expect(canSendMessage(status, party)).toBe(false);
    }
  });
});

describe("postRequestSchema", () => {
  it("splits comma-separated tags and drops duplicates ignoring case", () => {
    expect(
      postRequestSchema.parse({ title: " Build fails ", description: "It fails.", tags: "docker, Docker, APIs,, " }),
    ).toEqual({ title: "Build fails", description: "It fails.", tags: ["docker", "APIs"], tried: "" });
  });

  it("requires a title and a description", () => {
    expect(postRequestSchema.safeParse({ title: "  ", description: "x" }).success).toBe(false);
    expect(postRequestSchema.safeParse({ title: "x", description: "" }).success).toBe(false);
  });
});

describe("sendMessageSchema", () => {
  it("keeps a snippet's spacing and rejects blank messages and system messages", () => {
    expect(sendMessageSchema.parse({ kind: "snippet", body: "  indented\n" })).toEqual({
      kind: "snippet",
      body: "  indented\n",
    });
    expect(sendMessageSchema.safeParse({ body: "   " }).success).toBe(false);
    expect(sendMessageSchema.safeParse({ kind: "system", body: "Team Orbit is helping" }).success).toBe(false);
  });
});

describe("submitOutcomeSchema", () => {
  const base = { summary: "Fixed the port binding.", evidenceKind: "text", evidence: "Bound to 0.0.0.0." };

  it("accepts text evidence and in-person help", () => {
    expect(submitOutcomeSchema.parse({ ...base, inPerson: true })).toEqual({ ...base, inPerson: true });
  });

  it("requires a web link for link evidence", () => {
    expect(submitOutcomeSchema.safeParse({ ...base, evidenceKind: "link", evidence: "https://github.com/x/y/pull/1" }).success).toBe(true);
    expect(submitOutcomeSchema.safeParse({ ...base, evidenceKind: "link", evidence: "see the repo" }).success).toBe(false);
    expect(submitOutcomeSchema.safeParse({ ...base, evidenceKind: "screenshot_link", evidence: "javascript:alert(1)" }).success).toBe(false);
  });

  it("requires a summary and evidence", () => {
    expect(submitOutcomeSchema.safeParse({ ...base, summary: " " }).success).toBe(false);
    expect(submitOutcomeSchema.safeParse({ ...base, evidence: "" }).success).toBe(false);
  });
});
