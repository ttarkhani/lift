import { requireUser } from "@/server/auth/guards";
import { errorResponse } from "@/server/errors";

export async function GET() {
  try {
    const viewer = await requireUser();
    return Response.json({
      user: { id: viewer.userId, displayName: viewer.displayName, email: viewer.email },
      team: viewer.team,
      roles: viewer.roles,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
