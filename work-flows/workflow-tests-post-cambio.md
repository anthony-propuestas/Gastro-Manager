# Workflow: Tests Post-Cambio

Ejecutar ante cualquier cambio uncommitted antes de commitear.

**Framework:** Vitest 4.1.2 — `npm test` · `npm run test:watch` · `npm run test:coverage`  
**Convención:** cada archivo tiene su test hermano en la misma carpeta (`archivo.ts` → `archivo.test.ts`)

---

## Checklist rápida

- [ ] Tests creados para archivos nuevos
- [ ] Tests existentes actualizados para archivos modificados
- [ ] Tests obsoletos eliminados
- [ ] `npm test` pasa sin errores

---

## Paso 1 — Identificar qué cambió

```bash
git status          # archivos nuevos, modificados, eliminados
git diff HEAD       # contenido de los cambios (staged + unstaged)
```

Clasificar cada archivo:

| Categoría | Acción |
|---|---|
| Archivo nuevo | Crear test hermano |
| Archivo modificado | Revisar y actualizar su test hermano |
| Archivo eliminado | Eliminar su test hermano |

---

## Paso 2 — Tipos de test en este proyecto

Hay tres niveles. Cada uno tiene patrones distintos.

---

### Tipo A — Hook de datos

**Qué testea:** lógica de fetch, estado interno, acciones de escritura.  
**Archivo de referencia:** `src/react-app/hooks/useSellers.test.tsx`

**Cuándo mockar `fetch` vs `apiFetch`:**

| El hook usa | Mockear con |
|---|---|
| `fetch()` nativo (ej: sin negocio_id) | `vi.stubGlobal("fetch", mockFetch)` + `vi.unstubAllGlobals()` en `afterEach` |
| `apiFetch` (con negocio_id) | `vi.mock("@/react-app/lib/api", ...)` + `vi.mock("@/react-app/context/AuthContext", ...)` |

**Organización del archivo:** un `describe` por operación, separados con comentario `// ─── Sección ───`:

```ts
// ─── Estado inicial ───────────────────────────────────────────────────────────
describe("useXxx — estado inicial", () => { ... });

// ─── fetchItems ───────────────────────────────────────────────────────────────
describe("useXxx — fetchItems", () => { ... });

// ─── createItem ───────────────────────────────────────────────────────────────
describe("useXxx — createItem", () => { ... });
```

**Cobertura mínima por operación:**

*Estado inicial:*
- `isLoading: true`, datos en su valor vacío, `error: null`

*fetchItems (GET):*
- `success: true` → datos se actualizan, `isLoading` vuelve a `false`
- `success: false` → datos quedan vacíos, `error` puede setearse
- Campo opcional ausente en data → se usa valor por defecto (`[]`, `null`)
- Excepción de red → `error` se setea con mensaje de fallback

*createItem / deleteItem / updateItem (mutaciones):*
- Retorna `true` + llama `fetchItems` de nuevo cuando el servidor responde `success: true`
- Retorna `false` + setea `error` cuando el servidor responde `success: false`
- Retorna `false` cuando hay error de red

**Patrón con `fetch` nativo:**

```ts
import { renderHook, waitFor, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { useXxx } from "./useXxx";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  vi.clearAllMocks();
});
afterEach(() => { vi.unstubAllGlobals(); });

function res(body: unknown) {
  return Promise.resolve({ json: () => Promise.resolve(body) } as Response);
}

const ITEM = { id: 1, name: "test", created_at: "2026-01-01" };

// ─── Estado inicial ───────────────────────────────────────────────────────────

describe("useXxx — estado inicial", () => {
  it("isLoading empieza en true e items en []", () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useXxx());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});

// ─── fetchItems ───────────────────────────────────────────────────────────────

describe("useXxx — fetchItems", () => {
  it("setea items cuando el fetch tiene éxito", async () => {
    mockFetch.mockReturnValue(res({ success: true, data: [ITEM] }));
    const { result } = renderHook(() => useXxx());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it("deja items en [] cuando success es false", async () => {
    mockFetch.mockReturnValue(res({ success: false }));
    const { result } = renderHook(() => useXxx());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toEqual([]);
  });

  it("setea error cuando el fetch lanza excepción", async () => {
    mockFetch.mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useXxx());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe("Error al cargar"); // ajustar al mensaje real
  });
});

// ─── createItem ───────────────────────────────────────────────────────────────

describe("useXxx — createItem", () => {
  it("retorna true y re-llama fetchItems al crear con éxito", async () => {
    mockFetch
      .mockReturnValueOnce(res({ success: true, data: [] }))          // fetchItems inicial
      .mockReturnValueOnce(res({ success: true, data: { id: 2 } }))   // POST
      .mockReturnValueOnce(res({ success: true, data: [ITEM] }));      // fetchItems refresh

    const { result } = renderHook(() => useXxx());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let ok!: boolean;
    await act(async () => { ok = await result.current.createItem({ name: "nuevo" }); });

    expect(ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("retorna false cuando el servidor responde con error", async () => {
    mockFetch
      .mockReturnValueOnce(res({ success: true, data: [] }))
      .mockReturnValueOnce(res({ success: false, error: { message: "Error" } }));

    const { result } = renderHook(() => useXxx());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let ok!: boolean;
    await act(async () => { ok = await result.current.createItem({ name: "nuevo" }); });

    expect(ok).toBe(false);
  });
});
```

