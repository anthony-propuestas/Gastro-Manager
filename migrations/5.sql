CREATE TABLE advances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  employee_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  period_month INTEGER NOT NULL,
  period_year INTEGER NOT NULL,
  advance_date DATE NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_advances_employee ON advances(employee_id);
CREATE INDEX idx_advances_period ON advances(period_year, period_month);

CREATE TABLE salary_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  employee_id INTEGER NOT NULL,
  period_month INTEGER NOT NULL,
  period_year INTEGER NOT NULL,
  salary_amount REAL NOT NULL,
  advances_total REAL DEFAULT 0,
  net_amount REAL NOT NULL,
  is_paid INTEGER DEFAULT 0,
  paid_date DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_salary_payments_employee ON salary_payments(employee_id);
CREATE INDEX idx_salary_payments_period ON salary_payments(period_year, period_month);
CREATE UNIQUE INDEX idx_salary_payments_unique ON salary_payments(employee_id, period_year, period_month);