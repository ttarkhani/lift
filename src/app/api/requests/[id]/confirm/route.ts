import { requestAction } from "@/server/request-actions";
import { confirmOutcome } from "@/server/services/requests";

export const POST = requestAction(confirmOutcome, () => "Fix confirmed.");
