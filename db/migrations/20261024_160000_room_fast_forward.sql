-- Additive server-authoritative 5-second transition after all participants finish.
-- Never delete, modify or reset historical runs.
ALTER TABLE public.ws_events
 ADD COLUMN IF NOT EXISTS round_start_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN public.ws_events.round_start_overrides IS
 'Position -> ISO UTC start time for completed-round 5s countdown. Only the server may update.';
