-- tournament_channels: maps Discord channels to QWICKY tournaments
create table tournament_channels (
  id uuid primary key default gen_random_uuid(),
  discord_guild_id text not null,
  discord_channel_id text not null unique,
  tournament_id text not null,
  division_id text,
  registered_by text not null,
  created_at timestamptz not null default now()
);

create index idx_tournament_channels_channel on tournament_channels (discord_channel_id);
create index idx_tournament_channels_tournament on tournament_channels (tournament_id);

-- match_submissions: incoming results from Discord
create table match_submissions (
  id uuid primary key default gen_random_uuid(),
  tournament_id text not null,
  division_id text,
  hub_url text not null,
  game_id text not null,
  game_data jsonb,
  submitted_by_discord_id text not null,
  submitted_by_name text not null,
  discord_channel_id text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'duplicate')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create unique index idx_match_submissions_no_dupes on match_submissions (tournament_id, game_id);
create index idx_match_submissions_tournament on match_submissions (tournament_id, status);
