import "./load-env";
import { createSql } from "@/server/db/client";
import { env } from "@/server/env";
import { verifyLedger } from "@/server/services/awards";

// Read-only, so it's safe against any database, production included.
async function main() {
  const sql = createSql(env.databaseUrl, { max: 1 });
  try {
    // One read-only snapshot, so awards and the ledger are compared at the same moment.
    const check = await sql.begin("isolation level repeatable read read only", (tx) => verifyLedger(tx));
    if (check.problems.length > 0) {
      console.error(`The ledger doesn't match awards (${check.problems.length} problems):`);
      for (const problem of check.problems) console.error(`  ${problem}`);
      process.exitCode = 1;
      return;
    }
    console.log(`Ledger OK: ${check.awards} awards and ${check.teams} teams match.`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
