# Auditoría: Documentación vs Código — Sistema de Backup

Comparación entre lo que describe `docs/backup.md` y lo que ejecuta `.github/workflows/backup.yml`. Objetivo: detectar inconsistencias, comportamientos no documentados y riesgos.

**Fecha de auditoría:** 2026-04-07
**Última actualización:** 2026-04-28
**Archivos analizados:**
- Documentación: `docs/backup.md`
- Código: `.github/workflows/backup.yml`

---

## Resumen Ejecutivo

| Severidad | Cantidad | Descripción |
|---|---|---|
| ✅ Resuelto | 5 | Todos los hallazgos corregidos en `backup.md` |

## Estado actual

**2026-04-28 — Auditoría cerrada.** Todos los hallazgos detectados el 2026-04-07 han sido corregidos en `docs/backup.md`:

- El hallazgo crítico original (propagación de borrados) fue el primero en resolverse.
- Los cuatro hallazgos menores (flags no documentados, mapeo de secrets, instalación de rclone, versión de Node.js) también están documentados en `backup.md` en la sección "Detalles de Implementación" y en la tabla de secrets.

Este documento se conserva como registro histórico completo de la auditoría.

---

## Hallazgo histórico resuelto

### 1. Propagación de borrados en el backup de R2

**Lo que decía la documentación en el momento de la auditoría (`backup.md`, sección "Componente 2 — Archivos (R2)"):**

> "Si un archivo es eliminado en producción, **permanece en el backup** (no se propaga el borrado)."

**Lo que hace el código (`backup.yml`, job `backup-r2`):**

```yaml
rclone sync \
  :s3:[bucket-produccion]/compras \
  :s3:[bucket-backup]/compras \
  ...
```

**El problema:**

`rclone sync` hace que el destino sea una réplica exacta del origen. Esto incluye **propagar los borrados**: si un archivo existe en el bucket de backup pero ya no existe en producción, `rclone sync` lo eliminará del backup en la próxima ejecución.

El comportamiento documentado correspondería a `rclone copy`, que solo copia objetos nuevos o modificados sin tocar los que ya no existen en el origen.

**Implicación práctica:**

Cuando un usuario elimina una compra desde la app (`DELETE /api/compras/:id`), el worker borra el archivo del bucket de producción. En el siguiente backup nocturno, `rclone sync` también lo borrará del bucket de backup. El archivo queda sin respaldo desde ese momento.

**Opciones de corrección:**

| Opción | Comando | Consecuencia |
|---|---|---|
| A — Cambiar a `copy` | `rclone copy` | Los archivos borrados en producción se conservan en backup indefinidamente (bucket crece sin límite) |
| B — Mantener `sync` y corregir la documentación | Sin cambio de código | El backup de archivos refleja el estado actual de producción, no un historial |
| C — Agregar `--backup-dir` | `rclone sync --backup-dir [ruta]` | Los archivos borrados se mueven a un directorio de historial en lugar de eliminarse |

La opción B fue la adoptada posteriormente en la documentación principal: hoy `backup.md` ya deja explícito que el backup de archivos es una réplica del estado actual y no un historial.

---

## Hallazgos menores — todos resueltos

### 2. Flag `--s3-no-check-bucket` no documentado ✅ Resuelto

Documentado en `backup.md` (sección "Componente 2 — Archivos (R2) → Permisos requeridos").

---

### 3. Flag `--verbose` en rclone no documentado ✅ Resuelto

Documentado en `backup.md` (sección "Detalles de Implementación → Logs de rclone"), incluyendo la recomendación de usar `--stats-one-line` para reducir verbosidad.

---

### 4. Distinción entre nombre de secret y variable de entorno de wrangler ✅ Resuelto

Documentado en `backup.md` (tabla de "Secrets de GitHub Actions" con columna "Variable de entorno usada internamente" y nota de implementación sobre el mapeo).

---

### 5. Instalación de rclone vía script externo no auditado ✅ Resuelto

Documentado en `backup.md` (sección "Detalles de Implementación → Instalación de rclone") como decisión consciente de simplicidad sobre verificación de integridad.

---

### 6. Node.js 20 con advertencia de deprecación activa ✅ Resuelto

Documentado en `backup.md` (sección "Detalles de Implementación → Versión de Node.js") con la fecha límite del 16 de septiembre de 2026 y la acción requerida.

---

## Tabla de Concordancia Global

| Aspecto documentado | Código real | Estado |
|---|---|---|
| Frecuencia: diaria a las 03:00 UTC | `cron: '0 3 * * *'` | ✅ Correcto |
| Dos jobs independientes en paralelo | Dos jobs sin `needs:` | ✅ Correcto |
| Herramienta D1: `wrangler d1 export` | `wrangler d1 export ... --remote` | ✅ Correcto |
| Destino del SQL: `/backups/d1/YYYY-MM-DD/` | `backups/d1/${DATE}/gastro-manager-db.sql` | ✅ Correcto |
| Herramienta R2: `rclone sync` | `rclone sync` | ✅ Correcto |
| `backup.md` actual documenta propagación de borrados | `rclone sync` **los borra** | ✅ Correcto |
| 4 secrets requeridos | 4 variables referenciadas | ✅ Correcto |
| Ejecución manual disponible | `workflow_dispatch` | ✅ Correcto |
| Flag `--s3-no-check-bucket` | Presente en código | ✅ Documentado en `backup.md` |
| Flag `--verbose` | Presente en código | ✅ Documentado en `backup.md` |
| Mapeo secret → variable de entorno wrangler | Implícito en el `env:` del step | ✅ Documentado en `backup.md` |
| Instalación de rclone vía `curl \| bash` | Presente en código | ✅ Documentado en `backup.md` |
| Versión Node.js con deprecación próxima | `node-version: '20'` | ✅ Documentado en `backup.md` |

---

## Acciones completadas

| Acción | Estado |
|---|---|
| Actualizar `node-version: '20'` → `'22'` o superior antes de septiembre 2026 | ⏳ Pendiente en código (documentado en `backup.md`) |
| Agregar en `backup.md` nota sobre mapeo `CF_API_TOKEN` → `CLOUDFLARE_API_TOKEN` | ✅ Hecho |
| Registrar decisión de `curl \| bash` como elección consciente en `backup.md` | ✅ Hecho |
