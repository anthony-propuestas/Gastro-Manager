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

Cobertura actual:
- `src/react-app/lib/api.test.ts`: verifica que `apiFetch` agregue `X-Negocio-ID` cuando corresponde y que dispare el evento global `USAGE_LIMIT_EVENT` cuando el backend responde `429 USAGE_LIMIT_EXCEEDED`.
- `src/worker/validation.test.ts`: verifica schemas Zod y el helper `validateData`. Cubre los schemas de creación y actualización de todas las entidades: empleados, job roles, negocios, tópicos, notas, adelantos, pagos de sueldo, compras y facturación. Valida tipos enum, rangos de monto, formatos de fecha y hora, campos requeridos y fallbacks de error. Actualmente deja `src/worker/validation.ts` con cobertura completa.
- `src/react-app/components/UsageBanner.test.tsx`: verifica cuando el banner no aparece, cuando avisa y cuando marca limite alcanzado.
- `src/react-app/components/ErrorBoundary.test.tsx`: verifica que renderiza hijos sin error, muestra UI de error por defecto o fallback personalizado al capturar excepciones, y que el botón "Intentar de nuevo" restaura el estado limpio.
- `src/react-app/context/UsageLimitModalContext.test.tsx`: verifica el modal global de upgrade por límite. Cubre apertura al recibir `USAGE_LIMIT_EVENT`, renderizado del contenido dinámico, cierre con tecla `Escape`, cierre por click en el backdrop y restauración del `overflow` del `body`.
- `src/react-app/hooks/useSidebar.test.tsx`: verifica estado inicial, toggles de isOpen e isCollapsed, cierre del menú mobile al hacer resize a ≥1024px, y error al usar el hook fuera del Provider.
- `src/react-app/components/auth/ProtectedRoute.test.tsx`: verifica loading y redirecciones de rutas protegidas.
- `src/react-app/hooks/useModulePrefs.test.ts`: verifica carga de preferencias, restricciones y update optimista con rollback. Cubre los módulos `calendario`, `personal`, `sueldos`, `compras` y `facturacion`.
- `src/react-app/hooks/useChat.test.ts`: verifica el hook del chatbot. Cubre: estado inicial vacío, que mensajes vacíos o con solo espacios no disparen la API, que el primer mensaje envíe `history: []`, que los mensajes siguientes incluyan el intercambio previo como historial, que el rol `assistant` se mapee a `model` (formato requerido por Gemini), que el historial se corte a 20 items, manejo de errores de API y de red, reset de `isLoading` en ambos casos, `clearMessages`, y propagación del id del negocio a `apiFetch`.
- `src/react-app/pages/Admin.test.tsx`: verifica la paginación de la tabla "Uso por Usuario" en el panel de administración. Cubre: ausencia de controles con ≤50 filas, aparición de controles con >50 filas, estado disabled de "Anterior" en página 1 y "Siguiente" en la última, visibilidad correcta de filas por página, navegación hacia adelante y hacia atrás, indicador "Página X de Y", y reset a página 1 al filtrar por email o al limpiar filtros.

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
- La cobertura actual verificada del repo es 96.34% en statements y 92.3% en branches.
- `src/worker/validation.ts` quedo en 100% de statements, branches, funciones y lineas.

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