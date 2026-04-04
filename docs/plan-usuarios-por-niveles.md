# Plan: Sistema de Usuarios por Niveles

## Visión General

Implementar un sistema de roles con dos niveles de usuario: **Usuario Básico** (limitado por cuotas de uso) y **Usuario Inteligente** (sin límites). La gestión de ambos roles se centraliza en el Panel de Administración de la plataforma, accesible únicamente a correos con permisos especiales (`INITIAL_ADMIN_EMAIL` o correos agregados manualmente).

---

## Paso 1 — Asignar rol "Usuario Básico" a todos los usuarios logueados

### Lógica
Todos los usuarios que se autentican con Google OAuth reciben automáticamente el rol `usuario_basico` al registrarse por primera vez. Este rol se almacena en la tabla `users` de la base de datos.

### Cambios requeridos
- **DB (migración nueva):** Agregar columna `role` a la tabla `users` con valores posibles `usuario_basico` | `usuario_inteligente`. Valor por defecto: `usuario_basico`.
- **Worker:** Al crear el usuario en la primera sesión (`POST /api/sessions`), asignar `role = 'usuario_basico'` si el usuario no existe aún.
- **JWT / Sesión:** Incluir el campo `role` en el payload del token de sesión para que el frontend y el worker puedan leerlo sin consultas extra.
- **`GET /api/users/me`:** Devolver el campo `role` en la respuesta.

---

## Paso 2 — Identificar las herramientas de la plataforma

Las herramientas que consume un usuario y que serán sujetas a límites son:

| Módulo | Herramienta | Descripción |
|---|---|---|
| **Empleados** | Crear empleado | `POST /api/employees` |
| **Empleados** | Crear rol de trabajo | `POST /api/job-roles` |
| **Empleados** | Crear tema en empleado | `POST /api/employees/:id/topics` |
| **Empleados** | Crear nota en tema | `POST /api/topics/:id/notes` |
| **Sueldos** | Registrar anticipo | `POST /api/employees/:id/advances` |
| **Sueldos** | Marcar sueldo pagado | `POST /api/salary-payments/mark-paid` |
| **Sueldos** | Marcar todos pagados | `POST /api/salary-payments/mark-all-paid` |
| **Calendario** | Crear evento | `POST /api/events` |
| **Chat IA** | Enviar mensaje al chat | `POST /api/chat` |

> **Nota:** Las operaciones de lectura (`GET`) no están sujetas a límites ya que no generan carga significativa ni son el vector de monetización.

---

## Paso 3 — Contabilizar los usos y asignar límites

### Mecanismo de conteo
Cada vez que un usuario `usuario_basico` llama a un endpoint de escritura de las herramientas listadas arriba, el worker incrementa un contador en la tabla `usage_counters`.

#### Estructura de la tabla `usage_counters`
```sql
CREATE TABLE usage_counters (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL,          -- ID del usuario
  tool        TEXT NOT NULL,          -- nombre de la herramienta (ej: 'employees', 'events', 'chat')
  count       INTEGER NOT NULL DEFAULT 0,
  period      TEXT NOT NULL,          -- periodo de conteo, ej: '2026-04' (año-mes)
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, tool, period)
);
```

#### Límites mensuales por defecto (configurables desde el panel Admin)

| Herramienta | Límite mensual (Usuario Básico) |
|---|---|
| Empleados creados | 5 |
| Roles de trabajo creados | 3 |
| Temas creados | 10 |
| Notas creadas | 20 |
| Anticipos registrados | 10 |
| Sueldos marcados pagados | 10 |
| Eventos de calendario creados | 15 |
| Mensajes de chat IA | 20 |

#### Flujo de validación en el Worker
1. Leer el `role` del usuario desde el JWT.
2. Si `role === 'usuario_inteligente'` → continuar sin restricción.
3. Si `role === 'usuario_basico'`:
   - Consultar `usage_counters` para el usuario, herramienta y periodo actual.
   - Si `count >= limite_configurado` → responder `429 Too Many Requests` con mensaje claro.
   - Si no → incrementar el contador y proceder con la operación.

#### Tabla de límites configurables
```sql
CREATE TABLE usage_limits (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  tool    TEXT NOT NULL UNIQUE,   -- nombre de la herramienta
  limit   INTEGER NOT NULL        -- límite mensual para usuario_basico
);
```

Los límites se insertan con valores por defecto en la misma migración y pueden modificarse desde el panel Admin.

---

## Paso 4 — Panel de Administración: control de uso

### Ubicación
`/admin` — página `Admin.tsx`. Solo accesible para correos en `admin_emails` o el `INITIAL_ADMIN_EMAIL`.

### Secciones a agregar en el panel

