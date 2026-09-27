import { afterEach, describe, expect, it, vi } from "vitest";
import { mocks, organizer, participant, signInAs } from "../../../../test/route-auth";

vi.mock("@/server/auth/auth0", () => mocks.auth0());
vi.mock("@/server/auth/viewer", (importOriginal) => mocks.viewer(importOriginal as never));
vi.mock("@/server/db/client", (importOriginal) => mocks.db(importOriginal as never));

const { GET } = await import("./route");

describe("GET /api/me", () => {
  afterEach(() => signInAs(null));

  it("returns 401 when signed out", async () => {
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("returns the viewer's team and roles", async () => {
    signInAs(participant);
    expect(await (await GET()).json()).toEqual({
      user: { id: "10", displayName: "Sam Okafor", email: "sam@example.test" },
      team: participant.team,
      roles: [],
    });
    signInAs(organizer);
    expect((await (await GET()).json()).roles).toEqual(["organizer"]);
  });
});
