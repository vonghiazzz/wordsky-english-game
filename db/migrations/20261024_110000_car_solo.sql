-- Phase 2.3 CAR Solo: expand one CHECK only; keep MATCH/BOMB rows and security.
BEGIN;
DO $$
DECLARE definition text;
BEGIN
 SELECT pg_get_constraintdef(oid) INTO definition FROM pg_constraint
 WHERE conrelid='public.ws_solo_runs'::regclass AND conname='ws_solo_runs_mode_check';
 IF definition IS NOT NULL AND position('CAR' in definition)=0 THEN
  ALTER TABLE public.ws_solo_runs DROP CONSTRAINT ws_solo_runs_mode_check;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint
  WHERE conrelid='public.ws_solo_runs'::regclass AND conname='ws_solo_runs_mode_check') THEN
  ALTER TABLE public.ws_solo_runs ADD CONSTRAINT ws_solo_runs_mode_check
   CHECK (mode IN ('MATCH','BOMB','CAR')) NOT VALID;
 END IF;
END $$;
ALTER TABLE public.ws_solo_runs VALIDATE CONSTRAINT ws_solo_runs_mode_check;
ALTER TABLE public.ws_solo_runs ENABLE ROW LEVEL SECURITY;
COMMIT;
