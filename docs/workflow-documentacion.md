# Workflow de Documentación Post-Cambio

Ejecutar después de **cualquier** cambio de código antes de cerrar la tarea.

---

## Checklist rápida

- [ ] `docs/test.md` refleja el estado actual de tests
- [ ] `docs/security.md` documenta el impacto (o la ausencia de impacto) del cambio
- [ ] `README.md` describe con precisión el estado actual del sistema

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

## Paso 3 — README (`README.md`)

Actualizar solo las secciones afectadas:

- **Características / Módulos** — si se agregó, modificó o eliminó un feature visible al usuario.
- **Stack tecnológico** — si cambió una dependencia principal.
- **Comandos NPM** — si se agregó o eliminó un comando.
- **Sistema de roles y cuotas** — si cambió el comportamiento de cuotas, límites o roles.
- **Versión y fecha** — si el cambio es significativo.

No tocar secciones que no fueron afectadas.
