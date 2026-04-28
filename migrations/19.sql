ALTER TABLE employees ADD COLUMN ausencia_desde DATE;
ALTER TABLE employees ADD COLUMN informo INTEGER DEFAULT 0;
ALTER TABLE employees ADD COLUMN cuando_informo DATE;
ALTER TABLE employees ADD COLUMN sueldo_pendiente REAL DEFAULT 0;
