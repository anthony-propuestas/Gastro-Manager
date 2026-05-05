# Arquitectura del Sistema

## Visión General

Gastro Manager es una aplicación full-stack con frontend desplegado en **Cloudflare Pages** y API REST en un **Cloudflare Worker** (Hono), conectada a una base de datos D1 (SQLite) y servicios externos.

```
Navegador
   │
   │  HTTPS
   ▼
Cloudflare Pages — functions/[[route]].ts intercepta TODAS las rutas
   ├── /api/*     → Hono Worker (src/worker/index.ts)
   │                    ├── corsMiddleware           → valida Origin contra APP_URL
   │                    ├── authMiddleware           → lee rol fresco de D1
   │                    ├── negocioMiddleware        → valida X-Negocio-ID
   │                    ├── moduleRestrictionMiddleware → bloquea gerentes de módulos restringidos
   │                    ├── usageLimitMiddleware     → cuotas atómicas
   │                    └── Route handlers → D1 (SQLite)
   │                                         ├── R2 producción (comprobantes)
   │                                         └── Google Gemini API (chatbot)
   ├── /assets/*  → ASSETS (404 + Cache-Control: no-store si el archivo no existe)
   └── demás      → ASSETS con fallback a /index.html para SPA routing

Google OAuth (accounts.google.com) ← intercambio de código en POST /api/sessions

GitHub Actions (cron diario 03:00 UTC)
   ├── Job Backup D1 → wrangler d1 export → R2 producción /backups/d1/YYYY-MM-DD/
   └── Job Backup R2 → rclone sync       → R2 backup (comprobantes)
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
| Almacenamiento | Cloudflare R2 (comprobantes) | — |
| Caché en memoria | Cloudflare KV (binding `CACHE`) | — |
| Autenticación | Google OAuth nativo + JWT (jose) | — |
| Validación | Zod | — |
| IA | Google Gemini 2.5 Flash | v1beta |

---

## Middlewares del Worker

### `corsMiddleware` (global `/api/*`)

Primer middleware en ejecutar. Valida que el header `Origin` de la request coincida exactamente con `APP_URL` (variable de entorno). Si no coincide, la respuesta no incluye `Access-Control-Allow-Origin` y el browser bloquea la respuesta. Configurado con `hono/cors`:

- Métodos permitidos: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`
- Headers permitidos: `Content-Type`, `X-Negocio-ID`
- `credentials: true` (necesario para cookies)
- `maxAge: 600`

Si `APP_URL` no está definida (dev local sin proxy), todos los orígenes quedan bloqueados por CORS para requests cross-origin; las requests same-origin (sin header `Origin`) no son afectadas.

### `authMiddleware`

Ejecuta en todas las rutas `/api/*` (excepto OAuth).

1. Lee la cookie `session_token` y la verifica con `jwtVerify` (jose, JWT_SECRET).
2. Decodifica el JWT para obtener `user.id`.
3. **Lee `role` y `email_verified` frescos de la tabla `users` en D1** (no confía en el JWT).
4. Si el usuario no existe en `users`, asigna `role = 'usuario_basico'` por defecto.
5. Si `role === 'usuario_inteligente'`, consulta `suscripciones` para verificar el período de gracia:
   - Si la gracia expiró: hace `batch` UPDATE (suscripción → `'pausada'`, usuario → `'usuario_basico'`) y degrada el rol en la request actual.
   - Si la gracia aún está activa: emite el header `X-Grace-Days-Left` con los días restantes.

```typescript
const dbUser = await db.prepare("SELECT role, email_verified FROM users WHERE id = ?")
  .bind(user.id).first<{ role: string; email_verified: number }>();
user.role = dbUser?.role ?? "usuario_basico";

if (user.role === "usuario_inteligente") {
  const sub = await db.prepare("SELECT estado, grace_deadline FROM suscripciones WHERE user_id = ?")
    .bind(user.id).first();
  if (sub?.estado === "en_gracia" && sub.grace_deadline) {
    if (Date.now() > new Date(sub.grace_deadline).getTime()) {
      await db.batch([/* UPDATE suscripciones → pausada, UPDATE users → usuario_basico */]);
      user.role = "usuario_basico";
    } else {
      c.header("X-Grace-Days-Left", String(daysLeft));
    }
  }
}
```

### `negocioMiddleware`

Ejecuta en todos los endpoints de datos operativos.

1. Lee el header `X-Negocio-ID`.
2. Verifica que el negocio exista en D1.
3. Verifica que el usuario autenticado sea miembro del negocio.
4. Inyecta `negocio` en el contexto Hono para los handlers.

### `createUsageLimitMiddleware(tool)`

Ejecuta antes de los 9 endpoints de escritura con cuota.

**Patrón atómico (increment-then-revert) para evitar TOCTOU:**

- Si `user.role === 'usuario_inteligente'`, aplica cuota propia (cap `CHAT_CAP_INTELIGENTE = 3000`). No usa `usage_limits`.

```
1. INSERT usage_counters ... count = count + 1 RETURNING count
2. Si newCount > limit:
   a. UPDATE usage_counters SET count = count - 1
   b. Devolver 429 USAGE_LIMIT_EXCEEDED
