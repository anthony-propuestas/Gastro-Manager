-- ============================================================
-- Migración 8: Sistema de Negocios Compartidos
-- ============================================================

-- 1. Nuevas tablas

CREATE TABLE negocios (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE negocio_members (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  negocio_id INTEGER NOT NULL,
  user_id    TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_name  TEXT NOT NULL,
  invited_by TEXT NOT NULL,
  joined_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(negocio_id, user_id)
);

CREATE TABLE invitations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  negocio_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  invited_by TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at    DATETIME,
  used_by    TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Índices en tablas nuevas

CREATE INDEX idx_negocio_members_negocio ON negocio_members(negocio_id);
CREATE INDEX idx_negocio_members_user    ON negocio_members(user_id);
CREATE INDEX idx_invitations_negocio     ON invitations(negocio_id);
CREATE INDEX idx_invitations_token_hash  ON invitations(token_hash);

-- 3. Agregar negocio_id a las 6 tablas existentes

ALTER TABLE employees       ADD COLUMN negocio_id INTEGER;
ALTER TABLE events          ADD COLUMN negocio_id INTEGER;
ALTER TABLE advances        ADD COLUMN negocio_id INTEGER;
ALTER TABLE salary_payments ADD COLUMN negocio_id INTEGER;
ALTER TABLE job_roles       ADD COLUMN negocio_id INTEGER;
ALTER TABLE usage_logs      ADD COLUMN negocio_id INTEGER;

-- 4. Migrar datos existentes: crear un negocio por cada user_id único

INSERT INTO negocios (name, created_by, created_at, updated_at)
SELECT DISTINCT 'Mi Negocio', user_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM employees
UNION
SELECT DISTINCT 'Mi Negocio', user_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM events
WHERE user_id NOT IN (SELECT user_id FROM employees)
UNION
SELECT DISTINCT 'Mi Negocio', user_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM job_roles
WHERE user_id NOT IN (SELECT user_id FROM employees)
  AND user_id NOT IN (SELECT user_id FROM events);

-- 5. Asignar negocio_id en cada tabla

UPDATE employees       SET negocio_id = (SELECT id FROM negocios WHERE created_by = employees.user_id       LIMIT 1);
UPDATE events          SET negocio_id = (SELECT id FROM negocios WHERE created_by = events.user_id          LIMIT 1);
UPDATE advances        SET negocio_id = (SELECT id FROM negocios WHERE created_by = advances.user_id        LIMIT 1);
UPDATE salary_payments SET negocio_id = (SELECT id FROM negocios WHERE created_by = salary_payments.user_id LIMIT 1);
UPDATE job_roles       SET negocio_id = (SELECT id FROM negocios WHERE created_by = job_roles.user_id       LIMIT 1);
UPDATE usage_logs      SET negocio_id = (SELECT id FROM negocios WHERE created_by = usage_logs.user_id      LIMIT 1);

-- 6. Índices en tablas existentes

CREATE INDEX idx_employees_negocio_id       ON employees(negocio_id);
CREATE INDEX idx_events_negocio_id          ON events(negocio_id);
CREATE INDEX idx_advances_negocio_id        ON advances(negocio_id);
CREATE INDEX idx_salary_payments_negocio_id ON salary_payments(negocio_id);
CREATE INDEX idx_job_roles_negocio_id       ON job_roles(negocio_id);
CREATE INDEX idx_usage_logs_negocio_id      ON usage_logs(negocio_id);
