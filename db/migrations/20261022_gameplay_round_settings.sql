-- WordSky gameplay upgrade: run ONLY on isolated Preview before deploying patch.
-- Additive and idempotent; does not change existing round rows or vocabulary.
ALTER TABLE public.ws_rounds
  ADD COLUMN IF NOT EXISTS bomb_fall_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS bomb_batch_size INTEGER,
  ADD COLUMN IF NOT EXISTS bomb_spawn_interval_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS car_step_seconds INTEGER;
COMMENT ON COLUMN public.ws_rounds.bomb_fall_seconds IS 'Seconds each falling bomb remains on screen (5..60).';
COMMENT ON COLUMN public.ws_rounds.bomb_batch_size IS 'Simultaneous bombs per wave (1..3).';
COMMENT ON COLUMN public.ws_rounds.bomb_spawn_interval_seconds IS 'Seconds between bomb waves (3..45).';
COMMENT ON COLUMN public.ws_rounds.car_step_seconds IS 'Seconds before each CAR stage times out (2..45).';
