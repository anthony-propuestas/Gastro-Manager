# Sistema de Roles — Gastro Manager

## Visión General

Gastro Manager implementa un sistema de roles de **3 niveles** que controla el acceso, las cuotas de uso y la visibilidad de módulos. Adicionalmente existe el concepto de **Job Roles** (puestos de trabajo) que es puramente organizacional y no afecta permisos.

```
Nivel del Sistema (email-based)
  └── Admin
        • Gestión global de usuarios, límites y estadísticas

Nivel Global de Usuario (users.role)
  ├── usuario_inteligente  → Sin cuotas
  └── usuario_basico       → Cuotas mensuales

Nivel de Negocio (negocio_members.negocio_role)
  ├── owner    → Control total del negocio, restringe módulos a gerentes
  └── gerente  → Rol por defecto al ser invitado, sujeto a restricciones

Concepto independiente (tabla job_roles)
  └── Job Roles → Puestos de trabajo (HR), sin efecto en permisos
```

---

## 1. Rol Admin

### Determinación

El rol de Admin **no** se almacena en `users.role`. Se determina por **coincidencia de email** en dos fuentes:

| Fuente | Descripción |
|--------|-------------|
| Variable de entorno `INITIAL_ADMIN_EMAIL` | Define al primer administrador del sistema |
| Tabla `admin_emails` | Emails adicionales agregados por admins existentes |

La función `isAdmin()` en el worker verifica ambas fuentes en cada solicitud a endpoints `/api/admin/*`.

### Almacenamiento

