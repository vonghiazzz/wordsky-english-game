-- WordSky Phase 2.2: allow BOMB in the existing Solo run table.
-- Additive/idempotent: no data rewrite, no table replacement, MATCH rows remain valid.
BEGIN;

DO $$
DECLARE
 mode_definition text;
 question_definition text;
BEGIN
 SELECT pg_get_constraintdef(oid) INTO mode_definition
 FROM pg_constraint
 WHERE conrelid='public.ws_solo_runs'::regclass
   AND conname='ws_solo_runs_mode_check';

 IF mode_definition IS NOT NULL AND position('BOMB' in mode_definition)=0 THEN
  ALTER TABLE public.ws_solo_runs DROP CONSTRAINT ws_solo_runs_mode_check;
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint
  WHERE conrelid='public.ws_solo_runs'::regclass
    AND conname='ws_solo_runs_mode_check'
 ) THEN
  ALTER TABLE public.ws_solo_runs
   ADD CONSTRAINT ws_solo_runs_mode_check
   CHECK (mode IN ('MATCH','BOMB')) NOT VALID;
 END IF;

 SELECT pg_get_constraintdef(oid) INTO question_definition
 FROM pg_constraint
 WHERE conrelid='public.ws_solo_runs'::regclass
   AND conname='ws_solo_runs_question_count_check';

 IF question_definition IS NOT NULL AND position('30' in question_definition)=0 THEN
  ALTER TABLE public.ws_solo_runs DROP CONSTRAINT ws_solo_runs_question_count_check;
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint
  WHERE conrelid='public.ws_solo_runs'::regclass
    AND conname='ws_solo_runs_question_count_check'
 ) THEN
  ALTER TABLE public.ws_solo_runs
   ADD CONSTRAINT ws_solo_runs_question_count_check
   CHECK (question_count BETWEEN 3 AND 30) NOT VALID;
 END IF;
END $$;

ALTER TABLE public.ws_solo_runs VALIDATE CONSTRAINT ws_solo_runs_mode_check;
ALTER TABLE public.ws_solo_runs VALIDATE CONSTRAINT ws_solo_runs_question_count_check;

-- Defense in depth remains unchanged for the shared MATCH/BOMB table.
ALTER TABLE public.ws_solo_runs ENABLE ROW LEVEL SECURITY;

COMMIT;
