# Guía: Agregar un Nuevo Módulo

Un módulo es una herramienta para el usuario (ej: Calendario, Personal, Sueldos). Tiene dos dimensiones:

**Visibilidad:**
- Aparece en el menú lateral izquierdo (Sidebar, desktop) y en el menú inferior mobile (BottomNav)
- El usuario puede mostrarlo u ocultarlo desde `/configuracion` — preferencia personal, solo visual
- El Owner puede desactivarlo para los gerentes de su negocio desde `/owner` — se aplica en UI y en el backend

**Límites de uso:**
- Los endpoints de escritura (POST/PUT/DELETE) se contabilizan por usuario + negocio + mes
- Los usuarios `usuario_basico` tienen un límite mensual configurable desde el panel admin
- Los usuarios `usuario_inteligente` tienen acceso ilimitado y no se les cuenta

---

## Checklist completo de archivos a modificar

```
FRONTEND
────────────────────────────────────────────────────────────────────
src/shared/types.ts                           ←  1. Agregar clave al tipo NegocioModuleRestrictions
src/react-app/hooks/useModulePrefs.ts         ←  2. Registrar en MODULES, DEFAULT_PREFS, DEFAULT_RESTRICTIONS
src/react-app/hooks/useModulePrefs.test.ts    ←  2b. Actualizar tests: objetos esperados y mocks de fetch
src/react-app/components/layout/Sidebar.tsx   ←  3. Agregar ítem de navegación (desktop)
src/react-app/components/layout/BottomNav.tsx ←  4. Agregar ítem de navegación (mobile)
src/react-app/pages/Settings.tsx              ←  5. Agregar ícono al dict MODULE_ICONS
src/react-app/pages/OwnerPanel.tsx            ←  6. Agregar entrada al array MODULE_LABELS
src/react-app/App.tsx                         ←  7. Agregar ruta protegida
src/react-app/pages/modulos/MiModulo.tsx      ←  8. Crear la página del módulo (archivo nuevo)
src/react-app/hooks/useMiModulo.ts            ←  9. Crear el hook de datos (archivo nuevo)

BACKEND  (las líneas son aproximadas — buscar por nombre de variable si se desplazan)
────────────────────────────────────────────────────────────────────
src/worker/usageTools.ts                      ← 10. Registrar constante del tool de uso
src/worker/index.ts  (línea ~181)             ← 11. Extender la unión de tipos de createModuleRestrictionMiddleware
src/worker/index.ts  (línea ~992)             ← 12. Agregar a VALID_MODULE_KEYS
src/worker/index.ts  (GET /module-restrictions)← 13. Agregar valor por defecto en respuesta
src/worker/index.ts  (PUT /module-restrictions)← 14. Agregar a VALID_KEYS
src/worker/index.ts  (PUT /admin/usage-limits) ← 15. Agregar a validTools
src/worker/validation.ts                      ← 16. Agregar schema Zod de validación
src/worker/index.ts                           ← 17. Crear los endpoints del módulo (GET, POST, etc.)

BASE DE DATOS
────────────────────────────────────────────────────────────────────
migrations/N.sql                              ← 18. Crear migración con la tabla del módulo
                                              ← 19. Aplicar la migración con wrangler
```

---

## Paso a paso

### 1. Tipo compartido

[src/shared/types.ts](../src/shared/types.ts) — tipo `NegocioModuleRestrictions`

```ts
export type NegocioModuleRestrictions = {
  calendario: boolean;
  personal: boolean;
  sueldos: boolean;
  mi_modulo: boolean; // ← agregar
};
```

---

### 2. Registrar en el hook de preferencias

[src/react-app/hooks/useModulePrefs.ts](../src/react-app/hooks/useModulePrefs.ts)

```ts
// Agregar a MODULES — este array lo usan Settings y el filtrado de Sidebar/BottomNav
export const MODULES = [
  { key: "calendario", label: "Calendario", order: 1, path: "/calendario",  description: "Gestión de eventos y agenda" },
  { key: "personal",   label: "Personal",   order: 2, path: "/empleados",   description: "Administración de empleados" },
  { key: "sueldos",    label: "Sueldos",    order: 3, path: "/sueldos",     description: "Pagos y anticipos salariales" },
  { key: "compras",    label: "Compras",    order: 4, path: "/compras",     description: "Registro de compras y gastos" },
  { key: "mi_modulo",  label: "Mi Módulo",  order: 5, path: "/mi-modulo",   description: "Descripción corta" }, // ← nuevo
] as const;

// Agregar a DEFAULT_PREFS
const DEFAULT_PREFS: Record<ModuleKey, boolean> = {
  calendario: true,
  personal: true,
  sueldos: true,
  compras: true,
  mi_modulo: true, // ← nuevo
};

// Agregar a DEFAULT_RESTRICTIONS
const DEFAULT_RESTRICTIONS: NegocioModuleRestrictions = {
  calendario: false,
  personal: false,
  sueldos: false,
  compras: false,
  mi_modulo: false, // ← nuevo
};
```