```sql
-- Migration 7
CREATE TABLE admin_emails (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL UNIQUE,
  added_by   TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Capacidades exclusivas

| Capacidad | Endpoint |
|-----------|----------|
| Ver estadísticas del sistema | `GET /api/admin/stats` |
| Gestionar emails de admin | `GET/POST/DELETE /api/admin/emails` |
| Ver uso por usuario/negocio | `GET /api/admin/usage` |
| Configurar límites de uso | `GET/PUT /api/admin/usage-limits` |
| Listar todos los usuarios | `GET /api/admin/users` |
| Promover a `usuario_inteligente` | `POST /api/admin/users/:userId/promote` |
| Degradar a `usuario_basico` | `POST /api/admin/users/:userId/demote` |

### En el frontend

- La UI del panel Admin (`/admin`) solo se muestra si `isAdmin === true`.
- El enlace en el Sidebar aparece con un icono de escudo (Shield).
- Si un usuario no admin accede a `/admin`, ve un mensaje de "Acceso Restringido".

### Mecanismos de seguridad

- **Prevención de auto-degradación**: un admin no puede eliminarse a sí mismo de la lista de admins.
- Estado verificado en cada request vía `GET /api/admin/check`.

---

## 2. Roles Globales de Usuario

### Definición

Almacenados en la columna `users.role` (Migration 9). Controlan las **cuotas de uso**. En el código actual, **no** determinan si un usuario puede solicitar ser `owner`: esa validación depende de que el usuario sea miembro del negocio y de la aprobación de un `owner` existente.

```sql
-- Migration 9
CREATE TABLE users (
  id         TEXT PRIMARY KEY,               -- Google ID
  email      TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  picture    TEXT NOT NULL DEFAULT '',
  role       TEXT NOT NULL DEFAULT 'usuario_basico',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Comparación

| Característica | `usuario_basico` | `usuario_inteligente` |
|----------------|-------------------|-----------------------|
| Rol por defecto | ✅ Sí | ❌ No (requiere promoción por admin) |
| Cuotas mensuales | ✅ Sí, limitadas | ❌ Sin límite (bypass) |
| Puede solicitar ser owner si pertenece al negocio | ✅ Sí | ✅ Sí |
| Promoción | — | Vía `POST /api/admin/users/:userId/promote` |
| Degradación | — | Vía `POST /api/admin/users/:userId/demote` |

### Cuotas mensuales (solo `usuario_basico`)

Las cuotas se aplican por **combinación (usuario, negocio, herramienta, mes)**:

| Herramienta | Límite mensual |
|-------------|----------------|
| `employees` | 5 |
| `job_roles` | 3 |
| `topics` | 10 |
| `notes` | 20 |
| `advances` | 10 |
| `salary_payments` | 10 |
| `events` | 15 |
| `chat` | 20 |
| `compras` | *(sin límite por defecto — configurable desde el admin)* |

```sql
-- Migration 10
CREATE TABLE usage_counters (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL,
  negocio_id INTEGER NOT NULL,
  tool       TEXT NOT NULL,
  count      INTEGER NOT NULL DEFAULT 0,
  period     TEXT NOT NULL,          -- formato 'YYYY-MM'
  updated_at TEXT,
  UNIQUE(user_id, negocio_id, tool, period)
);

CREATE TABLE usage_limits (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  tool    TEXT NOT NULL UNIQUE,
  "limit" INTEGER NOT NULL
);
```

### Verificación atómica de cuotas

El middleware `createUsageLimitMiddleware(tool)` implementa un patrón atómico:

1. **Incrementar** el contador (`INSERT ... ON CONFLICT DO UPDATE count = count + 1`)
2. **Verificar** si el nuevo conteo supera el límite
3. **Revertir** (decrementar) si se excedió → responder con HTTP 429

Esto previene condiciones de carrera en solicitudes concurrentes.

### En el frontend

- El componente `UsageBanner` muestra el uso actual vs. límite en páginas de módulos.
- El rol se lee del contexto de autenticación (`AuthContext`).

---

## 3. Roles de Negocio

### Definición

Almacenados en `negocio_members.negocio_role` (Migration 12). Son roles **por negocio** — un usuario puede ser `owner` en un negocio y `gerente` en otro.

```sql
-- Migration 12
ALTER TABLE negocio_members ADD COLUMN negocio_role TEXT NOT NULL DEFAULT 'gerente';
```

### Comparación

| Característica | `owner` | `gerente` |
|----------------|---------|-----------|
| Asignación | Creador del negocio o aprobado via request | Por defecto al ser invitado |
| Restringir módulos a gerentes | ✅ Sí | ❌ No |
| Aprobar/rechazar owner requests | ✅ Sí | ❌ No |
| Ver Panel Owner (`/owner`) | ✅ Sí | ❌ No |
| Sujeto a restricciones de módulos | ❌ No (bypass) | ✅ Sí |
| Requisito previo | Ninguno | Ninguno |

### Restricciones de módulos

El owner puede ocultar módulos específicos a los gerentes de su negocio:

| Módulo | `module_key` | Rutas afectadas |
|--------|-------------|-----------------|
| Calendario | `calendario` | `/calendario` |
| Personal | `personal` | `/empleados` |
| Sueldos | `sueldos` | `/sueldos` |
| Compras | `compras` | `/compras` |

```sql
-- Migration 12
CREATE TABLE negocio_module_restrictions (
  negocio_id    INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  module_key    TEXT    NOT NULL, -- 'calendario' | 'personal' | 'sueldos' | 'compras'
  is_restricted INTEGER NOT NULL DEFAULT 0,
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (negocio_id, module_key)
);
```

El middleware `createModuleRestrictionMiddleware(moduleKey)` verifica:
- Si el usuario es `gerente` **y** el módulo está restringido → HTTP 403.
- Si el usuario es `owner` → acceso permitido siempre.

### En el frontend

- **Sidebar**: los gerentes no ven enlaces a módulos restringidos.
- **`RestrictedModuleRoute`**: redirige gerentes a `/` si intentan acceder a una ruta restringida.
- **Settings**: módulos restringidos muestran un icono de candado (Lock) con el texto "Restringido por el owner" y el switch queda deshabilitado.
- **Panel Owner** (`/owner`): solo visible para owners, con toggles para activar/desactivar restricciones y gestión de owner requests.

---

## 4. Flujo de Owner Request

Cualquier miembro de un negocio puede solicitar ser `owner`. El creador del negocio es automáticamente el primer owner.

Este flujo usa el rol por negocio (`negocio_members.negocio_role`), no el rol global (`users.role`).

```
1. Miembro del negocio (cualquier rol global)
       │
       ▼
2. Solicita ser owner (POST /api/negocios/:id/request-owner)
       │
       ▼
3. Se crea registro en owner_requests (status = 'pending')
       │
  └──► Queda pendiente (siempre existe un owner: el creador)
                 │
                 ▼
           4. Owner existente aprueba/rechaza
              (POST /api/negocios/:id/owner-requests/:requestId/approve|reject)
                 │
                 ├──► Aprobado → negocio_members.negocio_role = 'owner'
                 └──► Rechazado → status = 'rejected'
```

```sql
-- Migration 12
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

### Protección del último owner

Si un owner intenta abandonar un negocio que tiene otros miembros y es el **único owner**, la operación se rechaza para evitar un negocio sin administrador.

---

## 5. Sistema de Invitaciones

Las invitaciones conectan usuarios nuevos con negocios existentes:

```
Owner/Gerente genera invitación
       │
       ▼
POST /api/negocios/:id/invitations
       │
       ▼
Se genera token_hash con expiración
       │
       ▼
URL: /invite/{token}
       │
       ▼
Usuario logeado redime el token
(POST /api/invitations/:token/redeem)
       │
       ▼
Se agrega a negocio_members con negocio_role = 'gerente'
```

```sql
-- Migration 8
CREATE TABLE invitations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  negocio_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  invited_by TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at    DATETIME,
  used_by    TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

- Todos los invitados ingresan como `gerente`.
- El token es de un solo uso y tiene expiración.

---

## 6. Job Roles vs User Roles

Es importante distinguir estos dos conceptos:

| Aspecto | User Roles | Job Roles |
|---------|-----------|-----------|
| Propósito | Control de acceso y permisos | Clasificación de puestos de trabajo (HR) |
| Almacenamiento | `users.role` + `negocio_members.negocio_role` | Tabla `job_roles` |
| Afecta permisos | ✅ Sí | ❌ No |
| Ámbito | Global / por negocio | Por negocio |
| Ejemplo | `owner`, `gerente`, `usuario_inteligente` | "Jefe de Cocina", "Supervisor de Barra" |
| Sujeto a cuotas | No (los roles controlan cuotas) | Sí (máx. 3/mes para `usuario_basico`) |

```sql
-- Migration 6
CREATE TABLE job_roles (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  negocio_id INTEGER NOT NULL,
  name       TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Los Job Roles se asignan a empleados (`employees.role`) y son creados/editados libremente por cualquier miembro del negocio (sujeto a cuotas si es `usuario_basico`).

---

## 7. Middleware Guards (Backend)

El worker define 4 niveles de middleware que se aplican en cadena:

| Middleware | Archivo | Función |
|-----------|---------|---------|
| `authMiddleware` | `src/worker/index.ts` | Valida JWT, lee `users.role` fresco de la DB |
| `negocioMiddleware` | `src/worker/index.ts` | Verifica membresía al negocio, establece `negocio_role` |
| `createUsageLimitMiddleware(tool)` | `src/worker/index.ts` | Verifica cuotas (skip si `usuario_inteligente`) |
| `createModuleRestrictionMiddleware(moduleKey)` | `src/worker/index.ts` | Bloquea gerentes de módulos restringidos |

**Detalle importante**: el rol del usuario se **lee de la base de datos en cada request**, no se confía en el valor cacheado en el JWT. Esto garantiza que cambios de rol surtan efecto de inmediato.

---

## 8. Frontend — Control de Acceso por Rol

### Rutas protegidas

| Componente | Verificación |
|-----------|-------------|
| `ProtectedRoute` | Usuario autenticado + negocio seleccionado |
| `RestrictedModuleRoute` | `ProtectedRoute` + módulo no restringido para gerentes |

### Sidebar — Visibilidad de navegación

```
Dashboard        → Siempre visible
Calendario       → Oculto si: prefs.calendario = false O (isGerente Y restricción activa)
Personal         → Oculto si: prefs.personal = false O (isGerente Y restricción activa)
Sueldos          → Oculto si: prefs.sueldos = false O (isGerente Y restricción activa)
Compras          → Oculto si: prefs.compras = false O (isGerente Y restricción activa)
Configuración    → Siempre visible
Admin            → Solo si isAdmin
Panel Owner      → Solo si negocio_role = 'owner'
```

### Páginas exclusivas por rol

| Página | Rol requerido | Comportamiento si no cumple |
|--------|---------------|----------------------------|
| `/admin` | Admin (email-based) | Muestra "Acceso Restringido" |
| `/owner` | `owner` en el negocio actual | Redirige a `/` |

### Preferencias de módulos del usuario

Independiente de las restricciones del owner, cada usuario puede **ocultar módulos voluntariamente**:

```sql
-- Migration 11
CREATE TABLE user_module_prefs (
  user_id    TEXT NOT NULL,
  module_key TEXT NOT NULL,
  is_active  INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT,
  PRIMARY KEY (user_id, module_key)
);
```

Un módulo es visible si: `user_module_prefs.is_active = 1` **Y** (es `owner` **O** `negocio_module_restrictions.is_restricted = 0`).

---

## 9. Tabla Resumen de Permisos

| Permiso | Admin | `usuario_inteligente` + `owner` | `usuario_inteligente` + `gerente` | `usuario_basico` + `owner` | `usuario_basico` + `gerente` |
|---------|-------|------|---------|------|---------|
| Panel Admin | ✅ | ❌ | ❌ | ❌ | ❌ |
| Promover/degradar usuarios | ✅ | ❌ | ❌ | ❌ | ❌ |
| Gestionar límites de uso | ✅ | ❌ | ❌ | ❌ | ❌ |
| Sin cuotas mensuales | — | ✅ | ✅ | ❌ | ❌ |
| Solicitar ser owner | — | ✅ | ✅ | ✅ | ✅ |
| Panel Owner | — | ✅ | ❌ | ✅ | ❌ |
| Restringir módulos a gerentes | — | ✅ | ❌ | ✅ | ❌ |
| Aprobar owner requests | — | ✅ | ❌ | ✅ | ❌ |
| Módulos restringidos | — | Acceso total | ❌ Bloqueado | Acceso total | ❌ Bloqueado |
| CRUD empleados/eventos/etc. | — | ✅ | ✅ (si módulo no restringido) | ✅ (con cuota) | ✅ (con cuota, si módulo no restringido) |

---

## 10. Diagrama de Relaciones en Base de Datos

```
                        ┌─────────────┐
                        │    users    │
                        │─────────────│
                        │ id (PK)     │
                        │ email       │
                        │ role        │◄── 'usuario_basico' | 'usuario_inteligente'
                        └──────┬──────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
     ┌────────────────┐ ┌───────────────┐ ┌──────────────────┐
     │  admin_emails  │ │negocio_members│ │  owner_requests  │
     │────────────────│ │───────────────│ │──────────────────│
     │ email (UNIQUE) │ │ user_id (FK)  │ │ user_id (FK)     │
     │ added_by       │ │ negocio_id(FK)│ │ negocio_id (FK)  │
     └────────────────┘ │ negocio_role  │ │ status           │
                        │ invited_by    │ │ resolved_by      │
                        └───────┬───────┘ └──────────────────┘
                                │
                                ▼
                       ┌────────────────┐
                       │    negocios    │
                       │────────────────│
                       │ id (PK)        │
                       │ name           │
                       │ created_by     │
                       └───────┬────────┘
                               │
          ┌────────────┬───────┼───────┬────────────┐
          ▼            ▼       ▼       ▼            ▼
    ┌───────────┐ ┌─────────┐ │ ┌───────────┐ ┌─────────────────────┐
    │ employees │ │job_roles│ │ │  events   │ │negocio_module_      │
    │───────────│ │─────────│ │ │───────────│ │restrictions         │
    │negocio_id │ │negocio_ │ │ │negocio_id │ │─────────────────────│
    │ role (HR) │ │id       │ │ └───────────┘ │ negocio_id          │
    └───────────┘ │ name    │ │               │ module_key           │
                  └─────────┘ │               │ is_restricted        │
                              ▼               └─────────────────────┘
                    ┌──────────────────┐
                    │ usage_counters   │
                    │──────────────────│
                    │ user_id          │
                    │ negocio_id       │
                    │ tool             │
                    │ count            │
                    │ period (YYYY-MM) │
                    └──────────────────┘
```
