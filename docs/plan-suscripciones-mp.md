# Plan: MercadoPago Preaprobación — Suscripciones Mensuales

## Context
Gastro Manager necesita monetizar el upgrade de `usuario_basico` → `usuario_inteligente`. Se implementa con MercadoPago Preaprobación (débito automático mensual). El usuario es redirigido a MP para aprobar el débito; MP cobra ARS 15.000/mes y notifica al backend vía webhook. Si un cobro falla, el usuario tiene 7 días de gracia antes de ser bajado de plan. La demote ocurre lazy (en cada request autenticada) ya que el backend es Cloudflare Workers serverless sin cron.

---

## Stack relevante
- **Backend:** Hono en Cloudflare Workers — TypeScript — raw SQL D1
- **Frontend:** React 19 + Tailwind v4 + shadcn/ui
- **Migraciones:** archivos `/migrations/N.sql` numerados (último: 19)
- **Auth:** `authMiddleware` lee `role` de DB en cada request (`index.ts:115–134`)
- **CTA de upgrade existente:** `UsageLimitModalContext.tsx:128` tiene un `// TODO` sin implementar

---

## Archivos críticos
| Archivo | Qué se modifica |
|---------|----------------|
| `src/worker/index.ts` | `Env` type, `authMiddleware`, `/api/users/me`, 6 rutas nuevas |
| `migrations/20.sql` | Tablas `suscripciones` y `pagos_suscripcion` |
| `src/react-app/context/AuthContext.tsx` | Añadir `graceDaysLeft` a `AuthUser` y `AuthContextValue` |
| `src/react-app/context/UsageLimitModalContext.tsx` | Conectar botón "Subir a inteligente" con `/suscripcion` |
| `src/react-app/App.tsx` | Registrar rutas `/suscripcion` y `/suscripcion/estado` |
| `src/react-app/pages/Admin.tsx` | Nueva Card "Suscripciones" con tabla + historial |
| `src/react-app/hooks/useAdmin.ts` | Añadir fetch de suscripciones y pagos |
| `src/react-app/pages/Settings.tsx` | Card de plan actual con CTA |
| `wrangler.json` o `worker-configuration.d.ts` | Declarar vars MP |

**Archivos nuevos:**
| Archivo | Propósito |
|---------|-----------|
| `migrations/20.sql` | Schema de suscripciones |
| `src/react-app/pages/Suscripcion.tsx` | Gestión de suscripción del usuario |
| `src/react-app/pages/SuscripcionEstado.tsx` | Landing post-pago (back_url de MP) |
| `src/react-app/hooks/useSuscripcion.ts` | Hook de datos y acciones de suscripción |
| `src/react-app/components/GracePeriodBanner.tsx` | Banner no-modal de período de gracia |

---

## Paso 1 — Migración `migrations/20.sql`

```sql
CREATE TABLE suscripciones (
  id                    INTEGER  PRIMARY KEY AUTOINCREMENT,
  user_id               TEXT     NOT NULL UNIQUE,
  mp_preapproval_id     TEXT     UNIQUE,
  mp_plan_id            TEXT,
  estado                TEXT     NOT NULL DEFAULT 'pendiente',
  -- 'pendiente' | 'autorizada' | 'en_gracia' | 'pausada' | 'cancelada'
  fecha_inicio          TEXT,
  proximo_cobro         TEXT,
  ultimo_pago_ok        TEXT,
  grace_deadline        TEXT,   -- ISO datetime: ultimo_pago_ok + 7 días
  monto                 REAL    NOT NULL DEFAULT 15000,
  moneda                TEXT    NOT NULL DEFAULT 'ARS',
  payer_email           TEXT,
  created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_suscripciones_user_id ON suscripciones(user_id);
CREATE INDEX idx_suscripciones_estado  ON suscripciones(estado);

CREATE TABLE pagos_suscripcion (
  id                INTEGER  PRIMARY KEY AUTOINCREMENT,
  suscripcion_id    INTEGER  NOT NULL REFERENCES suscripciones(id) ON DELETE CASCADE,
  user_id           TEXT     NOT NULL,
  mp_payment_id     TEXT     UNIQUE,
  mp_preapproval_id TEXT,
  estado_pago       TEXT     NOT NULL,  -- 'approved' | 'rejected' | 'pending' | 'cancelled'
  monto             REAL,
  moneda            TEXT     DEFAULT 'ARS',
  fecha_pago        TEXT,
  razon_rechazo     TEXT,
  payload_raw       TEXT,               -- JSON completo del webhook (debug)
  created_at        TEXT     NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_pagos_suscripcion_id  ON pagos_suscripcion(suscripcion_id);
CREATE INDEX idx_pagos_user_id         ON pagos_suscripcion(user_id);
CREATE INDEX idx_pagos_mp_payment_id   ON pagos_suscripcion(mp_payment_id);
```

