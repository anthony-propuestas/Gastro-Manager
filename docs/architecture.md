# Arquitectura del Sistema

## Visión General

Gastro Manager es una aplicación full-stack donde el Worker de Cloudflare sirve tanto el frontend estático (React SPA) como la API REST, conectada a una base de datos D1 (SQLite) y servicios externos.

```
Navegador
   │
   │  HTTPS
   ▼
Cloudflare Worker (Hono)
   ├── Sirve React SPA (archivos estáticos)
   └── API REST /api/*
         ├── authMiddleware      → lee rol fresco de D1
         ├── negocioMiddleware   → valida X-Negocio-ID
         ├── usageLimitMiddleware → cuotas atómicas
         └── Route handlers → D1 (SQLite)
                              └── Google Gemini API (chatbot)

Google OAuth (accounts.google.com) ← intercambio de código en POST /api/sessions
```

---

## Stack Tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Frontend | React + React Router | 19 / 7 |
| Estilos | Tailwind CSS + shadcn/ui | v4 |
| Backend | Hono | latest |
| Runtime | Cloudflare Workers | Edge |
| Base de datos | Cloudflare D1 (SQLite) | — |
| Autenticación | Google OAuth nativo + JWT (jose) | — |
| Validación | Zod | — |
| IA | Google Gemini 2.5 Flash | v1beta |

---

## Middlewares del Worker

### `authMiddleware`

Ejecuta en todas las rutas `/api/*` (excepto OAuth).

1. Lee la cookie `session_token` y la verifica con `jwtVerify` (jose, JWT_SECRET).
2. Decodifica el JWT para obtener `user.id`.
3. **Lee el `role` fresco de la tabla `users` en D1** (no confía en el JWT para el rol).
4. Si el usuario no existe en `users`, asigna `role = 'usuario_basico'` por defecto.

```typescript
// Corrección 5: rol siempre desde DB, nunca desde JWT
const dbUser = await db.prepare("SELECT role FROM users WHERE id = ?")
  .bind(user.id).first<{ role: string }>();
user.role = dbUser?.role ?? "usuario_basico";
```

### `negocioMiddleware`

Ejecuta en todos los endpoints de datos operativos.

1. Lee el header `X-Negocio-ID`.
2. Verifica que el negocio exista en D1.
3. Verifica que el usuario autenticado sea miembro del negocio.
4. Inyecta `negocio` en el contexto Hono para los handlers.

### `createUsageLimitMiddleware(tool)`

Ejecuta antes de los 8 endpoints de escritura con cuota.

**Patrón atómico (increment-then-revert) para evitar TOCTOU:**

```
1. INSERT usage_counters ... count = count + 1 RETURNING count
2. Si newCount > limit:
   a. UPDATE usage_counters SET count = count - 1
   b. Devolver 429 USAGE_LIMIT_EXCEEDED
3. Si newCount <= limit: continuar con el handler
```

Omite todo si `user.role === 'usuario_inteligente'`.

---

## Sistema Multi-Negocio

Cada usuario puede crear o pertenecer a múltiples negocios. Todo dato operativo (empleados, sueldos, eventos) está aislado por `negocio_id`.

```
Usuario A ──┬── Miembro de: Negocio 1 (Restaurante Norte)
            │                  └── employees, events, salary_payments...
            └── Miembro de: Negocio 2 (Restaurante Sur)
                               └── employees, events, salary_payments...
```

El frontend mantiene un `currentNegocio` en el `AuthContext` y lo envía en cada petición como `X-Negocio-ID`.

El cambio de negocio se dispara desde el dropdown del sidebar. Al seleccionar otro negocio, el frontend actualiza `currentNegocio`, lo persiste en `localStorage` y vuelve a solicitar la data dependiente del negocio activo en hooks y pantallas que usan `apiFetch`.

**Convención del frontend:** los requests ligados a negocio deben usar `apiFetch(url, options, negocioId)` para centralizar la inyección de `X-Negocio-ID` y evitar inconsistencias al cambiar de negocio.

**Invitaciones:** Se genera un token único; el destinatario abre el enlace, autenticarse si no lo está, y canjea el token con `POST /api/invitations/:token/redeem`. El token queda invalidado tras el primer uso.

---

## Sistema de Roles y Cuotas

### Roles

| Rol | Descripción |
|---|---|
| `usuario_basico` | Sujeto a cuotas mensuales configurables |
| `usuario_inteligente` | Sin cuotas; acceso ilimitado |

El rol se almacena en `users.role` y es gestionado por el admin vía `/api/admin/users/:id/promote|demote`. Los cambios son **inmediatos** porque el `authMiddleware` lo lee de DB en cada request.

### Cuotas

Las cuotas son **por usuario por negocio por mes** (`UNIQUE(user_id, negocio_id, tool, period)`).

- **8 herramientas** sujetas a cuota: `employees`, `job_roles`, `topics`, `notes`, `advances`, `salary_payments`, `events`, `chat`.
- Los límites son globales (una fila por tool en `usage_limits`) y editables desde el panel de admin.
- El endpoint `mark-all-paid` consume **N usos** (uno por empleado marcado), con el mismo patrón atómico.

---

## Flujos Principales

### Login

```
1. Frontend → GET /api/oauth/google/redirect_url → URL de Google
2. Usuario se autentica en Google
3. Google redirige con ?code=...
4. Frontend → POST /api/sessions { code }
5. Worker intercambia code con Google (oauth2.googleapis.com/token)
6. Worker obtiene datos del usuario (googleapis.com/oauth2/v2/userinfo)
7. Worker hace UPSERT en users (sin sobrescribir role)
8. Cookie session_token seteada (httpOnly, JWT firmado con JWT_SECRET)
9. Redirección a dashboard
```

