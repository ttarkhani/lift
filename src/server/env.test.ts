import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function loadEnv() {
  vi.resetModules();
  return (await import("./env")).env;
}

describe("env", () => {
  beforeEach(() => {
    vi.stubEnv("APP_BASE_URL", "http://localhost:3000");
    vi.stubEnv("EVENT_NAME", "Hack the Hill");
    vi.stubEnv("EVENT_TIMEZONE", "America/Toronto");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads typed values", async () => {
    const env = await loadEnv();
    expect(env.appBaseUrl).toBe("http://localhost:3000");
    expect(env.eventName).toBe("Hack the Hill");
    expect(env.eventTimezone).toBe("America/Toronto");
  });

  it("only fails when a missing variable is read", async () => {
    vi.stubEnv("EVENT_NAME", undefined);
    const env = await loadEnv();
    expect(env.appBaseUrl).toBe("http://localhost:3000");
    expect(() => env.eventName).toThrow(/EVENT_NAME/);
  });

  it("rejects invalid values", async () => {
    vi.stubEnv("APP_BASE_URL", "not a url");
    vi.stubEnv("EVENT_TIMEZONE", "Mars/Olympus");
    const env = await loadEnv();
    expect(() => env.appBaseUrl).toThrow(/APP_BASE_URL/);
    expect(() => env.eventTimezone).toThrow(/EVENT_TIMEZONE/);
  });

  it("reads database settings", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://lifts:lifts@localhost:5432/lifts");
    vi.stubEnv("ALLOW_REMOTE_SEED", undefined);
    const env = await loadEnv();
    expect(env.databaseUrl).toBe("postgres://lifts:lifts@localhost:5432/lifts");
    expect(env.allowRemoteSeed).toBe(false);
  });

  it("parses ALLOW_REMOTE_SEED and rejects non-postgres URLs", async () => {
    vi.stubEnv("ALLOW_REMOTE_SEED", "1");
    vi.stubEnv("TEST_DATABASE_URL", "mysql://localhost/lift_test");
    const env = await loadEnv();
    expect(env.allowRemoteSeed).toBe(true);
    expect(() => env.testDatabaseUrl).toThrow(/TEST_DATABASE_URL/);
  });

  it("reads Auth0 settings and rejects a domain with a scheme or a short secret", async () => {
    vi.stubEnv("AUTH0_DOMAIN", "dev-lifts.us.auth0.com");
    vi.stubEnv("AUTH0_CLIENT_ID", "client-id");
    vi.stubEnv("AUTH0_CLIENT_SECRET", "client-secret");
    vi.stubEnv("AUTH0_SECRET", "ab".repeat(32));
    let env = await loadEnv();
    expect(env.auth0Domain).toBe("dev-lifts.us.auth0.com");
    expect(env.auth0ClientId).toBe("client-id");
    expect(env.auth0ClientSecret).toBe("client-secret");
    expect(env.auth0Secret).toBe("ab".repeat(32));

    vi.stubEnv("AUTH0_DOMAIN", "https://dev-lifts.us.auth0.com");
    vi.stubEnv("AUTH0_SECRET", "too-short");
    env = await loadEnv();
    expect(() => env.auth0Domain).toThrow(/AUTH0_DOMAIN/);
    expect(() => env.auth0Secret).toThrow(/AUTH0_SECRET/);
  });
});
