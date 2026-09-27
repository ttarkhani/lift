// Vitest global setup: gives integration tests a freshly migrated TEST_DATABASE_URL.
import { createSql, isLocalDatabaseUrl } from "../src/server/db/client";
import { dropSchema, migrate } from "../src/server/db/migrate";

export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    console.log("TEST_DATABASE_URL isn't set, so database integration tests are skipped.");
    return;
  }
  if (!isLocalDatabaseUrl(url) && !process.env.CI) {
    throw new Error("TEST_DATABASE_URL must point at a local database (outside CI), because tests wipe it.");
  }

  // Dropping the schema drops the TimescaleDB extension, so migrate from a fresh session.
  const drop = createSql(url, { max: 1 });
  await dropSchema(drop).finally(() => drop.end());
  const sql = createSql(url, { max: 1 });
  await migrate(sql).finally(() => sql.end());
}
