-- Activity history for analytics. Scoring never reads from here; points come from awards (step 4).

create extension if not exists timescaledb;

-- One row per state change, written in the same transaction as the change.
-- team_id is the acting team, counterpart_team_id the other team involved.
-- duration_s: seconds waited before help (request_accepted) or spent solving (resolution_confirmed).
-- A hypertable's unique indexes must include the time column, so there is no id primary key.
create table activity_events (
  time timestamptz not null default now(),
  event_type text not null check (event_type in (
    'team_created', 'member_joined', 'member_moved',
    'request_posted', 'request_accepted', 'request_released', 'request_cancelled', 'request_reopened',
    'message_sent', 'outcome_submitted', 'outcome_rejected', 'resolution_confirmed',
    'award_changed', 'flag_raised', 'flag_resolved'
  )),
  team_id bigint references teams (id),
  counterpart_team_id bigint references teams (id),
  request_id bigint references help_requests (id),
  actor_user_id bigint references users (id),
  is_demo boolean not null default false,
  duration_s integer check (duration_s >= 0),
  payload jsonb not null default '{}'
) with (tsdb.hypertable, tsdb.partition_column = 'time');

create index activity_events_request_id_time_idx on activity_events (request_id, time desc);
create index activity_events_team_id_time_idx on activity_events (team_id, time desc);

-- Real-time aggregation (materialized_only = false) has been off by default since TimescaleDB 2.13;
-- it's on here so charts include events newer than the last refresh.

create materialized view activity_5m
with (timescaledb.continuous, timescaledb.materialized_only = false) as
select
  time_bucket('5 minutes', time) as bucket,
  is_demo,
  event_type,
  count(*) as events
from activity_events
group by bucket, is_demo, event_type
with no data;

select add_continuous_aggregate_policy('activity_5m',
  start_offset => interval '1 day',
  end_offset => interval '5 minutes',
  schedule_interval => interval '5 minutes');

-- Confirmed resolutions per unordered pair of teams.
create materialized view pair_resolutions_1h
with (timescaledb.continuous, timescaledb.materialized_only = false) as
select
  time_bucket('1 hour', time) as bucket,
  is_demo,
  least(team_id, counterpart_team_id) as team_a_id,
  greatest(team_id, counterpart_team_id) as team_b_id,
  count(*) as resolutions
from activity_events
where event_type = 'resolution_confirmed'
group by bucket, is_demo, team_a_id, team_b_id
with no data;

select add_continuous_aggregate_policy('pair_resolutions_1h',
  start_offset => interval '3 days',
  end_offset => interval '1 hour',
  schedule_interval => interval '30 minutes');

-- Average seconds from posting to acceptance (wait) and from acceptance to confirmation (solve).
create materialized view response_times_15m
with (timescaledb.continuous, timescaledb.materialized_only = false) as
select
  time_bucket('15 minutes', time) as bucket,
  is_demo,
  avg(duration_s) filter (where event_type = 'request_accepted') as avg_wait_s,
  avg(duration_s) filter (where event_type = 'resolution_confirmed') as avg_solve_s,
  count(*) filter (where event_type = 'request_accepted') as accepted,
  count(*) filter (where event_type = 'resolution_confirmed') as resolved
from activity_events
where event_type in ('request_accepted', 'resolution_confirmed')
group by bucket, is_demo
with no data;

select add_continuous_aggregate_policy('response_times_15m',
  start_offset => interval '1 day',
  end_offset => interval '15 minutes',
  schedule_interval => interval '15 minutes');
