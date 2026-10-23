-- WordSky Phase 2.1: MATCH Solo persistence.
-- Additive and idempotent. Review and run on an isolated Preview database first.
CREATE TABLE IF NOT EXISTS public.ws_solo_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid REFERENCES public.ws_users(id) ON DELETE SET NULL,
 access_token_hash text NOT NULL,
 client_fingerprint_hash text NOT NULL,
 mode text NOT NULL DEFAULT 'MATCH' CHECK(mode='MATCH'),
 topic_id uuid REFERENCES public.ws_topics(id) ON DELETE SET NULL,
 difficulty text NOT NULL CHECK(difficulty IN ('EASY','NORMAL','HARD')),
 duration_seconds integer NOT NULL CHECK(duration_seconds BETWEEN 20 AND 600),
 question_count integer NOT NULL CHECK(question_count BETWEEN 3 AND 20),
 points_per_correct integer NOT NULL CHECK(points_per_correct BETWEEN 10 AND 1000),
 penalty integer NOT NULL CHECK(penalty BETWEEN 0 AND 1000),
 status text NOT NULL DEFAULT 'PLAYING' CHECK(status IN ('PLAYING','COMPLETED','FAILED','TIMEOUT')),
 score integer NOT NULL DEFAULT 0 CHECK(score >= 0),
 health integer NOT NULL DEFAULT 3 CHECK(health BETWEEN 0 AND 3),
 correct integer NOT NULL DEFAULT 0,
 mistakes integer NOT NULL DEFAULT 0,
 state jsonb NOT NULL,
 started_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS ws_solo_runs_user_started ON public.ws_solo_runs(user_id, started_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ws_solo_runs_started ON public.ws_solo_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS ws_solo_runs_fingerprint_started ON public.ws_solo_runs(client_fingerprint_hash, started_at DESC);
ALTER TABLE public.ws_solo_runs ENABLE ROW LEVEL SECURITY;

-- The app accesses this table only through its server-side PostgreSQL connection.
-- Remove direct Data API privileges when the standard Supabase client roles exist.
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
  REVOKE ALL ON TABLE public.ws_solo_runs FROM anon;
 END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
  REVOKE ALL ON TABLE public.ws_solo_runs FROM authenticated;
 END IF;
END $$;
