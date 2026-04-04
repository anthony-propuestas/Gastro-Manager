# Auditoría de Implementación — Sistema de Usuarios por Niveles

**Fecha:** 2026-04-04  
**Referencia:** `docs/plan-usuarios-por-niveles.md`  
**Alcance:** Pasos 1–5 + Correcciones 1–9

---

## Resumen ejecutivo

| Categoría | Cantidad |
|---|---|
| Realizadas correctamente | 32 |
| Desviaciones menores (funcional pero distinto al plan) | 4 |
| Mal ejecutadas (bug o inconsistencia real) | 3 |
| No realizadas | 0 |

El sistema está **mayoritariamente correcto y funcional**. Las 3 fallas encontradas son reales pero de bajo impacto en escenarios de un solo negocio por usuario; se vuelven más relevantes en configuraciones multi-negocio.

---

## REALIZADAS CORRECTAMENTE ✅

### Paso 1 — Tabla `users` y persistencia de rol

| Ítem | Archivo | Detalle |
|---|---|---|
| Tabla `users` creada | `migrations/9.sql` | `id TEXT PRIMARY KEY`, `email UNIQUE`, `role DEFAULT 'usuario_basico'` |
| UPSERT en login | `src/worker/index.ts:269` | `ON CONFLICT(id) DO UPDATE SET email, name, picture` — el `role` **no** se sobreescribe |
| `role` en JWT al crear sesión | `src/worker/index.ts:286` | Lee el rol de la DB antes de firmar el JWT |
| `GET /api/users/me` retorna `role` | `src/worker/index.ts:302` | Devuelve `c.get("user")` que incluye `role` |
| `AuthContext` expone `role` | `src/react-app/context/AuthContext.tsx` | `User` type incluye `role: string` |
| **Corrección 5** — Rol fresco en cada request | `src/worker/index.ts:86` | `authMiddleware` hace `SELECT role FROM users WHERE id = ?` ignorando el JWT, fallback a `"usuario_basico"` si no existe |

---

### Paso 2 — Herramientas canónicas

| Ítem | Archivo | Detalle |
|---|---|---|
| **Corrección 3** — Nombres canónicos | `src/worker/usageTools.ts` | Objeto `USAGE_TOOLS` exportado con 8 herramientas, documentadas con sus endpoints |
| Límites por defecto documentados | `src/worker/usageTools.ts:26` | `DEFAULT_USAGE_LIMITS` con los 8 valores del plan |

---

### Paso 3 — Contadores y middleware de cuotas

| Ítem | Archivo | Detalle |
|---|---|---|
| Tabla `usage_counters` | `migrations/10.sql` | `UNIQUE(user_id, negocio_id, tool, period)` |
| **Corrección 2** — Límites por usuario+negocio | `migrations/10.sql` | `negocio_id` presente en `usage_counters` |
| Tabla `usage_limits` + seed | `migrations/10.sql` | 8 filas insertadas con valores correctos del plan |
| **Corrección 9** — Sin limpieza automática (Opción C) | `migrations/10.sql:6` | Documentado en comentario de la migración |
| `createUsageLimitMiddleware` — incremento atómico | `src/worker/index.ts:127` | `INSERT ... RETURNING count`, luego check, luego `UPDATE count = count - 1` si excede (Corrección 6) |
| Middleware aplicado a `POST /api/employees` | `src/worker/index.ts:716` | ✅ |
| Middleware aplicado a `POST /api/job-roles` | `src/worker/index.ts:879` | ✅ |
| Middleware aplicado a `POST /api/employees/:id/topics` | `src/worker/index.ts:971` | ✅ |
| Middleware aplicado a `POST /api/topics/:id/notes` | `src/worker/index.ts:1129` | ✅ |
| Middleware aplicado a `POST /api/events` | `src/worker/index.ts:1336` | ✅ |
| Middleware aplicado a `POST /api/employees/:id/advances` | `src/worker/index.ts:1556` | ✅ |
| Middleware aplicado a `POST /api/salary-payments/mark-paid` | `src/worker/index.ts:1672` | ✅ |
| Middleware aplicado a `POST /api/chat` | `src/worker/index.ts:2202` | ✅ |
| **Corrección 4** — `mark-all-paid` cuenta N usos | `src/worker/index.ts:1776` | Lógica N-count implementada, bloquea si `currentCount + n > limit` |
| `usuario_inteligente` bypassa middleware | `src/worker/index.ts:130` | `if (user.role === "usuario_inteligente") { await next(); return; }` |

