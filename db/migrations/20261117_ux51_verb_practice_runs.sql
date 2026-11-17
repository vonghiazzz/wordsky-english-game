-- UX51: account-bound history of objective V1/V2/V3 quiz attempts.
-- Stored independently of Flashcard review / SRS queues. Apply only after QA and backup.
CREATE TABLE IF NOT EXISTS public.ws_verb_practice_runs (
 user_id uuid NOT NULL REFERENCES public.ws_users(id) ON DELETE CASCADE,
 request_id uuid NOT NULL,
 mode text NOT NULL CHECK (mode IN ('full','retry')),
 total integer NOT NULL CHECK (total BETWEEN 1 AND 10),
 correct integer NOT NULL CHECK (correct BETWEEN 0 AND total),
 answers jsonb NOT NULL CHECK (jsonb_typeof(answers)='array' AND jsonb_array_length(answers) BETWEEN 1 AND 10),
 completed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (user_id,request_id)
);
CREATE INDEX IF NOT EXISTS ws_verb_practice_recent_by_user ON public.ws_verb_practice_runs(user_id,completed_at DESC,request_id DESC);
ALTER TABLE public.ws_verb_practice_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ws_verb_practice_runs FROM PUBLIC;
DO $ux51$
DECLARE role_name text;
BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON TABLE public.ws_verb_practice_runs FROM %I',role_name);
  END IF;
 END LOOP;
END $ux51$;
