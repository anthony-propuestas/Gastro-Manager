# Workflow: Verificación Documentación vs Código

Ejecutar antes de commitear cuando el diff incluye al menos un archivo `.md`.  
El código es la fuente de verdad — el doc se ajusta al código, nunca al revés.

**Dos escenarios distintos, mismo proceso:**

| Qué cambió | Por qué corre este workflow |
|---|---|
| Modificaste **código** | La doc podría describir comportamiento que ya no existe o que cambió |
| Modificaste **la doc** | Verificar que lo que escribiste en el doc es lo que el código realmente hace |

---

## Checklist rápida

- [ ] Identificados qué `.md` hay en el diff
- [ ] Cada `.md` modificado verificado contra su código fuente
- [ ] Discrepancias corregidas en el doc (no en el código)
- [ ] Sin menciones rotas del elemento cambiado en otros docs

---

## Paso 1 — Identificar qué `.md` fue modificado

```powershell
git diff --name-only HEAD        # staged + unstaged vs último commit
git diff --name-only --cached    # solo staged

# Filtrar solo .md:
git diff --name-only HEAD | Where-Object { $_ -match "\.md$" }
```

Incluye archivos **nuevos** (agregados) y **modificados** — ambos requieren verificación.  
Si ningún `.md` aparece en el output, este workflow no aplica — commitear normal.

---

## Paso 2 — Mapear cada `.md` a su código fuente

| Documento modificado | Código que debe reflejar |
|---|---|
| `docs/api.md` | Rutas y handlers en `src/worker/` (archivos `.ts` de endpoints) |
| `docs/database.md` | Archivos en `migrations/` (`.sql`) |
| `docs/validation.md` | `src/worker/validation.ts` |
| `docs/frontend.md` | `src/react-app/App.tsx`, `src/react-app/pages/`, `src/react-app/hooks/` |
| `docs/authentication.md` | Middleware de auth en `src/worker/`, flujo OAuth |
| `docs/roles.md` | `VALID_MODULE_KEYS` y `createModuleRestrictionMiddleware` en `src/worker/` |
| `docs/architecture.md` | Orden de middlewares en el entry point de `src/worker/index.ts` |
| `docs/test.md` | Archivos `*.test.ts` / `*.test.tsx` en `src/` |
| `docs/security.md` | Cualquier endpoint, guard, o validación afectada por el cambio |
| `docs/agregar-nuevo-modulo.md` | Proceso real observado al agregar módulos (no un archivo concreto) |
| `docs/mobile.md` | `capacitor.config.ts`, `android/variables.gradle`, `android/app/src/main/AndroidManifest.xml`, `package.json` |
| `work-flows/*.md` | Proceso real que describe — comparar contra práctica actual |
| `README.md` | Estado general del sistema, stack, comandos en `package.json` |

---

## Paso 3 — Verificar cada doc modificado

Para cada `.md` en el diff, abrir el doc y el código correspondiente en paralelo y revisar punto por punto.

---

### `docs/api.md`

Cada endpoint listado en el doc debe existir en código, con el mismo método y ruta.

| Verificar | Cómo |
|---|---|
| Endpoint existe | Buscar `router.get(`, `router.post(`, etc. con la ruta exacta |
| Método HTTP correcto | Confirmar que el verbo en el doc coincide con el código |
| Parámetros del body | Comparar campos documentados con el schema Zod o validación que usa el handler |
| Forma de la respuesta | Comparar el ejemplo de respuesta del doc con lo que retorna el handler |
| Total de endpoints | Contar los endpoints reales y comparar con el contador en "Notas Generales" |

**Señal de discrepancia:** el doc menciona `POST /api/items` pero el código tiene `PUT /api/items`; un campo documentado no aparece en la validación Zod; el contador de endpoints en "Notas Generales" no coincide con los handlers reales.

---

### `docs/database.md`

Las tablas y columnas documentadas deben coincidir con las migrations aplicadas.

| Verificar | Cómo |
|---|---|
| Nombre de tabla | Comparar contra `CREATE TABLE` en `migrations/` |
| Columnas y tipos | Listar columnas del `CREATE TABLE` — ¿el doc las tiene todas? |
| Columnas eliminadas | Si hay `ALTER TABLE DROP COLUMN`, ¿el doc ya no la menciona? |
| Número de migración | La referencia al número de migración en el doc debe coincidir con el archivo `.sql` real |

