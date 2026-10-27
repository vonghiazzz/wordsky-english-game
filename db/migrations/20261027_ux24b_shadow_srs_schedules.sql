-- UX-24B: additive shadow schedule table, not authoritative yet.
-- REVIEW AND TEST ONLY on isolated PostgreSQL / approved Preview.
-- NEVER apply to Production without separate explicit approval.
CREATE TABLE IF NOT EXISTS public.ws_user_srs_schedules (
  user_id uuid NOT NULL REFERENCES public.ws_users(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('shared','personal')),
  word_id uuid NOT NULL,
  policy_version text NOT NULL CHECK (policy_version = 'ux24-fixed-v1'),
  last_event_id uuid NOT NULL,
  last_reviewed_at timestamptz NOT NULL,
  remembered boolean NOT NULL,
  review_count integer NOT NULL CHECK (review_count >= 1),
  consecutive_remembered integer NOT NULL CHECK (consecutive_remembered >= 0 AND consecutive_remembered <= review_count),
  interval_days integer NOT NULL CHECK (interval_days IN (0,1,3,7,14,30,60,90)),
  due_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (user_id,source,word_id),
  CHECK (due_at >= last_reviewed_at),
  CHECK (
    (remembered = false AND consecutive_remembered = 0 AND interval_days = 0 AND due_at = last_reviewed_at)
    OR (remembered = true AND consecutive_remembered > 0 AND interval_days > 0)
  )
);
CREATE INDEX IF NOT EXISTS ws_user_srs_schedules_due
  ON public.ws_user_srs_schedules (user_id,due_at,source,word_id);
ALTER TABLE public.ws_user_srs_schedules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ws_user_srs_schedules FROM PUBLIC;
DO $ux24b$ DECLARE role_name text; BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('REVOKE ALL ON TABLE public.ws_user_srs_schedules FROM %I',role_name);
    END IF;
  END LOOP;
END $ux24b$;
