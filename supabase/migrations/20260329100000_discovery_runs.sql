-- Track discovery runs per tournament for dedup and history
CREATE TABLE IF NOT EXISTS discovery_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id text NOT NULL,
  division_id text,
  run_at timestamptz NOT NULL DEFAULT now(),
  candidates_found integer NOT NULL DEFAULT 0,
  candidates_posted integer NOT NULL DEFAULT 0,
  candidates_auto_imported integer NOT NULL DEFAULT 0,
  duplicates_skipped integer NOT NULL DEFAULT 0,
  summary jsonb DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_discovery_runs_tournament
  ON discovery_runs (tournament_id, run_at DESC);
