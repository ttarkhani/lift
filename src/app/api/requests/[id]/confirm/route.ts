import { requestAction } from "@/server/request-actions";
import { confirmOutcome } from "@/server/services/requests";

export const POST = requestAction(confirmOutcome, ({ award }) =>
  award ? `Fix confirmed. Team ${award.helpingTeam.name} earned ${award.points} points.` : "Fix confirmed.",
);
