# Auditoría: Documentación vs Código — Sistema de Backup

Comparación entre lo que describe `docs/backup.md` y lo que ejecuta `.github/workflows/backup.yml`. Objetivo: detectar inconsistencias, comportamientos no documentados y riesgos.

**Fecha de auditoría:** 2026-04-07
**Archivos analizados:**
- Documentación: `docs/backup.md`
- Código: `.github/workflows/backup.yml`

---

## Resumen Ejecutivo

| Severidad | Cantidad | Descripción |
|---|---|---|
| 🔴 Crítica | 1 | Comportamiento real opuesto a lo documentado |
| 🟡 Menor | 5 | Detalles de implementación no documentados |

---

## 🔴 Diferencia Crítica

### 1. Propagación de borrados en el backup de R2

**Lo que dice la documentación (`backup.md`, sección "Componente 2 — Archivos (R2)"):**

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

La opción B es la más honesta si el objetivo es tener una réplica del estado actual. La opción A es mejor si el objetivo es conservar comprobantes incluso después de borrarlos.

---

## 🟡 Diferencias Menores

### 2. Flag `--s3-no-check-bucket` no documentado

**En el código:**
```yaml
--s3-no-check-bucket
```

**En la documentación:** no mencionado.

**Por qué importa:** Este flag le indica a rclone que no intente verificar ni crear el bucket antes de operar. Sin él, rclone haría una llamada de verificación que requeriría permisos de administrador de bucket (no solo Object Read & Write). Al documentar los permisos mínimos requeridos, omitir este flag puede llevar a errores de autenticación si alguien replica la configuración sin incluirlo.

---

### 3. Flag `--verbose` en rclone no documentado

**En el código:**
```yaml
--verbose
```

**En la documentación:** no mencionado.

**Por qué importa:** `--verbose` imprime una línea de log por cada archivo sincronizado. Si el bucket de producción tiene cientos o miles de comprobantes, los logs del job pueden volverse muy extensos, dificultando la detección de errores reales entre el ruido. No es un problema de comportamiento, pero sí afecta la operabilidad del sistema.

---

### 4. Distinción entre nombre de secret y variable de entorno de wrangler

**En el código:**
```yaml
env:
  CLOUDFLARE_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
  CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CF_ACCOUNT_ID }}
```

**En la documentación:** solo se mencionan los nombres de los secrets de GitHub (`CF_API_TOKEN`, `CF_ACCOUNT_ID`), sin explicar que wrangler los consume bajo nombres de variable de entorno distintos (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`).

**Por qué importa:** Si alguien quiere depurar un fallo de autenticación de wrangler, buscará la variable `CLOUDFLARE_API_TOKEN` en los logs pero en la documentación solo verá `CF_API_TOKEN`. La tabla de secrets en `backup.md` es correcta para el repositorio de GitHub, pero incompleta para entender cómo el workflow los consume internamente.

---

### 5. Instalación de rclone vía script externo no auditado

**En el código:**
```yaml
run: curl https://rclone.org/install.sh | sudo bash
```

**En la documentación:** no mencionado.

**Por qué importa:** Este patrón (`curl | bash`) descarga y ejecuta con privilegios de superusuario un script de internet sin verificación de integridad (sin checksum ni firma). Es una práctica con implicaciones de seguridad en entornos CI/CD: si el servidor de rclone fuera comprometido o si hubiera un ataque de tipo man-in-the-middle, el script podría ejecutar código arbitrario en el runner.

Alternativa más segura documentada por GitHub Actions: usar una action oficial de rclone o instalar desde una release específica con checksum verificado.

Riesgo actual: bajo (Cloudflare Workers runners son efímeros y desechados tras cada job), pero vale la pena documentarlo como decisión consciente.

---

### 6. Node.js 20 con advertencia de deprecación activa

**En el código:**
```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20'
```

**En la documentación:** no mencionado.

**Contexto:** GitHub Actions ha emitido una advertencia oficial:
- Node.js 20 se eliminará de los runners el **16 de septiembre de 2026**.
- A partir del **2 de junio de 2026**, Node.js 24 será el runtime predeterminado.

**Impacto:** El workflow seguirá funcionando hasta septiembre de 2026, pero emitirá advertencias en cada ejecución desde junio. Después de esa fecha fallará si no se actualiza la versión.

**Corrección recomendada:** Cambiar `node-version: '20'` a `node-version: '22'` o `'24'` en el workflow, y probarlo antes de la fecha límite.

---

## Tabla de Concordancia Global

| Aspecto documentado | Código real | Estado |
|---|---|---|
| Frecuencia: diaria a las 03:00 UTC | `cron: '0 3 * * *'` | ✅ Correcto |
| Dos jobs independientes en paralelo | Dos jobs sin `needs:` | ✅ Correcto |
| Herramienta D1: `wrangler d1 export` | `wrangler d1 export ... --remote` | ✅ Correcto |
| Destino del SQL: `/backups/d1/YYYY-MM-DD/` | `backups/d1/${DATE}/gastro-manager-db.sql` | ✅ Correcto |
| Herramienta R2: `rclone sync` | `rclone sync` | ✅ Correcto |
| Archivos borrados en prod **permanecen** en backup | `rclone sync` **los borra** | 🔴 Incorrecto |
| 4 secrets requeridos | 4 variables referenciadas | ✅ Correcto |
| Ejecución manual disponible | `workflow_dispatch` | ✅ Correcto |
| Flag `--s3-no-check-bucket` | Presente en código | 🟡 No documentado |
| Flag `--verbose` | Presente en código | 🟡 No documentado |
| Mapeo secret → variable de entorno wrangler | Implícito en el `env:` del step | 🟡 No documentado |
| Instalación de rclone vía `curl \| bash` | Presente en código | 🟡 No documentado |
| Versión Node.js con deprecación próxima | `node-version: '20'` | 🟡 No documentado |

---

## Acciones Recomendadas

### Prioritaria (antes de la próxima ejecución)

1. **Decidir el comportamiento de borrados en R2 y corregir código o documentación según la decisión.** La documentación actual genera una expectativa falsa de que los comprobantes borrados quedan protegidos en el backup.

### A corto plazo (antes de junio 2026)

2. **Actualizar `node-version` de `'20'` a `'22'`** en el workflow para evitar warnings y prepararse para la deprecación.

### Mejora de documentación

3. Documentar la flag `--s3-no-check-bucket` en la sección de permisos requeridos de R2.
4. Agregar una nota sobre el mapeo `CF_API_TOKEN` → `CLOUDFLARE_API_TOKEN` en la tabla de secrets.
5. Registrar la decisión de usar `curl | bash` para instalar rclone como decisión consciente, o reemplazarlo por una alternativa con verificación de integridad.
