# Base de Datos

## Tecnología

**Cloudflare D1** - Base de datos SQLite serverless distribuida globalmente.

### Características
- SQLite compatible (con algunas limitaciones)
- Réplica automática multi-región
- Backups automáticos
- Escalado automático

## Esquema General

La base de datos consta de **8 tablas principales** organizadas en 3 grupos funcionales:

### 1. Gestión de Personal
- `employees` - Información de empleados
- `job_roles` - Puestos de trabajo personalizados
- `topics` - Temas de seguimiento por empleado
- `notes` - Notas asociadas a tópicos

### 2. Sistema de Sueldos
- `advances` - Adelantos de sueldo
- `salary_payments` - Registros de pagos mensuales

### 3. Calendario y Sistema
- `events` - Eventos del calendario
- `admin_emails` - Emails de administradores
- `usage_logs` - Registro de uso del sistema

## Tablas Detalladas

### employees

Almacena información de los empleados del restaurante.

```sql
CREATE TABLE employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,                    -- ID del usuario propietario
  name TEXT NOT NULL,                       -- Nombre del empleado
  role TEXT NOT NULL,                       -- Puesto (Mesero, Cocinero, etc.)
  phone TEXT,                               -- Teléfono de contacto
  email TEXT,                               -- Email del empleado
  hire_date DATE,                           -- Fecha de contratación
  is_active INTEGER DEFAULT 1,              -- 1=activo, 0=inactivo
  monthly_salary REAL DEFAULT 0,            -- Salario mensual
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Validaciones:**
- `name`: 1-100 caracteres
- `role`: 1-50 caracteres
- `phone`: máx 20 caracteres
- `email`: formato válido, máx 100 caracteres
- `hire_date`: rango razonable (100 años pasado - 10 años futuro)
- `monthly_salary`: 0 - 1,000,000

**Índices recomendados:**
```sql
CREATE INDEX idx_employees_user_id ON employees(user_id);
CREATE INDEX idx_employees_is_active ON employees(is_active);
```

### job_roles

Puestos de trabajo personalizados por usuario.

```sql
CREATE TABLE job_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,                       -- Nombre del puesto
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Validaciones:**
- `name`: 1-50 caracteres

**Nota:** Estos puestos se combinan con roles predefinidos (Mesero, Cocinero, Cajero, etc.)

### topics

Temas o asuntos de seguimiento por empleado (capacitaciones, evaluaciones, tareas).

```sql
CREATE TABLE topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,             -- FK a employees
  title TEXT NOT NULL,                      -- Título del tema
  is_open INTEGER DEFAULT 1,                -- 1=abierto, 0=resuelto
  due_date DATE,                            -- Fecha límite (opcional)
  due_time TEXT,                            -- Hora límite HH:MM (opcional)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Validaciones:**
- `title`: 1-200 caracteres
- `due_date`: rango razonable
- `due_time`: formato HH:MM

**Comportamiento especial:**
- Topics con `due_date` aparecen en el calendario
- Se muestran en rojo si están vencidos (`is_open=1` y `due_date < hoy`)
- Desaparecen del calendario al marcar `is_open=0`

**Índices recomendados:**
```sql
CREATE INDEX idx_topics_employee_id ON topics(employee_id);
CREATE INDEX idx_topics_is_open ON topics(is_open);
```

### notes

Notas asociadas a cada tópico.

```sql
CREATE TABLE notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL,                -- FK a topics
  content TEXT NOT NULL,                    -- Contenido de la nota
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Validaciones:**
- `content`: 1-1000 caracteres

**Índices recomendados:**
```sql
CREATE INDEX idx_notes_topic_id ON notes(topic_id);
```

### events

Eventos del calendario (reuniones, entregas, mantenimiento).