**Patrón con `apiFetch` (requiere negocio_id):**

```ts
const mockUseAuth = vi.fn();
const mockApiFetch = vi.fn();

vi.mock("@/react-app/context/AuthContext", () => ({ useAuth: () => mockUseAuth() }));
vi.mock("@/react-app/lib/api", () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));

function jsonResponse(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } })
  );
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({ currentNegocio: { id: 1 } });
  vi.clearAllMocks();
});

// El resto igual, pero mockApiFetch en lugar de mockFetch, y jsonResponse en lugar de res
```

---

### Tipo B — Componente UI

**Qué testea:** qué se renderiza dado un set de props. Sin lógica de negocio ni fetch.  
**Archivo de referencia:** `src/react-app/components/UsageBanner.test.tsx`

**Herramientas:** `render` + `screen`. No se necesita `act` ni `waitFor` salvo que haya estado asíncrono interno.

**Cobertura mínima:**

- Sin props opcionales: no rompe (smoke test)
- Cada estado visual distinto renderiza el contenido esperado
- Props que cambian la visual se testean individualmente

**Patrón:**

```ts
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MiComponente } from "@/react-app/components/MiComponente";

describe("MiComponente", () => {
  it("no renderiza cuando la prop principal está ausente", () => {
    const { container } = render(<MiComponente />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza el estado A con las props correctas", () => {
    render(<MiComponente valor={8} limite={10} label="Chat" />);
    expect(screen.getByText(/Acercándote al límite/i)).toBeInTheDocument();
  });

  it("renderiza el estado B al superar el límite", () => {
    render(<MiComponente valor={10} limite={10} label="Chat" />);
    expect(screen.getByText(/Límite mensual alcanzado/i)).toBeInTheDocument();
  });
});
```

---

### Tipo C — Página

**Qué testea:** qué renderiza la página según el estado del hook que consume, e interacciones de UI.  
**Archivo de referencia:** `src/react-app/pages/Sellers.test.tsx`

**Regla clave:** nunca dejar que el hook real haga fetch. Siempre mockear el hook completo con `vi.mock` + `vi.mocked`. El test de la página no prueba el hook — eso lo hace el test del hook.

**Patrón — BASE_MOCK + spread:**

