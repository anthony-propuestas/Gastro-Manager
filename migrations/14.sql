-- Migration 14: Facturación module (sales tracking)

CREATE TABLE facturas (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  negocio_id         INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  user_id            TEXT    NOT NULL,
  fecha              TEXT    NOT NULL,
  monto_total        REAL    NOT NULL,
  metodo_pago        TEXT    NOT NULL,
  concepto           TEXT,
  numero_comprobante TEXT,
  notas              TEXT,
  created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_facturas_negocio ON facturas(negocio_id);
CREATE INDEX idx_facturas_fecha   ON facturas(negocio_id, fecha);