---

### 2b. Actualizar los tests de `useModulePrefs`

[src/react-app/hooks/useModulePrefs.test.ts](../src/react-app/hooks/useModulePrefs.test.ts)

Cada vez que se agrega un módulo, este archivo requiere tres cambios:

**a) Objetos de prefs por defecto esperados** — en los tests que no tienen usuario autenticado o que simulan respuesta inválida, el valor esperado debe incluir la nueva clave:

```ts
// ANTES:
expect(result.current.prefs).toEqual({ calendario: true, personal: true, sueldos: true });
expect(result.current.negocioRestrictions).toEqual({ calendario: false, personal: false, sueldos: false });

// DESPUÉS (agregar mi_modulo):
expect(result.current.prefs).toEqual({ calendario: true, mi_modulo: true, personal: true, sueldos: true });
expect(result.current.negocioRestrictions).toEqual({ calendario: false, mi_modulo: false, personal: false, sueldos: false });
```

**b) Mock de respuesta del endpoint `/api/modules/prefs`** — el hook llama a `isModulePrefsResponse()` que valida que **todos los módulos de `MODULES` estén presentes** en el campo `data`. Si falta uno, la validación falla, el hook ignora la respuesta y los prefs quedan en DEFAULT. El mock debe incluir la nueva clave:

```ts
// ANTES:
return jsonResponse({
  success: true,
  data: { calendario: true, personal: false, sueldos: true },
});

// DESPUÉS:
return jsonResponse({
  success: true,
  data: { calendario: true, mi_modulo: true, personal: false, sueldos: true },
});
```

> Este es el error más silencioso al agregar un módulo: los tests compilan y corren, pero el test que verifica que los prefs se actualizan falla porque el mock devuelve una respuesta que el hook descarta como inválida.

**c) Verificar con `npm test`** — los tests deben pasar los 22 casos (o más si agregaste tests propios del módulo).

---

### 3. Agregar al Sidebar (desktop)

[src/react-app/components/layout/Sidebar.tsx](../src/react-app/components/layout/Sidebar.tsx) — array `navItems`

```ts
import { LayoutDashboard, Calendar, Users, Banknote, ShoppingCart, Settings, BookOpen } from "lucide-react";
//  elegir ícono en https://lucide.dev/icons/ ↑

const navItems = [
  { path: "/",             label: "Dashboard",     icon: LayoutDashboard },
  { path: "/calendario",   label: "Calendario",    icon: Calendar,       moduleKey: "calendario" as const },
  { path: "/empleados",    label: "Personal",      icon: Users,          moduleKey: "personal"   as const },
  { path: "/sueldos",      label: "Sueldos",       icon: Banknote,       moduleKey: "sueldos"    as const },
  { path: "/compras",      label: "Compras",       icon: ShoppingCart,   moduleKey: "compras"    as const },
  { path: "/mi-modulo",    label: "Mi Módulo",     icon: BookOpen,       moduleKey: "mi_modulo"  as const }, // ← nuevo
  { path: "/configuracion", label: "Configuración", icon: Settings },
];
```

El filtrado que oculta el ítem cuando el usuario lo desactivó o el owner lo restringió ya está implementado en las líneas 45-50 del Sidebar y no requiere cambios.

---

### 4. Agregar al BottomNav (mobile)

[src/react-app/components/layout/BottomNav.tsx](../src/react-app/components/layout/BottomNav.tsx)

```ts
import { LayoutDashboard, Calendar, Users, Banknote, ShoppingCart, Settings, BookOpen } from "lucide-react";

const navItems = [
  { path: "/",             label: "Inicio",      icon: LayoutDashboard },
  { path: "/calendario",   label: "Calendario",  icon: Calendar,      moduleKey: "calendario" as const },
  { path: "/empleados",    label: "Personal",    icon: Users,         moduleKey: "personal"   as const },
  { path: "/sueldos",      label: "Sueldos",     icon: Banknote,      moduleKey: "sueldos"    as const },
  { path: "/compras",      label: "Compras",     icon: ShoppingCart,  moduleKey: "compras"    as const },
  { path: "/mi-modulo",    label: "Mi Módulo",   icon: BookOpen,      moduleKey: "mi_modulo"  as const }, // ← nuevo
  { path: "/configuracion", label: "Config",     icon: Settings },
];
```

