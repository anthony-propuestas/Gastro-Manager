-- Migration 13: Compras (purchases/expenses) module

CREATE TABLE compras (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  negocio_id      INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  user_id         TEXT    NOT NULL,
  fecha           TEXT    NOT NULL,
  monto           REAL    NOT NULL,
  item            TEXT    NOT NULL,
  tipo            TEXT    NOT NULL DEFAULT 'producto',
  categoria       TEXT    NOT NULL DEFAULT 'otros',
  comprador_id    INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  descripcion     TEXT,
  comprobante_key TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_compras_negocio    ON compras(negocio_id);
CREATE INDEX idx_compras_fecha      ON compras(negocio_id, fecha);
CREATE INDEX idx_compras_comprador  ON compras(comprador_id);
