-- Discord notification queue: web app enqueues, bot polls and processes
CREATE TABLE IF NOT EXISTS discord_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id text NOT NULL,
  channel_id text NOT NULL,
  notification_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  scheduled_for timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dn_pending
  ON discord_notifications (scheduled_for)
  WHERE status IN ('pending', 'failed');

-- Atomic claim: bot calls this to grab a batch without race conditions
CREATE OR REPLACE FUNCTION claim_notifications(batch_size integer DEFAULT 10)
RETURNS SETOF discord_notifications AS $$
  UPDATE discord_notifications
  SET status = 'processing', attempts = attempts + 1
  WHERE id IN (
    SELECT id FROM discord_notifications
    WHERE status IN ('pending', 'failed')
      AND attempts < max_attempts
      AND scheduled_for <= now()
    ORDER BY created_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$ LANGUAGE sql;

-- Store the bot's reply message ID so we can edit embeds later
ALTER TABLE match_submissions
  ADD COLUMN IF NOT EXISTS discord_message_id text;