```sql
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,                      -- Título del evento
  description TEXT,                         -- Descripción
  event_date DATE NOT NULL,                 -- Fecha del evento
  start_time TEXT,                          -- Hora inicio HH:MM
  end_time TEXT,                            -- Hora fin HH:MM
  event_type TEXT,                          -- Tipo (meeting, task, etc.)
  location TEXT,                            -- Ubicación
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Validaciones:**
- `title`: 1-200 caracteres
- `description`: máx 1000 caracteres
- `event_date`: requerido, rango razonable
- `start_time`, `end_time`: formato HH:MM
- `location`: máx 200 caracteres

**Índices recomendados:**
```sql
CREATE INDEX idx_events_user_id ON events(user_id);
CREATE INDEX idx_events_event_date ON events(event_date);
```

### advances

Adelantos de sueldo registrados por empleado.

```sql
CREATE TABLE advances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  employee_id INTEGER NOT NULL,             -- FK a employees
  amount REAL NOT NULL,                     -- Monto del adelanto
  period_month INTEGER NOT NULL,            -- Mes (1-12)
  period_year INTEGER NOT NULL,             -- Año
  advance_date DATE NOT NULL,               -- Fecha del adelanto
  description TEXT,                         -- Descripción/motivo
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Validaciones:**
- `amount`: 0.01 - 1,000,000
- `period_month`: 1-12
- `period_year`: 2000-2100
- `advance_date`: rango razonable
- `description`: máx 500 caracteres

**Índices recomendados:**
```sql
CREATE INDEX idx_advances_user_id ON advances(user_id);
CREATE INDEX idx_advances_employee_id ON advances(employee_id);
CREATE INDEX idx_advances_period ON advances(period_month, period_year);
```

### salary_payments

Registros de pagos de sueldos mensuales.

```sql
CREATE TABLE salary_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  employee_id INTEGER NOT NULL,             -- FK a employees
  period_month INTEGER NOT NULL,            -- Mes del pago
  period_year INTEGER NOT NULL,             -- Año del pago
  salary_amount REAL NOT NULL,              -- Salario base
  advances_total REAL DEFAULT 0,            -- Total de adelantos
  net_amount REAL NOT NULL,                 -- Sueldo neto (salary - advances)
  is_paid INTEGER DEFAULT 0,                -- 0=pendiente, 1=pagado
  paid_date DATE,                           -- Fecha de pago
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Cálculo automático:**
```
net_amount = salary_amount - advances_total
```

**Índices recomendados:**
```sql
CREATE INDEX idx_salary_payments_user_id ON salary_payments(user_id);
CREATE INDEX idx_salary_payments_employee_id ON salary_payments(employee_id);
CREATE INDEX idx_salary_payments_period ON salary_payments(period_month, period_year);
CREATE INDEX idx_salary_payments_is_paid ON salary_payments(is_paid);
```

### admin_emails

Lista de emails con permisos de administrador.

```sql
CREATE TABLE admin_emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,               -- Email del admin
  added_by TEXT,                            -- Quien lo agregó
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Nota:** El admin inicial se configura mediante variable de entorno, no se guarda aquí.

### usage_logs

Registro de uso del sistema para estadísticas.

```sql
CREATE TABLE usage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  action_type TEXT NOT NULL,                -- CREATE, UPDATE, DELETE
  entity_type TEXT NOT NULL,                -- employees, events, etc.
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Tipos de acción:**
- `CREATE` - Creación de entidad
- `UPDATE` - Actualización
- `DELETE` - Eliminación

**Tipos de entidad:**
- `employees`
- `topics`
- `notes`
- `events`
- `advances`
- `salary_payments`

**Índices recomendados:**
```sql
CREATE INDEX idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX idx_usage_logs_created_at ON usage_logs(created_at);
```

## Relaciones entre Tablas

```
users (implicit, via user_id)
  │
  ├─── employees (1:N)
  │      │
  │      ├─── topics (1:N)
  │      │      │
  │      │      └─── notes (1:N)
  │      │
  │      ├─── advances (1:N)
  │      │
  │      └─── salary_payments (1:N)
  │
  ├─── events (1:N)
  │
  ├─── job_roles (1:N)
  │
  └─── usage_logs (1:N)

