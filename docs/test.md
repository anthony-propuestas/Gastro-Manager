# Guia de tests y chequeos

Esta guia resume como ejecutar todas las verificaciones disponibles del proyecto y que valida cada una.

## Antes de empezar

1. Instala dependencias:

```bash
npm install
```

2. Si vas a ejecutar `npm run check`, asegúrate de tener configuradas las variables y bindings de Cloudflare, porque ese comando incluye `wrangler deploy --dry-run`.

## Paso a paso

### 1. Ejecutar los tests unitarios

```bash
npm test
```

Que verifica:
- Ejecuta la suite de Vitest.
- Comprueba utilidades, validaciones, rutas protegidas y hooks ya cubiertos por tests.

Los tests cubren dos ubicaciones: `src/**` y `functions/**` (ambas incluidas en el `include` de `vitest.config.ts` — ver sección de cobertura).

Cobertura actual:
- `src/react-app/lib/api.test.ts`: verifica que `apiFetch` agregue `X-Negocio-ID` cuando corresponde, que no lo inyecte cuando `negocioId` está ausente, que dispare el evento global `USAGE_LIMIT_EVENT` cuando el backend responde `429 USAGE_LIMIT_EXCEEDED`, y que un `429 TOO_MANY_REQUESTS` (rate limit de auth) **no** dispare ese evento.
- `src/worker/geminiCache.test.ts`: verifica la función `getOrCreateGeminiCache` (9 tests). Cubre: cache hit cuando el nombre existe y no expiró (no llama a la API de Gemini); cache miss cuando no hay fila en D1; cache miss cuando `gemini_cache_name` es null; cache miss cuando el cache expiró; payload correcto enviado a la API de Gemini (`model: "models/gemini-2.5-flash"`, `systemInstruction`, `ttl: "7200s"`, header `x-goog-api-key`); persistencia del nuevo nombre y `expiresAt` en D1 con los `userId` y `negocioId` correctos; que D1 no se actualiza cuando la API de Gemini responde un error; retorno null ante respuesta no-ok de la API; retorno null ante excepción de red.
- `src/worker/rateLimitAuth.test.ts`: verifica la función `checkRateLimit` (11 tests) y la lógica del validador de origen CORS (6 tests). Para `checkRateLimit`: retorna `true` cuando el count está por debajo del límite, `true` en el boundary exacto, `false` al excederlo en uno, `true` en el primer intento, `true` cuando D1 devuelve null (fail-open), que el IP se guarda como hash SHA-256 de 64 chars hex y no como texto plano, que el mismo IP produce el mismo hash, que IPs distintas producen hashes distintos, que `window_start` se redondea al múltiplo del windowMinutes sin segundos ni milisegundos, que los límites de `verify-email` (5/60 min) se respetan, y que el nombre del endpoint llega sin modificar a D1. Para el validador CORS: permite el origen exacto de `APP_URL`, rechaza orígenes distintos, rechaza subdominios, rechaza todos los orígenes cuando `APP_URL` es `undefined`, rechaza string vacío, y distingue http de https.
- `src/worker/validation.test.ts`: verifica schemas Zod y el helper `validateData`. Cubre los schemas de creación y actualización de todas las entidades: empleados, job roles, negocios, tópicos, notas, adelantos, pagos de sueldo, compras y facturación. Para empleados cubre también los campos de salida (`ausencia_desde`, `informo`, `cuando_informo`, `sueldo_pendiente`): acepta valores válidos y null, rechaza `sueldo_pendiente` negativo en ambos schemas. Cubre también `chatHistoryItemSchema` (acepta `role: "user"|"model"` con content de 1–2000 chars; rechaza roles inválidos, content vacío y content excesivo) y `chatHistoryArraySchema` (acepta array vacío y arrays válidos; rechaza ítems con role inválido). Valida tipos enum, rangos de monto, formatos de fecha y hora, campos requeridos y fallbacks de error. Actualmente deja `src/worker/validation.ts` con cobertura completa.
- `src/react-app/components/employees/EmployeeModal.test.tsx`: verifica el control segmentado de estado y el formulario condicional de baja. Cubre: que ambos botones ("Empleado activo" / "Empleado inactivo") se renderizan; que "Empleado activo" está seleccionado por defecto en un empleado nuevo; que al editar un empleado inactivo el botón "Empleado inactivo" queda seleccionado; que los campos de baja no aparecen cuando el empleado está activo; que aparecen al seleccionar "Empleado inactivo"; que `cuando_informo` permanece oculto mientras `informo` está desmarcado; que `cuando_informo` aparece al marcar `informo`; que los campos desaparecen al re-activar; que al editar un empleado inactivo los campos se pre-rellenan correctamente (`ausencia_desde`, `informo`, `cuando_informo`, `sueldo_pendiente`); y que desmarcar `informo` limpia `cuando_informo`.
- `src/react-app/components/employees/EmployeeViewModal.test.tsx`: verifica el modal de solo lectura para visualizar empleados. Cubre 4 bloques: **visibilidad** (no renderiza si `isOpen` es false o si `employee` es null; renderiza cuando ambos están presentes); **empleado activo** (nombre, cargo, iniciales en avatar, teléfono, email, salario formateado en MXN, badge "Activo", y que la sección de información de baja no aparece); **empleado inactivo** (badge "Inactivo", sección de información de baja con `ausencia_desde`, `sueldo_pendiente` formateado, estado de `informo`, y que la sección no aparece cuando todos los campos de baja están vacíos/nulos); **acciones** (`onEdit` se llama con el empleado correcto al pulsar "Editar", `onClose` al pulsar "Cerrar", `onClose` al pulsar el backdrop, y que "Cerrar" no dispara `onEdit`).
- `src/react-app/pages/modulos/Employees.test.tsx`: verifica la integración de la página de empleados. Cubre 2 bloques: **clic en tarjeta abre vista** (el modal de vista no está visible al cargar; clic en una tarjeta abre el modal con el empleado correcto; clic en otra tarjeta muestra ese empleado; cerrar el modal lo oculta); **control segmentado en tarjetas** (cada tarjeta tiene ambos botones de estado; clic en "Empleado inactivo" llama a `updateEmployee` con `is_active: false`; clic en "Empleado activo" llama a `updateEmployee` con `is_active: true`; los botones de estado NO abren el modal de vista; toast de éxito al marcar inactivo; toast de éxito al marcar activo; toast de error cuando `updateEmployee` falla, mostrando el mensaje de error).
- `src/react-app/components/UsageBanner.test.tsx`: verifica cuando el banner no aparece, cuando avisa y cuando marca limite alcanzado.
- `src/react-app/components/ErrorBoundary.test.tsx`: verifica que renderiza hijos sin error, muestra UI de error por defecto o fallback personalizado al capturar excepciones, y que el botón "Intentar de nuevo" restaura el estado limpio.
- `src/react-app/context/UsageLimitModalContext.test.tsx`: verifica el modal global de upgrade por límite. Cubre apertura al recibir `USAGE_LIMIT_EVENT`, renderizado del contenido dinámico, cierre con tecla `Escape`, cierre por click en el backdrop y restauración del `overflow` del `body`.
- `src/react-app/hooks/useSidebar.test.tsx`: verifica estado inicial, toggles de isOpen e isCollapsed, cierre del menú mobile al hacer resize a ≥1024px, y error al usar el hook fuera del Provider.
- `src/react-app/components/auth/ProtectedRoute.test.tsx`: verifica loading y redirecciones de rutas protegidas (8 tests). Cubre: spinner de carga mientras auth está pendiente; usuarios anónimos redirigidos a `/`; usuarios con email no verificado redirigidos a `/verify-email`; usuarios autenticados sin negocio activo redirigidos a `/setup`; la ruta `/setup` accesible sin negocio activo; renderizado del contenido protegido cuando hay auth y negocio disponibles; gerentes con módulo restringido redirigidos a `/dashboard`; y renderizado normal cuando el módulo está disponible.
- `src/react-app/pages/LandingPage.test.tsx`: verifica la landing page pública en 4 bloques (25 tests). **WaveBackground** (4 tests): renderiza el elemento SVG, contiene exactamente 6 paths de onda, los paths tienen `fill="none"`, y el SVG tiene `preserveAspectRatio="xMidYMid slice"`. **Renderizado** (13 tests): branding "La Hoja", links de navegación con anclas correctas, h1 del hero, botón de login en navbar, botones "Empezá gratis" (hero + CTA), sección de pain points con su heading, las 6 tarjetas de problemas, sección de módulos con su heading, los 6 títulos de módulo, beneficios en verde por módulo, sección "¿Cómo funciona?" con los 3 pasos, las 4 estadísticas de confianza y el footer con copyright. **Autenticación** (4 tests): redirige a `/dashboard` cuando el usuario está autenticado; no redirige mientras `isPending` es true; muestra el banner de email verificado con `?verified=true`; no muestra el banner sin el query param. **Login** (4 tests): al hacer click en el botón de login llama a `/api/oauth/google/redirect_url` y redirige a la URL recibida; muestra "Conectando..." y spinner durante la carga; el botón queda deshabilitado mientras espera; vuelve a habilitarse si el fetch falla.
- `src/react-app/hooks/useModulePrefs.test.ts`: verifica estado por defecto sin usuario (no hace fetch), carga de prefs y restricciones de negocio para usuarios autenticados (incluyendo `isGerente`), mantenimiento de prefs por defecto cuando la respuesta del endpoint tiene formato inválido, update optimista con confirmación exitosa y rollback ante fallo. Módulos registrados: `calendario`, `personal`, `sueldos`, `compras` y `facturacion`.
- `src/react-app/hooks/useSuscripcion.test.ts`: verifica el hook de suscripciones MercadoPago (23 tests). Cubre 4 bloques:
  - **Estado inicial y carga en mount** (4 tests): `isLoading: true` antes de resolver, fetch a `/api/suscripciones/estado` en mount y seteo de `suscripcion`, respuesta `null` cuando no hay suscripción, error de red al cargar estado.
  - **crear()** (13 tests): retorno de `init_point` y llamada a `fetchEstado` en éxito, reset de `isLoading`; `400 ALREADY_SUBSCRIBED` con mensaje del servidor; los 5 códigos 502 de MercadoPago (`MP_NETWORK_ERROR`, `MP_AUTH_ERROR`, `MP_VALIDATION_ERROR` con y sin `mp_detail`, `MP_SERVER_ERROR`, `MP_NO_INIT_POINT`); código desconocido con y sin `mp_detail`; error sin código; `fetch` throws.
  - **cancelar()** (3 tests): retorno `true` y llamada a `fetchEstado` en éxito; retorno `false` con error en fallo 404; `fetch` throws → retorna `false` y error de red.
  - **fetchPagos()** (3 tests): seteo de lista de pagos en éxito; respuesta no-ok no modifica el estado de error; excepción de red no modifica el estado de error.
