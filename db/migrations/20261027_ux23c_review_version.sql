-- UX-23C: additive optimistic concurrency metadata for account review requests.
-- Review_count in each progress table is the canonical version (0 when no row exists).
-- Existing UX-23 request records remain readable; their version metadata may be NULL.
ALTER TABLE public.ws_learning_review_requests
 ADD COLUMN IF NOT EXISTS expected_version integer,
 ADD COLUMN IF NOT EXISTS result_version integer;
DO $ux23c$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ws_learning_review_requests_versions_valid') THEN
  ALTER TABLE public.ws_learning_review_requests ADD CONSTRAINT ws_learning_review_requests_versions_valid
   CHECK ((expected_version IS NULL OR expected_version>=0)
      AND (result_version IS NULL OR result_version>=1));
 END IF;
END $ux23c$;
-- Security unchanged: existing ledger RLS and revoked Data API grants remain enforced.
