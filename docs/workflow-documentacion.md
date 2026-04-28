# Workflow de Documentación Post-Cambio

Seguir este documento paso a paso después de cualquier cambio de código.

---

## Paso 1 — Tests

Revisar qué ocurrió con los tests como consecuencia del cambio:

- **Si se crearon tests nuevos**: listar qué archivo(s) y qué casos cubre cada uno.
- **Si se modificaron tests existentes**: describir qué cambió y por qué.
- **Si se eliminaron tests**: indicar cuáles y el motivo.
- **Si no hubo cambios en tests**: confirmar explícitamente que no aplica.

---

## Paso 2 — Documentar tests en `docs/test.md`

Actualizar `docs/test.md` según lo relevado en el Paso 1:

- Agregar entradas para tests nuevos bajo la sección del comando `npm test`, con el mismo formato de bullet que tienen las entradas existentes.
- Actualizar entradas existentes si cambió lo que verifican.
- Eliminar entradas de tests que ya no existen.
- Actualizar los porcentajes de cobertura en la sección `npm run test:coverage` si cambiaron.
- **No tocar** secciones que no fueron afectadas por el cambio.

---

## Paso 3 — Analizar y documentar en `docs/security.md`

Analizar el cambio desde la perspectiva de seguridad y actualizar `docs/security.md`:

Preguntas a responder antes de escribir:
- ¿El cambio introduce una nueva superficie de ataque?
- ¿Modifica validación de entrada, autenticación, autorización o manejo de cuotas?
- ¿Expone datos de un negocio a otro?
- ¿Agrega o elimina una mitigación existente?
- ¿Cambia el comportamiento de algún riesgo listado en la tabla de superficie de ataque?

Actualizar según corresponda:
- Agregar o modificar la sección temática relevante (Autenticación, Autorización, Cuotas, Chatbot, Validación, etc.).
- Actualizar la tabla **Superficie de ataque conocida y mitigaciones** si el riesgo o la mitigación cambiaron.
- Actualizar la sección **Tests de seguridad relevantes** si se agregaron o eliminaron tests con impacto en seguridad.
- Si el cambio no tiene impacto de seguridad, confirmar explícitamente que se revisó y no aplica.

---

## Paso 4 — Documentar en `README.md`

Actualizar `README.md` para reflejar el estado actual del proyecto:

- **Características / Módulos**: si se agregó, modificó o eliminó un módulo o feature visible al usuario.
- **Stack tecnológico**: si cambió alguna dependencia principal.
- **Comandos NPM**: si se agregó o eliminó un comando.
- **Sistema de roles y cuotas**: si cambió el comportamiento de cuotas, límites o roles.
- **Sección de Seguridad** (resumen al pie): si cambió alguna capa de seguridad relevante.
- **Versión y fecha**: actualizar la línea final si el cambio es significativo.
- **No tocar** secciones que no fueron afectadas por el cambio.

---

## Criterio de completitud

El workflow está completo cuando:
1. `docs/test.md` refleja el estado actual de la suite de tests.
2. `docs/security.md` documenta el impacto (o la ausencia de impacto) del cambio en la postura de seguridad.
3. `README.md` describe con precisión el estado actual del sistema.
