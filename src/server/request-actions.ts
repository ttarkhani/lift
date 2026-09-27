import type { Viewer } from "@/server/auth/viewer";
import { requireUser } from "@/server/auth/guards";
import { withTx, type Tx } from "@/server/db/client";
import { errorResponse } from "@/server/errors";
import { routeId } from "@/server/http";
import type { RequestRef } from "@/server/services/requests";

type Context = { params: Promise<{ id: string }> };

/**
 * A POST handler for a request action with no body (accept, release, cancel, and so on):
 * guard, then the service in one transaction. The response carries the message the UI shows.
 */
export function requestAction<T extends RequestRef>(
  service: (tx: Tx, actor: Viewer, requestId: string) => Promise<T>,
  message: (result: T) => string,
) {
  return async function POST(_request: Request, ctx: Context) {
    try {
      const viewer = await requireUser();
      const requestId = routeId((await ctx.params).id, "That blocker doesn't exist.");
      const result = await withTx((tx) => service(tx, viewer, requestId));
      return Response.json({ request: result, message: message(result) });
    } catch (error) {
      return errorResponse(error);
    }
  };
}
