import { idSchema, moveMemberSchema } from "@/domain/teams";
import { requireOrganizer } from "@/server/auth/guards";
import { withTx } from "@/server/db/client";
import { errorResponse, NotFoundError } from "@/server/errors";
import { readJson } from "@/server/http";
import { moveMember } from "@/server/services/teams";

export async function POST(request: Request, ctx: RouteContext<"/api/organizer/members/[userId]/move">) {
  try {
    const organizer = await requireOrganizer();
    const userId = idSchema.safeParse((await ctx.params).userId);
    if (!userId.success) throw new NotFoundError("That person isn't on a team.");
    const input = moveMemberSchema.parse(await readJson(request));
    const move = await withTx((tx) => moveMember(tx, organizer, userId.data, input));
    return Response.json(move);
  } catch (error) {
    return errorResponse(error);
  }
}