> El BottomNav tiene espacio limitado. Con más de 5–6 ítems considera priorizar los más usados.

---

### 5. Agregar ícono en Settings

[src/react-app/pages/Settings.tsx](../src/react-app/pages/Settings.tsx) — `MODULE_ICONS`

```ts
import { Calendar, Users, Banknote, ShoppingCart, BookOpen } from "lucide-react"; // ← agregar BookOpen

const MODULE_ICONS = {
  calendario: Calendar,
  personal:   Users,
  sueldos:    Banknote,
  compras:    ShoppingCart,
  mi_modulo:  BookOpen, // ← nuevo — mismo ícono que usaste en Sidebar
} as const;
```

Settings ya itera sobre `MODULES` para renderizar los toggles. Solo necesita el ícono registrado aquí para que TypeScript no se queje y el ícono aparezca correctamente.

---

### 6. Agregar entrada en OwnerPanel

[src/react-app/pages/OwnerPanel.tsx](../src/react-app/pages/OwnerPanel.tsx) — `MODULE_LABELS`

```ts
import { Crown, Lock, Calendar, Users, Banknote, ShoppingCart, BookOpen /* ← agregar */ } from "lucide-react";
import type { NegocioModuleRestrictions } from "@/shared/types";

const MODULE_LABELS: { key: keyof NegocioModuleRestrictions; label: string; icon: typeof Calendar }[] = [
  { key: "calendario", label: "Calendario",  icon: Calendar },
  { key: "personal",   label: "Personal",    icon: Users },
  { key: "sueldos",    label: "Sueldos",     icon: Banknote },
  { key: "compras",    label: "Compras",     icon: ShoppingCart },
  { key: "mi_modulo",  label: "Mi Módulo",   icon: BookOpen }, // ← nuevo
];
```

> **Importante:** OwnerPanel tiene su propio array estático `MODULE_LABELS`. No se alimenta automáticamente de `MODULES` — hay que actualizarlo manualmente.

---

### 7. Agregar la ruta en App.tsx

[src/react-app/App.tsx](../src/react-app/App.tsx)

```tsx
import MiModulo from "@/react-app/pages/modulos/MiModulo"; // ← import

// Dentro de <Routes>:
<Route
  path="/mi-modulo"
  element={
    <ProtectedRoute>
      <MainLayout>
        <PageErrorBoundary>
          <RestrictedModuleRoute moduleKey="mi_modulo">
            <MiModulo />
          </RestrictedModuleRoute>
        </PageErrorBoundary>
      </MainLayout>
    </ProtectedRoute>
  }
/>
```

`RestrictedModuleRoute` redirige a `/` si el owner restringió el módulo para ese gerente.

---

### 8. Crear la página del módulo

Crear [src/react-app/pages/modulos/MiModulo.tsx](../src/react-app/pages/modulos/MiModulo.tsx):

```tsx
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/react-app/components/ui/button";
import { useToast } from "@/react-app/components/ui/toast";
import { UsageBanner } from "@/react-app/components/UsageBanner";
import { useMyUsage } from "@/react-app/hooks/useMyUsage";
import { useMiModulo } from "@/react-app/hooks/useMiModulo";

export default function MiModulo() {
  const { items, isLoading, error, createItem } = useMiModulo();
  const { data: myUsage } = useMyUsage();
  const toast = useToast(); // útil para mostrar feedback tras createItem — ver ejemplo abajo

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={() => window.location.reload()}>Reintentar</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner de cuota: aparece al 80% del límite (amarillo) y al 100% (rojo) */}
      {/* "mi_modulo_action" debe coincidir con la clave en USAGE_TOOLS */}
      <UsageBanner label="Mi Módulo" usage={myUsage?.usage["mi_modulo_action"]} />

      <div>
        <h1 className="text-2xl sm:text-3xl font-serif font-semibold text-foreground">
          Mi Módulo
        </h1>
        <p className="text-muted-foreground mt-1">Descripción del módulo</p>
      </div>

      {/* contenido */}
    </div>
  );
}
```

