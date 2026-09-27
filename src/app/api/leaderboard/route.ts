import { withTx } from "@/server/db/client";
import { errorResponse } from "@/server/errors";
import { getLeaderboard } from "@/server/services/awards";

/** Public. Demo teams only with ?demo=1. */
export async function GET(request: Request) {
  try {
    const includeDemo = new URL(request.url).searchParams.get("demo") === "1";
    const entries = await withTx((tx) => getLeaderboard(tx, { includeDemo }));
    return Response.json({ entries });
  } catch (error) {
    return errorResponse(error);
  }
}
