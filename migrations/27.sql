ALTER TABLE compras ADD COLUMN expires_at TEXT;
UPDATE compras SET expires_at = datetime(created_at, '+24 months') WHERE expires_at IS NULL;
