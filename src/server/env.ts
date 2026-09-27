import { z } from "zod";

// Each variable is validated on first use, so builds and CI run without secrets
// and a missing value only fails the feature that needs it.
const schema = z.object({
  APP_BASE_URL: z.url(),
  EVENT_NAME: z.string().min(1),
  EVENT_TIMEZONE: z.string().refine(isTimeZone, "Must be an IANA time zone"),
  DATABASE_URL: postgresUrl(),
  TEST_DATABASE_URL: postgresUrl(),
  ALLOW_REMOTE_SEED: z
    .enum(["0", "1"])
    .default("0")
    .transform((value) => value === "1"),
  AUTH0_DOMAIN: z
    .string()
    .regex(/^[a-z0-9.-]+$/i, "Must be a bare domain like dev-abc123.us.auth0.com, without https://"),
  AUTH0_CLIENT_ID: z.string().min(1),
  AUTH0_CLIENT_SECRET: z.string().min(1),
  AUTH0_SECRET: z.string().regex(/^[0-9a-f]{64}$/i, "Must be 64 hex characters (openssl rand -hex 32)"),
});

type Env = z.infer<typeof schema>;
type EnvKey = keyof Env;

const cache: Partial<Env> = {};

function postgresUrl() {
  return z.url({
    protocol: /^postgres(ql)?$/,
    error: "Must be a postgres:// URL",
  });
}

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function read<K extends EnvKey>(key: K): Env[K] {
  if (!(key in cache)) {
    const raw = process.env[key] || undefined;
    const result = schema.shape[key].safeParse(raw);
    if (!result.success && raw === undefined) {
      throw new Error(
        `Missing environment variable ${key}. Set it in .env.local (see .env.example).`,
      );
    }
    if (!result.success) {
      throw new Error(
        `Invalid environment variable ${key}: ${z.prettifyError(result.error)}`,
      );
    }
    cache[key] = result.data as Env[K];
  }
  return cache[key] as Env[K];
}

export const env = {
  get appBaseUrl() {
    return read("APP_BASE_URL");
  },
  get eventName() {
    return read("EVENT_NAME");
  },
  get eventTimezone() {
    return read("EVENT_TIMEZONE");
  },
  get databaseUrl() {
    return read("DATABASE_URL");
  },
  get testDatabaseUrl() {
    return read("TEST_DATABASE_URL");
  },
  get allowRemoteSeed() {
    return read("ALLOW_REMOTE_SEED");
  },
  get auth0Domain() {
    return read("AUTH0_DOMAIN");
  },
  get auth0ClientId() {
    return read("AUTH0_CLIENT_ID");
  },
  get auth0ClientSecret() {
    return read("AUTH0_CLIENT_SECRET");
  },
  get auth0Secret() {
    return read("AUTH0_SECRET");
  },
};
