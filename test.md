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
- `src/react-app/lib/api.test.ts`: verifica que `apiFetch` agregue `X-Negocio-ID` cuando corresponde.
- `src/worker/validation.test.ts`: verifica schemas Zod y el helper `validateData`.
- `src/react-app/components/UsageBanner.test.tsx`: verifica cuando el banner no aparece, cuando avisa y cuando marca limite alcanzado.
- `src/react-app/components/auth/ProtectedRoute.test.tsx`: verifica loading y redirecciones de rutas protegidas.
- `src/react-app/hooks/useModulePrefs.test.ts`: verifica carga de preferencias, restricciones y update optimista con rollback.

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