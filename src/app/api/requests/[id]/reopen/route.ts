import { requestAction } from "@/server/request-actions";
import { reopenRequest } from "@/server/services/requests";

export const POST = requestAction(reopenRequest, () => "Blocker reopened");
