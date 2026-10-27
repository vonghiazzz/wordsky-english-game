-- UX-23A: idempotent, account-scoped review commands. PREVIEW first; no Production execution without approval.
-- This table is an operation ledger, not a replacement for review history or progress.
CREATE TABLE IF NOT EXISTS public.ws_learning_review_requests (
  user_id uuid NOT NULL REFERENCES public.ws_users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  source text NOT NULL CHECK (source IN ('shared','personal')),
  word_id uuid NOT NULL,
  remembered boolean NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, request_id)
);
CREATE INDEX IF NOT EXISTS ws_learning_review_requests_user_time
 ON public.ws_learning_review_requests (user_id, reviewed_at DESC, request_id);
ALTER TABLE public.ws_learning_review_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ws_learning_review_requests FROM PUBLIC;
DO $ux23$ DECLARE role_name text; BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('REVOKE ALL ON TABLE public.ws_learning_review_requests FROM %I',role_name);
    END IF;
  END LOOP;
END $ux23$;