---

### Paso 4 — Panel Admin: cuotas y visibilidad

| Ítem | Archivo | Detalle |
|---|---|---|
| `GET /api/admin/usage` | `src/worker/index.ts:2047` | Dos queries + join en JS; retorna `{ period, users }` |
| `GET /api/admin/usage-limits` | `src/worker/index.ts:2079` | Retorna `Record<string, number>` |
| `PUT /api/admin/usage-limits` | `src/worker/index.ts:2093` | Valida tool names, `db.batch()` para actualización atómica |
| **Corrección 7** — `GET /api/usage/me` | `src/worker/index.ts:2172` | LEFT JOIN `usage_limits` con `usage_counters`, `limit: null` para inteligente |
| Interfaces nuevas en `useAdmin.ts` | `src/react-app/hooks/useAdmin.ts:3` | `UserUsage`, `AdminUsageData`, `UsageLimits`, `AdminUser` |
| Funciones `fetchUsage`, `fetchLimits`, `updateLimits` | `src/react-app/hooks/useAdmin.ts:115` | Correctamente exportadas |
| `useMyUsage.ts` — hook nuevo | `src/react-app/hooks/useMyUsage.ts` | Llama con `X-Negocio-ID`, `limit: null` para inteligente |
| `UsageBanner.tsx` — componente nuevo | `src/react-app/components/UsageBanner.tsx` | Amber ≥80%, Rojo ≥100%, `null` si sin límite |
| Admin sección 4.3 — tarjetas de cuotas | `src/react-app/pages/Admin.tsx:257` | Grid 8 herramientas con barra de progreso y total acumulado |
| Admin sección 4.1 — tabla uso por usuario | `src/react-app/pages/Admin.tsx:293` | Tabla con email, Badge de rol, conteo por herramienta |
| Admin sección 4.2 — editar límites | `src/react-app/pages/Admin.tsx:335` | 8 inputs numéricos, botón "Guardar límites" con `db.batch()` |
| `UsageBanner` en `Employees.tsx` | `src/react-app/pages/Employees.tsx:125` | `label="Empleados"`, `usage["employees"]` |
| `UsageBanner` en `Salaries.tsx` | `src/react-app/pages/Salaries.tsx:106` | Dos banners: `salary_payments` y `advances` |
| `UsageBanner` en `CalendarPage.tsx` | `src/react-app/pages/CalendarPage.tsx:201` | `label="Eventos"`, `usage["events"]` |
| `UsageBanner` en `ChatWidget.tsx` | `src/react-app/components/ChatWidget.tsx:67` | `label="Chat IA"`, `usage["chat"]` |
| `TOOL_LABELS` constante en `Admin.tsx` | `src/react-app/pages/Admin.tsx:11` | 8 entradas con `key`, `label`, `color` |
| `useEffect` sincroniza `limitEdits` desde `limits` | `src/react-app/pages/Admin.tsx:44` | Se llena al cargar los límites actuales |

---

### Paso 5 — Gestión de roles de usuario

