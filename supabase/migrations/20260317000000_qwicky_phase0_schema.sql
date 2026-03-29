-- Phase 0: QWICKY Automation Platform — full tournament persistence schema
-- Adds tables for tournaments, divisions, teams, aliases, matches, brackets, and audit.
-- The existing tournament_channels and match_submissions tables are untouched.

-- ─── Admin authentication ────────────────────────────────────────────────────
create table if not exists tournament_admins (
  id uuid primary key default gen_random_uuid(),
  admin_token uuid not null unique default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- ─── Tournament metadata ─────────────────────────────────────────────────────
-- Uses slug as PK to match the string IDs already stored in match_submissions.
create table if not exists tournaments (
  id text primary key,                    -- slug, e.g. "eql-season-25"
  name text not null,
  mode text not null default '4on4',
  start_date date,
  end_date date,
  active_division_id text,               -- last active division, for restore
  settings jsonb not null default '{}',  -- { autoApprove, approvalWindowDays, minAutoApproveConfidence }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Division settings ────────────────────────────────────────────────────────
-- All fields are flat (matching the UI's flat division object — no nesting).
create table if not exists divisions (
  id text primary key,                    -- "div-<timestamp>"
  tournament_id text not null references tournaments(id) on delete cascade,
  name text not null,
  format text not null default 'groups',
  num_groups integer not null default 2,
  teams_per_group integer not null default 4,
  advance_count integer not null default 2,
  group_stage_best_of integer not null default 3,
  group_stage_type text not null default 'bestof',
  group_meetings integer not null default 1,
  match_pace text not null default 'weekly',
  playoff_format text not null default 'single',
  playoff_teams integer not null default 4,
  playoff_r32_best_of integer not null default 3,
  playoff_r32_type text not null default 'bestof',
  playoff_r16_best_of integer not null default 3,
  playoff_r16_type text not null default 'bestof',
  playoff_qf_best_of integer not null default 3,
  playoff_qf_type text not null default 'bestof',
  playoff_sf_best_of integer not null default 3,
  playoff_sf_type text not null default 'bestof',
  playoff_final_best_of integer not null default 5,
  playoff_final_type text not null default 'bestof',
  playoff_3rd_best_of integer not null default 0,
  playoff_3rd_type text not null default 'bestof',
  playoff_losers_best_of integer not null default 3,
  playoff_losers_type text not null default 'bestof',
  playoff_grand_final_best_of integer not null default 5,
  playoff_grand_final_type text not null default 'bestof',
  playoff_bracket_reset boolean not null default true,
  playoff_tiers jsonb not null default '[]',          -- multi-tier config (JSONB)
  points_win integer not null default 3,
  points_loss integer not null default 0,
  tie_breakers jsonb not null default '["mapDiff","fragDiff","headToHead"]',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_divisions_tournament on divisions (tournament_id);

-- ─── Teams ───────────────────────────────────────────────────────────────────
create table if not exists teams (
  id text primary key,
  division_id text not null references divisions(id) on delete cascade,
  tournament_id text not null references tournaments(id) on delete cascade,
  name text not null,
  tag text not null default '',
  country text not null default '',
  players jsonb not null default '[]',    -- string array of player names
  "group" text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_teams_division on teams (division_id);
create index idx_teams_tournament on teams (tournament_id);

-- ─── Team aliases ─────────────────────────────────────────────────────────────
-- Maps raw/alternate team names to canonical team names for auto-resolution.
-- is_global = true aliases apply across all tournaments.
create table if not exists team_aliases (
  id uuid primary key default gen_random_uuid(),
  tournament_id text references tournaments(id) on delete cascade,
  team_id text references teams(id) on delete cascade,
  alias text not null,                    -- raw / alternate name (lowercased)
  canonical text not null,               -- canonical team name it maps to
  is_global boolean not null default false,
  confidence integer not null default 100,
  source text not null default 'manual', -- 'manual' | 'auto' | 'fuzzy'
  created_at timestamptz not null default now()
);

create index idx_team_aliases_tournament on team_aliases (tournament_id);
create index idx_team_aliases_alias on team_aliases (lower(alias));
create index idx_team_aliases_global on team_aliases (is_global) where is_global = true;

-- ─── Scheduled matches ────────────────────────────────────────────────────────
create table if not exists matches (
  id text primary key,
  division_id text not null references divisions(id) on delete cascade,
  tournament_id text not null references tournaments(id) on delete cascade,
  team1 text not null default '',
  team2 text not null default '',
  status text not null default 'scheduled'
    check (status in ('scheduled', 'live', 'completed')),
  round text not null default 'group',
  "group" text not null default '',
  round_num integer not null default 1,
  meeting integer not null default 1,
  best_of integer not null default 3,
  match_date date,
  match_time text,
  forfeit text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_matches_division on matches (division_id);
create index idx_matches_tournament on matches (tournament_id);
create index idx_matches_status on matches (tournament_id, status);

-- ─── Per-map scores ──────────────────────────────────────────────────────────
create table if not exists match_maps (
  id text primary key,
  match_id text not null references matches(id) on delete cascade,
  division_id text not null references divisions(id) on delete cascade,
  map_name text not null,
  score1 integer not null default 0,
  score2 integer not null default 0,
  forfeit text,
  game_id text,                           -- Hub game ID for traceability
  created_at timestamptz not null default now()
);

create index idx_match_maps_match on match_maps (match_id);

-- ─── Raw imported maps (before match linking) ─────────────────────────────────
-- One row per parsed map/game from a submission, kept for re-processing.
create table if not exists raw_maps (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references match_submissions(id) on delete set null,
  division_id text not null references divisions(id) on delete cascade,
  tournament_id text not null references tournaments(id) on delete cascade,
  game_id text not null,
  map_name text not null,
  team1 text not null,
  team2 text not null,
  score1 integer not null default 0,
  score2 integer not null default 0,
  game_date timestamptz,
  mode text,
  raw_data jsonb,                         -- full ktxstats JSON
  linked_match_id text references matches(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_raw_maps_division on raw_maps (division_id);
create index idx_raw_maps_submission on raw_maps (submission_id);

-- ─── Bracket data (JSONB) ────────────────────────────────────────────────────
-- Bracket structures are deeply nested and always loaded as a unit.
-- tier_id is null for the main bracket; set for multi-tier playoff tiers.
create table if not exists brackets (
  id uuid primary key default gen_random_uuid(),
  division_id text not null references divisions(id) on delete cascade,
  tier_id text,                           -- null = main bracket
  bracket_data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create unique index idx_brackets_division_tier
  on brackets (division_id, coalesce(tier_id, ''));

-- ─── Audit log ───────────────────────────────────────────────────────────────
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  tournament_id text references tournaments(id) on delete cascade,
  action text not null,                   -- 'approve_match', 'add_team', 'update_bracket', …
  entity_type text not null,             -- 'match', 'team', 'division', 'bracket'
  entity_id text,
  actor text not null default 'admin',   -- Discord user ID or 'admin'
  diff jsonb,                            -- { before: {…}, after: {…} }
  created_at timestamptz not null default now()
);

create index idx_audit_log_tournament on audit_log (tournament_id);
create index idx_audit_log_created on audit_log (created_at desc);

-- ─── Phase 4 prep: auto-approval flags on submissions ────────────────────────
alter table match_submissions
  add column if not exists flags jsonb;
