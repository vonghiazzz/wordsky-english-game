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
