-- A reopened request can be helped and resolved again, but it never gets a second confirmed
-- outcome or a second award. The later confirmation is recorded as reconfirmed_at instead.

alter table outcomes add column reconfirmed_by bigint references users (id);
alter table outcomes add column reconfirmed_at timestamptz;
alter table outcomes add constraint outcomes_reconfirmed_together
  check ((reconfirmed_by is null) = (reconfirmed_at is null));
alter table outcomes add constraint outcomes_one_decision
  check (num_nonnulls(confirmed_at, reconfirmed_at, rejected_at) <= 1);

-- Its own activity type, so analytics don't count the same request's resolution twice.
alter table activity_events drop constraint activity_events_event_type_check;
alter table activity_events add constraint activity_events_event_type_check check (event_type in (
  'user_created', 'team_created', 'invite_issued', 'member_joined', 'member_moved',
  'request_posted', 'request_accepted', 'request_released', 'request_cancelled', 'request_reopened',
  'message_sent', 'outcome_submitted', 'outcome_rejected', 'resolution_confirmed', 'resolution_reconfirmed',
  'award_changed', 'flag_raised', 'flag_resolved'
));
