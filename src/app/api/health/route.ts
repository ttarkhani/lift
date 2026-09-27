import { getSql } from "@/server/db/client";

const DB_TIMEOUT_MS = 2000;

async function pingDatabase(): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Database ping timed out")), DB_TIMEOUT_MS);
    });
    await Promise.race([getSql()`select 1`, timeout]);
    return true;
  } catch (error) {
    console.error("Health check: database unavailable", error);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const dbUp = await pingDatabase();
  return Response.json(
    { ok: dbUp, db: dbUp ? "up" : "down" },
    { status: dbUp ? 200 : 503 },
  );
}