---

## Paso 2 — Backend (`src/worker/index.ts`)

### 2.1 Extender `Env` (línea 28)
Agregar después de `GEMINI_API_KEY`:
```typescript
MP_ACCESS_TOKEN: string;
MP_ACCESS_TOKEN_TEST?: string;
MP_WEBHOOK_SECRET: string;
MP_PLAN_ID: string;
MP_BACK_URL?: string;
```

### 2.2 Tipos MP y helper (después del bloque de helpers de crypto)
```typescript
type MPPayment = {
  id: number; status: string; status_detail: string | null;
  transaction_amount: number; currency_id: string;
  date_approved: string | null; external_reference: string;
  preapproval_id: string | null;
};
type MPPreapproval = {
  id: string; status: string; external_reference: string;
  next_payment_date: string | null;
};
function getMPToken(env: Env): string {
  return env.MP_ACCESS_TOKEN_TEST ?? env.MP_ACCESS_TOKEN;
}
```

### 2.3 Extender `authMiddleware` con grace check (entre línea 127 y 129)
Insertar después de `user.role = dbUser?.role ?? "usuario_basico"`:
```typescript
if (user.role === "usuario_inteligente") {
  const sub = await c.env.DB
    .prepare("SELECT estado, grace_deadline FROM suscripciones WHERE user_id = ?")
    .bind(user.id)
    .first<{ estado: string; grace_deadline: string | null }>();
  if (sub?.estado === "en_gracia" && sub.grace_deadline) {
    if (Date.now() > new Date(sub.grace_deadline).getTime()) {
      await c.env.DB.batch([
        c.env.DB.prepare("UPDATE suscripciones SET estado='pausada', updated_at=datetime('now') WHERE user_id=?").bind(user.id),
        c.env.DB.prepare("UPDATE users SET role='usuario_basico', updated_at=datetime('now') WHERE id=?").bind(user.id),
      ]);
      user.role = "usuario_basico";
    } else {
      const daysLeft = Math.ceil((new Date(sub.grace_deadline).getTime() - Date.now()) / 86_400_000);
      c.header("X-Grace-Days-Left", String(daysLeft));
    }
  }
}
```

### 2.4 Extender `GET /api/users/me`
Añadir al response `suscripcion: { estado, grace_days_left }` leyendo de `suscripciones`. El `AuthContext` ya consume este endpoint en el mount.

### 2.5 Rutas nuevas (sección "Suscripciones" en `index.ts`)

**`POST /api/suscripciones/crear`** — requiere `authMiddleware`
1. Verificar no tiene suscripción activa (`estado IN ('autorizada','en_gracia')`). Si tiene → 400 `ALREADY_SUBSCRIBED`.
2. `POST https://api.mercadopago.com/preapproval` con:
   - `preapproval_plan_id`: `env.MP_PLAN_ID`
   - `back_url`: `${env.MP_BACK_URL}/suscripcion/estado`
   - `external_reference`: `user.id`
   - `payer_email`: `user.email`
   - `reason`: `"Gastro Manager — Plan Inteligente"`
   - Header: `Authorization: Bearer {getMPToken(env)}`
3. UPSERT en `suscripciones` con `estado='pendiente'`.
4. Devolver `{ data: { init_point } }` 201.

**`GET /api/suscripciones/estado`** — requiere `authMiddleware`
- Query `suscripciones WHERE user_id = ?`.
- Calcular `grace_days_left` si `estado='en_gracia'`.
- Devolver la fila o `{ data: null }`.

**`POST /api/suscripciones/cancelar`** — requiere `authMiddleware`
1. Obtener suscripción activa (`autorizada` o `en_gracia`). Si no → 404.
2. `PUT https://api.mercadopago.com/preapproval/{mp_preapproval_id}` con `{ "status": "cancelled" }`.
3. Update DB: `estado='cancelada'`.
4. Demotar usuario: `role='usuario_basico'`.

**`POST /api/webhooks/mercadopago`** — **SIN** `authMiddleware` (endpoint público)
Ver sección 3.

**`GET /api/admin/suscripciones`** — requiere `authMiddleware` + isAdmin
```sql
SELECT s.*, u.email, u.name, u.role,
  (SELECT COUNT(*) FROM pagos_suscripcion p WHERE p.suscripcion_id = s.id) as total_pagos,
  (SELECT COUNT(*) FROM pagos_suscripcion p WHERE p.suscripcion_id = s.id AND p.estado_pago='approved') as pagos_ok
FROM suscripciones s JOIN users u ON u.id = s.user_id
ORDER BY s.created_at DESC
```
Query param opcional `?estado=autorizada`.