3. Si newCount === 80% del cap (2400 para inteligente, solo tool=chat):
   - waitUntil(sendCapAlertEmail()) → email de aviso al usuario
4. Si newCount <= limit: continuar con el handler
```

**Alerta al 80% (solo `usuario_inteligente`, tool `chat`):** cuando el contador cruza exactamente 2400, se envía un email transaccional via Resend (`sendCapAlertEmail`) en `waitUntil`. El cruce exacto evita envíos repetidos.

**Efecto en frontend cuando hay exceso de cuota:**

1. El backend responde `429 USAGE_LIMIT_EXCEEDED`
2. `apiFetch()` detecta la respuesta y dispara `USAGE_LIMIT_EVENT`
3. `UsageLimitModalProvider` muestra un modal global de upgrade a Usuario Inteligente
4. El usuario puede cerrarlo; la acción original permanece rechazada

Omite bloqueo si `user.role === 'usuario_inteligente'` y el counter no supera `CHAT_CAP_INTELIGENTE`.

### `createModuleRestrictionMiddleware(moduleKey)`

Ejecuta en endpoints de módulos restringibles (`calendario`, `personal`, `sueldos`, `compras`, `facturacion`).

- Si el usuario es `owner` del negocio → acceso permitido siempre.
- Si el usuario es `gerente` y el módulo está marcado como restringido en `negocio_module_restrictions` → devuelve 403 FORBIDDEN.

**⚠️ Excepciones importantes — rutas SIN restricción de módulo:**

| Ruta | Razón |
|---|---|
| `POST /api/chat` | El chatbot no pertenece a ningún módulo. No es restringible por el owner. Además, el contexto enviado a Gemini incluye datos de **todos** los módulos (empleados, eventos, tópicos, anticipos, pagos) independientemente de restricciones. Un gerente con módulos restringidos puede acceder a esa información indirectamente via el chatbot. |
| `GET /api/compras/files/*` | Solo requiere `auth + negocio`. Un gerente con `compras` restringido podría acceder a imágenes de comprobantes si conoce la URL directa (el key de R2). Se valida que el key pertenezca al negocio activo, pero no se verifica la restricción del módulo. |
| `GET /api/auth/verify-email` | Endpoint de verificación de email. No requiere sesión activa ni negocio; solo valida el token de verificación. |

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
| `usuario_inteligente` | Cap de **3.000 queries/mes** para `chat` (via `incrementAndCheckInteligenteLimit`). Sin cuota para los otros 9 tools. Uso registrado en `usage_counters`. |

El rol se almacena en `users.role` y es gestionado por el admin vía `/api/admin/users/:id/promote|demote`. Los cambios son **inmediatos** porque el `authMiddleware` lo lee de DB en cada request.

### Cuotas

Las cuotas son **por usuario por negocio por mes** (`UNIQUE(user_id, negocio_id, tool, period)`).

- **10 herramientas** sujetas a cuota: `employees`, `job_roles`, `topics`, `notes`, `advances`, `salary_payments`, `events`, `chat`, `compras`, `facturacion`.
- Los límites son globales (una fila por tool en `usage_limits`) y editables desde el panel de admin.
- El endpoint `mark-all-paid` consume **N usos** (uno por empleado marcado), con lógica inline (no usa el middleware estándar).
- `compras` y `facturacion` tienen límite default de 50 seedeado en migración 16.

**⚠️ DISCREPANCIA CRÍTICA - Consumo de cuota en PUT/DELETE:**
La documentación anterior indicaba que `PUT /api/compras`, `PUT /api/facturacion` y `DELETE /api/facturacion` consumían cuota. **El código real NO incluye `createUsageLimitMiddleware` en estos endpoints**. Por lo tanto:
- **PUT /api/compras/:id** → NO consume cuota (inconsistencia)
- **DELETE /api/compras/:id** → NO consume cuota (inconsistencia)
- **PUT /api/facturacion/:id** → NO consume cuota (inconsistencia)
- **DELETE /api/facturacion/:id** → NO consume cuota (inconsistencia)

Además, las operaciones DELETE en otros módulos (`employees`, `topics`, `notes`, `job-roles`, `advances`) también **NO consumen cuota**, a pesar de que solo POST está documentado como sujeto a límites. Esto permite a usuarios básicos eliminar datos ilimitadamente.

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
8a. Si usuario NO verificado → genera token de verificación, envía email,
    responde { error: { code: "PENDING_VERIFICATION" } } (sin cookie)
8b. Si usuario verificado → Cookie session_token seteada (httpOnly, JWT firmado con JWT_SECRET)
9. Redirección a dashboard

── Rama verificación de email ──
GET /api/auth/verify-email?token=<token_plano>
   → Valida token → marca usuario como verificado
   → Crea cookie session_token → responde éxito
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
  │   ⚠️ NO tiene createModuleRestrictionMiddleware
  └── handler:
        ├── SELECT chat_context_cache (TTL 30 min)
        │     └── miss: db.batch([
        │                 empleados (activos primero ORDER BY is_active DESC, LIMIT 30),
        │                 eventos (mes actual ORDER BY event_date ASC, LIMIT 20),
        │                 temas abiertos (ORDER BY due_date ASC, LIMIT 15),
        │                 adelantos (mes actual), sueldos (mes actual)
        │               ])
        │                └── UPSERT chat_context_cache (limpia gemini_cache_name = NULL)
        ├── getOrCreateGeminiCache() [geminiCache.ts]
        │     ├── hit: gemini_cache_name válido (<2h) → retorna nombre existente
        │     └── miss: POST /v1beta/cachedContents (systemInstruction, TTL 2h)
        │                └── UPDATE chat_context_cache (gemini_cache_name, gemini_cache_expires_at)
        │                └── null si API falla (fallback transparente)
        ├── POST → Gemini 2.5 Flash API
        │     ├── con cache: { cachedContent: "cachedContents/xyz", contents: [history + message] }
        │     └── sin cache (fallback): { contents: [contextText + history + message] }
        │     └── Respuesta → { reply: "..." }
        └── waitUntil(INSERT gemini_usage_log(prompt_tokens, output_tokens))
              — registra usageMetadata de la respuesta de Gemini (no bloquea al cliente)
```

⚠️ **Implicación de seguridad:** El chatbot accede a datos de todos los módulos sin respetar restricciones del owner. Un gerente con módulos restringidos puede obtener información de esos módulos a través del chat.

---

## Sellers / Programa de Referidos

Feature platform-level: **no particionada por `negocio_id`**. El vínculo es entre usuarios, independiente del negocio activo.

### Tablas

- **`vendedores`**: un registro por usuario-vendedor. Código único generado al activarse (alfanumérico + timestamp, con retry ante colisión).
- **`referidos`**: registra el vínculo vendedor → comprador. Estado: `pendiente` al crear la suscripción → `confirmado` cuando MercadoPago aprueba el pago.

### Confirmación automática

El webhook `POST /api/webhooks/mercadopago` dispara `UPDATE referidos SET estado='confirmado', comision_monto=7500, reembolso_monto=6000, confirmed_at=…` cuando el pago es aprobado (`type=payment`, `status=approved`).

### Estructura de comisiones

| Concepto | Monto | Destinatario |
|---|---|---|
| Comisión | 7.500 ARS | Vendedor (al confirmar pago) |
| Reembolso | 6.000 ARS | Comprador referido (al confirmar pago) |

Los flags `comision_pagada` y `reembolso_pagado` permiten al admin registrar el desembolso manual.

### Navegación

El item "Vendedores" en Sidebar y BottomNav no tiene `moduleKey` — siempre visible, no sujeto a restricciones de módulo del owner.

### Flujo

```
Usuario → POST /api/sellers/activate → genera codigo único → tabla vendedores
Comprador → GET /suscripcion?ref=CODIGO → POST /api/suscripciones/crear { ref_code }
         → INSERT referidos (estado: pendiente)
MercadoPago → POST /api/webhooks/mercadopago (payment approved)
           → UPDATE referidos SET estado=confirmado, comision_monto=7500, reembolso_monto=6000
```

---

## Estructura del Proyecto

```
gastro-manager/
├── migrations/           # Migraciones SQL numeradas (inmutables)
├── docs/                 # Documentación
├── wrangler.json         # Config Pages (frontend + Worker principal)
├── wrangler-cron.json    # Config Worker de cron (deploy separado)
├── functions/
│   └── [[route]].ts      # Pages Function: /api/* → Hono Worker; /assets/* → ASSETS (404 limpio si falta); demás → ASSETS con fallback a index.html
├── public/
│   ├── _redirects        # Placeholder vacío; el SPA routing lo maneja [[route]].ts
│   └── _headers          # Headers HTTP por ruta: security headers globales (X-Frame-Options, CSP, etc.); Cache-Control por ruta
├── src/
│   ├── cron/
│   │   └── index.ts         # Worker de cron: handler scheduled() — limpieza mensual de R2
│   ├── worker/
│   │   ├── index.ts         # Todos los endpoints y middlewares (solo exporta { fetch })
│   │   ├── geminiCache.ts   # getOrCreateGeminiCache() — Gemini API-level context caching
│   │   ├── rateLimitAuth.ts # checkRateLimit() — rate limiting D1 para endpoints de auth
│   │   ├── usageTools.ts    # Constantes USAGE_TOOLS y DEFAULT_USAGE_LIMITS
│   │   └── validation.ts    # Esquemas Zod
│   └── react-app/
│       ├── context/
│       │   ├── AuthContext.tsx        # user, role, currentNegocio
│       │   ├── ModulePrefsContext.tsx # preferencias de módulos
│       │   └── UsageLimitModalContext.tsx # modal global de upgrade por cuota
│       ├── hooks/
│       │   ├── useAdmin.ts        # Panel de admin (incluye sellers, referidos, mark-pagada/reembolso)
│       │   ├── useSellers.ts      # Programa de referidos: activación, fetchMe, stats
│       │   ├── useMyUsage.ts      # Cuotas propias
│       │   ├── useModulePrefs.ts  # Visibilidad de módulos (optimistic)
│       │   ├── useNegocios.ts     # Multi-tenancy: CRUD negocios
│       │   ├── useChat.ts         # Chatbot
│       │   └── use*.ts            # Hooks por módulo
│       ├── lib/
│       │   ├── api.ts             # fetch helper + detección de 429 de cuota
│       │   └── usageLimitModal.ts # evento global USAGE_LIMIT_EVENT y payload
│       ├── components/
│       │   ├── UsageBanner.tsx    # Banner de advertencia de cuota
│       │   ├── ChatWidget.tsx     # Widget flotante del chatbot
│       │   └── ui/                # shadcn/ui components
│       └── pages/
│           ├── Admin.tsx          # Panel de administración (7 secciones, incluye Programa de Referidos)
│           ├── Sellers.tsx        # Programa de referidos: activación, link, stats, tabla
│           ├── Dashboard.tsx
│           ├── OwnerPanel.tsx     # Panel de owner (restricciones + owner requests)
│           ├── Settings.tsx       # Configuración (módulos, miembros)
│           ├── modulos/
│           │   ├── Employees.tsx
│           │   ├── Salaries.tsx
│           │   ├── CalendarPage.tsx
│           │   ├── Compras.tsx
│           │   └── facturacion/   # Módulo de facturación (calendario + CRUD)
│           ├── NegocioSetup.tsx   # Selección/creación de negocio
│           ├── InvitePage.tsx     # Flujo de invitación
│           └── ...
```

---

## Capas de Seguridad

| Capa | Mecanismo | Dónde |
|---|---|---|
| 0. CORS | Valida `Origin` contra `APP_URL`; rechaza orígenes no autorizados | `corsMiddleware` (hono/cors) |
| 1. Autenticación | Google OAuth + cookie httpOnly | `authMiddleware` |
| 2. Rol fresco | `role` y `email_verified` leídos de DB, nunca del JWT. Downgrade automático si gracia de suscripción expiró | `authMiddleware` |
| 3. Aislamiento de datos | Todas las queries filtran por `negocio_id` | `negocioMiddleware` + handlers |
| 4. Validación de entrada | Zod schemas en servidor | `validateData()` |
| 5. Cuotas atómicas | Increment-then-revert sin TOCTOU | `createUsageLimitMiddleware` |
| 6. Rate limiting en auth | Max 10 req/15 min (`/api/sessions`), 5 req/hr (`/api/auth/verify-email`) por IP hasheada | `checkRateLimit()` en `rateLimitAuth.ts` |
| 7. Headers de seguridad HTTP | CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy | `public/_headers` |

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
`AuthContext` expone `user`, `role`, `currentNegocio`, y la lista de negocios. Toast notifications via componente `toast.tsx` de shadcn/ui. `SidebarContext` para estado del menú. `ModulePrefsContext` distribuye las preferencias de visibilidad de módulos al Sidebar y Settings.

`currentNegocio` es la fuente única de verdad para el negocio activo. Cualquier vista con datos operativos debe reaccionar a cambios en `currentNegocio?.id` para refrescar su información.

### Formato de respuesta uniforme
Todos los endpoints devuelven `{ success: true, data }` o `{ success: false, error: { code, message } }`.

### Middleware chain en Hono
```
corsMiddleware → authMiddleware → negocioMiddleware → moduleRestrictionMiddleware → usageLimitMiddleware → handler
```
Cada middleware puede cortocircuitar la cadena devolviendo una respuesta sin llamar a `next()`.

---

## Cron Handler

El cron corre en un **Worker separado** (`wrangler-cron.json`, `src/cron/index.ts`), desplegado independientemente del Worker principal con `wrangler deploy -c wrangler-cron.json`. El Worker principal (`src/worker/index.ts`) solo exporta `{ fetch }`.

El Worker de cron solo exporta `{ scheduled }` — no tiene endpoints HTTP. Se dispara el **1 de cada mes a las 03:00 UTC** (`0 3 1 * *`):

```
scheduled():
  SELECT id, comprobante_key FROM compras WHERE expires_at <= datetime('now') AND comprobante_key IS NOT NULL
  Para cada fila:
    R2_BUCKET.delete(comprobante_key)
    UPDATE compras SET comprobante_key = NULL WHERE id = ?
```

Limpia archivos de comprobantes en R2 que llevan más de 24 meses subidos, liberando storage. Usa los mismos bindings D1 y R2 que el Worker principal (mismo `database_id` y `bucket_name` en `wrangler-cron.json`).

---

## Caché KV (CACHE binding)

Cloudflare KV se usa como caché de lectura con TTL de 60 segundos para dos endpoints de alta frecuencia:

| Endpoint | Clave KV | Invalidación |
|---|---|---|
| `GET /api/employees` | `emp:{negocio_id}` | POST / PUT / DELETE employees |
| `GET /api/events` | `evt:{negocio_id}:{mm}:{yyyy}` | POST / PUT / DELETE events (del mes afectado) + clave sin mes (`evt:{id}::`) |

Las escrituras a KV y las invalidaciones se hacen en `waitUntil` (no bloquean la respuesta).

---

## Rendimiento

- **Edge computing**: Workers ejecutan en +200 ubicaciones; latencia ~10-50ms.
- **D1 co-localizado**: SQLite co-ubicado con el Worker; sin latencia de red adicional.
- **Sin N+1**: los endpoints de overview (sueldos, calendario) usan JOINs y queries agregadas.
- **db.batch()** en el handler de chat: las 5 queries de contexto se envían en una sola llamada a D1 (antes usaban `Promise.all` con 5 llamadas independientes).

---

## Monitoreo

- Logs de Worker: `console.log/error` → Cloudflare Dashboard → Workers → Logs.
- Errores React: `ErrorBoundary` en el layout principal.
- Uso de cuotas: tabla `usage_counters` consultable vía `GET /api/admin/usage`.
