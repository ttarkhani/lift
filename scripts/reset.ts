import "./load-env";
import { createSql, isLocalDatabaseUrl } from "@/server/db/client";
import { dropSchema, migrate } from "@/server/db/migrate";
import { seed } from "@/server/db/seed";
import { env } from "@/server/env";

async function main() {
  const url = env.databaseUrl;
  if (!isLocalDatabaseUrl(url)) {
    throw new Error("db:reset only runs against a local database.");
  }

  // Dropping the schema also drops the TimescaleDB extension, which should be
  // recreated from a fresh session, so each phase gets its own connection.
  const drop = createSql(url, { max: 1 });
  await dropSchema(drop).finally(() => drop.end());
  console.log("Dropped the public schema.");

  const sql = createSql(url, { max: 1 });
  try {
    for (const file of await migrate(sql)) console.log(`Applied ${file}`);
    const { invites } = await seed(sql);
    console.log("Seeded teams. Invite codes:");
    for (const { team, code } of invites) console.log(`  ${team.padEnd(8)} ${code}`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