#### 4.1 — Tabla de uso por usuario
Muestra una tabla con todos los usuarios registrados y su consumo mensual actual por herramienta. Permite al admin ver quién está cerca de sus límites.

**Nuevo endpoint:** `GET /api/admin/usage`
```json
// Respuesta ejemplo
{
  "period": "2026-04",
  "users": [
    {
      "user_id": "abc123",
      "email": "usuario@gmail.com",
      "role": "usuario_basico",
      "usage": {
        "employees": 3,
        "events": 12,
        "chat": 18
      }
    }
  ]
}
```

#### 4.2 — Configuración de límites
Formulario donde el admin puede modificar el límite mensual de cada herramienta para los `usuario_basico`. Los valores se guardan en la tabla `usage_limits`.

**Nuevo endpoint:** `PUT /api/admin/usage-limits`

#### 4.3 — Tarjetas de resumen de uso
Cards visuales con barras de progreso mostrando el uso agregado de la plataforma por herramienta (similar a las tarjetas ya existentes de Empleados/Sueldos/Calendario).

---

## Paso 5 — Rol "Usuario Inteligente"

### Definición
El `usuario_inteligente` tiene acceso ilimitado a todas las herramientas de la plataforma. No se aplica ninguna restricción de cuota.

### Cómo se asigna

#### Formulario en el Panel de Administración

Se agrega una nueva sección en `/admin` llamada **"Gestión de Roles de Usuario"**.

**Funcionalidad:**
- Campo de búsqueda para encontrar un usuario por email.
- Botón para promover al usuario a `usuario_inteligente`.
- Botón para regresar al usuario a `usuario_basico`.
- Tabla con todos los usuarios `usuario_inteligente` actuales y opción de revocar.

**Nuevos endpoints:**
```
POST   /api/admin/users/:userId/promote    → role = 'usuario_inteligente'
POST   /api/admin/users/:userId/demote     → role = 'usuario_basico'
GET    /api/admin/users                    → lista de usuarios con su role actual
```

**Seguridad:** Estos endpoints verifican que el solicitante sea admin (correo en `admin_emails` o `INITIAL_ADMIN_EMAIL`).

---

## Resumen de cambios técnicos

### Base de datos (nueva migración)
- Columna `role` en tabla `users`
- Tabla `usage_counters`
- Tabla `usage_limits` (con valores por defecto insertados)

### Worker (`src/worker/index.ts`)
- Incluir `role` en el JWT al crear sesión
- Middleware de validación de cuotas (`usageLimitMiddleware`) aplicado a endpoints de escritura
- Endpoints nuevos de admin: `/api/admin/usage`, `/api/admin/usage-limits`, `/api/admin/users`, `/api/admin/users/:id/promote`, `/api/admin/users/:id/demote`

### Frontend (`src/react-app/`)
- `AuthContext`: exponer el campo `role` del usuario
- `Admin.tsx`: agregar secciones de uso, límites y gestión de roles
- Páginas de herramientas (Employees, Salaries, CalendarPage, ChatWidget): mostrar un aviso visual cuando el usuario alcanza o supera su límite mensual

---

## Orden de implementación sugerido

1. Migración de base de datos (role + usage_counters + usage_limits)
2. Actualizar el worker: JWT con role + middleware de cuotas
3. Endpoints admin nuevos
4. Frontend: AuthContext + avisos de límite en cada módulo
5. Frontend: secciones nuevas en Admin.tsx

---

## Problemas identificados — Correcciones en orden lógico

Los siguientes puntos se deben resolver **antes o durante** la implementación del plan. Están ordenados de mayor a menor dependencia: los primeros desbloquean a los siguientes.

---

### Corrección 1 — Crear la tabla `users` (prerequisito bloqueante)

**Problema:** El plan asume que existe una tabla `users` donde agregar la columna `role`. Esa tabla no existe. Revisando todas las migraciones (1–8), los usuarios solo viven en el JWT de sesión + Google OAuth. No hay persistencia de usuarios en la DB.

**Qué hacer:**
- En la migración 9, crear la tabla `users` antes de agregar la columna `role`:

