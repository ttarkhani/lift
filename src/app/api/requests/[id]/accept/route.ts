import { requestAction } from "@/server/request-actions";
import { acceptRequest } from "@/server/services/requests";

export const POST = requestAction(acceptRequest, (r) => `You're helping Team ${r.requestingTeam}`);
