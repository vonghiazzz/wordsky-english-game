-- WordSky V6: additive migration. Apply ONLY to an isolated PREVIEW database first.
-- No backfill, no auto-approval, no deletion of existing vocabulary.
BEGIN;
ALTER TABLE public.ws_words
  ADD COLUMN IF NOT EXISTS cefr_level text;
ALTER TABLE public.ws_words
  ADD COLUMN IF NOT EXISTS cefr_review_status text NOT NULL DEFAULT 'UNREVIEWED';
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ws_words_cefr_level_check' AND conrelid='public.ws_words'::regclass) THEN
  ALTER TABLE public.ws_words ADD CONSTRAINT ws_words_cefr_level_check
  CHECK (cefr_level IS NULL OR cefr_level IN ('A1','A2','B1','B2','C1','C2'));
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ws_words_cefr_review_status_check' AND conrelid='public.ws_words'::regclass) THEN
  ALTER TABLE public.ws_words ADD CONSTRAINT ws_words_cefr_review_status_check
  CHECK (cefr_review_status IN ('UNREVIEWED','PROVISIONAL','APPROVED'));
 END IF;
END $$;
CREATE INDEX IF NOT EXISTS ws_words_cefr_approved_by_topic
ON public.ws_words (topic_id,cefr_level)
WHERE enabled=true AND cefr_review_status='APPROVED';
COMMIT;
