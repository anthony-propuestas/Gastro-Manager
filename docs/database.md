# Base de Datos

## Tecnología

**Cloudflare D1** — SQLite serverless con réplica multi-región automática y backups diarios.

---

## Esquema General

La base de datos tiene **19 tablas** en 5 grupos funcionales:

| Grupo | Tablas |
|---|---|
| Identidad y acceso | `users`, `admin_emails` |
| Negocios compartidos | `negocios`, `negocio_members`, `invitations` |
| Roles y restricciones | `owner_requests`, `negocio_module_restrictions`, `user_module_prefs` |
| Cuotas | `usage_counters`, `usage_limits` |
| Datos operativos | `employees`, `job_roles`, `topics`, `notes`, `advances`, `salary_payments`, `events`, `compras` |
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
| `compras` | *(sin límite por defecto)* | Registrar compras y gastos |

`compras` no tiene límite seedeado en la migración — es `NULL` hasta que el admin lo configure desde el panel.

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
  module_key    TEXT    NOT NULL,  -- 'calendario' | 'personal' | 'sueldos' | 'compras'
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
  module_key TEXT NOT NULL,          -- 'calendario' | 'personal' | 'sueldos' | 'compras'
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
| Migraciones | Numeradas `1.sql`–`13.sql`, inmutables en producción |

---

## Limitaciones de D1

- No soporta foreign key constraints enforcement (la integridad referencial se valida en el backend).
- No soporta triggers ni `PRAGMA` statements.
- Free tier: 5 GB storage, 5M reads/día, 100K writes/día, 100K requests/día.
