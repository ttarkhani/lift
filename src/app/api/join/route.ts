import { joinTeamSchema } from "@/domain/teams";
import { requireUser } from "@/server/auth/guards";
import { withTx } from "@/server/db/client";
import { errorResponse } from "@/server/errors";
import { readJson } from "@/server/http";
import { joinTeam } from "@/server/services/teams";

export async function POST(request: Request) {
  try {
    const viewer = await requireUser();
    const input = joinTeamSchema.parse(await readJson(request));
    const team = await withTx((tx) => joinTeam(tx, viewer, input));
    return Response.json({ team }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