**`GET /api/admin/suscripciones/:userId/pagos`** — requiere `authMiddleware` + isAdmin
```sql
SELECT p.* FROM pagos_suscripcion p
JOIN suscripciones s ON s.id = p.suscripcion_id
WHERE s.user_id = ? ORDER BY p.fecha_pago DESC LIMIT 100
```

---

## Paso 3 — Webhook handler + seguridad

### Verificación de firma
MP envía header `x-signature: ts=<ts>,v1=<hmac>` y `x-request-id`.
El mensaje firmado es: `"id:{query.data.id};request-id:{x-request-id};ts:{ts}"`.
Usar `crypto.subtle` (disponible nativamente en Workers).

```typescript
async function verifyMPWebhook(c: Context<{Bindings:Env}>, dataId: string): Promise<boolean> {
  const sig = c.req.header("x-signature") ?? "";
  const reqId = c.req.header("x-request-id") ?? "";
  const ts = sig.match(/ts=([^,]+)/)?.[1];
  const v1 = sig.match(/v1=([^,]+)/)?.[1];
  if (!ts || !v1 || !c.env.MP_WEBHOOK_SECRET) return false;
  const manifest = `id:${dataId};request-id:${reqId};ts:${ts}`;
  const key = await crypto.subtle.importKey("raw",
    new TextEncoder().encode(c.env.MP_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const buf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  const computed = Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
  return computed === v1;
}
```

### Lógica del webhook (siempre responde 200)

**`type=payment`**:
- GET `https://api.mercadopago.com/v1/payments/{dataId}` → `MPPayment`
- `external_reference` = `user_id`
- `INSERT OR IGNORE` en `pagos_suscripcion` (idempotente por `UNIQUE mp_payment_id`)
- Si `status=approved` → batch: `estado='autorizada'`, `grace_deadline=NULL`, `ultimo_pago_ok=NOW()`, `role='usuario_inteligente'`
- Si `status=rejected` → `estado='en_gracia'`, `grace_deadline = (ultimo_pago_ok ?? NOW()) + 7 días`; el rol permanece inteligente (lazy demotion en authMiddleware)

**`type=preapproval`**:
- GET `https://api.mercadopago.com/preapproval/{dataId}` → `MPPreapproval`
- `authorized` → `estado='autorizada'`, actualizar `mp_preapproval_id` y `proximo_cobro`
- `cancelled` → `estado='cancelada'`, demotar usuario inmediatamente
- `paused` → `estado='pausada'`, demotar usuario

---

## Paso 4 — Frontend

### 4.1 `AuthContext.tsx`
- Añadir `graceDaysLeft: number | null` a `AuthUser` e `AuthContextValue`.
- Parsear del response de `/api/users/me` el campo `suscripcion.grace_days_left`.

### 4.2 `UsageLimitModalContext.tsx` — línea 128
Reemplazar el `onClick` vacío con TODO:
```typescript
onClick={() => {
  onClose();
  window.location.assign("/suscripcion");
}}
```

### 4.3 `GracePeriodBanner.tsx` (nuevo)
Banner horizontal ámbar (no modal) en `MainLayout.tsx` entre header y contenido.
- Texto: *"Tu suscripción está en período de gracia — X días restantes para regularizar el pago."*
- Botón: *"Actualizar pago"* → navega a `/suscripcion`
- Solo visible cuando `graceDaysLeft !== null` (desde `useAuth()`)

### 4.4 `Suscripcion.tsx` (nuevo) — ruta `/suscripcion`
Card de estado del plan + acciones. Comportamiento por estado:
| Estado | UI |
|--------|-----|
| `null` | CTA "Suscribirse por ARS 15.000/mes" → llama `crear()`, redirige a `init_point` |
| `pendiente` | "Completar pago en MercadoPago" + link si hay `init_point` |
| `autorizada` | Check verde, próximo cobro, botón cancelar |
| `en_gracia` | Warning ámbar, días restantes, botón "Actualizar pago" |
| `cancelada`/`pausada` | "Sin suscripción activa", CTA para re-suscribirse |

Incluye tabla de últimos 5 pagos (fecha, monto, badge de estado).
Hook: `useSuscripcion.ts` con `{ estado, crear, cancelar, isLoading }`.

### 4.5 `SuscripcionEstado.tsx` (nuevo) — ruta `/suscripcion/estado`
Landing de redirect post-MP. Lee query params (`collection_status`, `status`).
- `approved` → pantalla verde de éxito
- `rejected`/`failure` → pantalla roja con instrucciones
- Botón "Volver a la app" → `/`
- No llama al backend (el webhook ya procesó el pago)

