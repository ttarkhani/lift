import { afterEach, describe, expect, it, vi } from "vitest";
import { auth, jsonRequest, mocks, organizer, params, participant, signInAs } from "../../../../test/route-auth";

vi.mock("@/server/auth/auth0", () => mocks.auth0());
vi.mock("@/server/auth/viewer", (importOriginal) => mocks.viewer(importOriginal as never));
vi.mock("@/server/db/client", (importOriginal) => mocks.db(importOriginal as never));

const createTeam = await import("./teams/route");
const issueInvite = await import("./teams/[id]/invites/route");
const moveMember = await import("./members/[userId]/move/route");

const calls = {
  "POST /api/organizer/teams": () => createTeam.POST(jsonRequest("/api/organizer/teams", { name: "Sneaky" })),
  "POST /api/organizer/teams/[id]/invites": () =>
    issueInvite.POST(jsonRequest("/api/organizer/teams/1/invites", { maxUses: 4 }), params({ id: "1" })),
  "POST /api/organizer/members/[userId]/move": () =>
    moveMember.POST(
      jsonRequest("/api/organizer/members/10/move", { teamId: "2", reason: "Wrong team" }),
      params({ userId: "10" }),
    ),
};

describe.each(Object.entries(calls))("%s", (_name, call) => {
  afterEach(() => signInAs(null));

  it("returns 403 to a participant and changes nothing", async () => {
    signInAs(participant);
    const response = await call();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: { code: "forbidden", message: "Only organizers can do this." },
    });
    expect(auth.queries).not.toHaveBeenCalled();
  });

  it("returns 401 when signed out", async () => {
    signInAs(null);
    const response = await call();
    expect(response.status).toBe(401);
    expect(auth.queries).not.toHaveBeenCalled();
  });
});

describe("organizer route validation", () => {
  afterEach(() => signInAs(null));

  it("rejects a blank reason on a move with 400 before touching the database", async () => {
    signInAs(organizer);
    const response = await moveMember.POST(
      jsonRequest("/api/organizer/members/10/move", { teamId: "2", reason: "  " }),
      params({ userId: "10" }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.details.fieldErrors.reason).toBeDefined();
    expect(auth.queries).not.toHaveBeenCalled();
  });

  it("returns 404 for a malformed team id", async () => {
    signInAs(organizer);
    const response = await issueInvite.POST(
      jsonRequest("/api/organizer/teams/abc/invites", {}),
      params({ id: "abc" }),
    );
    expect(response.status).toBe(404);
  });

  it("returns 400 for a body that isn't JSON", async () => {
    signInAs(organizer);
    const response = await createTeam.POST(jsonRequest("/api/organizer/teams", "{not json"));
    expect(response.status).toBe(400);
  });
});
