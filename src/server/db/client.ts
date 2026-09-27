import postgres from "postgres";
import { env } from "@/server/env";

export type Sql = postgres.Sql;
export type Tx = postgres.TransactionSql;

/**
 * Connection options for a database URL. `sslmode=require` in the URL turns on SSL
 * (Tiger Cloud needs it). Tiger Cloud's transaction pooler (database `tsdb_transaction`)
 * can't keep prepared statements between transactions, so they're off there.
 */
export function connectionOptions(url: string): postgres.Options<Record<string, never>> {
  const database = decodeURIComponent(new URL(url).pathname.slice(1));
  return {
    prepare: database !== "tsdb_transaction",
    onnotice: () => {},
  };
}

export function createSql(url: string, options: postgres.Options<Record<string, never>> = {}): Sql {
  return postgres(url, { ...connectionOptions(url), ...options });
}

/** True when `error` is a unique-constraint violation, optionally on one named constraint. */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  if (!(error instanceof postgres.PostgresError) || error.code !== "23505") return false;
  return constraint === undefined || error.constraint_name === constraint;
}

/** True only for loopback hosts, so a production container named "db" never counts as local. */
export function isLocalDatabaseUrl(url: string): boolean {
  const host = new URL(url).hostname;
  return ["localhost", "127.0.0.1", "[::1]"].includes(host);
}

// Kept on globalThis so dev-server reloads reuse one pool.
const globalForDb = globalThis as { liftsSql?: Sql };

/** The app's shared client, created on first use from DATABASE_URL. */
export function getSql(): Sql {
  globalForDb.liftsSql ??= createSql(env.databaseUrl);
  return globalForDb.liftsSql;
}

/** Runs `fn` in a transaction on the shared client. It commits if `fn` resolves and rolls back if it throws. */
export function withTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return getSql().begin(fn) as Promise<T>;
}
