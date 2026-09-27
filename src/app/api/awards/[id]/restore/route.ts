import { awardAction } from "@/server/award-actions";
import { restoreAward } from "@/server/services/awards";

export const POST = awardAction(restoreAward, "Award restored");
