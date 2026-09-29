import { confirmMessage } from "@/domain/scoring";
import { requestAction } from "@/server/request-actions";
import { confirmOutcome } from "@/server/services/requests";

export const POST = requestAction(confirmOutcome, ({ award }) => confirmMessage(award));
