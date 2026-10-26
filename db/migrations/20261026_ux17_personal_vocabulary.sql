-- UX17: personal vocabulary belongs to an authenticated WordSky user.
-- Additive, no Production execution without explicit owner approval.
CREATE TABLE IF NOT EXISTS public.ws_user_vocabulary (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.ws_users(id) ON DELETE CASCADE,
 topic text NOT NULL CHECK (char_length(topic) BETWEEN 1 AND 80),
 english text NOT NULL CHECK (char_length(english) BETWEEN 1 AND 80),
 ipa text NOT NULL DEFAULT '' CHECK (char_length(ipa)<=120),
 meaning text NOT NULL CHECK (char_length(meaning) BETWEEN 1 AND 180),
 example text NOT NULL DEFAULT '' CHECK (char_length(example)<=500),
 translation text NOT NULL DEFAULT '' CHECK (char_length(translation)<=500),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz,
 revision integer NOT NULL DEFAULT 1 CHECK (revision>=1)
);
DO $constraint$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ws_user_vocab_owner_unique') THEN ALTER TABLE public.ws_user_vocabulary ADD CONSTRAINT ws_user_vocab_owner_unique UNIQUE(id,user_id); END IF; END $constraint$;
CREATE UNIQUE INDEX IF NOT EXISTS ws_user_vocab_unique_active ON public.ws_user_vocabulary(user_id,lower(topic),lower(english)) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ws_user_vocab_user_updated ON public.ws_user_vocabulary(user_id,updated_at DESC,id);
CREATE TABLE IF NOT EXISTS public.ws_user_vocabulary_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.ws_users(id) ON DELETE CASCADE,
 personal_word_id uuid NOT NULL REFERENCES public.ws_user_vocabulary(id) ON DELETE CASCADE,
 remembered boolean NOT NULL,
 reviewed_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT ws_user_vocab_review_unique_owner FOREIGN KEY (personal_word_id,user_id)
   REFERENCES public.ws_user_vocabulary(id,user_id)
);
CREATE INDEX IF NOT EXISTS ws_user_vocab_reviews_by_user ON public.ws_user_vocabulary_reviews(user_id,reviewed_at DESC);
CREATE TABLE IF NOT EXISTS public.ws_user_vocabulary_progress (
 user_id uuid NOT NULL REFERENCES public.ws_users(id) ON DELETE CASCADE,
 personal_word_id uuid NOT NULL,
 remembered boolean NOT NULL,
 review_count integer NOT NULL DEFAULT 1 CHECK(review_count>=1),
 last_reviewed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,personal_word_id),
 CONSTRAINT ws_user_vocab_progress_unique_owner FOREIGN KEY (personal_word_id,user_id)
  REFERENCES public.ws_user_vocabulary(id,user_id)
);
ALTER TABLE public.ws_user_vocabulary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ws_user_vocabulary_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ws_user_vocabulary_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ws_user_vocabulary,public.ws_user_vocabulary_reviews,public.ws_user_vocabulary_progress FROM PUBLIC;
DO $ux17$ DECLARE r text; BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
 EXECUTE format('REVOKE ALL ON public.ws_user_vocabulary,public.ws_user_vocabulary_reviews,public.ws_user_vocabulary_progress FROM %I',r);
 END IF; END LOOP;
END $ux17$;
