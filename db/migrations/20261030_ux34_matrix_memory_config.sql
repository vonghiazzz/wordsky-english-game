-- UX34: MATRIX/MEMORY configurable Solo and event rounds.
-- Apply to isolated PostgreSQL first, after UX33. Production requires a fresh
-- verified backup, explicit release approval and a staged deployment.
-- No user, vocabulary, score, SRS or existing run data is rewritten.
DO $ux34$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.ws_solo_runs'::regclass
   AND conname='ws_solo_runs_mode_check' AND pg_get_constraintdef(oid) LIKE '%MEMORY%') THEN
  ALTER TABLE public.ws_solo_runs DROP CONSTRAINT IF EXISTS ws_solo_runs_mode_check;
  ALTER TABLE public.ws_solo_runs ADD CONSTRAINT ws_solo_runs_mode_check
    CHECK(mode IN ('MATCH','BOMB','CAR','MATRIX','MEMORY')) NOT VALID;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.ws_rounds'::regclass
   AND conname='ws_rounds_mode_check' AND pg_get_constraintdef(oid) LIKE '%MEMORY%') THEN
  ALTER TABLE public.ws_rounds DROP CONSTRAINT IF EXISTS ws_rounds_mode_check;
  ALTER TABLE public.ws_rounds ADD CONSTRAINT ws_rounds_mode_check
    CHECK(mode IN ('MATCH','BOMB','CAR','MATRIX','MEMORY')) NOT VALID;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.ws_rounds'::regclass
   AND conname='ws_rounds_duration_seconds_check' AND pg_get_constraintdef(oid) LIKE '%1800%') THEN
  ALTER TABLE public.ws_rounds DROP CONSTRAINT IF EXISTS ws_rounds_duration_seconds_check;
  ALTER TABLE public.ws_rounds ADD CONSTRAINT ws_rounds_duration_seconds_check
    CHECK(duration_seconds BETWEEN 20 AND 1800) NOT VALID;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.ws_rounds'::regclass
   AND conname='ws_rounds_question_count_check' AND pg_get_constraintdef(oid) LIKE '%128%') THEN
  ALTER TABLE public.ws_rounds DROP CONSTRAINT IF EXISTS ws_rounds_question_count_check;
  ALTER TABLE public.ws_rounds ADD CONSTRAINT ws_rounds_question_count_check
    CHECK(question_count BETWEEN 3 AND 128) NOT VALID;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.ws_features'::regclass
   AND conname='ws_features_feature_key_check' AND pg_get_constraintdef(oid) LIKE '%MEMORY%') THEN
  ALTER TABLE public.ws_features DROP CONSTRAINT IF EXISTS ws_features_feature_key_check;
  ALTER TABLE public.ws_features ADD CONSTRAINT ws_features_feature_key_check
    CHECK(feature_key IN ('MATCH','BOMB','CAR','MATRIX','MEMORY','ATTENDANCE','SIGNUP')) NOT VALID;
 END IF;
END $ux34$;
ALTER TABLE public.ws_solo_runs VALIDATE CONSTRAINT ws_solo_runs_mode_check;
ALTER TABLE public.ws_rounds VALIDATE CONSTRAINT ws_rounds_mode_check;
ALTER TABLE public.ws_rounds VALIDATE CONSTRAINT ws_rounds_duration_seconds_check;
ALTER TABLE public.ws_rounds VALIDATE CONSTRAINT ws_rounds_question_count_check;
ALTER TABLE public.ws_features VALIDATE CONSTRAINT ws_features_feature_key_check;
INSERT INTO public.ws_features(feature_key,enabled) VALUES ('MEMORY',false)
 ON CONFLICT(feature_key) DO NOTHING;
