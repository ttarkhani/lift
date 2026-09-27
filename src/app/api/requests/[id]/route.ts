import { requireUser } from "@/server/auth/guards";
import { withTx } from "@/server/db/client";
import { errorResponse } from "@/server/errors";
import { routeId } from "@/server/http";
import { getRequestView } from "@/server/services/requests";

export async function GET(_request: Request, ctx: RouteContext<"/api/requests/[id]">) {
  try {
    const viewer = await requireUser();
    const requestId = routeId((await ctx.params).id, "That blocker doesn't exist.");
    return Response.json(await withTx((tx) => getRequestView(tx, viewer, requestId)));
  } catch (error) {
    return errorResponse(error);
  }
}
