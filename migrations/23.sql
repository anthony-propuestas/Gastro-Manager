-- Rate limiting para endpoints de autenticación
CREATE TABLE IF NOT EXISTS rate_limit_auth (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash      TEXT    NOT NULL,
  endpoint     TEXT    NOT NULL,
  window_start TEXT    NOT NULL,
  count        INTEGER NOT NULL DEFAULT 1,
  UNIQUE(ip_hash, endpoint, window_start)
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_auth_window ON rate_limit_auth(window_start);
