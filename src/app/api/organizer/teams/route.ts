import { createTeamSchema } from "@/domain/teams";
import { requireOrganizer } from "@/server/auth/guards";
import { withTx } from "@/server/db/client";
import { errorResponse } from "@/server/errors";
import { readJson } from "@/server/http";
import { createTeam } from "@/server/services/teams";

export async function POST(request: Request) {
  try {
    const organizer = await requireOrganizer();
    const input = createTeamSchema.parse(await readJson(request));
    const team = await withTx((tx) => createTeam(tx, organizer, input));
    return Response.json({ team }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