- `src/react-app/hooks/useSellers.test.tsx`: verifica el hook `useSellers` (10 tests). Cubre 4 bloques: **estado inicial** (vendedor/referidos/stats en null, isLoading false, error null); **fetchMe() exitoso** (carga vendedor, lista de referidos y stats desde `/api/sellers/me`, reset de isLoading); **manejo de errores** (error de red y error de servidor en fetchMe, reset de isLoading en ambos casos); **activate()** (POST a `/api/sellers/activate`, seteo de `vendedor.codigo`, llamada a fetchMe en éxito; error de red y error de servidor en activación; estado de isLoading durante la operación); **refresh()** (re-llama a fetchMe y actualiza estado).
- `src/react-app/pages/Sellers.test.tsx`: verifica la página Sellers en dos estados principales (23 tests). Cubre: **spinner de carga** mientras fetchMe está pendiente; **card de activación** cuando el usuario no es vendedor (título "Convertite en vendedor", comisión 7.500 ARS, reembolso 6.000 ARS, listado de beneficios, botón "Activarme como vendedor"); **mensaje de error** cuando activate falla; **estado activado** (link de referido con código, botón de copiar, stats — total referidos, confirmados, comisión total, pendiente de cobro); **tabla de referidos** (nombre + email, fecha, badge de suscripción, badge de estado referido con colores pendiente/confirmado/cancelado); **comisión pagada** (monto tachado + badge "✓"); **estado vacío** ("Aún no tenés referidos").
- `src/react-app/hooks/useChat.test.ts`: verifica el hook del chatbot. Cubre: estado inicial vacío, que mensajes vacíos o con solo espacios no disparen la API, que el primer mensaje envíe `history: []`, que el mensaje del usuario y la respuesta del asistente se agreguen al estado `messages`, que los mensajes siguientes incluyan el intercambio previo como historial, que el rol `assistant` se mapee a `model` (formato requerido por Gemini), que el historial se corte a 20 items, manejo de errores de API y de red, reset de `isLoading` en ambos casos, `clearMessages`, y propagación del id del negocio a `apiFetch`.
- `functions/route.test.ts`: verifica el routing de la Pages Function de Cloudflare. 7 tests en 3 grupos: `/assets/*` (asset existente pasa sin modificar; asset faltante o con error devuelve 404 `text/plain` con `Cache-Control: no-store`; nunca hace fallback a `index.html`), SPA routing (recurso existente pasa directo; ruta desconocida hace fallback a `/index.html`), y `/api/*` (delega al Hono Worker sin llamar a ASSETS). El mock de `src/worker/index` aísla completamente la lógica de routing de los endpoints de negocio.
- `src/react-app/pages/Admin.test.tsx`: verifica el panel de administración en cuatro bloques. El `BASE_MOCK` incluye `suscripciones`, `fetchSuscripciones` y `fetchPagosUsuario` (requeridos por la sección de suscripciones del panel Admin):
  - **Paginación de uso por usuario** (10 tests): ausencia de controles con ≤50 filas, aparición de controles con >50 filas, estado disabled de "Anterior" en página 1 y "Siguiente" en la última, visibilidad correcta de filas por página, navegación hacia adelante y hacia atrás, indicador "Página X de Y", reset a página 1 al filtrar por email, y reset a página 1 al limpiar filtros.
  - **Uso del Sistema** (12 tests): spinner mientras `fetchUsage` está pendiente, mensaje de error cuando `fetchUsage` falla, botón "Reintentar" visible en estado de error y que vuelve a llamar a `fetchUsage` y `fetchLimits`, mensaje "Sin datos" cuando `usageData` es null, período y conteo de usuarios básicos en la descripción de la tarjeta, cálculo correcto de `usado / (límite × usuariosBásicos)` con uno y con múltiples usuarios, subtexto "Límite: X/usuario" por herramienta, `0%` cuando no hay límite configurado, y que los usuarios inteligentes no se cuentan en el denominador del límite.
  - **Tarjeta de Usuarios Registrados** (3 tests): muestra `0` cuando `stats` es null, muestra el valor correcto de `totalUsers` cuando `stats` está disponible, y verifica que las tarjetas antiguas eliminadas ("Correos Registrados", "Promedio Empleados", "Promedio Eventos") ya no aparecen en el DOM.
  - **Programa de Referidos** (14 tests): título "Programa de Referidos" visible; tabs "Referidos" y "Vendedores"; estado vacío cuando no hay referidos; display de email del vendedor y del referido; badge "pendiente" para referido pendiente; sin botones de comisión/reembolso para referido pendiente; botones "Marcar pagada" y "Marcar procesado" para referido confirmado sin pagar; cada botón llama al handler correcto con el id del referido; badges "Pagada" y "Procesado" reemplazan a los botones cuando ya están marcados; tab "Vendedores" muestra mensaje vacío si no hay sellers; tab "Vendedores" muestra nombre, código y stats del seller; llamadas a `fetchSellers()` y `fetchReferidos()` en el montaje inicial del panel admin.