| Ítem | Archivo | Detalle |
|---|---|---|
| `GET /api/admin/users` | `src/worker/index.ts:2118` | Retorna `id, email, name, role, created_at` ordenado por email |
| `POST /api/admin/users/:userId/promote` | `src/worker/index.ts:2130` | Verifica existencia del target, `UPDATE role = 'usuario_inteligente'` |
| `POST /api/admin/users/:userId/demote` | `src/worker/index.ts:2147` | Verifica existencia del target, `UPDATE role = 'usuario_basico'` |
| **Corrección 8** — Guardia anti-auto-degradación | `src/worker/index.ts:2155` | `if (targetId === user.id) → 403` antes de cualquier UPDATE |
| Estado `users` en `useAdmin.ts` | `src/react-app/hooks/useAdmin.ts:52` | ✅ |
| Funciones `fetchUsers`, `promoteUser`, `demoteUser` | `src/react-app/hooks/useAdmin.ts:146` | ✅ |
| Interfaz `AdminUser` | `src/react-app/hooks/useAdmin.ts:17` | `id, email, name, role, created_at` |
| Sección "Gestión de Roles" en `Admin.tsx` | `src/react-app/pages/Admin.tsx:377` | Buscador por email + tabla de `usuario_inteligente` |
| Botones promover/degradar dinámicos | `src/react-app/pages/Admin.tsx:416` | Muestra "Promover" o "Regresar a Básico" según `u.role` |

---

## DESVIACIONES MENORES ⚠️
*(Funcionales pero distintos al plan — no son bugs)*

### D1 — `tool` prop eliminado de `UsageBanner`

**Plan spec:**
```typescript
interface UsageBannerProps {
  tool: string;   // ← presente en el plan
  label: string;
  usage: ToolUsage | undefined;
}
```

**Implementación** (`src/react-app/components/UsageBanner.tsx:4`):
```typescript
interface UsageBannerProps {
  label: string;   // tool fue eliminado
  usage: ToolUsage | undefined;
}
```

**Evaluación:** Correcto. El prop `tool` no era usado en ninguna lógica del componente. Eliminarlo simplifica la API del componente sin pérdida funcional.

---

### D2 — `UsageBanner` agrega ícono `AlertCircle` no mencionado en el plan

**Plan:**
```tsx
<div className="flex items-center gap-2 ...">
  <span>...</span>
</div>
```

**Implementación** (`src/react-app/components/UsageBanner.tsx:16`):
```tsx
<div className="flex items-center gap-2 ...">
  <AlertCircle className="h-4 w-4 shrink-0" />  {/* ← no estaba en el plan */}
  <span>...</span>
</div>
```

**Evaluación:** Mejora visual menor. No afecta funcionalidad.

---

### D3 — `TOOL_LABELS` usa `as const` en vez de ser un array mutable

**Plan:** `const TOOL_LABELS = [...]`  
**Implementación** (`src/react-app/pages/Admin.tsx:20`): `] as const`

**Evaluación:** Mejora TypeScript (inferencia de tipos más estrecha). No introduce diferencia funcional.

---

### D4 — Botón "Regresar a Básico" visible para el propio admin en la UI

El plan describe la Corrección 8 solo a nivel de API. La UI no oculta el botón de degradación cuando el usuario en la tabla es el mismo admin que está logueado.

**Comportamiento actual:** El botón aparece → el admin lo presiona → la API devuelve `403 FORBIDDEN` → se muestra un `showToast` de error. Funciona correctamente, pero la UX es confusa.

**Evaluación:** El backend está protegido. El frontend podría mejorar ocultando o deshabilitando el botón, pero no es un bug.

---

## MAL EJECUTADAS 🐛
*(Bug o inconsistencia real con el plan)*

### B1 — `GET /api/admin/usage` agrega uso de todos los negocios sin distinguirlos

**Plan (Corrección 2):** Los contadores son **por usuario+negocio** (Opción B elegida). Esta fue una decisión explícita de diseño.

**Problema en `src/worker/index.ts:2059`:**
```sql
SELECT user_id, tool, SUM(count) as count
FROM usage_counters
WHERE period = ?
GROUP BY user_id, tool          -- ← no distingue por negocio_id
```

**Consecuencia:**
- Si el usuario A tiene `negocio_1` con 3 empleados creados y `negocio_2` con 4, el admin ve "7" para ese usuario.
- La barra de progreso en la sección 4.3 compara ese total "7" contra `limit × cantidadUsuarios` (siendo `limit` el límite **por negocio**), lo que produce un porcentaje incorrecto.
- En la tabla de sección 4.1, el número "7" no refleja ningún contexto de negocio — el admin no puede saber cuál negocio está consumiendo qué.