```sql
CREATE TABLE users (
  id         TEXT PRIMARY KEY,   -- Google ID
  email      TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  picture    TEXT NOT NULL DEFAULT '',
  role       TEXT NOT NULL DEFAULT 'usuario_basico',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

- En `POST /api/sessions` (worker), después de obtener los datos de Google, hacer UPSERT del usuario:

```sql
INSERT INTO users (id, email, name, picture, role, created_at, updated_at)
VALUES (?, ?, ?, ?, 'usuario_basico', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  email = excluded.email,
  name = excluded.name,
  picture = excluded.picture,
  updated_at = excluded.updated_at
```

- El campo `role` **no** se sobreescribe en el UPSERT para no revertir promociones existentes.

---

### Corrección 2 — Decidir si los límites son globales por usuario o por usuario+negocio

**Problema:** La migración 8 introdujo negocios compartidos: un usuario puede pertenecer a múltiples negocios y todos los datos están scoped por `negocio_id`. La tabla `usage_counters` propuesta solo tiene `user_id`, lo que crea ambigüedad.

**Decisión requerida (elegir una):**

| Opción | Comportamiento | Implicación en schema |
|---|---|---|
| **A — Global por usuario** | El límite se comparte entre todos sus negocios. Si crea 3 empleados en Negocio X y 2 en Negocio Y, ha consumido 5 de su cuota. | `usage_counters` sin `negocio_id` (como está en el plan) |
| **B — Por usuario+negocio** | Cada negocio tiene su propia cuota independiente. | Agregar `negocio_id` a `usage_counters` y cambiar el UNIQUE a `(user_id, negocio_id, tool, period)` |

**Recomendación:** Opción B es más justa en un sistema multi-negocio. Actualizar el schema de `usage_counters` en consecuencia antes de escribir el middleware.

---

### Corrección 3 — Definir los nombres canónicos de `tool`

**Problema:** El middleware de cuotas y la tabla `usage_limits` se comunican mediante un campo `tool TEXT`. Si el worker usa una clave distinta a la registrada en `usage_limits`, el conteo falla silenciosamente (sin match de límite = nunca bloquea). El plan no define estos nombres formalmente.

**Qué hacer:** Establecer un enum de nombres canónicos y usarlos de forma consistente en el middleware, en los INSERT de contadores y en el seed de `usage_limits`:

| Endpoint | Nombre canónico (`tool`) |
|---|---|
| `POST /api/employees` | `employees` |
| `POST /api/job-roles` | `job_roles` |
| `POST /api/employees/:id/topics` | `topics` |
| `POST /api/topics/:id/notes` | `notes` |
| `POST /api/employees/:id/advances` | `advances` |
| `POST /api/salary-payments/mark-paid` | `salary_payments` |
| `POST /api/salary-payments/mark-all-paid` | `salary_payments` (ver Corrección 4) |
| `POST /api/events` | `events` |
| `POST /api/chat` | `chat` |

Definir estas constantes en un archivo compartido (ej. `src/worker/usageTools.ts`) para evitar typos.

---

### Corrección 4 — Definir la semántica de conteo de `mark-all-paid`

**Problema:** El endpoint `POST /api/salary-payments/mark-all-paid` itera sobre todos los empleados activos del negocio en un loop. Si hay 10 empleados activos, una sola llamada marca 10 pagos. El plan lo lista con el mismo límite que `mark-paid` individual (10/mes), pero no define si cuenta como **1 uso** (por llamada) o **N usos** (por empleado marcado).

**Decisión requerida (elegir una):**

| Opción | Comportamiento |
|---|---|
| **A — 1 uso por llamada** | Llamar a `mark-all-paid` siempre cuesta 1, sin importar cuántos empleados haya. Simple, pero puede saltarse el límite efectivo. |
| **B — N usos por empleado marcado** | Cada empleado marcado consume 1 de la cuota. Más justo, pero puede sorprender al usuario. |
| **C — Límite separado** | `mark-all-paid` tiene su propia entrada en `usage_limits` con un límite distinto (ej. 3/mes). |

Documentar la opción elegida y reflejarla en la tabla de límites del Paso 3 y en el middleware.

---

### Corrección 5 — Estrategia para el JWT stale al cambiar el rol

**Problema:** El JWT tiene TTL de 7 días. Si el admin promueve o degrada a un usuario hoy, ese usuario no notará el cambio hasta que expire su token o haga logout + login. El plan lee el `role` directamente del JWT, lo que hace que los cambios de rol no sean inmediatos.

**Opciones (elegir una):**

| Opción | Ventaja | Desventaja |
|---|---|---|
| **A — DB lookup en cada request** | El rol es siempre el actual. | Un query extra por request protegido. |
| **B — JWT de corta duración + refresh token** | Correcto por diseño. | Requiere implementar refresh tokens (más trabajo). |
| **C — Versión de rol en DB + campo en JWT** | Detecta cambios sin query completo. | Complejidad media. |

**Recomendación:** Opción A. En el `authMiddleware`, después de verificar el JWT, hacer:
```sql
SELECT role FROM users WHERE id = ?
```
y usar ese valor en lugar del JWT. El overhead es mínimo (una query por request autenticado).

Actualizar `UserPayload` y `Variables` en el worker para incluir `role`:
```ts
type UserPayload = { id: string; email: string; name: string; picture: string; role: string };
```

---

### Corrección 6 — Conteo atómico para evitar race condition

**Problema:** El flujo "consultar count → verificar → incrementar" tiene una condición de carrera TOCTOU: dos requests simultáneos pueden pasar el check al mismo tiempo y ambos ejecutarse aunque solo uno debería pasar.

**Qué hacer:** Reemplazar el flujo de dos pasos por una operación atómica:

```sql
-- Paso 1: incrementar siempre (atómico)
INSERT INTO usage_counters (user_id, tool, period, count)
VALUES (?, ?, ?, 1)
ON CONFLICT(user_id, tool, period)
DO UPDATE SET count = count + 1, updated_at = datetime('now')
RETURNING count;

-- Paso 2: leer el count devuelto y comparar con el límite
-- Si count > limite → revertir con UPDATE count = count - 1 y responder 429
-- Si count <= limite → continuar con la operación
```

D1/SQLite garantiza atomicidad en operaciones individuales, por lo que este patrón es seguro.

---

### Corrección 7 — Endpoint `GET /api/usage/me` para el frontend

**Problema:** El plan dice "mostrar un aviso visual cuando el usuario alcanza su límite", pero no define cómo el frontend obtiene el uso actual del usuario. Sin este dato, no se pueden mostrar barras de progreso ni alertas preventivas (solo se puede mostrar el error después del 429).

**Qué hacer:** Agregar un endpoint nuevo:

```
GET /api/usage/me
```

**Respuesta:**
```json
{
  "period": "2026-04",
  "role": "usuario_basico",
  "usage": {
    "employees":      { "count": 3, "limit": 5 },
    "job_roles":      { "count": 1, "limit": 3 },
    "topics":         { "count": 7, "limit": 10 },
    "notes":          { "count": 12, "limit": 20 },
    "advances":       { "count": 4, "limit": 10 },
    "salary_payments":{ "count": 2, "limit": 10 },
    "events":         { "count": 9, "limit": 15 },
    "chat":           { "count": 18, "limit": 20 }
  }
}
```

- Si `role === 'usuario_inteligente'`, devolver `"limit": null` en todos los campos.
- El frontend llama a este endpoint al cargar cada módulo y muestra avisos cuando `count / limit >= 0.8`.
- Agregar este endpoint al resumen de cambios del Worker y al plan del Frontend.

---

### Corrección 8 — Proteger al admin de auto-degradarse

**Problema:** El endpoint `POST /api/admin/users/:userId/demote` no tiene restricción que impida que un admin se degrade a sí mismo. Si el único admin (que no sea `INITIAL_ADMIN_EMAIL`) lo hace accidentalmente, pierde acceso al panel y no puede revertirlo.

**Qué hacer:** En el handler de `/demote`, antes de ejecutar el UPDATE, verificar:

```ts
if (targetUserId === requestingUser.id) {
  return c.json(apiError("FORBIDDEN", "No puedes cambiar tu propio rol desde el panel admin"), 403);
}
```

El `INITIAL_ADMIN_EMAIL` siempre mantiene acceso independientemente del campo `role` en DB (ya está protegido por la función `isAdmin`), pero los admins secundarios necesitan esta guardia.

---

### Corrección 9 — Limpieza de filas antiguas en `usage_counters`

**Problema:** Los registros de periodos pasados (`2026-01`, `2026-02`, etc.) se acumulan indefinidamente en la tabla `usage_counters`. No hay estrategia de limpieza.

**Qué hacer (elegir una):**

| Opción | Descripción |
|---|---|
| **A — Cron job de Cloudflare** | Usar un Durable Object o Cron Trigger para borrar registros con más de N meses de antigüedad. |
| **B — Borrado lazy** | Al insertar/actualizar un contador, borrar en la misma transacción los registros del mismo usuario con periodo anterior a los últimos 3 meses. |
| **C — Sin limpieza (aceptar acumulación)** | Válido si el volumen es bajo. Documentar la decisión. |

Para el volumen actual de la plataforma la Opción C es aceptable a corto plazo. Dejar una nota en el schema de la migración.

---

### Orden de resolución recomendado

| # | Corrección | Tipo | Bloquea a |
|---|---|---|---|
| 1 | Crear tabla `users` | Schema + Worker | 2, 5, 7 |
| 2 | Decidir dimensión negocio en límites | Decisión de diseño | Schema de `usage_counters` |
| 3 | Definir nombres canónicos de `tool` | Decisión de diseño | Middleware, seed de DB |
| 4 | Semántica de `mark-all-paid` | Decisión de diseño | Middleware |
| 5 | Estrategia JWT stale | Worker | — |
| 6 | Conteo atómico | Worker | — |
| 7 | `GET /api/usage/me` | Worker + Frontend | UI de avisos |
| 8 | Protección auto-degradación | Worker | — |
| 9 | Limpieza de contadores viejos | Decisión / Infra | — |
