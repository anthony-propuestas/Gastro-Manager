# Workflow de Documentación Post-Cambio

Ejecutar después de **cualquier** cambio de código antes de cerrar la tarea.

---

## Checklist rápida

- [ ] `docs/test.md` refleja el estado actual de tests
- [ ] `docs/security.md` documenta el impacto (o la ausencia de impacto) del cambio
- [ ] `docs/api.md` refleja endpoints nuevos, modificados o eliminados
- [ ] `docs/architecture.md` refleja cambios en middlewares, cuotas, módulos o flujos internos
- [ ] `docs/authentication.md` refleja cambios en el flujo de auth o sesiones
- [ ] `docs/database.md` refleja tablas nuevas o modificadas y migraciones aplicadas
- [ ] `docs/validation.md` refleja schemas Zod nuevos o modificados
- [ ] `docs/roles.md` refleja cambios en módulos restringibles o comportamiento de roles
- [ ] `docs/frontend.md` refleja rutas, páginas, hooks o componentes nuevos o eliminados
- [ ] `docs/agregar-nuevo-modulo.md` refleja cambios en el proceso de incorporar módulos
- [ ] `README.md` describe con precisión el estado actual del sistema

> Solo marcar los que aplican al cambio. Si un archivo no fue afectado, omitirlo.

---

## Paso 1 — Tests (`docs/test.md`)

Determinar qué cambió en la suite y actualizar `docs/test.md`:

| Situación | Acción |
|---|---|
| Tests nuevos | Agregar bullet bajo `npm test` con archivo y qué verifica |
| Tests modificados | Actualizar la entrada existente |
| Tests eliminados | Eliminar la entrada |
| Cobertura cambiada | Actualizar porcentajes en `npm run test:coverage` |
| Sin cambios en tests | Confirmar explícitamente que no aplica y pasar al Paso 2 |

**Formato de bullet:** mismo estilo que las entradas existentes en `docs/test.md`.

---

## Paso 2 — Seguridad (`docs/security.md`)

**Mentalidad:** asumir que el atacante conoce el código. Pensar en el peor caso concreto para cada área.

### 2a — Análisis obligatorio por área

Para cada área que toca el cambio, responder la pregunta de peor caso:

| Área | Pregunta de peor caso |
|---|---|
| **Endpoint nuevo o modificado** | ¿Qué pasa si se llama sin JWT, con JWT de otro negocio, o con payload malformado? ¿Devuelve datos? ¿Escribe en DB? |
| **Validación de entrada** | ¿Qué pasa si el campo llega vacío, nulo, con 10 MB de texto, o con caracteres especiales SQL/HTML? ¿Falla silenciosamente o explota? |
| **Aislamiento por `negocio_id`** | ¿Puede un usuario autenticado en el negocio A leer o escribir datos del negocio B con este cambio? |
| **Autenticación / sesión** | ¿Puede alguien sin cuenta acceder a algo que antes requería login? ¿Se puede reutilizar un token expirado o revocado? |
| **Autorización / roles** | ¿Puede un empleado ejecutar una acción que solo debería hacer el admin o el owner? |
| **Cuotas y rate limiting** | ¿Puede un usuario agotar recursos de otro negocio, o bypassear su propio límite con este cambio? |
| **Chatbot / historial** | ¿Puede el historial filtrar datos de otros negocios? ¿Se puede inyectar texto que altere el comportamiento del modelo? |
| **Panel admin** | ¿El cambio expone una acción de admin a usuarios normales? ¿Algún endpoint `/api/admin/*` quedó sin verificar `isAdmin()`? |

### 2b — Conclusión y documentación

Después del análisis:

- **Si hay riesgo:** describir el vector concreto, la mitigación implementada (o pendiente), y actualizar `docs/security.md`.
- **Si no hay riesgo:** escribir una línea explícita que indique qué áreas se revisaron y por qué no aplica. No omitir silenciosamente.

---

## Paso 3 — API (`docs/api.md`)

Actualizar solo si hubo cambios en endpoints:

| Situación | Acción |
|---|---|
| Endpoint nuevo | Agregar sección con método, ruta, auth, body y respuesta |
| Endpoint eliminado | Eliminar la sección y decrementar el total en "Notas Generales" |
| Cambio en request/response | Actualizar campos y ejemplos |
| Solo cambio de lógica interna (sin cambio de contrato) | No aplica |

Actualizar el contador `Total de endpoints` en la sección "Notas Generales" si cambió la cantidad.

---

## Paso 4 — Arquitectura (`docs/architecture.md`)

Actualizar si cambió alguno de estos elementos:

