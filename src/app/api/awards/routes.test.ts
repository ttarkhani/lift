import { afterEach, describe, expect, it, vi } from "vitest";
import { auth, jsonRequest, mocks, organizer, params, participant, signInAs } from "../../../../test/route-auth";

vi.mock("@/server/auth/auth0", () => mocks.auth0());
vi.mock("@/server/auth/viewer", (importOriginal) => mocks.viewer(importOriginal as never));
vi.mock("@/server/db/client", (importOriginal) => mocks.db(importOriginal as never));

const reverse = await import("./[id]/reverse/route");
const restore = await import("./[id]/restore/route");
const leaderboard = await import("../leaderboard/route");
const receipt = await import("../teams/[slug]/receipt/route");

function get(url: string) {
  return new Request(`http://localhost:3000${url}`);
}

describe.each([
  ["reverse", reverse.POST],
  ["restore", restore.POST],
])("POST /api/awards/[id]/%s", (action, POST) => {
  afterEach(() => signInAs(null));
  const call = (body: unknown = { reason: "Duplicate request" }, id = "1") =>
    POST(jsonRequest(`/api/awards/${id}/${action}`, body), params({ id }));

  it("returns 401 when signed out and changes nothing", async () => {
    const response = await call();
    expect(response.status).toBe(401);
    expect(auth.queries).not.toHaveBeenCalled();
  });

  it("returns 403 to a participant and changes nothing", async () => {
    signInAs(participant);
    const response = await call();
    expect(response.status).toBe(403);
    expect(auth.queries).not.toHaveBeenCalled();
  });

  it("requires a reason before touching the database", async () => {
    signInAs(organizer);
    const blank = await call({ reason: "  " });
    expect(blank.status).toBe(400);
    expect(Object.keys((await blank.json()).error.details.fieldErrors)).toEqual(["reason"]);
    const missing = await call({});
    expect(missing.status).toBe(400);
    expect(auth.queries).not.toHaveBeenCalled();
  });

  it("returns 404 for a malformed award id", async () => {
    signInAs(organizer);
    const response = await call(undefined, "abc");
    expect(response.status).toBe(404);
    expect(auth.queries).not.toHaveBeenCalled();
  });
});

describe("public score routes", () => {
  afterEach(() => signInAs(null));

  it("serve the leaderboard to signed-out visitors", async () => {
    const response = await leaderboard.GET(get("/api/leaderboard"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ entries: [] });
  });

  it("return 404 for a malformed team slug without touching the database", async () => {
    const response = await receipt.GET(get("/api/teams/Not A Slug/receipt"), params({ slug: "Not A Slug" }));
    expect(response.status).toBe(404);
    expect(auth.queries).not.toHaveBeenCalled();
  });

  it("return 404 for a team that doesn't exist", async () => {
    const response = await receipt.GET(get("/api/teams/nobody/receipt"), params({ slug: "nobody" }));
    expect(response.status).toBe(404);
  });
});
