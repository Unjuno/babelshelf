CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('bug', 'idea', 'usability', 'other')),
  message TEXT NOT NULL CHECK (length(message) BETWEEN 1 AND 2000),
  app_build TEXT
);

CREATE INDEX IF NOT EXISTS feedback_created_at_idx ON feedback(created_at DESC);