- **Middlewares** — nuevo middleware, nueva excepción, cambio en orden de ejecución
- **Módulos restringibles** — se agregó o quitó un módulo de `createModuleRestrictionMiddleware`
- **Sistema de cuotas** — nuevo endpoint que consume cuota, cambio en cuándo se consume (PUT/DELETE que antes no consumían)
- **Flujo de auth** — cambio en el diagrama de sesiones/JWT
- **Excepciones conocidas** — nuevo caso documentado en la tabla de excepciones de módulos

Si no cambió nada de lo anterior, no tocar el archivo.

---

## Paso 5 — Autenticación (`docs/authentication.md`)

Actualizar solo si cambió el flujo de autenticación:

- Nuevo paso en el diagrama de OAuth (login, verificación, logout)
- Cambio en cómo se genera o valida la cookie/JWT
- Cambio en cómo responde el backend en cada rama (verificado / no verificado)
- Nuevo endpoint de auth

Si el cambio fue solo en lógica de negocio (no en auth), no tocar el archivo.

---

## Paso 7 — Base de datos (`docs/database.md`)

Actualizar si cambió el schema de la base de datos:

| Situación | Acción |
|---|---|
| Tabla nueva (`migrations/N.sql`) | Agregar fila en la tabla de esquemas D1: nombre, propósito, columnas clave y número de migración |
| Columna agregada o eliminada | Actualizar la entrada existente de la tabla afectada |
| Tabla eliminada | Eliminar la entrada de la tabla en database.md |
| Solo cambio de lógica (sin DDL) | No aplica |

Si no hubo cambios de schema (ningún archivo `.sql` nuevo o modificado), no tocar el archivo.

---

## Paso 8 — Validaciones (`docs/validation.md`)

Actualizar si cambió `src/worker/validation.ts`:

| Situación | Acción |
|---|---|
| Schema Zod nuevo | Agregar entrada con nombre del schema, endpoint que lo usa, campos y constraints clave |
| Schema modificado (campos, reglas, mensajes) | Actualizar la entrada existente |
| Schema eliminado | Eliminar la entrada |
| Sin cambios en validation.ts | No aplica |

---

## Paso 9 — Roles y restricciones (`docs/roles.md`)

Actualizar si cambió el sistema de roles o el control de acceso a módulos:

| Situación | Acción |
|---|---|
| Nuevo módulo en `VALID_MODULE_KEYS` | Documentar el módulo en la sección de restricciones owner/gerente |
| Módulo eliminado de `VALID_MODULE_KEYS` | Eliminar la mención del módulo |
| Cambio en `createModuleRestrictionMiddleware` | Actualizar la descripción del comportamiento de restricción |
| Cambio en lógica de negocio sin afectar roles | No aplica |

---

## Paso 10 — Frontend (`docs/frontend.md`)

Actualizar si cambió la arquitectura de rutas, layout o estructura de hooks:

| Situación | Acción |
|---|---|
| Nueva página en `/pages/modulos/` | Documentar la ruta, el componente y el hook que consume |
| Ruta nueva o eliminada en `App.tsx` | Actualizar la lista de rutas |
| Hook de datos nuevo o eliminado | Actualizar la sección de hooks |
| Cambio en Sidebar o BottomNav (estructura, ítems) | Actualizar la descripción del layout |
| Cambio interno a un componente sin alterar rutas o layout | No aplica |

---

## Paso 11 — Guía de módulos (`docs/agregar-nuevo-modulo.md`)

Actualizar solo si cambió el **proceso estándar** de agregar un módulo:

| Situación | Acción |
|---|---|
| Nuevo paso obligatorio en el proceso (ej: nuevo archivo a tocar) | Agregar el paso al checklist y al paso a paso |
| Paso eliminado o fusionado | Eliminar o consolidar la sección correspondiente |
| Nuevo patrón de componente/hook que aplica a todos los módulos futuros | Actualizar el template del paso 8 o 9 |
| Cambio en el orden de middlewares en endpoints de módulo | Actualizar el ejemplo del paso 17 |
| Cambio específico a un módulo concreto (campos, lógica propia) | No aplica — la guía documenta el patrón genérico |

---

## Paso 12 — README (`README.md`)

Actualizar solo las secciones afectadas:

- **Características / Módulos** — si se agregó, modificó o eliminó un feature visible al usuario.
- **Stack tecnológico** — si cambió una dependencia principal.
- **Comandos NPM** — si se agregó o eliminó un comando.
- **Sistema de roles y cuotas** — si cambió el comportamiento de cuotas, límites o roles.
- **Versión y fecha** — si el cambio es significativo.

No tocar secciones que no fueron afectadas.
