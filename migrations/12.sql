-- Migration 12: Owner role system and per-negocio module restrictions
--
-- Adds:
--   1. negocio_role to negocio_members: 'gerente' (default) | 'owner'
--   2. owner_requests: pending requests for a user to become owner in a negocio
--   3. negocio_module_restrictions: per-negocio module visibility blocks for gerentes

-- 1. Add negocio_role to negocio_members (default 'gerente' for all existing members)
ALTER TABLE negocio_members
  ADD COLUMN negocio_role TEXT NOT NULL DEFAULT 'gerente';

-- Back-fill: existing negocio creators become owners of their own negocios
UPDATE negocio_members
SET negocio_role = 'owner'
WHERE (negocio_id, user_id) IN (SELECT id, created_by FROM negocios);

-- 2. Owner requests table (pending approval flow)
CREATE TABLE owner_requests (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  negocio_id   INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  user_id      TEXT    NOT NULL,
  status       TEXT    NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  requested_at TEXT    NOT NULL DEFAULT (datetime('now')),
  resolved_at  TEXT,
  resolved_by  TEXT,
  UNIQUE(negocio_id, user_id, status)
);

CREATE INDEX idx_owner_requests_negocio ON owner_requests(negocio_id);
CREATE INDEX idx_owner_requests_user    ON owner_requests(user_id);

-- 3. Per-negocio module restrictions (owners control which modules gerentes can see)
CREATE TABLE negocio_module_restrictions (
  negocio_id    INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  module_key    TEXT    NOT NULL, -- 'calendario' | 'personal' | 'sueldos'
  is_restricted INTEGER NOT NULL DEFAULT 0,
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (negocio_id, module_key)
);
