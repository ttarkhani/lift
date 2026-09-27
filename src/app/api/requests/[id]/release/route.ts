import { requestAction } from "@/server/request-actions";
import { releaseRequest } from "@/server/services/requests";

export const POST = requestAction(releaseRequest, (r) => `You stopped helping Team ${r.requestingTeam}`);
