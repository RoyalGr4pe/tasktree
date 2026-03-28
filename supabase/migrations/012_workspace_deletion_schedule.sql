-- ---------------------------------------------------------------------------
-- 012_workspace_deletion_schedule.sql
-- Adds scheduled deletion support for app uninstall compliance.
-- When an account uninstalls the app, we mark the workspace for deletion
-- 5 days later rather than deleting immediately (grace period for accidental uninstalls).
-- A daily pg_cron job hard-deletes any workspace past its scheduled_for_deletion_at.
-- Reinstalling the app clears the flag, restoring all data.
-- ---------------------------------------------------------------------------

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS scheduled_for_deletion_at TIMESTAMPTZ DEFAULT NULL;

-- Daily cleanup job: delete workspaces whose grace period has expired.
-- Requires pg_cron extension (enabled by default on Supabase).
SELECT cron.schedule(
  'delete-expired-workspaces',   -- job name (idempotent)
  '0 3 * * *',                   -- 03:00 UTC daily
  $$
    DELETE FROM workspaces
    WHERE scheduled_for_deletion_at IS NOT NULL
      AND scheduled_for_deletion_at <= NOW();
  $$
);
