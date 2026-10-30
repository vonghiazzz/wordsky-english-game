-- UX33: Solo MATRIX word-card grid. Run on isolated Preview first.
-- Required before enabling MATRIX; do not execute on Production without a
-- separately verified backup and manual release approval.
-- Additive to existing Solo runs. No user, word, or learning history rewrite.
DO $ux33$
BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM pg_constraint
  WHERE conrelid='public.ws_solo_runs'::regclass
    AND conname='ws_solo_runs_mode_check'
    AND pg_get_constraintdef(oid) LIKE '%MATRIX%'
 ) THEN
  ALTER TABLE public.ws_solo_runs DROP CONSTRAINT IF EXISTS ws_solo_runs_mode_check;
  ALTER TABLE public.ws_solo_runs ADD CONSTRAINT ws_solo_runs_mode_check
    CHECK (mode IN ('MATCH','BOMB','CAR','MATRIX')) NOT VALID;
 END IF;
 IF NOT EXISTS(
  SELECT 1 FROM pg_constraint
  WHERE conrelid='public.ws_solo_runs'::regclass
    AND conname='ws_solo_runs_duration_seconds_check'
    AND pg_get_constraintdef(oid) LIKE '%1800%'
 ) THEN
  ALTER TABLE public.ws_solo_runs DROP CONSTRAINT IF EXISTS ws_solo_runs_duration_seconds_check;
  ALTER TABLE public.ws_solo_runs ADD CONSTRAINT ws_solo_runs_duration_seconds_check
    CHECK (duration_seconds BETWEEN 20 AND 1800) NOT VALID;
 END IF;
 IF NOT EXISTS(
  SELECT 1 FROM pg_constraint
  WHERE conrelid='public.ws_solo_runs'::regclass
    AND conname='ws_solo_runs_question_count_check'
    AND pg_get_constraintdef(oid) LIKE '%128%'
 ) THEN
  ALTER TABLE public.ws_solo_runs DROP CONSTRAINT IF EXISTS ws_solo_runs_question_count_check;
  ALTER TABLE public.ws_solo_runs ADD CONSTRAINT ws_solo_runs_question_count_check
    CHECK (question_count BETWEEN 3 AND 128) NOT VALID;
 END IF;
 IF NOT EXISTS(
  SELECT 1 FROM pg_constraint
  WHERE conrelid='public.ws_features'::regclass
    AND conname='ws_features_feature_key_check'
    AND pg_get_constraintdef(oid) LIKE '%MATRIX%'
 ) THEN
  ALTER TABLE public.ws_features DROP CONSTRAINT IF EXISTS ws_features_feature_key_check;
  ALTER TABLE public.ws_features ADD CONSTRAINT ws_features_feature_key_check
    CHECK(feature_key IN ('MATCH','BOMB','CAR','MATRIX','ATTENDANCE','SIGNUP')) NOT VALID;
 END IF;
END $ux33$;
ALTER TABLE public.ws_solo_runs VALIDATE CONSTRAINT ws_solo_runs_mode_check;
ALTER TABLE public.ws_solo_runs VALIDATE CONSTRAINT ws_solo_runs_duration_seconds_check;
ALTER TABLE public.ws_solo_runs VALIDATE CONSTRAINT ws_solo_runs_question_count_check;
ALTER TABLE public.ws_features VALIDATE CONSTRAINT ws_features_feature_key_check;
INSERT INTO public.ws_features(feature_key,enabled)
 VALUES ('MATRIX',false) ON CONFLICT(feature_key) DO NOTHING;
ALTER TABLE public.ws_solo_runs ENABLE ROW LEVEL SECURITY;
