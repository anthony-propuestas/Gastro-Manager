-- Migration 9: Create users table for role-based access control
-- Users are persisted here on first login (UPSERT in POST /api/sessions)
-- Role is read from DB on every authenticated request (not from JWT) to avoid stale tokens
-- Note: old usage_counters rows accumulate over time (acceptable at current volume, see plan-usuarios-por-niveles.md)

CREATE TABLE users (
  id         TEXT PRIMARY KEY,          -- Google ID
  email      TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  picture    TEXT NOT NULL DEFAULT '',
  role       TEXT NOT NULL DEFAULT 'usuario_basico',  -- 'usuario_basico' | 'usuario_inteligente'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
