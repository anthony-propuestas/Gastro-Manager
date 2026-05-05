CREATE TABLE IF NOT EXISTS gemini_usage_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  negocio_id INTEGER NOT NULL,
  prompt_tokens INTEGER,
  output_tokens INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_gemini_log_negocio ON gemini_usage_log(negocio_id, created_at);
