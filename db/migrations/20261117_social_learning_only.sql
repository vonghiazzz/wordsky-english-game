-- SOCIAL-1000 phrase safety: learning-only entries remain in ws_words for My Learning/SRS,
-- but must be explicitly excluded from ALL game question pools. Run before any phrase import.
ALTER TABLE public.ws_words
  ADD COLUMN IF NOT EXISTS learning_only boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.ws_words.learning_only IS
  'True for sentence/phrase study cards used by My Learning and SRS; excluded from gameplay pools.';
