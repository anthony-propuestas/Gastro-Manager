-- Migration 24: Sistema de referidos

CREATE TABLE vendedores (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  codigo     TEXT UNIQUE NOT NULL,
  activo     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE referidos (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  vendedor_id      TEXT NOT NULL REFERENCES users(id),
  referido_user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
  suscripcion_id   INTEGER REFERENCES suscripciones(id),
  estado           TEXT NOT NULL DEFAULT 'pendiente',
  comision_monto   INTEGER,
  reembolso_monto  INTEGER,
  comision_pagada  INTEGER NOT NULL DEFAULT 0,
  reembolso_pagado INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  confirmed_at     TEXT
);

CREATE INDEX idx_referidos_vendedor ON referidos(vendedor_id);
CREATE INDEX idx_referidos_referido ON referidos(referido_user_id);