### Operación con cuota (ejemplo: crear empleado)

```
POST /api/employees
  │
  ├── authMiddleware: valida cookie → lee role de DB
  ├── negocioMiddleware: valida X-Negocio-ID → carga negocio
  ├── usageLimitMiddleware("employees"):
  │     - Si role === "usuario_inteligente" → skip
  │     - INSERT usage_counters count+1 RETURNING count
  │     - Si count > limit → UPDATE count-1 → 429
  └── handler: INSERT employees → 201
```

### Chatbot IA

```
POST /api/chat { message }
  │
  ├── authMiddleware + negocioMiddleware + usageLimitMiddleware("chat")
  └── handler:
        ├── SELECT empleados activos del negocio
        ├── SELECT eventos del mes
        ├── SELECT tópicos pendientes
        ├── SELECT anticipos y pagos
        ├── Construir system prompt con contexto
        └── POST → Gemini 2.5 Flash API
              └── Respuesta → { response: "..." }
```

---

## Estructura del Proyecto

```
gastro-manager/
├── migrations/           # 11 migraciones SQL (inmutables)
├── docs/                 # Documentación
├── src/
│   ├── worker/
│   │   ├── index.ts      # Todos los endpoints y middlewares
│   │   ├── usageTools.ts # Constantes USAGE_TOOLS y DEFAULT_USAGE_LIMITS
│   │   └── validation.ts # Esquemas Zod
│   └── react-app/
│       ├── context/
│       │   ├── AuthContext.tsx        # user, role, currentNegocio
│       │   └── ModulePrefsContext.tsx # preferencias de módulos
│       ├── hooks/
│       │   ├── useAdmin.ts        # Panel de admin (14+ funciones)
│       │   ├── useMyUsage.ts      # Cuotas propias
│       │   ├── useModulePrefs.ts  # Visibilidad de módulos (optimistic)
│       │   ├── useNegocios.ts     # Multi-tenancy: CRUD negocios
│       │   ├── useChat.ts         # Chatbot
│       │   └── use*.ts            # Hooks por módulo
│       ├── components/
│       │   ├── UsageBanner.tsx    # Banner de advertencia de cuota
│       │   ├── ChatWidget.tsx     # Widget flotante del chatbot
│       │   └── ui/                # shadcn/ui components
│       └── pages/
│           ├── Admin.tsx          # Panel de administración (6 secciones)
│           ├── Dashboard.tsx
│           ├── modulos/
│           │   ├── Employees.tsx
│           │   ├── Salaries.tsx
│           │   └── CalendarPage.tsx
│           ├── NegocioSetup.tsx   # Selección/creación de negocio
│           ├── InvitePage.tsx     # Flujo de invitación
│           └── ...
└── public/
```
│           └── ...
└── public/
```

---

## Capas de Seguridad

| Capa | Mecanismo | Dónde |
|---|---|---|
| 1. Autenticación | Google OAuth + cookie httpOnly | `authMiddleware` |
| 2. Rol fresco | Rol leído de DB, nunca del JWT | `authMiddleware` |
| 3. Aislamiento de datos | Todas las queries filtran por `negocio_id` | `negocioMiddleware` + handlers |
| 4. Validación de entrada | Zod schemas en servidor | `validateData()` |
| 5. Cuotas atómicas | Increment-then-revert sin TOCTOU | `createUsageLimitMiddleware` |

**Principios aplicados:**
- *Least privilege*: `usuario_basico` tiene cuotas; solo admin gestiona roles.
- *Defense in depth*: validación en cliente Y servidor.
- *Secure by default*: todas las rutas protegidas por defecto.
- *Secret management*: variables de entorno, nunca hardcoded.

---

## Patrones de Diseño

### Custom Hooks como repositorios
Cada módulo tiene un hook (`useEmployees`, `useSalaries`, etc.) que encapsula el estado y las llamadas a API. Los componentes solo consumen el hook.

### Context API para estado global
`AuthContext` expone `user`, `role`, `currentNegocio`, y la lista de negocios. `ToastContext` para notificaciones. `SidebarContext` para estado del menú. `ModulePrefsContext` distribuye las preferencias de visibilidad de módulos al Sidebar y Settings.

`currentNegocio` es la fuente única de verdad para el negocio activo. Cualquier vista con datos operativos debe reaccionar a cambios en `currentNegocio?.id` para refrescar su información.

### Formato de respuesta uniforme
Todos los endpoints devuelven `{ success: true, data }` o `{ success: false, error: { code, message } }`.

### Middleware chain en Hono
```
authMiddleware → negocioMiddleware → usageLimitMiddleware → handler
```
Cada middleware puede cortocircuitar la cadena devolviendo una respuesta sin llamar a `next()`.

---

## Rendimiento

- **Edge computing**: Workers ejecutan en +200 ubicaciones; latencia ~10-50ms.
- **D1 co-localizado**: SQLite co-ubicado con el Worker; sin latencia de red adicional.
- **Sin N+1**: los endpoints de overview (sueldos, calendario) usan JOINs y queries agregadas.

---

## Monitoreo

- Logs de Worker: `console.log/error` → Cloudflare Dashboard → Workers → Logs.
- Errores React: `ErrorBoundary` en el layout principal.
- Uso de cuotas: tabla `usage_counters` consultable vía `GET /api/admin/usage`.
