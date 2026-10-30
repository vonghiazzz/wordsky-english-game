-- WordSky V4 Postgres schema. Run in a new database; safe, no destructive drops.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS ws_users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 username text NOT NULL UNIQUE CHECK (username = lower(username)),
 display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 40),
 password_hash text NOT NULL,
 session_version integer NOT NULL DEFAULT 0 CHECK(session_version >= 0),
 password_changed_at timestamptz,
 xp integer NOT NULL DEFAULT 0 CHECK (xp >= 0),
 streak integer NOT NULL DEFAULT 0 CHECK (streak >= 0),
 last_checkin date,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ws_checkins (
 user_id uuid NOT NULL REFERENCES ws_users(id) ON DELETE CASCADE,
 day date NOT NULL,
 awarded_xp integer NOT NULL CHECK(awarded_xp >= 0),
 streak integer NOT NULL,
 PRIMARY KEY(user_id, day)
);
CREATE TABLE IF NOT EXISTS ws_topics (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 title text NOT NULL UNIQUE CHECK (char_length(title) BETWEEN 2 AND 80),
 enabled boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ws_words (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 topic_id uuid NOT NULL REFERENCES ws_topics(id) ON DELETE CASCADE,
 english text NOT NULL,
 meaning text NOT NULL,
 ipa text NOT NULL DEFAULT '',
 example text NOT NULL DEFAULT '',
 translation text NOT NULL DEFAULT '',
 enabled boolean NOT NULL DEFAULT true,
 UNIQUE(topic_id, english),
 CHECK(char_length(english) BETWEEN 1 AND 80),
 CHECK(char_length(meaning) BETWEEN 1 AND 180)
);
CREATE INDEX IF NOT EXISTS ws_words_by_topic ON ws_words(topic_id) WHERE enabled=true;

CREATE TABLE IF NOT EXISTS ws_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 title text NOT NULL CHECK(char_length(title) BETWEEN 3 AND 120),
 join_code text NOT NULL UNIQUE CHECK(char_length(join_code) BETWEEN 5 AND 12),
 password_hash text NOT NULL,
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','OPEN','LIVE','FINISHED','CANCELLED')),
 max_players integer NOT NULL CHECK(max_players BETWEEN 2 AND 500),
 round_start_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
 started_at timestamptz,
 completed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ws_rounds (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_id uuid NOT NULL REFERENCES ws_events(id) ON DELETE CASCADE,
 position integer NOT NULL CHECK(position BETWEEN 1 AND 12),
 mode text NOT NULL CHECK(mode IN ('MATCH','BOMB','CAR','MATRIX','MEMORY')),
 topic_id uuid REFERENCES ws_topics(id),
 difficulty text NOT NULL CHECK(difficulty IN ('EASY','NORMAL','HARD')),
 duration_seconds integer NOT NULL CHECK(duration_seconds BETWEEN 20 AND 1800),
 question_count integer NOT NULL CHECK(question_count BETWEEN 3 AND 128),
 points_per_correct integer NOT NULL CHECK(points_per_correct BETWEEN 10 AND 1000),
 penalty integer NOT NULL CHECK(penalty BETWEEN 0 AND 1000),
 weight integer NOT NULL CHECK(weight BETWEEN 1 AND 10),
 UNIQUE(event_id, position)
);
CREATE TABLE IF NOT EXISTS ws_participants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_id uuid NOT NULL REFERENCES ws_events(id) ON DELETE CASCADE,
 user_id uuid REFERENCES ws_users(id) ON DELETE SET NULL,
 display_name text NOT NULL CHECK(char_length(display_name) BETWEEN 2 AND 40),
 entry_secret_hash text NOT NULL,
 joined_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ws_participants_unique_name ON ws_participants(event_id, lower(display_name));
CREATE UNIQUE INDEX IF NOT EXISTS ws_participants_user_once ON ws_participants(event_id, user_id) WHERE user_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS ws_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 participant_id uuid NOT NULL REFERENCES ws_participants(id) ON DELETE CASCADE,
 round_id uuid NOT NULL REFERENCES ws_rounds(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'PLAYING' CHECK(status IN ('PLAYING','COMPLETED','FAILED','TIMEOUT')),
 score integer NOT NULL DEFAULT 0 CHECK(score >= 0),
 health integer NOT NULL DEFAULT 3 CHECK(health BETWEEN 0 AND 3),
 correct integer NOT NULL DEFAULT 0,
 mistakes integer NOT NULL DEFAULT 0,
 state jsonb NOT NULL,
 started_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 UNIQUE(participant_id, round_id)
);
CREATE INDEX IF NOT EXISTS ws_runs_round ON ws_runs(round_id, status);
CREATE TABLE IF NOT EXISTS ws_solo_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid REFERENCES ws_users(id) ON DELETE SET NULL,
 access_token_hash text NOT NULL,
 client_fingerprint_hash text NOT NULL,
 mode text NOT NULL DEFAULT 'MATCH' CHECK(mode IN ('MATCH','BOMB','CAR','MATRIX','MEMORY')),
 topic_id uuid REFERENCES ws_topics(id) ON DELETE SET NULL,
 difficulty text NOT NULL CHECK(difficulty IN ('EASY','NORMAL','HARD')),
 duration_seconds integer NOT NULL CHECK(duration_seconds BETWEEN 20 AND 1800),
 question_count integer NOT NULL CHECK(question_count BETWEEN 3 AND 128),
 points_per_correct integer NOT NULL CHECK(points_per_correct BETWEEN 10 AND 1000),
 penalty integer NOT NULL CHECK(penalty BETWEEN 0 AND 1000),
 status text NOT NULL DEFAULT 'PLAYING' CHECK(status IN ('PLAYING','COMPLETED','FAILED','TIMEOUT')),
 score integer NOT NULL DEFAULT 0 CHECK(score >= 0),
 health integer NOT NULL DEFAULT 3 CHECK(health BETWEEN 0 AND 3),
 correct integer NOT NULL DEFAULT 0,
 mistakes integer NOT NULL DEFAULT 0,
 state jsonb NOT NULL,
 started_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS ws_solo_runs_user_started ON ws_solo_runs(user_id, started_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ws_solo_runs_started ON ws_solo_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS ws_solo_runs_fingerprint_started ON ws_solo_runs(client_fingerprint_hash, started_at DESC);
ALTER TABLE ws_solo_runs ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS ws_audit (
 id bigserial PRIMARY KEY,
 actor text NOT NULL,
 action text NOT NULL,
 entity_id text,
 payload jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ws_login_failures (
 remote_ip text NOT NULL,
 attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ws_login_failures_recent ON ws_login_failures(remote_ip, attempted_at DESC);

CREATE TABLE IF NOT EXISTS ws_features (
 feature_key text PRIMARY KEY CHECK(feature_key IN ('MATCH','BOMB','CAR','MATRIX','MEMORY','ATTENDANCE','SIGNUP')),
 enabled boolean NOT NULL DEFAULT true,
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO ws_features(feature_key,enabled)
VALUES ('MATCH',true),('BOMB',true),('CAR',true),('MATRIX',false),('MEMORY',false),('ATTENDANCE',true),('SIGNUP',true)
ON CONFLICT(feature_key) DO NOTHING;
CREATE TABLE IF NOT EXISTS ws_join_failures (
 remote_ip text NOT NULL,
 attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ws_join_failures_recent ON ws_join_failures(remote_ip, attempted_at DESC);

-- UX-10: account Flashcard reviews. Apply only after database owner approval.
CREATE TABLE IF NOT EXISTS ws_learning_flashcard_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES ws_users(id) ON DELETE CASCADE,
 word_id uuid NOT NULL REFERENCES ws_words(id) ON DELETE CASCADE,
 remembered boolean NOT NULL,
 reviewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ws_learning_reviews_user_time ON ws_learning_flashcard_reviews(user_id,reviewed_at DESC);
CREATE TABLE IF NOT EXISTS ws_learning_word_progress (
 user_id uuid NOT NULL REFERENCES ws_users(id) ON DELETE CASCADE,
 word_id uuid NOT NULL REFERENCES ws_words(id) ON DELETE CASCADE,
 remembered boolean NOT NULL DEFAULT false,
 review_count integer NOT NULL DEFAULT 1 CHECK (review_count >= 1),
 last_reviewed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,word_id)
);

-- The WordSky API uses authenticated server-side PostgreSQL access, not Supabase Data API.
-- Fail closed for anon/authenticated Data API roles: do not expose user study history.
ALTER TABLE public.ws_learning_flashcard_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ws_learning_word_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ws_learning_flashcard_reviews FROM PUBLIC;
REVOKE ALL ON public.ws_learning_word_progress FROM PUBLIC;
-- Plain PostgreSQL does not define Supabase's Data API roles.
DO $ux10$
DECLARE role_name text;
DECLARE table_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      FOREACH table_name IN ARRAY ARRAY['ws_learning_flashcard_reviews','ws_learning_word_progress'] LOOP
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', table_name, role_name);
      END LOOP;
    END IF;
  END LOOP;
END
$ux10$;


-- UX30: administrative password resets only through authenticated server API.
CREATE TABLE IF NOT EXISTS ws_admin_password_reset_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 admin_username text NOT NULL,
 target_user_id uuid NOT NULL REFERENCES ws_users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ws_admin_password_reset_audit_user_time
 ON ws_admin_password_reset_audit(target_user_id,created_at DESC);
ALTER TABLE ws_admin_password_reset_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ws_admin_password_reset_audit FROM PUBLIC;
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