**Notas:**
- `useMyUsage()` devuelve `{ data, isLoading }`. Para el banner: `data?.usage["nombre_del_tool"]`
- `UsageBanner` acepta `label` (texto para el mensaje) y `usage` (objeto `{ count, limit }`)
- Si `usage.limit === null` (usuario inteligente), el banner no se renderiza automáticamente
- `useToast()` se incluye en el template para dar feedback al usuario tras operaciones de escritura. Ejemplo:
  ```ts
  const ok = await createItem({ name: "Nuevo" });
  if (ok) toast.success("Creado exitosamente");
  else toast.error("Error al crear");
  ```

---

### 9. Crear el hook de datos

Crear [src/react-app/hooks/useMiModulo.ts](../src/react-app/hooks/useMiModulo.ts):

```ts
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/react-app/context/AuthContext";
import { apiFetch } from "@/react-app/lib/api";

export interface MiItem {
  id: number;
  negocio_id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface MiItemInput {
  name: string;
}

export function useMiModulo() {
  const { currentNegocio } = useAuth();
  const [items, setItems]         = useState<MiItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    if (!currentNegocio?.id) return;
    try {
      setIsLoading(true);
      setError(null);
      const res  = await apiFetch("/api/mi-modulo", {}, currentNegocio.id);
      const json = await res.json();
      if (json.success) setItems(json.data ?? []);
      else setError(json.error?.message ?? "Error al cargar");
    } catch {
      setError("Error de conexión");
    } finally {
      setIsLoading(false);
    }
  }, [currentNegocio?.id]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const createItem = useCallback(async (input: MiItemInput): Promise<boolean> => {
    if (!currentNegocio?.id) return false;
    try {
      const res  = await apiFetch("/api/mi-modulo", {
        method: "POST",
        body: JSON.stringify(input),
      }, currentNegocio.id);
      const json = await res.json();
      if (json.success) {
        await fetchItems();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [currentNegocio?.id, fetchItems]);

  return { items, isLoading, error, fetchItems, createItem };
}
```

> Usar siempre `apiFetch` (de `@/react-app/lib/api`) — agrega automáticamente el header `X-Negocio-ID` que el backend requiere para filtrar datos por negocio.
>
> **Excepción:** los endpoints que son por usuario y no por negocio (como `/api/modules/prefs`) pueden usar `fetch()` directo, porque no necesitan el header `X-Negocio-ID`. Si tu módulo maneja datos aislados por negocio (la mayoría), usa `apiFetch`.

---

### 10. Registrar el tool de uso

[src/worker/usageTools.ts](../src/worker/usageTools.ts) — fuente canónica de los nombres de tools:

```ts
export const USAGE_TOOLS = {
  EMPLOYEES:        "employees",
  JOB_ROLES:        "job_roles",
  TOPICS:           "topics",
  NOTES:            "notes",
  ADVANCES:         "advances",
  SALARY_PAYMENTS:  "salary_payments",
  EVENTS:           "events",
  CHAT:             "chat",
  COMPRAS:          "compras",
  MI_MODULO_ACTION: "mi_modulo_action", // ← nuevo
} as const;
```

**Regla:** el string (`"mi_modulo_action"`) es la clave en las tablas `usage_counters` y `usage_limits`. Debe ser único. Una vez en producción, no renombrar (rompería el historial de contadores).

---

### 11–16. Cambios en el worker (index.ts)

[src/worker/index.ts](../src/worker/index.ts) tiene **6 lugares** que requieren actualización:

#### 11. Extender la unión de tipos de `createModuleRestrictionMiddleware` (línea ~181)

```ts
// ANTES:
function createModuleRestrictionMiddleware(moduleKey: 'calendario' | 'personal' | 'sueldos' | 'compras')

// DESPUÉS:
function createModuleRestrictionMiddleware(moduleKey: 'calendario' | 'personal' | 'sueldos' | 'compras' | 'mi_modulo')
```

#### 12. `VALID_MODULE_KEYS` (línea ~992)

```ts
const VALID_MODULE_KEYS = ["calendario", "personal", "sueldos", "compras", "mi_modulo"] as const;
```

#### 13. GET `/api/negocios/:id/module-restrictions` — objeto de valores por defecto

```ts
const data: Record<string, boolean> = {
  calendario: false,
  personal:   false,
  sueldos:    false,
  compras:    false,
  mi_modulo:  false, // ← nuevo
};
```

#### 14. PUT `/api/negocios/:id/module-restrictions` — validación de `module_key` (línea ~963)

