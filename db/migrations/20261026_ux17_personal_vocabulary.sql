-- UX-17: private, per-account vocabulary. Apply ONLY to isolated Preview first.
-- An explicit browser import seeds this table. Never overwrite personal edits implicitly.
CREATE TABLE IF NOT EXISTS public.ws_user_vocabulary (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.ws_users(id) ON DELETE CASCADE,
 import_key text NOT NULL CHECK (char_length(import_key) BETWEEN 3 AND 220),
 topic text NOT NULL CHECK (char_length(topic) BETWEEN 1 AND 80),
 english text NOT NULL CHECK (char_length(english) BETWEEN 1 AND 80),
 ipa text NOT NULL DEFAULT '' CHECK (char_length(ipa) <= 100),
 meaning text NOT NULL CHECK (char_length(meaning) BETWEEN 1 AND 180),
 example text NOT NULL DEFAULT '' CHECK (char_length(example) <= 300),
 translation text NOT NULL DEFAULT '' CHECK (char_length(translation) <= 300),
 remembered boolean NOT NULL DEFAULT false,
 version integer NOT NULL DEFAULT 1 CHECK (version > 0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (user_id, import_key)
);
CREATE INDEX IF NOT EXISTS ws_user_vocabulary_user_updated
 ON public.ws_user_vocabulary(user_id, updated_at DESC, id);
ALTER TABLE public.ws_user_vocabulary ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ws_user_vocabulary FROM PUBLIC;
-- This project authenticates WordSky sessions in Node, NOT via Supabase Auth JWT.
-- Keep public Data API roles away from this table; Node accesses it server-side.
DO $ux17$
DECLARE role_name text;
BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
   EXECUTE format('REVOKE ALL ON TABLE public.ws_user_vocabulary FROM %I',role_name);
  END IF;
 END LOOP;
END
$ux17$;
