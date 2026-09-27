import { idSchema, issueInviteSchema } from "@/domain/teams";
import { requireOrganizer } from "@/server/auth/guards";
import { withTx } from "@/server/db/client";
import { errorResponse, NotFoundError } from "@/server/errors";
import { readJson } from "@/server/http";
import { issueInvite } from "@/server/services/teams";

export async function POST(request: Request, ctx: RouteContext<"/api/organizer/teams/[id]/invites">) {
  try {
    const organizer = await requireOrganizer();
    const teamId = idSchema.safeParse((await ctx.params).id);
    if (!teamId.success) throw new NotFoundError("That team doesn't exist.");
    const input = issueInviteSchema.parse(await readJson(request));
    const invite = await withTx((tx) => issueInvite(tx, organizer, teamId.data, input));
    return Response.json({ invite }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