**Señal de discrepancia:** el doc documenta `negocio_id TEXT` pero la migration la define como `INTEGER`; el doc lista una columna que fue dropeada en una migration posterior.

---

### `docs/validation.md`

Cada schema Zod documentado debe existir en `src/worker/validation.ts` con los mismos campos.

| Verificar | Cómo |
|---|---|
| Schema existe | Buscar el nombre del schema en `validation.ts` |
| Campos documentados | Comparar los campos del doc con los del objeto `z.object({ ... })` real |
| Constraints clave | `.min()`, `.max()`, `.optional()`, `.email()` — verificar que el doc los refleja |
| Endpoint que lo usa | Confirmar que el endpoint listado en el doc realmente importa ese schema |

**Señal de discrepancia:** el doc lista `nombre: z.string().min(3)` pero el código tiene `.min(1)`; el schema existe en el doc pero fue renombrado o eliminado en `validation.ts`.

---

### `docs/frontend.md`

Las rutas, páginas y hooks documentados deben existir en el código.

| Verificar | Cómo |
|---|---|
| Rutas en `App.tsx` | Cada ruta documentada debe aparecer como `<Route path="..." />` en `App.tsx` |
| Páginas en `/pages/` | El archivo de página debe existir en `src/react-app/pages/` |
| Hooks en `/hooks/` | El hook documentado debe existir en `src/react-app/hooks/` |
| Componentes en Sidebar/BottomNav | Verificar que los ítems de navegación documentados existen en esos componentes |

**Señal de discrepancia:** el doc menciona `/modulos/ventas` pero esa ruta no existe en `App.tsx`; un hook listado fue renombrado o movido de carpeta.

---

### `docs/authentication.md`

El flujo descrito debe coincidir con el código de autenticación.

| Verificar | Cómo |
|---|---|
| Pasos del flujo OAuth | Cada paso del diagrama debe tener un handler o middleware real que lo ejecute |
| Generación de JWT/cookie | Confirmar que el método y los campos del token coinciden con el código |
| Ramas del flujo (verificado/no verificado) | Verificar que las condiciones documentadas están en el código |

**Señal de discrepancia:** el doc describe un paso de "verificación de email" que ya no existe en el flujo OAuth; los campos del JWT documentados no coinciden con lo que el código realmente firma.

---

### `docs/roles.md`

Los módulos documentados deben coincidir exactamente con `VALID_MODULE_KEYS`.

| Verificar | Cómo |
|---|---|
| Lista de módulos | Comparar la lista del doc con el array/objeto `VALID_MODULE_KEYS` en el código |
| Comportamiento de restricción | Confirmar que `createModuleRestrictionMiddleware` actúa como describe el doc |
| Módulos owner-only vs gerente | Verificar que el código diferencia roles como dice el doc |

**Señal de discrepancia:** el doc lista un módulo que fue eliminado de `VALID_MODULE_KEYS`; el doc dice "solo owner" pero `createModuleRestrictionMiddleware` también lo permite para gerente.

---

### `docs/architecture.md`

El orden de middlewares y las excepciones documentadas deben ser reales.

| Verificar | Cómo |
|---|---|
| Orden de middlewares | Leer el entry point (`src/worker/index.ts` o equivalente) y comparar el orden real |
| Excepciones de módulos | Cada excepción listada en la tabla debe estar en el código con esa lógica |
| Diagrama de flujo | Si hay un diagrama, cada rama debe corresponder a una bifurcación real en el código |

**Señal de discrepancia:** el doc describe un middleware que fue reordenado o eliminado; una excepción documentada en la tabla ya no está en el código (fue generalizada o eliminada).

---

### `docs/test.md`

Los archivos de test listados deben existir y el conteo debe ser correcto.

| Verificar | Cómo |
|---|---|
| Archivos de test mencionados | Confirmar que cada `archivo.test.ts` mencionado existe en el filesystem |
| Qué verifica cada test | El resumen del doc debe coincidir con los `describe`/`it` reales del archivo |
| Cobertura si se documenta | Comparar porcentajes del doc con `npm run test:coverage` si cambió |

**Señal de discrepancia:** el doc menciona `useVentas.test.tsx` pero ese archivo fue eliminado o renombrado; el bullet describe lo que verifica un `it()` que ya no existe.

---

### `docs/security.md`

Verificar que los vectores documentados corresponden a riesgos reales del código actual.