> **Atención al agregar un nuevo módulo:** este archivo debe actualizarse manualmente. Los objetos de prefs y restricciones esperados deben incluir la nueva clave, y cualquier mock de respuesta del endpoint `/api/modules/prefs` también debe incluirla — el hook valida que **todos** los módulos registrados en `MODULES` estén presentes en la respuesta, y si falta uno el test fallará silenciosamente (los prefs no se actualizan y se mantiene el valor por defecto). Los módulos actualmente registrados son: `calendario`, `personal`, `sueldos`, `compras` y `facturacion`.

### 2. Ejecutar tests en modo watch

```bash
npm run test:watch
```

Que verifica:
- Ejecuta la misma suite de Vitest en modo interactivo.
- Sirve para desarrollo mientras vas cambiando codigo.

### 3. Ejecutar tests con cobertura

```bash
npm run test:coverage
```

Que verifica:
- Ejecuta la suite de Vitest y genera reporte de cobertura.
- Sirve para ver que partes del codigo ya estan cubiertas y cuales faltan.

Estado actual:
- Con `npm install`, este comando ya funciona sin instalar dependencias adicionales manualmente.
- Cobertura global: **62.1% statements / 60.87% branches / 66.8% funciones / 64.46% líneas**.
- Módulos con cobertura 100%: `functions/[[route]].ts`, `src/worker/validation.ts`, `src/worker/rateLimitAuth.ts`, `src/worker/geminiCache.ts`, `useSellers.ts`, `useSuscripcion.ts`, `useChat.ts`, `api.ts`, `utils.ts`, `UsageBanner.tsx`, `ProtectedRoute.tsx` y todos los componentes UI.
- Módulos sin cobertura: `useAdmin.ts` (0%). Cobertura parcial: `Admin.tsx` (59.35% statements / 63.33% líneas), `Sellers.tsx` (90.47% statements / 90.62% branches).
- `useSuscripcion.ts` cubre 100% statements y 90.62% branches; las 3 ramas no cubiertas son fallbacks `?? null` en líneas 92, 107 y 125.

