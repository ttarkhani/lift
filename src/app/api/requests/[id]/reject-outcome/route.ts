import { requestAction } from "@/server/request-actions";
import { rejectOutcome } from "@/server/services/requests";

export const POST = requestAction(rejectOutcome, (r) => `Sent back to Team ${r.helpingTeam}`);
