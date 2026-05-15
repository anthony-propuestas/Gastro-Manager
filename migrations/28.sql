DROP TABLE IF EXISTS chat_context_cache;
CREATE TABLE chat_context_cache (
  negocio_id               TEXT NOT NULL PRIMARY KEY,
  context_text             TEXT NOT NULL,
  fetched_at               TEXT NOT NULL,
  gemini_cache_name        TEXT,
  gemini_cache_expires_at  INTEGER
);
