# Base de Datos

## Tecnología

**Cloudflare D1** — SQLite serverless con réplica multi-región automática y backups diarios.

---

## Esquema General

La base de datos tiene **20 tablas** en 5 grupos funcionales:

| Grupo | Tablas |
|---|---|
| Identidad y acceso | `users`, `admin_emails` |
| Negocios compartidos | `negocios`, `negocio_members`, `invitations` |
| Roles y restricciones | `owner_requests`, `negocio_module_restrictions`, `user_module_prefs` |
| Cuotas | `usage_counters`, `usage_limits` |
| Datos operativos | `employees`, `job_roles`, `topics`, `notes`, `advances`, `salary_payments`, `events`, `compras`, `facturas` |
| Logging | `usage_logs` |

---

## Identidad y Acceso

### `users`

Persiste usuarios de Google OAuth con su rol de plan. Se llena por UPSERT en `POST /api/sessions` (login).

```sql
CREATE TABLE users (
  id         TEXT PRIMARY KEY,               -- Google ID (claim "sub")
  email      TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  picture    TEXT NOT NULL DEFAULT '',
  role       TEXT NOT NULL DEFAULT 'usuario_basico',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Valores de `role`:** `'usuario_basico'` | `'usuario_inteligente'`

**Comportamiento crítico:**
- El UPSERT de login **no sobreescribe** el `role` — se preserva el rol asignado por el admin.
- El `authMiddleware` lee el `role` de esta tabla en cada request (no del JWT) para garantizar que los cambios sean inmediatos.

---

### `admin_emails`

Correos con permisos de administrador del sistema. El primer admin se determina por la variable de entorno `INITIAL_ADMIN_EMAIL` y no requiere entrada en esta tabla.

```sql
CREATE TABLE admin_emails (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL UNIQUE,
  added_by   TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## Negocios Compartidos

### `negocios`

Espacio de trabajo colaborativo. Todo dato operativo (empleados, sueldos, eventos) pertenece a un negocio, no a un usuario directamente.

```sql
CREATE TABLE negocios (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  created_by TEXT NOT NULL,               -- user_id del creador
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

### `negocio_members`

Relación muchos-a-muchos entre usuarios y negocios. Un usuario puede ser miembro de varios negocios.

```sql
CREATE TABLE negocio_members (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  negocio_id   INTEGER NOT NULL,
  user_id      TEXT NOT NULL,
  user_email   TEXT NOT NULL,
  user_name    TEXT NOT NULL,
  invited_by   TEXT NOT NULL,
  negocio_role TEXT NOT NULL DEFAULT 'gerente',  -- 'owner' | 'gerente'
  joined_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(negocio_id, user_id)
);
```

**Valores de `negocio_role`:** `'owner'` | `'gerente'`

- El creador del negocio es automáticamente `owner`.
- Los invitados ingresan como `gerente` por defecto.
- Un gerente puede solicitar ser owner via `POST /api/negocios/:id/request-owner`.

---

### `invitations`

Tokens de invitación de un solo uso para unirse a un negocio. Se genera un token de 32 bytes, se hashea con SHA-256 y se almacena el hash. Expiran a las 48 horas. Máximo 10 activas por negocio.

```sql
CREATE TABLE invitations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  negocio_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  invited_by TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at    DATETIME,                    -- NULL = pendiente
  used_by    TEXT,                         -- user_id de quien canjeó
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## Cuotas

### `usage_counters`

Contador de operaciones por usuario, negocio, herramienta y periodo mensual.

```sql
CREATE TABLE usage_counters (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT    NOT NULL,
  negocio_id INTEGER NOT NULL,
  tool       TEXT    NOT NULL,
  count      INTEGER NOT NULL DEFAULT 0,
  period     TEXT    NOT NULL,            -- 'YYYY-MM'
  updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, negocio_id, tool, period)
);
```

**Diseño:**
- El scope es **`user_id + negocio_id`**: un usuario con 2 negocios tiene cuotas independientes.
- El incremento es **atómico**: `INSERT … RETURNING count` → si excede límite, `UPDATE count - N`.
- Las filas de periodos anteriores no se eliminan (volumen actual lo permite).

---

### `usage_limits`

Límites mensuales globales por herramienta, editables desde el panel de administración.

```sql
CREATE TABLE usage_limits (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  tool    TEXT    NOT NULL UNIQUE,
  "limit" INTEGER NOT NULL
);
```

**Valores por defecto:**

| tool | limit | Descripción |
|---|---|---|
| `employees` | 5 | Crear empleados |
| `job_roles` | 3 | Crear puestos personalizados |
| `topics` | 10 | Crear temas de seguimiento |
| `notes` | 20 | Crear notas |
| `advances` | 10 | Registrar anticipos |
| `salary_payments` | 10 | Marcar pagos de sueldo |
| `events` | 15 | Crear eventos |
| `chat` | 20 | Mensajes al chatbot IA |
| `compras` | 50 | Registrar compras y gastos |
| `facturacion` | 50 | Crear/editar/eliminar ventas |

`compras` y `facturacion` obtienen su valor por defecto de 50 en la **migración 16**. Si la migración 16 aún no fue aplicada, aparecerán como `NULL` hasta que el admin los configure desde el panel.

Los usuarios con `role = 'usuario_inteligente'` ignoran estos límites.

---

## Roles y Restricciones

### `owner_requests`

Solicitudes pendientes para que un miembro del negocio sea promovido a `owner`. El flujo es: gerente solicita → owner existente aprueba o rechaza.

```sql
CREATE TABLE owner_requests (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  negocio_id   INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  user_id      TEXT    NOT NULL,
  status       TEXT    NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
  requested_at TEXT    NOT NULL DEFAULT (datetime('now')),
  resolved_at  TEXT,
  resolved_by  TEXT,
  UNIQUE(negocio_id, user_id, status)
);
```

---

### `negocio_module_restrictions`

Restricciones de módulos por negocio. El `owner` puede bloquear módulos específicos para los `gerentes`.

```sql
CREATE TABLE negocio_module_restrictions (
  negocio_id    INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  module_key    TEXT    NOT NULL,  -- 'calendario' | 'personal' | 'sueldos' | 'compras' | 'facturacion'
  is_restricted INTEGER NOT NULL DEFAULT 0,
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (negocio_id, module_key)
);
```

---

### `user_module_prefs`

Preferencias de visibilidad de módulos por usuario. Independiente de las restricciones del owner — permite que cada usuario oculte voluntariamente módulos del sidebar.

```sql
CREATE TABLE user_module_prefs (
  user_id    TEXT NOT NULL,
  module_key TEXT NOT NULL,          -- 'calendario' | 'personal' | 'sueldos' | 'compras' | 'facturacion'
  is_active  INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, module_key)
);
```

---

## Logging

### `usage_logs`

Registro de acciones de usuario. Se usa internamente para tracking de operaciones.

```sql
CREATE TABLE usage_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL,
  negocio_id  INTEGER,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## Datos Operativos

Todas estas tablas usan `negocio_id` para el aislamiento de datos. El `negocioMiddleware` inyecta el negocio activo en el contexto a partir del header `X-Negocio-ID`.

### `employees`

```sql
CREATE TABLE employees (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        TEXT NOT NULL,               -- Google ID del creador original
  negocio_id     INTEGER,                     -- agregado en migración 8 (nullable por ALTER TABLE)
  name           TEXT NOT NULL,             -- 1-100 chars
  role           TEXT NOT NULL,             -- 1-50 chars
  phone          TEXT,
  email          TEXT,
  hire_date      DATE,
  is_active      INTEGER DEFAULT 1,         -- 1=activo, 0=inactivo
  monthly_salary REAL DEFAULT 0,            -- 0-1,000,000
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### `job_roles`

Puestos personalizados por negocio. Se combinan con roles predefinidos en el frontend.

```sql
CREATE TABLE job_roles (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL,               -- Google ID del creador original
  negocio_id INTEGER,                     -- agregado en migración 8 (nullable por ALTER TABLE)
  name       TEXT NOT NULL,                 -- 1-50 chars
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### `topics`

Temas de seguimiento por empleado. Los que tienen `due_date` se integran en el calendario.

```sql
CREATE TABLE topics (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  title       TEXT NOT NULL,               -- 1-200 chars
  is_open     INTEGER DEFAULT 1,           -- 1=pendiente, 0=resuelto
  due_date    DATE,
  due_time    TEXT,                        -- HH:MM
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Aparecen en el calendario si tienen `due_date`. Se muestran en rojo si `is_open=1` y `due_date < hoy`.

### `notes`

```sql
CREATE TABLE notes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id   INTEGER NOT NULL,
  content    TEXT NOT NULL,               -- 1-1000 chars
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### `advances`

```sql
CREATE TABLE advances (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      TEXT NOT NULL,               -- Google ID del creador original
  negocio_id   INTEGER,                     -- agregado en migración 8 (nullable por ALTER TABLE)
  employee_id  INTEGER NOT NULL,
  amount       REAL NOT NULL,             -- 0.01-1,000,000
  period_month INTEGER NOT NULL,          -- 1-12
  period_year  INTEGER NOT NULL,          -- 2000-2100
  advance_date DATE NOT NULL,
  description  TEXT,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### `salary_payments`

```sql
CREATE TABLE salary_payments (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        TEXT NOT NULL,               -- Google ID del creador original
  negocio_id     INTEGER,                     -- agregado en migración 8 (nullable por ALTER TABLE)
  employee_id    INTEGER NOT NULL,
  period_month   INTEGER NOT NULL,
  period_year    INTEGER NOT NULL,
  salary_amount  REAL NOT NULL,
  advances_total REAL DEFAULT 0,
  net_amount     REAL NOT NULL,           -- salary_amount - advances_total
  is_paid        INTEGER DEFAULT 0,
  paid_date      DATE,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### `events`

```sql
CREATE TABLE events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL,               -- Google ID del creador original
  negocio_id  INTEGER,                     -- agregado en migración 8 (nullable por ALTER TABLE)
  title       TEXT NOT NULL,              -- 1-200 chars
  description TEXT,
  event_date  DATE NOT NULL,
  start_time  TEXT,                       -- HH:MM
  end_time    TEXT,                       -- HH:MM
  event_type  TEXT,
  location    TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### `compras`

Compras y gastos del negocio. Sujeto a cuota mensual (tool `compras`).

```sql
CREATE TABLE compras (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  negocio_id      INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  user_id         TEXT    NOT NULL,
  fecha           TEXT    NOT NULL,
  monto           REAL    NOT NULL,              -- 0.01-10,000,000
  item            TEXT    NOT NULL,              -- 1-200 chars
  tipo            TEXT    NOT NULL DEFAULT 'producto', -- 'producto' | 'servicio'
  categoria       TEXT    NOT NULL DEFAULT 'otros',
  comprador_id    INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  descripcion     TEXT,
  comprobante_key TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

**Valores válidos de `categoria`:** `carnes`, `verduras`, `bebidas`, `limpieza`, `descartables`, `servicios`, `mantenimiento`, `alquiler`, `otros`

### `facturas`

Ventas del negocio. Sujeto a cuota mensual (tool `facturacion`). Soporta pagos múltiples y agrupación por turno.

```sql
-- Migración 14
CREATE TABLE facturas (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  negocio_id          INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  user_id             TEXT    NOT NULL,
  fecha               TEXT    NOT NULL,              -- YYYY-MM-DD
  monto_total         REAL    NOT NULL,              -- > 0, máx 10 000 000
  metodo_pago         TEXT    NOT NULL,              -- ver enum abajo
  concepto            TEXT,                          -- máx 200 chars
  numero_comprobante  TEXT,                          -- máx 50 chars
  notas               TEXT,                          -- máx 500 chars
  created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Migración 15 (ALTER TABLE)
ALTER TABLE facturas ADD COLUMN turno         TEXT;  -- 'mañana' | 'tarde' | NULL
ALTER TABLE facturas ADD COLUMN pagos_detalle TEXT;  -- JSON | NULL (ver abajo)
```

> ⚠️ **Inconsistencia entre DB y código:** La columna `metodo_pago` es `NOT NULL` en la migración 14, pero el tipo TypeScript `Factura` la declara como `MetodoPago | null`. El schema Zod de creación también la acepta como `optional().nullable()`. En la práctica, el backend siempre asigna un valor antes del INSERT (calculado desde `pagos_detalle` o recibido del cliente), por lo que el NOT NULL de la DB no suele romperse — pero el contrato entre capas no es consistente.

**Valores válidos de `metodo_pago`:** `efectivo` | `tarjeta_credito` | `tarjeta_debito` | `transferencia` | `mercado_pago` | `mixto` | `otros`

- Si el registro tiene un único método de pago, `metodo_pago` refleja ese método directamente.
- Si tiene dos o más métodos, el backend lo setea automáticamente a `mixto`. El valor `mixto` no es seleccionable por el usuario — solo se asigna por lógica interna.
- `pagos_detalle` es `NULL` cuando hay un solo método. Solo se almacena el JSON cuando hay 2 o más métodos de pago.

**Formato de `pagos_detalle`:** JSON string almacenado como TEXT. Solo existe cuando hay pagos múltiples (2 o más métodos).

```json
[
  { "metodo_pago": "efectivo",        "monto": 800   },
  { "metodo_pago": "tarjeta_credito", "monto": 700.5 }
]
```

**Índices (migración 14):**

| Índice | Columna(s) |
|---|---|
| `idx_facturas_negocio` | `negocio_id` |
| `idx_facturas_fecha` | `negocio_id, fecha` |

---

## Diagrama de Relaciones

```
users (Google ID)
  │
  ├─── negocio_members (N:M) ──► negocios
  │                                  │
  │                                  ├─── employees (1:N)
  │                                  │       ├─── topics (1:N)
  │                                  │       │       └─── notes (1:N)
  │                                  │       ├─── advances (1:N)
  │                                  │       └─── salary_payments (1:N)
  │                                  │
  │                                  ├─── job_roles (1:N)
  │                                  ├─── events (1:N)
  │                                  ├─── compras (1:N)
  │                                  │       └─── comprador_id ──► employees (FK opcional)
  │                                  ├─── facturas (1:N)
  │                                  ├─── invitations (1:N)
  │                                  ├─── owner_requests (1:N)
  │                                  ├─── negocio_module_restrictions (1:N)
  │                                  └─── usage_logs (1:N)
  │
  ├─── user_module_prefs (1:N, por módulo)
  │
  └─── usage_counters (scope: user_id + negocio_id)
              │
              └── usage_limits (límites globales por tool)

admin_emails  (standalone — consultado por isAdmin())
```

---

## Convenciones

| Convención | Detalle |
|---|---|
| Aislamiento de datos | Todas las queries de datos filtran por `negocio_id` |
| Timestamps | `created_at` + `updated_at` en todas las tablas; `updated_at` se actualiza manualmente |
| Booleanos | `INTEGER` 0/1 con prefijo `is_` o `has_` |
| Migraciones | Numeradas `1.sql`–`16.sql`, inmutables en producción |

---

## Índices

Las migraciones crean **28 índices explícitos** para optimizar las queries más frecuentes. Estos índices no se muestran en las sentencias `CREATE TABLE` arriba, pero son creados por sentencias `CREATE INDEX` separadas en las migraciones.

### Índices por tabla

| Tabla | Índice | Columna(s) | Tipo | Migración |
|---|---|---|---|---|
| `employees` | `idx_employees_user_id` | `user_id` | Normal | 1 |
| `employees` | `idx_employees_negocio_id` | `negocio_id` | Normal | 8 |
| `topics` | `idx_topics_employee_id` | `employee_id` | Normal | 1 |
| `notes` | `idx_notes_topic_id` | `topic_id` | Normal | 1 |
| `events` | `idx_events_user_id` | `user_id` | Normal | 2 |
| `events` | `idx_events_date` | `event_date` | Normal | 2 |
| `events` | `idx_events_negocio_id` | `negocio_id` | Normal | 8 |
| `advances` | `idx_advances_employee` | `employee_id` | Normal | 5 |
| `advances` | `idx_advances_period` | `period_year, period_month` | Normal | 5 |
| `advances` | `idx_advances_negocio_id` | `negocio_id` | Normal | 8 |
| `salary_payments` | `idx_salary_payments_employee` | `employee_id` | Normal | 5 |
| `salary_payments` | `idx_salary_payments_period` | `period_year, period_month` | Normal | 5 |
| `salary_payments` | `idx_salary_payments_unique` | `employee_id, period_year, period_month` | **UNIQUE** | 5 |
| `salary_payments` | `idx_salary_payments_negocio_id` | `negocio_id` | Normal | 8 |
| `job_roles` | `idx_job_roles_user_id` | `user_id` | Normal | 6 |
| `job_roles` | `idx_job_roles_negocio_id` | `negocio_id` | Normal | 8 |
| `negocio_members` | `idx_negocio_members_negocio` | `negocio_id` | Normal | 8 |
| `negocio_members` | `idx_negocio_members_user` | `user_id` | Normal | 8 |
| `invitations` | `idx_invitations_negocio` | `negocio_id` | Normal | 8 |
| `invitations` | `idx_invitations_token_hash` | `token_hash` | Normal | 8 |
| `usage_logs` | `idx_usage_logs_negocio_id` | `negocio_id` | Normal | 8 |
| `owner_requests` | `idx_owner_requests_negocio` | `negocio_id` | Normal | 12 |
| `owner_requests` | `idx_owner_requests_user` | `user_id` | Normal | 12 |
| `compras` | `idx_compras_negocio` | `negocio_id` | Normal | 13 |
| `compras` | `idx_compras_fecha` | `negocio_id, fecha` | Normal | 13 |
| `compras` | `idx_compras_comprador` | `comprador_id` | Normal | 13 |
| `facturas` | `idx_facturas_negocio` | `negocio_id` | Normal | 14 |
| `facturas` | `idx_facturas_fecha` | `negocio_id, fecha` | Normal | 14 |

### Índices implícitos (por constraints)

Además de los índices explícitos, SQLite crea índices automáticos para:
- `PRIMARY KEY` de cada tabla
- `UNIQUE` constraints: `users.email`, `admin_emails.email`, `negocio_members(negocio_id, user_id)`, `invitations.token_hash`, `usage_counters(user_id, negocio_id, tool, period)`, `usage_limits.tool`, `owner_requests(negocio_id, user_id, status)`

---

## Notas de Discrepancia entre Migraciones y Código

### `compras` y `facturacion` como `module_key`

Las migraciones 11 y 12 (que crean `user_module_prefs` y `negocio_module_restrictions`) documentan en sus comentarios SQL los valores válidos de `module_key` como `'calendario' | 'personal' | 'sueldos'` — **sin incluir `compras` ni `facturacion`**.

Sin embargo, el código del Worker (`VALID_MODULE_KEYS` y `VALID_KEYS` en `index.ts`) recognoce los 5 módulos. Esto funciona porque `module_key` es una columna `TEXT` sin constraint de enum. Las migraciones 13 y 14 (que agregan `compras` y `facturas`) no actulizaron los comentarios de las migraciones anteriores.

### `compras` y `facturacion` en `usage_limits` (resuelto en migración 16)

La migración 10 insertó valores iniciales en `usage_limits` para 8 tools, pero **no incluía `compras` ni `facturacion`**. Esto causaba que `PUT /api/admin/usage-limits` ejecutara un `UPDATE ... WHERE tool = ?` que afectaba 0 filas (falla silenciosa), y el admin no podía configurar esos límites.

La **migración 16** resuelve esto con:
```sql
INSERT OR IGNORE INTO usage_limits (tool, "limit") VALUES ('compras', 50), ('facturacion', 50);
```

Adicionalmente, el endpoint `PUT /api/admin/usage-limits` fue actualizado para usar **upsert** en lugar de `UPDATE`, eliminando el riesgo de falla silenciosa para cualquier herramienta futura que falte en la tabla.

---

## Limitaciones de D1

- No soporta foreign key constraints enforcement (la integridad referencial se valida en el backend).
- No soporta triggers ni `PRAGMA` statements.
- Free tier: 5 GB storage, 5M reads/día, 100K writes/día, 100K requests/día.