```ts
const VALID_KEYS = ['calendario', 'personal', 'sueldos', 'compras', 'mi_modulo'];
```

#### 15. PUT `/api/admin/usage-limits` — lista de tools válidos (línea ~2515)

```ts
const validTools = [
  "employees", "job_roles", "topics", "notes",
  "advances", "salary_payments", "events", "chat",
  "compras",
  "mi_modulo_action", // ← nuevo
];
```

---

### 16. Agregar schema de validación

[src/worker/validation.ts](../src/worker/validation.ts) — todos los endpoints de escritura usan `validateData(schema, body)` en lugar de validación manual. Agregar el schema del módulo aquí:

```ts
import { z } from "zod";

// Al final del archivo, junto a los otros schemas:
export const createMiItemSchema = z.object({
  name: z.string().min(1, "Nombre es requerido").max(100, "Nombre muy largo"),
  // agregar los campos que necesite el módulo
});

export const updateMiItemSchema = createMiItemSchema.partial();
```

Luego importar en `index.ts` (línea ~7, donde se importan los otros schemas):
```ts
import {
  validateData,
  // ... schemas existentes ...
  createMiItemSchema,
  updateMiItemSchema,
} from "./validation";
```

---

### 17. Crear los endpoints del módulo

[src/worker/index.ts](../src/worker/index.ts) — agregar los endpoints. `USAGE_TOOLS` ya está importado en la línea 20 del archivo.

```ts
// ============================================
// Mi Módulo Routes
// ============================================

// GET — lectura, sin cuota
app.get("/api/mi-modulo",
  authMiddleware,
  negocioMiddleware,
  createModuleRestrictionMiddleware('mi_modulo'),
  async (c) => {
    const user    = c.get("user");
    const negocio = c.get("negocio");
    const db      = c.env.DB;
    try {
      const rows = await db
        .prepare("SELECT * FROM mi_modulo_items WHERE negocio_id = ? ORDER BY created_at DESC")
        .bind(negocio.id)
        .all();
      await logUsage(db, user.id, negocio.id, "view", "mi_modulo_item");
      return c.json(apiResponse(rows.results));
    } catch (error) {
      console.error("Error fetching mi_modulo:", error);
      return c.json(apiError("FETCH_ERROR", "Error al obtener datos"), 500);
    }
  }
);

// POST — escritura, con cuota
app.post("/api/mi-modulo",
  authMiddleware,
  negocioMiddleware,
  createModuleRestrictionMiddleware('mi_modulo'),           // bloquea gerentes si owner restringió
  createUsageLimitMiddleware(USAGE_TOOLS.MI_MODULO_ACTION), // cuenta y aplica límite mensual
  async (c) => {
    const user    = c.get("user");
    const negocio = c.get("negocio");
    const db      = c.env.DB;
    try {
      const body = await c.req.json();
      const validation = validateData(createMiItemSchema, body);
      if (!validation.success) {
        return c.json(apiError("VALIDATION_ERROR", validation.error || "Datos inválidos"), 400);
      }
      const validData = validation.data!;

      const now    = new Date().toISOString();
      const result = await db
        .prepare(`INSERT INTO mi_modulo_items (negocio_id, user_id, name, created_at, updated_at)
                  VALUES (?, ?, ?, ?, ?) RETURNING *`)
        .bind(negocio.id, user.id, validData.name, now, now)
        .first();

      await logUsage(db, user.id, negocio.id, "create", "mi_modulo_item");
      return c.json(apiResponse(result), 201);
    } catch (error) {
      console.error("Error creating mi_modulo item:", error);
      return c.json(apiError("CREATE_ERROR", "Error al crear"), 500);
    }
  }
);
```

**Notas del patrón:**
- `logUsage(db, user.id, negocio.id, "action", "entity")` — se llama en **todos** los endpoints. Escribe en la tabla `usage_logs` (audit trail independiente de las cuotas)
- `validateData(schema, body)` — siempre usar schemas Zod desde `validation.ts`, no validación manual
- Los errores se envuelven en `try/catch` con `console.error` + `apiError`
- `USAGE_TOOLS` ya está importado al inicio de `index.ts` — no reimportar

**Comportamiento de `createUsageLimitMiddleware`:**

| Rol del usuario | Resultado |
|----------------|-----------|
| `usuario_inteligente` | Pasa sin contar — acceso ilimitado |
| `usuario_basico` dentro del límite | Incrementa contador y pasa |
| `usuario_basico` que superó el límite | 429 `USAGE_LIMIT_EXCEEDED` con mensaje de upgrade |