### 4. Ejecutar el linter

```bash
npm run lint
```

Que verifica:
- Reglas ESLint para TypeScript y React.
- Detecta problemas de calidad, patrones invalidos y errores comunes de hooks.

### 5. Ejecutar el build

```bash
npm run build
```

Que verifica:
- Typecheck con TypeScript.
- Build de produccion con Vite.
- Detecta errores de compilacion antes de publicar.

### 6. Ejecutar el check completo

```bash
npm run check
```

Que verifica:
- Compilacion TypeScript.
- Build de Vite.
- Dry-run de deploy con Wrangler para detectar problemas de configuracion o despliegue.

### 7. Buscar codigo sin usar

```bash
npm run knip
```

Que verifica:
- Detecta archivos, exports o dependencias sin uso.
- Sirve como chequeo complementario de mantenimiento.

## Nota sobre E2E

Actualmente el proyecto no tiene Playwright ni tests end-to-end configurados. Hoy la validacion automatica del repo se apoya en Vitest, ESLint, TypeScript, Vite, Wrangler dry-run y Knip.

## Resumen

Orden recomendado para validar rapido:

```bash
npm test
npm run lint
npm run build
```

Antes de desplegar:

```bash
npm run check
```

Chequeo adicional de mantenimiento:

```bash
npm run knip
```