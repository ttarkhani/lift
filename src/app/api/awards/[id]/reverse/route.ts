import { awardAction } from "@/server/award-actions";
import { reverseAward } from "@/server/services/awards";

export const POST = awardAction(reverseAward, "Award reversed");
