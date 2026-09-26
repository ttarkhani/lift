import { z } from "zod";

// Each variable is validated on first use, so builds and CI run without secrets
// and a missing value only fails the feature that needs it.
const schema = z.object({
  APP_BASE_URL: z.url(),
  EVENT_NAME: z.string().min(1),
  EVENT_TIMEZONE: z.string().refine(isTimeZone, "Must be an IANA time zone"),
});

type Env = z.infer<typeof schema>;
type EnvKey = keyof Env;

const cache: Partial<Env> = {};

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
    const raw = process.env[key];
    if (raw === undefined || raw === "") {
      throw new Error(
        `Missing environment variable ${key}. Set it in .env.local (see .env.example).`,
      );
    }
    const result = schema.shape[key].safeParse(raw);
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
};
