import type { Tx } from "@/server/db/client";

export type OrganizerAction = {
  organizerUserId: string;
  /** What was done, such as "move_member". */
  action: string;
  targetType: "team" | "user";
  targetId: string;
  reason: string;
};

/** Appends a row to organizer_actions. The table rejects blank reasons, updates, and deletes. */
export async function recordOrganizerAction(tx: Tx, entry: OrganizerAction): Promise<void> {
  await tx`
    insert into organizer_actions (organizer_user_id, action, target_type, target_id, reason)
    values (${entry.organizerUserId}, ${entry.action}, ${entry.targetType}, ${entry.targetId}, ${entry.reason})
  `;
}
