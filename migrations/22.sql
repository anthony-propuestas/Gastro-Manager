-- Suscripciones MercadoPago (idempotente — tablas ya creadas manualmente en DBs existentes)
CREATE TABLE IF NOT EXISTS suscripciones (
  id                    INTEGER  PRIMARY KEY AUTOINCREMENT,
  user_id               TEXT     NOT NULL UNIQUE,
  mp_preapproval_id     TEXT     UNIQUE,
  mp_plan_id            TEXT,
  estado                TEXT     NOT NULL DEFAULT 'pendiente',
  fecha_inicio          TEXT,
  proximo_cobro         TEXT,
  ultimo_pago_ok        TEXT,
  grace_deadline        TEXT,
  monto                 REAL     NOT NULL DEFAULT 15000,
  moneda                TEXT     NOT NULL DEFAULT 'ARS',
  payer_email           TEXT,
  created_at            TEXT     NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT     NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_suscripciones_user_id ON suscripciones(user_id);
CREATE INDEX IF NOT EXISTS idx_suscripciones_estado  ON suscripciones(estado);

CREATE TABLE IF NOT EXISTS pagos_suscripcion (
  id                INTEGER  PRIMARY KEY AUTOINCREMENT,
  suscripcion_id    INTEGER  NOT NULL REFERENCES suscripciones(id) ON DELETE CASCADE,
  user_id           TEXT     NOT NULL,
  mp_payment_id     TEXT     UNIQUE,
  mp_preapproval_id TEXT,
  estado_pago       TEXT     NOT NULL,
  monto             REAL,
  moneda            TEXT     DEFAULT 'ARS',
  fecha_pago        TEXT,
  razon_rechazo     TEXT,
  payload_raw       TEXT,
  created_at        TEXT     NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pagos_suscripcion_id  ON pagos_suscripcion(suscripcion_id);
CREATE INDEX IF NOT EXISTS idx_pagos_user_id         ON pagos_suscripcion(user_id);
CREATE INDEX IF NOT EXISTS idx_pagos_mp_payment_id   ON pagos_suscripcion(mp_payment_id);
