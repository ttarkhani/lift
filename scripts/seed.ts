import "./load-env";
import { createSql, isLocalDatabaseUrl } from "@/server/db/client";
import { seed, type SeedResult } from "@/server/db/seed";
import { env } from "@/server/env";

function printInvites({ invites }: SeedResult) {
  console.log("Seeded teams. Invite codes:");
  for (const { team, code } of invites) console.log(`  ${team.padEnd(8)} ${code}`);
}

async function main() {
  const url = env.databaseUrl;
  if (!isLocalDatabaseUrl(url) && !env.allowRemoteSeed) {
    throw new Error(
      "DATABASE_URL isn't local. Set ALLOW_REMOTE_SEED=1 to seed it anyway, and never seed production.",
    );
  }
  const sql = createSql(url, { max: 1 });
  try {
    printInvites(await seed(sql));
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