El límite es `NULL` hasta que el admin lo configure en `/admin`. Con `NULL`, el middleware no bloquea.

---

### 18. Crear la migración de base de datos

Crear `migrations/N.sql` (N = siguiente número en la secuencia, actualmente la última es `13.sql`):

```sql
-- Migration N: Tabla para el módulo Mi Módulo

CREATE TABLE mi_modulo_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  negocio_id  INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  user_id     TEXT    NOT NULL,
  name        TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_mi_modulo_items_negocio ON mi_modulo_items(negocio_id);
```

**Reglas de la DB:**
- Toda tabla de módulo **debe tener `negocio_id`** — todos los datos están aislados por negocio
- `ON DELETE CASCADE` en la FK garantiza que los datos se eliminan si el negocio se borra
- Agregar índice sobre `negocio_id` para queries eficientes

---

### 19. Aplicar la migración

```bash
# Desarrollo local (D1 local):
npx wrangler d1 migrations apply gastro-manager-db --local

# Producción:
npx wrangler d1 migrations apply gastro-manager-db
```

Wrangler detecta automáticamente los archivos `.sql` en `/migrations` por número de secuencia y aplica solo los que aún no han sido ejecutados.

---

## Cómo funciona la visibilidad

```
Capas de control (se aplican de afuera hacia adentro):

1. Owner restringe módulo en /owner
   └─> negocio_module_restrictions tabla (por negocio)
       ├─> Sidebar/BottomNav ocultan el ítem al gerente
       ├─> RestrictedModuleRoute redirige al gerente a "/"
       └─> createModuleRestrictionMiddleware devuelve 403 al gerente

2. Usuario oculta módulo en /configuracion
   └─> user_module_prefs tabla (por usuario)
       └─> Sidebar/BottomNav ocultan el ítem (solo visual)
           No bloquea el acceso directo por URL

Reglas:
- Los owners SIEMPRE pueden acceder, sin importar restricciones
- Los gerentes NO pueden sobrepasar las restricciones del owner
- Cualquier usuario puede ocultar módulos que no usa (es solo cosmético)
```

**Filtrado en Sidebar y BottomNav** — ya implementado, no requiere cambios:
```ts
const visibleNavItems = navItems.filter((item) => {
  if (!item.moduleKey) return true;                                        // Dashboard, Configuración — siempre visibles
  if (prefs[item.moduleKey] === false) return false;                       // usuario lo ocultó
  if (isGerente && negocioRestrictions[item.moduleKey]) return false;      // owner lo restringió
  return true;
});
```

---

## Cómo funciona el sistema de cuotas

```
POST /api/mi-modulo
  └─> createUsageLimitMiddleware("mi_modulo_action")
        ├─> usuario_inteligente → next() sin contar
        └─> usuario_basico
              ├─> INSERT ... ON CONFLICT DO UPDATE count = count + 1 RETURNING count
              ├─> count <= limit → next()
              └─> count > limit  → revierte incremento → 429
```

**Scoping:** Los contadores son por `user_id + negocio_id + tool + period (YYYY-MM)`.
Un usuario puede agotar su cuota en el Negocio A y tener cuota fresca en el Negocio B.

**`UsageBanner`** en la página muestra el estado actual al usuario:
- < 80% del límite: no se muestra
- ≥ 80%: banner amarillo de advertencia
- ≥ 100%: banner rojo con mensaje de upgrade a Usuario Inteligente
- `limit === null` (usuario inteligente): no se muestra

---

## Cómo configurar límites desde el Admin Panel

Desde `/admin` (solo usuarios con rol admin de la plataforma):

**Sección "Cuotas":**
- Muestra un input editable por cada tool en `USAGE_TOOLS` + el que agregaste en `validTools` (paso 15)
- El límite `null` inicial significa "sin restricción" hasta que el admin lo configure
- Endpoint: `PUT /api/admin/usage-limits` con body `{ "mi_modulo_action": 50 }`

**Sección "Usuarios":**
- **Promover a `usuario_inteligente`**: acceso ilimitado (saltea todos los contadores)
- **Degradar a `usuario_basico`**: vuelven a aplicarse los límites configurados
- Endpoints: `POST /api/admin/users/:userId/promote` y `/demote`

**Sección "Uso actual":**
- Tabla con consumo del mes por usuario, negocio y tool
- Los contadores del nuevo módulo aparecen automáticamente una vez que hay actividad
