-- Scoring: one award per confirmed request, and an append-only ledger of every points change.
-- Only recomputePair() (src/server/services/awards.ts) writes awards.points and pair_sequence.

create table awards (
  id bigint generated always as identity primary key,
  -- One award per request, however often it is reopened and confirmed again.
  request_id bigint not null unique references help_requests (id),
  -- The request's first confirmed outcome.
  outcome_id bigint not null references outcomes (id),
  helping_team_id bigint not null references teams (id),
  recipient_team_id bigint not null references teams (id),
  -- The unordered pair, so A→B and B→A share one allowance.
  team_low_id bigint not null references teams (id),
  team_high_id bigint not null references teams (id),
  -- 1 for the pair's first counted resolution, 2 for the second, and so on. Null while reversed.
  pair_sequence integer check (pair_sequence > 0),
  points integer not null default 0 check (points >= 0),
  explanation text not null default '',
  status text not null default 'awarded' check (status in ('awarded', 'reversed')),
  reversal_reason text,
  confirmed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint awards_pair_ordered check (team_low_id < team_high_id),
  constraint awards_pair_matches_teams check (
    team_low_id = least(helping_team_id, recipient_team_id)
    and team_high_id = greatest(helping_team_id, recipient_team_id)
  ),
  constraint awards_reversal_has_reason check (
    (status = 'reversed') = (reversal_reason is not null and btrim(reversal_reason) <> '')
  )
);
-- The order recomputePair sequences a pair in.
create index awards_pair_order_idx on awards (team_low_id, team_high_id, confirmed_at, id);
create index awards_helping_team_id_idx on awards (helping_team_id);
create index awards_recipient_team_id_idx on awards (recipient_team_id);

-- One row per change to an award's points or sequence. points_after is the award's points after
-- the change, so an award's deltas always add up to its current points.
create table points_ledger (
  id bigint generated always as identity primary key,
  award_id bigint not null references awards (id),
  -- The helping team, who the points belong to.
  team_id bigint not null references teams (id),
  delta integer not null,
  points_after integer not null check (points_after >= 0),
  reason text not null check (reason in ('awarded', 'resequenced', 'reversed', 'restored')),
  -- The organizer decision behind the change, if there was one.
  organizer_action_id bigint references organizer_actions (id),
  created_at timestamptz not null default now()
);
create index points_ledger_award_id_idx on points_ledger (award_id, id);
create index points_ledger_team_id_idx on points_ledger (team_id);

create trigger points_ledger_append_only
  before update or delete on points_ledger
  for each row execute function forbid_changes();

create trigger points_ledger_no_truncate
  before truncate on points_ledger
  for each statement execute function forbid_changes();
