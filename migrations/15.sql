-- Migration 15: Add turno and multi-payment support to facturas
ALTER TABLE facturas ADD COLUMN turno TEXT;          -- "mañana" | "tarde" | null
ALTER TABLE facturas ADD COLUMN pagos_detalle TEXT;  -- JSON: [{metodo_pago, monto}] | null
