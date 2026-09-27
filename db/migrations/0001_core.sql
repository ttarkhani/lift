-- Core tables: teams, people, invites, help requests, threads, outcomes, and organizer actions.
-- Scoring tables arrive in step 4 and review tables in step 5.

create table teams (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null unique check (btrim(name) <> ''),
  table_location text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table users (
  id bigint generated always as identity primary key,
  auth0_sub text not null unique,
  email text,
  display_name text not null,
  created_at timestamptz not null default now()
);

-- The primary key on user_id is what limits each person to one team.
create table team_members (
  user_id bigint primary key references users (id),
  team_id bigint not null references teams (id),
  skills text[] not null default '{}',
  joined_at timestamptz not null default now()
);
create index team_members_team_id_idx on team_members (team_id);

create table invites (
  code text primary key,
  team_id bigint not null references teams (id),
  max_uses integer not null default 4 check (max_uses > 0),
  uses integer not null default 0 check (uses >= 0 and uses <= max_uses),
  created_by bigint references users (id),
  created_at timestamptz not null default now()
);
create index invites_team_id_idx on invites (team_id);

create table help_requests (
  id bigint generated always as identity primary key,
  requesting_team_id bigint not null references teams (id),
  created_by bigint not null references users (id),
  title text not null check (btrim(title) <> ''),
  description text not null,
  tags text[] not null default '{}',
  tried text not null default '',
  status text not null default 'open'
    check (status in ('open', 'accepted', 'outcome_submitted', 'resolved', 'cancelled')),
  helping_team_id bigint references teams (id),
  reopen_count integer not null default 0 check (reopen_count >= 0),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  resolved_at timestamptz,
  constraint help_requests_helper_is_other_team check (helping_team_id <> requesting_team_id)
);
create index help_requests_status_created_at_idx on help_requests (status, created_at desc);
create index help_requests_requesting_team_id_idx on help_requests (requesting_team_id);
create index help_requests_helping_team_id_idx on help_requests (helping_team_id);

create table messages (
  id bigint generated always as identity primary key,
  request_id bigint not null references help_requests (id),
  -- Null only for system messages.
  author_user_id bigint references users (id),
  kind text not null check (kind in ('text', 'snippet', 'system')),
  body text not null check (body <> ''),
  created_at timestamptz not null default now(),
  constraint messages_system_has_no_author check ((kind = 'system') = (author_user_id is null))
);
create index messages_request_id_created_at_idx on messages (request_id, created_at);

create table outcomes (
  id bigint generated always as identity primary key,
  request_id bigint not null references help_requests (id),
  helper_summary text not null check (btrim(helper_summary) <> ''),
  evidence_kind text not null check (evidence_kind in ('link', 'code_diff', 'text', 'screenshot_link')),
  evidence text not null check (btrim(evidence) <> ''),
  in_person boolean not null default false,
  submitted_by bigint not null references users (id),
  submitted_at timestamptz not null default now(),
  confirmed_by bigint references users (id),
  confirmed_at timestamptz,
  rejected_at timestamptz,
  constraint outcomes_confirmed_together check ((confirmed_by is null) = (confirmed_at is null)),
  constraint outcomes_not_confirmed_and_rejected check (confirmed_at is null or rejected_at is null)
);
create index outcomes_request_id_idx on outcomes (request_id);
-- A request can have many submitted outcomes but only one confirmed one.
create unique index outcomes_one_confirmed_per_request on outcomes (request_id) where confirmed_at is not null;

-- Every organizer decision, with its reason. Rows are never updated or deleted.
create table organizer_actions (
  id bigint generated always as identity primary key,
  organizer_user_id bigint not null references users (id),
  action text not null,
  target_type text not null,
  target_id bigint not null,
  reason text not null check (btrim(reason) <> ''),
  created_at timestamptz not null default now()
);
create index organizer_actions_target_idx on organizer_actions (target_type, target_id);

create function forbid_changes() returns trigger language plpgsql as $$
begin
  raise exception '% is append-only', tg_table_name;
end
$$;

create trigger organizer_actions_append_only
  before update or delete on organizer_actions
  for each row execute function forbid_changes();

create trigger organizer_actions_no_truncate
  before truncate on organizer_actions
  for each statement execute function forbid_changes();
