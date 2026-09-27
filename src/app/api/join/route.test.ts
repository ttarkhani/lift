import { afterEach, describe, expect, it, vi } from "vitest";
import { auth, jsonRequest, mocks, participant, signInAs } from "../../../../test/route-auth";

vi.mock("@/server/auth/auth0", () => mocks.auth0());
vi.mock("@/server/auth/viewer", (importOriginal) => mocks.viewer(importOriginal as never));
vi.mock("@/server/db/client", (importOriginal) => mocks.db(importOriginal as never));

const { POST } = await import("./route");

describe("POST /api/join", () => {
  afterEach(() => signInAs(null));

  it("returns 401 when signed out", async () => {
    const response = await POST(jsonRequest("/api/join", { code: "MAPLE-7K3Q" }));
    expect(response.status).toBe(401);
    expect(auth.queries).not.toHaveBeenCalled();
  });

  it("rejects unknown skills with 400", async () => {
    signInAs({ ...participant, team: null });
    const response = await POST(jsonRequest("/api/join", { code: "MAPLE-7K3Q", skills: ["juggling"] }));
    expect(response.status).toBe(400);
    expect(auth.queries).not.toHaveBeenCalled();
  });

  it("ignores a teamId sent by the client", async () => {
    signInAs({ ...participant, team: null });
    auth.queries.mockReturnValueOnce([]).mockReturnValueOnce([]);
    const response = await POST(jsonRequest("/api/join", { code: "NOPE-2345", teamId: "1" }));
    // The code decides the team; with no matching invite it's a 404, whatever teamId says.
    expect(response.status).toBe(404);
  });
});
