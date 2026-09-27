import { listRequestsSchema, postRequestSchema } from "@/domain/requests";
import { requireUser } from "@/server/auth/guards";
import { withTx } from "@/server/db/client";
import { errorResponse } from "@/server/errors";
import { readJson } from "@/server/http";
import { listRequests, postRequest } from "@/server/services/requests";

export async function GET(request: Request) {
  try {
    const viewer = await requireUser();
    const input = listRequestsSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return Response.json(await withTx((tx) => listRequests(tx, viewer, input)));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const viewer = await requireUser();
    const input = postRequestSchema.parse(await readJson(request));
    const posted = await withTx((tx) => postRequest(tx, viewer, input));
    return Response.json({ request: posted, message: "Blocker posted" }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
