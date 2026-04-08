-- Migration 16: Add compras and facturacion rows to usage_limits
-- These tools were missing from migration 10, causing the admin panel
-- UPDATE to silently fail (no rows matched). OR IGNORE ensures idempotency.
INSERT OR IGNORE INTO usage_limits (tool, "limit") VALUES
  ('compras',      50),
  ('facturacion',  50);