**Lo correcto según el plan:** Mostrar el uso desglosado por negocio, o al menos elegir un negocio de referencia explícito.

**Impacto:** Bajo en escenario de un negocio por usuario (la mayoría de los casos actuales), alto en multi-negocio.

---

### B2 — `mark-all-paid` viola Corrección 6 (no es atómico)

**Corrección 6 del plan:** Usar incremento atómico (INSERT…RETURNING → check → revert si excede) para evitar condición de carrera TOCTOU.

**Implementado para todos los endpoints simples:** ✅ El middleware `createUsageLimitMiddleware` es atómico.

**Problema en `src/worker/index.ts:1780`:**
```typescript
// Paso 1: READ (no atómico)
const counterRow = await db.prepare("SELECT count FROM usage_counters WHERE ...").first();
const currentCount = counterRow?.count ?? 0;

// Paso 2: CHECK
if (currentCount + n > limit) { return 429; }

// Paso 3: WRITE (separado del read — ventana TOCTOU aquí)
await db.prepare("INSERT ... ON CONFLICT DO UPDATE SET count = count + ?").bind(n).run();
```

**Consecuencia:** Dos llamadas simultáneas a `mark-all-paid` (p.ej. doble-click o petición duplicada de red) podrían pasar el check ambas y consumir `2×N` del contador cuando solo debería pasar una.

**Lo correcto según el plan:** Misma estrategia atómica que el middleware (increment-by-N → read RETURNING → revert si `newCount > limit`).

**Impacto:** Bajo en uso normal (usuarios raramente hacen doble submit), pero es una violación explícita de un requisito de diseño documentado.

---

### B3 — Barra de progreso en sección 4.3 mezcla unidades incorrectamente

**Relacionado con B1.** La fórmula de progreso en `Admin.tsx:273`:
```typescript
const avgPct = limit > 0 && usageData.users.length > 0
  ? Math.min((totalCount / (limit * usageData.users.length)) * 100, 100)
  : 0;
```

`totalCount` es la **suma de todos los negocios** de todos los usuarios, pero `limit` es el límite **por usuario por negocio**. La fórmula asume implícitamente que cada usuario tiene exactamente un negocio.

**Ejemplo concreto:** Si hay 2 usuarios, cada uno con 2 negocios, y el límite es 5:
- El denominador correcto sería `5 × 2 usuarios = 10` si mostramos uso promedio por usuario
- O `5 × 4 (usuario+negocio pairs) = 20` si mostramos uso total disponible
- La implementación usa `5 × 2 = 10` (ignora los negocios adicionales)
- El `totalCount` podría ser hasta 20 (4 negocios × 5 max cada uno), dando 200% en la barra

**Impacto:** La barra de progreso puede mostrar valores incorrectos (> 100% truncado a 100%) en entornos multi-negocio.

---

## TABLA RESUMEN

