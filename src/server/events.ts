import type postgres from "postgres";
import type { Tx } from "@/server/db/client";

export const ACTIVITY_EVENT_TYPES = [
  "team_created",
  "member_joined",
  "member_moved",
  "request_posted",
  "request_accepted",
  "request_released",
  "request_cancelled",
  "request_reopened",
  "message_sent",
  "outcome_submitted",
  "outcome_rejected",
  "resolution_confirmed",
  "award_changed",
  "flag_raised",
  "flag_resolved",
] as const;
export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number];

/** Database ids arrive from postgres.js as strings (bigint); numbers are accepted too. */
type Id = string | number;

export type ActivityEvent = {
  type: ActivityEventType;
  /** The acting team. */
  teamId?: Id | null;
  /** The other team involved, such as the helper on a confirmation. */
  counterpartTeamId?: Id | null;
  requestId?: Id | null;
  actorUserId?: Id | null;
  /** Seconds waited (request_accepted) or spent solving (resolution_confirmed). */
  durationS?: number | null;
  payload?: Record<string, postgres.JSONValue>;
  /** Defaults to the transaction's time. */
  time?: Date;
};

/**
 * Records a state change in activity_events. Call it with the same transaction as the
 * change itself. `is_demo` is copied from the acting team (or the counterpart when there
 * is no acting team), so analytics can leave demo teams out.
 */
export async function emitActivity(tx: Tx, event: ActivityEvent): Promise<void> {
  const teamId = event.teamId ?? null;
  const counterpartTeamId = event.counterpartTeamId ?? null;
  await tx`
    insert into activity_events (
      time, event_type, team_id, counterpart_team_id, request_id, actor_user_id,
      is_demo, duration_s, payload
    )
    select
      coalesce(${event.time ?? null}::timestamptz, now()),
      ${event.type},
      ${teamId}::bigint,
      ${counterpartTeamId}::bigint,
      ${event.requestId ?? null}::bigint,
      ${event.actorUserId ?? null}::bigint,
      coalesce(
        (select is_demo from teams where id = coalesce(${teamId}::bigint, ${counterpartTeamId}::bigint)),
        false
      ),
      ${event.durationS ?? null}::integer,
      ${tx.json(event.payload ?? {})}
  `;
}
