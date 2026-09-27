import { requestAction } from "@/server/request-actions";
import { cancelRequest } from "@/server/services/requests";

export const POST = requestAction(cancelRequest, () => "Blocker cancelled");
