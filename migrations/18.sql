CREATE TABLE IF NOT EXISTS chat_context_cache (
  user_id      TEXT NOT NULL,
  negocio_id   TEXT NOT NULL,
  context_text TEXT NOT NULL,
  fetched_at   TEXT NOT NULL,
  PRIMARY KEY (user_id, negocio_id)
);
