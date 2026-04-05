-- Migration 11: Per-user module visibility preferences
--
-- Each user can independently toggle which management modules
-- appear in their sidebar (Calendario, Personal, Sueldos).
-- Scope: per user_id only (not per negocio).
-- Default: if no row exists for a module, it is considered active (ON).

CREATE TABLE user_module_prefs (
  user_id    TEXT    NOT NULL,
  module_key TEXT    NOT NULL,  -- 'calendario' | 'personal' | 'sueldos'
  is_active  INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, module_key)
);
