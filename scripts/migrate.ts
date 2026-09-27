import "./load-env";
import { createSql } from "@/server/db/client";
import { migrate } from "@/server/db/migrate";
import { env } from "@/server/env";

async function main() {
  const sql = createSql(env.databaseUrl, { max: 1 });
  try {
    const applied = await migrate(sql);
    if (applied.length === 0) console.log("Database is up to date.");
    for (const file of applied) console.log(`Applied ${file}`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
