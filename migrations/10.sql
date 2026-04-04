-- Migration 10: Usage counters and limits for role-based quotas
--
-- Design decisions (see docs/plan-usuarios-por-niveles.md):
--   - Limits scoped per user+negocio (Corrección 2): a user with 2 businesses gets
--     independent quotas for each one.
--   - mark-all-paid counts N uses per employee marked (Corrección 4).
--   - Old period rows are NOT cleaned up automatically (Corrección 9, Option C —
--     acceptable at current volume).
--   - Counting is atomic: INCREMENT first, check, revert if over limit (Corrección 6).

CREATE TABLE usage_counters (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT    NOT NULL,
  negocio_id  INTEGER NOT NULL,
  tool        TEXT    NOT NULL,
  count       INTEGER NOT NULL DEFAULT 0,
  period      TEXT    NOT NULL,             -- 'YYYY-MM'
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, negocio_id, tool, period)
);

CREATE TABLE usage_limits (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  tool    TEXT    NOT NULL UNIQUE,
  "limit" INTEGER NOT NULL
);

-- Default monthly limits for usuario_basico (overridable from Admin panel)
INSERT INTO usage_limits (tool, "limit") VALUES
  ('employees',        5),
  ('job_roles',        3),
  ('topics',          10),
  ('notes',           20),
  ('advances',        10),
  ('salary_payments', 10),
  ('events',          15),
  ('chat',            20);