```ts
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import MiPagina from "./MiPagina";

vi.mock("@/react-app/hooks/useMiModulo");
import { useMiModulo } from "@/react-app/hooks/useMiModulo";
const mockUseMiModulo = vi.mocked(useMiModulo);

const ITEM = { id: 1, name: "Test", negocio_id: 1, created_at: "2026-01-01", updated_at: "2026-01-01" };

const BASE_MOCK = {
  items: [] as typeof ITEM[],
  isLoading: false,
  error: null as string | null,
  fetchItems: vi.fn(),
  createItem: vi.fn(),
};

beforeEach(() => { vi.clearAllMocks(); });

// ─── Loading / Error ──────────────────────────────────────────────────────────

describe("MiPagina — estados base", () => {
  it("muestra spinner cuando isLoading es true", () => {
    mockUseMiModulo.mockReturnValue({ ...BASE_MOCK, isLoading: true });
    render(<MiPagina />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("muestra mensaje de error cuando error tiene valor", () => {
    mockUseMiModulo.mockReturnValue({ ...BASE_MOCK, error: "Error de conexión" });
    render(<MiPagina />);
    expect(screen.getByText("Error de conexión")).toBeInTheDocument();
  });

  it("muestra vacío cuando items es []", () => {
    mockUseMiModulo.mockReturnValue({ ...BASE_MOCK });
    render(<MiPagina />);
    expect(screen.getByText(/No hay items/i)).toBeInTheDocument();
  });
});

// ─── Con datos ────────────────────────────────────────────────────────────────

describe("MiPagina — con datos", () => {
  it("renderiza el nombre del item", () => {
    mockUseMiModulo.mockReturnValue({ ...BASE_MOCK, items: [ITEM] });
    render(<MiPagina />);
    expect(screen.getByText("Test")).toBeInTheDocument();
  });
});

// ─── Acciones ─────────────────────────────────────────────────────────────────

describe("MiPagina — acciones", () => {
  it("clic en 'Crear' llama createItem()", async () => {
    const createItem = vi.fn(() => Promise.resolve(true));
    mockUseMiModulo.mockReturnValue({ ...BASE_MOCK, createItem });
    render(<MiPagina />);

    fireEvent.click(screen.getByText("Crear"));

    await waitFor(() => expect(createItem).toHaveBeenCalledTimes(1));
  });
});
```

---

## Paso 3 — Actualizar tests existentes

Para cada archivo modificado, revisar su test hermano.

### Cambios más comunes y qué actualizar

**Nueva propiedad en una interfaz o tipo:**
- Actualizar los objetos fixture (`ITEM`, `BASE_MOCK`, etc.)
- Actualizar los `toEqual` que comparan objetos completos

**Nueva prop en un componente:**
- Agregar la prop en cada `render(...)` del test
- Si es opcional, agregar un test para el comportamiento cuando está ausente

**Nuevo módulo en `MODULES`, `DEFAULT_PREFS`, `DEFAULT_RESTRICTIONS`:**

> Requiere tres actualizaciones en `src/react-app/hooks/useModulePrefs.test.ts`:

1. **`toEqual` sobre prefs o restrictions** — agregar la nueva clave (en orden alfabético, mismo orden que el objeto real):

```ts
// ANTES:
expect(result.current.prefs).toEqual({ calendario: true, personal: true });
// DESPUÉS:
expect(result.current.prefs).toEqual({ calendario: true, mi_modulo: true, personal: true });
```

2. **Mocks de `/api/modules/prefs`** — el hook descarta respuestas que no incluyen todos los módulos de `MODULES`. Si falta la clave nueva, el mock pasa la validación silenciosamente:

```ts
// ANTES:
return jsonResponse({ success: true, data: { calendario: true, personal: false } });
// DESPUÉS:
return jsonResponse({ success: true, data: { calendario: true, mi_modulo: true, personal: false } });
```

3. **Mocks de `/api/negocios/:id/module-restrictions`** — mismo razonamiento que arriba.

**Endpoint modificado (body, validación, respuesta):**
- Actualizar mocks que simulan la respuesta de ese endpoint
- Actualizar asserts sobre el body enviado (`toHaveBeenCalledWith(...)`)

**Nuevo middleware o guard en un endpoint:**
- Agregar un `it` que verifica que se rechaza (403, 429, etc.) cuando la condición no se cumple

---

## Paso 4 — Eliminar tests obsoletos

Un test es obsoleto cuando describe comportamiento que ya no existe en el código.

| Señal | Acción |
|---|---|
| El archivo que prueba fue eliminado | Eliminar todo `archivo.test.ts` |
| El `it()` prueba una función o prop que fue eliminada | Eliminar ese `it()` |
| El mock apunta a un endpoint que ya no existe | Eliminar o reescribir el test |
| El test falla pero el feature funciona | El test quedó desactualizado — eliminar o reescribir |
| El test pasa pero mockea algo que ya no existe | Puede estar pasando por razones equivocadas — revisar |

**Proceso:**
1. Correr `npm test` — ver cuáles fallan
2. Por cada fallo: ¿es un bug en el código, o el test quedó viejo?
3. Si el test está viejo: eliminarlo o reescribirlo
4. Revisar también los que pasan pero tienen mocks de endpoints o funciones eliminadas

---

## Paso 5 — Verificar

```bash
npm test
```

Todos los tests deben pasar. Si alguno falla, corregir antes de commitear.

```bash
npm run test:coverage   # opcional — ver cobertura del código nuevo
```

No declarar done hasta ver `0 failures` en el output de `npm test`.
