-- Migration 17: Email verification for new users
-- New users must verify their email before accessing the app.
-- Existing users are grandfathered as verified so they are not locked out.

ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;

UPDATE users SET email_verified = 1;

CREATE TABLE email_verification_tokens (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_evtokens_user_id    ON email_verification_tokens(user_id);
CREATE INDEX idx_evtokens_token_hash ON email_verification_tokens(token_hash);