| Verificar | Cómo |
|---|---|
| Mitigaciones implementadas | Para cada mitigación listada, confirmar que el código la tiene |
| Áreas marcadas como "no aplica" | Verificar que efectivamente no aplica después del cambio |
| Referencias a endpoints o guards | Confirmar que el endpoint mencionado existe y el guard es el real |

**Señal de discrepancia:** el doc menciona una mitigación ("se valida con Zod") pero el endpoint ya no tiene esa validación; un área marcada como "no aplica" ahora sí aplica porque cambió el flujo.

---

### `docs/agregar-nuevo-modulo.md`

El proceso descrito debe coincidir con los pasos reales que se siguen al agregar un módulo nuevo.

| Verificar | Cómo |
|---|---|
| Checklist de pasos | ¿Algún paso nuevo es obligatorio hoy que no está en la lista? ¿Algún paso listado ya no aplica? |
| Archivos que hay que tocar | Comparar la lista de archivos del doc contra los que realmente se modificaron en el último módulo agregado |
| Patrones de código de ejemplo | Verificar que los snippets del doc compilan y coinciden con el código real del módulo más reciente |
| Orden de middlewares en endpoints | Comparar el ejemplo del Paso 17 (o el que aplique) con un handler real de un módulo existente |

**Señal de discrepancia:** el doc no menciona un archivo que se tuvo que tocar al agregar el último módulo; un snippet de ejemplo usa una función que fue renombrada.

---

### `docs/mobile.md`

Mapea a: `capacitor.config.ts`, `android/variables.gradle`, `android/app/src/main/AndroidManifest.xml`, `package.json`

| Verificar | Cómo |
|---|---|
| `appId` | Comparar el valor en el doc con `config.appId` en `capacitor.config.ts` |
| `server.url` | Comparar con `config.server.url` en `capacitor.config.ts` |
| `minSdkVersion` y `targetSdkVersion` | Comparar con los valores en `android/variables.gradle` |
| Permisos declarados | Confirmar que los permisos listados en el doc coinciden con los `<uses-permission>` en `AndroidManifest.xml` |
| Versiones de `@capacitor/*` | Comparar con las entradas en `package.json` (dependencies o devDependencies) |

**Señal de discrepancia:** el doc dice `minSdkVersion = 22` pero `variables.gradle` tiene `24`; el doc lista un permiso que fue eliminado del Manifest; la versión de Capacitor en el doc no coincide con `package.json`.

---

### `work-flows/*.md`

El proceso descrito debe ser el que realmente se sigue.

| Verificar | Cómo |
|---|---|
| Pasos del workflow | ¿Se siguen en la práctica? Si hubo un cambio en el proceso, ¿el doc lo refleja? |
| Comandos y rutas | Ejecutar mentalmente cada comando — ¿sigue siendo el correcto en el proyecto? |
| Referencias a archivos | Confirmar que los archivos mencionados existen con esos nombres |

**Señal de discrepancia:** un paso del workflow menciona un comando que cambió; el workflow describe un proceso que ya no se sigue (ej: antes se corría un script manual que ahora es automático).

---

## Paso 4 — Acción ante discrepancia

**Regla única: el código manda.**

| Tipo de discrepancia | Qué hacer |
|---|---|
| Doc menciona endpoint/tabla/hook que ya no existe | Eliminar la entrada del doc |
| Doc tiene campos, métodos o rutas distintos al código | Actualizar el doc para que coincida con el código |
| Doc no menciona algo que sí existe en el código | Agregar la entrada faltante al doc |
| El código parece incorrecto (bug) | No tocar el doc — primero arreglar el código, luego volver a verificar |

No modificar el código para que "encaje" con lo que dice el doc. Si el doc describe algo que ya no existe, el doc está mal.

---

## Paso 5 — Verificar referencias cruzadas

Un cambio en una entidad (endpoint, tabla, módulo) puede estar mencionado en múltiples docs.

```powershell
# Buscar la entidad modificada en todos los .md del proyecto
Get-ChildItem -Recurse -Include "*.md" | Select-String "nombre_del_endpoint_o_tabla"
```

Para cada mención encontrada en un doc que no estaba en el diff, verificar que también sigue siendo correcta.

---

## Cuándo termina este workflow

Cuando todos los `.md` del diff reflejan exactamente lo que el código hace — sin entradas obsoletas, sin campos incorrectos, sin rutas inexistentes.

Solo entonces: commitear.