admin_emails (standalone)
```

## Convenciones de Diseño

### Timestamps Automáticos

Todas las tablas incluyen:
- `created_at`: Fecha/hora de creación (CURRENT_TIMESTAMP)
- `updated_at`: Fecha/hora de última actualización (CURRENT_TIMESTAMP)

**Actualización manual requerida:**
```sql
UPDATE employees 
SET name = ?, updated_at = ?
WHERE id = ?
```

### IDs Autoincrement

Todas las tablas usan `INTEGER PRIMARY KEY AUTOINCREMENT`:
- Valores únicos garantizados
- Generación automática
- Performance óptima para índices

### Campos Booleanos

SQLite no tiene tipo `BOOLEAN`, se usa `INTEGER`:
- `0` = false
- `1` = true

**Prefijos:**
- `is_*` para estados (is_active, is_open, is_paid)
- `has_*` para posesión (no usado actualmente)

### Multi-tenancy

Todas las tablas de datos de usuario incluyen `user_id TEXT`:
- Isolación completa de datos
- Queries siempre filtran por `user_id`
- Previene acceso cruzado entre usuarios

### Campos Opcionales vs Requeridos

**Requeridos (NOT NULL):**
- IDs, user_id
- Campos esenciales (name, title, amount)
- Timestamps

**Opcionales (nullable):**
- Información de contacto (phone, email)
- Campos descriptivos (description, location)
- Fechas opcionales (due_date, paid_date)

## Migraciones

Las migraciones se crean con:
- `up_sql`: Aplicar cambios
- `down_sql`: Revertir cambios

**Ejemplo:**
```sql
-- UP
ALTER TABLE employees ADD COLUMN monthly_salary REAL DEFAULT 0;

-- DOWN
ALTER TABLE employees DROP COLUMN monthly_salary;
```

**IMPORTANTE:** Las migraciones son **inmutables** una vez creadas. No se pueden editar ni eliminar.

## Consultas Comunes

### Obtener empleados activos con sus tópicos abiertos

```sql
SELECT 
  e.*,
  COUNT(t.id) as open_topics
FROM employees e
LEFT JOIN topics t ON e.id = t.employee_id AND t.is_open = 1
WHERE e.user_id = ? AND e.is_active = 1
GROUP BY e.id
```

### Calcular sueldo neto del mes

```sql
SELECT 
  e.name,
  e.monthly_salary,
  COALESCE(SUM(a.amount), 0) as total_advances,
  e.monthly_salary - COALESCE(SUM(a.amount), 0) as net_salary
FROM employees e
LEFT JOIN advances a ON e.id = a.employee_id 
  AND a.period_month = ?
  AND a.period_year = ?
WHERE e.user_id = ? AND e.is_active = 1
GROUP BY e.id
```

### Eventos y tópicos pendientes de un mes

```sql
-- Eventos
SELECT * FROM events 
WHERE user_id = ? 
  AND strftime('%m', event_date) = ?
  AND strftime('%Y', event_date) = ?

-- Tópicos con deadline
SELECT 
  t.*,
  e.name as employee_name
FROM topics t
JOIN employees e ON t.employee_id = e.id
WHERE e.user_id = ? 
  AND t.is_open = 1 
  AND t.due_date IS NOT NULL
  AND strftime('%m', t.due_date) = ?
  AND strftime('%Y', t.due_date) = ?
```

## Limitaciones de D1

### No Soportado
- Foreign keys constraints (se manejan en aplicación)
- Triggers (lógica en backend)
- Check constraints (validación con Zod)
- PRAGMA statements
- Enums (se usan strings)

### Límites
- Máximo 100 columnas por tabla
- 10GB storage (Free tier)
- 500 req/s por database (Free tier)

## Backup y Recuperación

- **Backups automáticos**: Cloudflare maneja snapshots diarios
- **Point-in-time recovery**: Disponible en planes pagos
- **Exportación**: Posible vía Wrangler CLI

## Optimización

### Índices Estratégicos
- Crear índices en columnas de WHERE y JOIN frecuentes
- `user_id` siempre debe tener índice
- Fechas usadas en rangos (event_date, created_at)

### Query Performance
- Evitar SELECT * (seleccionar solo columnas necesarias)
- Usar LIMIT para paginación
- Agregar índices antes de lanzar queries pesados

### Monitoreo
- Revisar query performance en Cloudflare Dashboard
- Analizar slow queries
- Optimizar con EXPLAIN QUERY PLAN
