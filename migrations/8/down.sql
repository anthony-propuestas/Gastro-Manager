-- Rollback Migración 8: Sistema de Negocios Compartidos

-- Índices en tablas nuevas (orden inverso)
DROP INDEX IF EXISTS idx_invitations_token_hash;
DROP INDEX IF EXISTS idx_invitations_negocio;
DROP INDEX IF EXISTS idx_negocio_members_user;
DROP INDEX IF EXISTS idx_negocio_members_negocio;

-- Índices en tablas existentes
DROP INDEX IF EXISTS idx_usage_logs_negocio_id;
DROP INDEX IF EXISTS idx_job_roles_negocio_id;
DROP INDEX IF EXISTS idx_salary_payments_negocio_id;
DROP INDEX IF EXISTS idx_advances_negocio_id;
DROP INDEX IF EXISTS idx_events_negocio_id;
DROP INDEX IF EXISTS idx_employees_negocio_id;

-- Tablas nuevas (orden inverso por dependencias)
DROP TABLE IF EXISTS invitations;
DROP TABLE IF EXISTS negocio_members;
DROP TABLE IF EXISTS negocios;

-- Columnas agregadas a tablas existentes
ALTER TABLE usage_logs      DROP COLUMN negocio_id;
ALTER TABLE job_roles       DROP COLUMN negocio_id;
ALTER TABLE salary_payments DROP COLUMN negocio_id;
ALTER TABLE advances        DROP COLUMN negocio_id;
ALTER TABLE events          DROP COLUMN negocio_id;
ALTER TABLE employees       DROP COLUMN negocio_id;
