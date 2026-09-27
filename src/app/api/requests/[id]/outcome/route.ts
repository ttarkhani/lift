import { submitOutcomeSchema } from "@/domain/requests";
import { requireUser } from "@/server/auth/guards";
import { withTx } from "@/server/db/client";
import { errorResponse } from "@/server/errors";
import { readJson, routeId } from "@/server/http";
import { submitOutcome } from "@/server/services/requests";

export async function POST(request: Request, ctx: RouteContext<"/api/requests/[id]/outcome">) {
  try {
    const viewer = await requireUser();
    const requestId = routeId((await ctx.params).id, "That blocker doesn't exist.");
    const input = submitOutcomeSchema.parse(await readJson(request));
    const result = await withTx((tx) => submitOutcome(tx, viewer, requestId, input));
    return Response.json({
      request: result,
      message: `Outcome submitted. Waiting for Team ${result.requestingTeam} to confirm.`,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
