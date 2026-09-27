-- Activity types for account changes: a person's first sign-in and an organizer issuing an invite code.

alter table activity_events drop constraint activity_events_event_type_check;
alter table activity_events add constraint activity_events_event_type_check check (event_type in (
  'user_created', 'team_created', 'invite_issued', 'member_joined', 'member_moved',
  'request_posted', 'request_accepted', 'request_released', 'request_cancelled', 'request_reopened',
  'message_sent', 'outcome_submitted', 'outcome_rejected', 'resolution_confirmed',
  'award_changed', 'flag_raised', 'flag_resolved'
));
