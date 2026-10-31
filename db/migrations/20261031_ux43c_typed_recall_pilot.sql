-- UX43C Preview-only, additive and privately scoped typed-recall pilot.
-- Apply ONLY to isolated PostgreSQL QA / approved isolated Preview DB.
-- NO Production execution without a distinct explicit migration approval.
-- WordSky uses its OWN versioned account cookie, not Supabase Auth users.
-- No anon/authenticated Data API access to any new table.

CREATE TABLE IF NOT EXISTS public.ws_recall_curated_prompts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 word_id uuid NOT NULL REFERENCES public.ws_words(id) ON DELETE CASCADE,
 prompt_vi text NOT NULL CHECK (char_length(prompt_vi) BETWEEN 1 AND 180),
 accepted_english text[] NOT NULL
   CHECK (cardinality(accepted_english) BETWEEN 1 AND 8),
 answer_revision text NOT NULL
   CHECK (answer_revision ~ '^[A-Za-z0-9._-]{1,64}$'),
 curator text NOT NULL CHECK (curator = 'owner'),
 curated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 approved boolean NOT NULL DEFAULT false,
 active boolean NOT NULL DEFAULT false,
 UNIQUE(word_id,answer_revision)
);
CREATE INDEX IF NOT EXISTS ws_recall_curated_prompts_enabled
 ON public.ws_recall_curated_prompts (approved,active,id)
 WHERE approved=true AND active=true;

CREATE TABLE IF NOT EXISTS public.ws_recall_consents (
 user_id uuid PRIMARY KEY REFERENCES public.ws_users(id) ON DELETE CASCADE,
 consent_version text NOT NULL CHECK (consent_version='ux43b-opt-in-v1'),
 accepted_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS public.ws_recall_trials (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.ws_recall_consents(user_id)
   ON DELETE CASCADE,
 prompt_id uuid NOT NULL REFERENCES public.ws_recall_curated_prompts(id),
 word_id uuid NOT NULL REFERENCES public.ws_words(id) ON DELETE CASCADE,
 prompt_vi text NOT NULL,
 accepted_english text[] NOT NULL
  CHECK (cardinality(accepted_english) BETWEEN 1 AND 8),
 answer_revision text NOT NULL
  CHECK (answer_revision ~ '^[A-Za-z0-9._-]{1,64}$'),
 issued_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 submitted_request_id uuid,
 submitted_at timestamptz,
 result text CHECK (result IN ('correct','incorrect')),
 response_latency text CHECK (response_latency IN
   ('under-1s','1-5s','5-15s','15-60s','60s-plus')),
 CHECK (expires_at>issued_at AND expires_at<=issued_at+interval '5 minutes'),
 CHECK (
  (submitted_at IS NULL AND submitted_request_id IS NULL
    AND result IS NULL AND response_latency IS NULL)
  OR
  (submitted_at IS NOT NULL AND submitted_request_id IS NOT NULL
    AND result IS NOT NULL AND response_latency IS NOT NULL
    AND submitted_at>=issued_at)
 ),
 UNIQUE(user_id,id)
);
CREATE INDEX IF NOT EXISTS ws_recall_trials_user_recent
 ON public.ws_recall_trials (user_id,issued_at DESC,id);

CREATE TABLE IF NOT EXISTS public.ws_recall_evidence (
 trial_id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES public.ws_recall_consents(user_id)
   ON DELETE CASCADE,
 request_id uuid NOT NULL,
 word_id uuid NOT NULL REFERENCES public.ws_words(id) ON DELETE CASCADE,
 answer_revision text NOT NULL,
 prompt_kind text NOT NULL CHECK (prompt_kind='vi-to-en-typed'),
 result text NOT NULL CHECK (result IN ('correct','incorrect')),
 response_latency text NOT NULL CHECK (response_latency IN
   ('under-1s','1-5s','5-15s','15-60s','60s-plus')),
 consent_version text NOT NULL CHECK (consent_version='ux43b-opt-in-v1'),
 observed_at timestamptz NOT NULL,
 FOREIGN KEY (user_id,trial_id)
  REFERENCES public.ws_recall_trials(user_id,id) ON DELETE CASCADE,
 UNIQUE(user_id,request_id)
);
CREATE INDEX IF NOT EXISTS ws_recall_evidence_user_time
 ON public.ws_recall_evidence (user_id,observed_at DESC,trial_id);

-- The public schema may be exposed by Supabase Data API. These tables
-- deliberately have no row policies; only the trusted WordSky server role
-- accesses them, after validating its own signed/versioned player cookie.
ALTER TABLE public.ws_recall_curated_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ws_recall_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ws_recall_trials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ws_recall_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE
 public.ws_recall_curated_prompts,
 public.ws_recall_consents,
 public.ws_recall_trials,
 public.ws_recall_evidence
 FROM PUBLIC;
DO $ux43c$ DECLARE r text; BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=r) THEN
   EXECUTE format(
    'REVOKE ALL ON TABLE public.ws_recall_curated_prompts, ' ||
    'public.ws_recall_consents, public.ws_recall_trials, ' ||
    'public.ws_recall_evidence FROM %I',r
   );
  END IF;
 END LOOP;
END $ux43c$;
