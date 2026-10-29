-- UX30 — Admin user management password reset and revocable player sessions.
-- Additive. Supabase migration runner owns the transaction; no embedded BEGIN/COMMIT.
-- Apply only on isolated Preview FIRST, before deploying updated API.
-- Do not run on Production until manual release approval and verified backup.
ALTER TABLE public.ws_users
 ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.ws_admin_password_reset_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 admin_username text NOT NULL,
 target_user_id uuid NOT NULL REFERENCES public.ws_users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ws_admin_password_reset_audit_user_time
 ON public.ws_admin_password_reset_audit(target_user_id,created_at DESC);

ALTER TABLE public.ws_admin_password_reset_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ws_admin_password_reset_audit FROM PUBLIC;
DO $ux30$
DECLARE access_role text;
BEGIN
 FOREACH access_role IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=access_role) THEN
   EXECUTE format('REVOKE ALL ON TABLE public.ws_admin_password_reset_audit FROM %I',access_role);
  END IF;
 END LOOP;
END
$ux30$;
