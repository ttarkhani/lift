import type { SessionData } from "@auth0/nextjs-auth0/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ROLES_CLAIM } from "@/domain/roles";
import { beforeSessionSaved, isAuth0Configured } from "./auth0";

function session(user: SessionData["user"]): SessionData {
  return {
    user,
    tokenSet: { accessToken: "at", expiresAt: 0 },
    internal: { sid: "sid", createdAt: 0 },
  };
}

describe("beforeSessionSaved", () => {
  it("keeps the default claims and the roles claim, and drops the rest", async () => {
    const saved = await beforeSessionSaved(
      session({ sub: "auth0|1", name: "Sam", email: "sam@example.test", [ROLES_CLAIM]: ["organizer"], extra: "x" }),
    );
    expect(saved.user).toEqual({ sub: "auth0|1", name: "Sam", email: "sam@example.test", [ROLES_CLAIM]: ["organizer"] });
    expect(saved.tokenSet.accessToken).toBe("at");
  });

  it("leaves the roles claim out when the token has none", async () => {
    const saved = await beforeSessionSaved(session({ sub: "auth0|1" }));
    expect(saved.user).toEqual({ sub: "auth0|1" });
  });
});

describe("isAuth0Configured", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("needs all four Auth0 variables", () => {
    vi.stubEnv("AUTH0_DOMAIN", "dev-lifts.us.auth0.com");
    vi.stubEnv("AUTH0_CLIENT_ID", "id");
    vi.stubEnv("AUTH0_CLIENT_SECRET", "secret");
    vi.stubEnv("AUTH0_SECRET", "");
    expect(isAuth0Configured()).toBe(false);
    vi.stubEnv("AUTH0_SECRET", "ab".repeat(32));
    expect(isAuth0Configured()).toBe(true);
  });
});
