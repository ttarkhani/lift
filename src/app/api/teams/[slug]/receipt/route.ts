import { withTx } from "@/server/db/client";
import { errorResponse, NotFoundError } from "@/server/errors";
import { getReceipt } from "@/server/services/awards";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Public. Points, explanations, and agreed summaries, never thread messages. */
export async function GET(_request: Request, ctx: RouteContext<"/api/teams/[slug]/receipt">) {
  try {
    const { slug } = await ctx.params;
    if (!SLUG.test(slug)) throw new NotFoundError("That team doesn't exist.");
    return Response.json(await withTx((tx) => getReceipt(tx, slug)));
  } catch (error) {
    return errorResponse(error);
  }
}