### 4.6 `Settings.tsx`
Nueva Card de plan antes de la sección Administradores:
- Badge rol actual
- `usuario_basico` → botón "Suscribirse" → `/suscripcion`
- `usuario_inteligente` → botón "Ver mi suscripción" → `/suscripcion`

### 4.7 `App.tsx`
Registrar rutas dentro de `<Routes>` con `<ProtectedRoute>` + `<MainLayout>`:
- `/suscripcion` → `<SuscripcionPage />`
- `/suscripcion/estado` → `<SuscripcionEstadoPage />`

---

## Paso 5 — Admin Panel (`Admin.tsx` + `useAdmin.ts`)

### Card "Suscripciones" en `Admin.tsx`
Nueva Card después de "Gestión de Roles", antes de "Administradores".

Contenido:
- Selector de filtro: Todos / Autorizada / En gracia / Cancelada / Pausada
- Tabla: Email | Nombre | Estado (badge con color) | Próximo cobro | Último pago OK | Monto | Aprobados/Total
- Expand por fila → tabla anidada: Fecha | Monto | Estado | Razón de rechazo
- Colores badge: `autorizada`=verde, `en_gracia`=ámbar, `cancelada`=rojo, `pausada`=gris, `pendiente`=azul

### `useAdmin.ts`
```typescript
const [suscripciones, setSuscripciones] = useState<AdminSuscripcion[]>([]);
const fetchSuscripciones = async (estado?: string) => { /* GET /api/admin/suscripciones */ };
const fetchPagosUsuario = async (userId: string): Promise<AdminPagoSuscripcion[]> => { /* GET /api/admin/suscripciones/:userId/pagos */ };
```

---

## Paso 6 — Setup único: crear plan en MP

Ejecutar una sola vez localmente antes del deploy:
```bash
curl -X POST https://api.mercadopago.com/preapproval_plan \
  -H "Authorization: Bearer $MP_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Gastro Manager Plan Inteligente",
    "auto_recurring": {
      "frequency": 1,
      "frequency_type": "months",
      "transaction_amount": 15000,
      "currency_id": "ARS"
    },
    "back_url": "https://TU-APP.pages.dev/suscripcion/estado"
  }'
```
Guardar el `id` resultante y subir secrets:
```bash
npx wrangler secret put MP_PLAN_ID
npx wrangler secret put MP_ACCESS_TOKEN
npx wrangler secret put MP_WEBHOOK_SECRET
npx wrangler secret put MP_ACCESS_TOKEN_TEST   # sandbox
```

---

## Paso 7 — Verificación E2E (sandbox)

1. `npx wrangler d1 migrations apply gastro-manager-db` → verificar tablas creadas
2. Login como `usuario_basico` → Settings → Card plan → click "Suscribirse"
3. Verificar `POST /api/suscripciones/crear` → `init_point` + fila `estado=pendiente` en DB
4. Seguir `init_point` con tarjeta test sandbox MP → completar pago
5. Verificar redirect a `/suscripcion/estado?collection_status=approved`
6. Confirmar webhook `type=payment` → `estado=autorizada`, `role=usuario_inteligente`, fila en `pagos_suscripcion`
7. Simular pago rechazado → `estado=en_gracia`, banner ámbar visible
8. Forzar expiración grace: `UPDATE suscripciones SET grace_deadline='2020-01-01' WHERE user_id='...'` → hacer request → verificar role bajó a `usuario_basico`
9. Probar cancelación → role baja inmediatamente
10. Admin `/admin` → Card Suscripciones → historial de pagos visible
11. Replay webhook duplicado → `INSERT OR IGNORE` no genera duplicados
12. Webhook con firma incorrecta → responde 200 pero no modifica DB
13. Double-subscribe guard → 400 `ALREADY_SUBSCRIBED`

---

## Máquina de estados

```
pendiente
  → autorizada    (webhook preapproval:authorized / payment:approved)
  → cancelada     (webhook preapproval:cancelled)

autorizada
  → en_gracia     (webhook payment:rejected)
  → cancelada     (webhook preapproval:cancelled / POST /cancelar)
  → pausada       (webhook preapproval:paused)

en_gracia
  → autorizada    (webhook payment:approved — cobro exitoso dentro del grace)
  → pausada       (lazy demotion en authMiddleware cuando grace_deadline vence)
  → cancelada     (webhook preapproval:cancelled)

pausada / cancelada → usuario puede volver a suscribirse (nueva fila en suscripciones)
```
