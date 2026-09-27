import { z } from "zod";
import { sendMessageSchema } from "@/domain/requests";
import { idSchema } from "@/domain/teams";
import { requireUser } from "@/server/auth/guards";
import { withTx } from "@/server/db/client";
import { errorResponse } from "@/server/errors";
import { readJson, routeId } from "@/server/http";
import { listMessages, sendMessage } from "@/server/services/requests";

const querySchema = z.object({ after: idSchema.optional() });

export async function GET(request: Request, ctx: RouteContext<"/api/requests/[id]/messages">) {
  try {
    const viewer = await requireUser();
    const requestId = routeId((await ctx.params).id, "That blocker doesn't exist.");
    const { after } = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return Response.json({ messages: await withTx((tx) => listMessages(tx, viewer, requestId, after)) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, ctx: RouteContext<"/api/requests/[id]/messages">) {
  try {
    const viewer = await requireUser();
    const requestId = routeId((await ctx.params).id, "That blocker doesn't exist.");
    const input = sendMessageSchema.parse(await readJson(request));
    const message = await withTx((tx) => sendMessage(tx, viewer, requestId, input));
    return Response.json({ message }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
