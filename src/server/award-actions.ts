import { awardDecisionSchema, type AwardDecisionInput } from "@/domain/scoring";
import { requireOrganizer } from "@/server/auth/guards";
import type { Viewer } from "@/server/auth/viewer";
import { withTx, type Tx } from "@/server/db/client";
import { errorResponse } from "@/server/errors";
import { readJson, routeId } from "@/server/http";
import type { AwardView } from "@/server/services/awards";

type Context = { params: Promise<{ id: string }> };

/** A POST handler for an organizer's award decision: guard, reason, then the service in one transaction. */
export function awardAction(
  service: (tx: Tx, actor: Viewer, awardId: string, input: AwardDecisionInput) => Promise<AwardView>,
  message: string,
) {
  return async function POST(request: Request, ctx: Context) {
    try {
      const organizer = await requireOrganizer();
      const awardId = routeId((await ctx.params).id, "That award doesn't exist.");
      const input = awardDecisionSchema.parse(await readJson(request));
      const award = await withTx((tx) => service(tx, organizer, awardId, input));
      return Response.json({ award, message });
    } catch (error) {
      return errorResponse(error);
    }
  };
}
