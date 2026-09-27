import { afterEach, describe, expect, it, vi } from "vitest";
import { auth, jsonRequest, mocks, params, participant, signInAs } from "../../../../test/route-auth";

vi.mock("@/server/auth/auth0", () => mocks.auth0());
vi.mock("@/server/auth/viewer", (importOriginal) => mocks.viewer(importOriginal as never));
vi.mock("@/server/db/client", (importOriginal) => mocks.db(importOriginal as never));

const list = await import("./route");
const detail = await import("./[id]/route");
const messages = await import("./[id]/messages/route");
const outcome = await import("./[id]/outcome/route");
const accept = await import("./[id]/accept/route");
const confirm = await import("./[id]/confirm/route");

function get(url: string) {
  return new Request(`http://localhost:3000${url}`);
}

describe("request routes", () => {
  afterEach(() => signInAs(null));

  it("return 401 to signed-out callers without touching the database", async () => {
    const responses = await Promise.all([
      list.GET(get("/api/requests")),
      list.POST(jsonRequest("/api/requests", { title: "x", description: "y" })),
      detail.GET(get("/api/requests/1"), params({ id: "1" })),
      messages.GET(get("/api/requests/1/messages"), params({ id: "1" })),
      accept.POST(jsonRequest("/api/requests/1/accept", {}), params({ id: "1" })),
      confirm.POST(jsonRequest("/api/requests/1/confirm", {}), params({ id: "1" })),
    ]);
    expect(responses.map((r) => r.status)).toEqual([401, 401, 401, 401, 401, 401]);
    expect(auth.queries).not.toHaveBeenCalled();
  });

  it("return 404 for a malformed request id", async () => {
    signInAs(participant);
    const response = await accept.POST(jsonRequest("/api/requests/abc/accept", {}), params({ id: "abc" }));
    expect(response.status).toBe(404);
    expect(auth.queries).not.toHaveBeenCalled();
  });

  it("validate bodies before touching the database", async () => {
    signInAs(participant);
    const blank = await list.POST(jsonRequest("/api/requests", { title: " ", description: "" }));
    expect(blank.status).toBe(400);
    expect(Object.keys((await blank.json()).error.details.fieldErrors)).toEqual(["title", "description"]);

    const badLink = await outcome.POST(
      jsonRequest("/api/requests/1/outcome", { summary: "Fixed", evidenceKind: "link", evidence: "not a link" }),
      params({ id: "1" }),
    );
    expect(badLink.status).toBe(400);

    const system = await messages.POST(
      jsonRequest("/api/requests/1/messages", { kind: "system", body: "Team Maple confirmed the fix" }),
      params({ id: "1" }),
    );
    expect(system.status).toBe(400);
    expect(auth.queries).not.toHaveBeenCalled();
  });
});