| Req. del plan | Estado | Archivo | Línea |
|---|---|---|---|
| Tabla `users` (Corrección 1) | ✅ | `migrations/9.sql` | — |
| `role` en JWT + UPSERT sin sobreescribir | ✅ | `index.ts` | 269, 286 |
| `role` fresco de DB en cada request (Corrección 5) | ✅ | `index.ts` | 86 |
| Nombres canónicos `usageTools.ts` (Corrección 3) | ✅ | `usageTools.ts` | — |
| `usage_counters` por user+negocio (Corrección 2) | ✅ | `migrations/10.sql` | — |
| `usage_limits` con seed | ✅ | `migrations/10.sql` | — |
| Middleware atómico (Corrección 6) — single tools | ✅ | `index.ts` | 127 |
| 8 endpoints con middleware | ✅ | `index.ts` | varios |
| `mark-all-paid` N-count (Corrección 4) | ✅ función, ⚠️ no atómico | `index.ts` | 1776 |
| Sin limpieza automática documentada (Corrección 9-C) | ✅ | `migrations/10.sql` | 6 |
| `GET /api/admin/usage` | 🐛 cross-negocio sin desglose | `index.ts` | 2047 |
| `GET /api/admin/usage-limits` | ✅ | `index.ts` | 2079 |
| `PUT /api/admin/usage-limits` | ✅ | `index.ts` | 2093 |
| `GET /api/usage/me` (Corrección 7) | ✅ | `index.ts` | 2172 |
| `useMyUsage.ts` | ✅ | `hooks/useMyUsage.ts` | — |
| `UsageBanner.tsx` | ✅ (+ ícono extra) | `components/UsageBanner.tsx` | — |
| Banner en Employees | ✅ | `pages/Employees.tsx` | 125 |
| Banner en Salaries (x2) | ✅ | `pages/Salaries.tsx` | 106 |
| Banner en CalendarPage | ✅ | `pages/CalendarPage.tsx` | 201 |
| Banner en ChatWidget | ✅ | `components/ChatWidget.tsx` | 67 |
| Admin sección 4.3 tarjetas | 🐛 fórmula incorrecta multi-negocio | `pages/Admin.tsx` | 257 |
| Admin sección 4.1 tabla usuarios | ✅ | `pages/Admin.tsx` | 293 |
| Admin sección 4.2 editar límites | ✅ | `pages/Admin.tsx` | 335 |
| `GET /api/admin/users` | ✅ | `index.ts` | 2118 |
| `POST /api/admin/users/:id/promote` | ✅ | `index.ts` | 2130 |
| `POST /api/admin/users/:id/demote` | ✅ | `index.ts` | 2147 |
| Auto-degradación bloqueada (Corrección 8) | ✅ API, ⚠️ sin guard en UI | `index.ts` | 2155 |
| Sección Gestión de Roles en Admin.tsx | ✅ | `pages/Admin.tsx` | 377 |
| `AuthContext` expone `role` | ✅ | `AuthContext.tsx` | — |

---

## Correcciones recomendadas (por prioridad)

### Prioridad alta

**B1 + B3 — Desglosar `GET /api/admin/usage` por negocio**

```sql
-- Opción A: agregar negocio_id en la query y mostrar filas separadas por negocio
SELECT user_id, negocio_id, tool, SUM(count) as count
FROM usage_counters
WHERE period = ?
GROUP BY user_id, negocio_id, tool

-- Opción B (más simple): aceptar que es vista global agregada pero
-- cambiar la fórmula de la barra al denominador correcto:
-- denominador = limit × SUM(DISTINCT user+negocio pairs con actividad)
```

**B2 — Hacer atómica la lógica N-count de `mark-all-paid`**

```typescript
// Reemplazar read-check-write por increment-N-then-revert:
const result = await db.prepare(`
  INSERT INTO usage_counters (user_id, negocio_id, tool, period, count, updated_at)
  VALUES (?, ?, ?, ?, ?, datetime('now'))
  ON CONFLICT(user_id, negocio_id, tool, period)
  DO UPDATE SET count = count + ?, updated_at = datetime('now')
  RETURNING count
`).bind(user.id, negocio.id, USAGE_TOOLS.SALARY_PAYMENTS, period, n, n).first<{ count: number }>();

const newCount = result?.count ?? n;
if (newCount > limit) {
  await db.prepare(`UPDATE usage_counters SET count = count - ?
    WHERE user_id = ? AND negocio_id = ? AND tool = ? AND period = ?`)
    .bind(n, user.id, negocio.id, USAGE_TOOLS.SALARY_PAYMENTS, period).run();
  return c.json(apiError("USAGE_LIMIT_EXCEEDED", `...`), 429);
}
```

### Prioridad baja

**D4 — Ocultar botón de degradación para el propio admin**

```tsx
// En la tabla de usuario_inteligente, comparar con el user actual:
const { user: currentUser } = useAuth();
// ...
{u.id !== currentUser?.id && (
  <Button onClick={...}>Regresar a Básico</Button>
)}
```
