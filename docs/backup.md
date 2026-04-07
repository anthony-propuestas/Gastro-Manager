# Sistema de Backup

Estrategia de copias de seguridad automatizadas para los datos estructurados y archivos del sistema.

---

## Visión General

El sistema tiene dos componentes independientes que se respaldan por separado:

| Componente | Qué contiene | Tecnología de backup |
|---|---|---|
| Base de datos (D1) | 19 tablas: usuarios, negocios, empleados, sueldos, compras, etc. | `wrangler d1 export` → SQL |
| Archivos (R2) | Imágenes de comprobantes de compras | `rclone sync` → bucket de backup |

**Frecuencia:** Diaria, automática, a las 03:00 UTC.

**Ventana máxima de pérdida de datos (RPO):** 24 horas.

---

## Arquitectura

```
[GitHub Actions — cron diario 03:00 UTC]
        │
        ├── Job: Backup D1
        │       │
        │       ├── wrangler d1 export → backup-YYYY-MM-DD.sql
        │       └── wrangler r2 object put → [R2 producción]/backups/d1/YYYY-MM-DD/
        │
        └── Job: Backup R2
                │
                └── rclone sync
                        [R2 producción]/compras/
                            → [R2 backup]/compras/
```

Los dos jobs corren **en paralelo** y son independientes. El fallo de uno no cancela el otro.

---

## Componente 1 — Base de Datos (D1)

### Herramienta

`wrangler d1 export` — genera un dump SQL completo y portátil.

### Formato de salida

Archivo `.sql` estándar SQLite. Contiene `CREATE TABLE` y `INSERT` para todas las tablas. Restaurable en cualquier instancia D1 o SQLite local sin herramientas propietarias.

### Destino

Almacenado dentro del mismo bucket R2 de producción, bajo el prefijo `/backups/d1/YYYY-MM-DD/`. Esto separa los backups de los archivos operativos sin necesitar infraestructura adicional.

### Retención recomendada

Configurar una **Lifecycle Rule** en el bucket R2 para eliminar automáticamente objetos bajo el prefijo `/backups/d1/` con más de 30 días de antigüedad.

> **Pasos:** Cloudflare Dashboard → R2 → bucket de producción → Settings → Object Lifecycle → Add Rule → Prefix: `backups/d1/` → Expiry: 30 días.

### Permisos requeridos

El token de Cloudflare usado en CI/CD necesita:

| Permiso | Nivel | Por qué |
|---|---|---|
| D1: Edit | Account | `d1 export` crea un job de exportación (operación de escritura interna) |
| Workers R2 Storage: Edit | Account | Subir el `.sql` generado al bucket |

> **Nota:** El permiso D1 debe ser **Edit**, no Read. Aunque solo se lee la base de datos, la API de export internamente crea un job temporal que requiere permisos de escritura.

---

## Componente 2 — Archivos (R2)

### Herramienta

`rclone sync` en modo S3-compatible — sincroniza objetos entre dos buckets R2.

### Qué sincroniza

La carpeta `/compras/` del bucket de producción, que contiene todas las imágenes de comprobantes subidas por los negocios. Estructura: `compras/{negocio_id}/{uuid}.{ext}`.

### Comportamiento

- **Réplica exacta:** el bucket de backup refleja el estado actual del bucket de producción en todo momento.
- **Incremental en adiciones:** solo transfiere archivos nuevos o modificados; no re-sube todo en cada ejecución.
- **Propaga borrados:** si un archivo es eliminado en producción, `rclone sync` también lo elimina del bucket de backup en la siguiente ejecución nocturna. El backup de archivos no es un historial — es una réplica del estado actual.

> **Implicación:** al eliminar una compra desde la app, el worker borra el comprobante del bucket de producción. En el siguiente backup nocturno, ese archivo también desaparece del bucket de backup. La protección cubre pérdidas accidentales de infraestructura, no borrados intencionales desde la aplicación.

### Permisos requeridos

Token R2 S3-compatible (generado en R2 → Manage R2 API Tokens) con acceso Object Read & Write a ambos buckets.

El comando usa la flag `--s3-no-check-bucket` para evitar que rclone intente verificar o crear los buckets antes de operar. Sin esta flag, rclone haría una llamada de verificación que requiere permisos de administrador de bucket — más de lo que Object Read & Write otorga. Con la flag, los permisos mínimos son suficientes.

### Limitación conocida

Los objetos R2 existentes **antes** de activar el sistema de backup no se copian automáticamente en la primera ejecución de `rclone sync`. Solo los objetos nuevos o modificados a partir de la activación quedan cubiertos.

Para migrar objetos históricos hay que ejecutar el job manualmente una vez eliminando el filtro de fechas, o aceptar que el historial previo no tiene backup de archivos.

---

## Secrets de GitHub Actions

El workflow requiere 4 secrets configurados en el repositorio (Settings → Secrets and variables → Actions):

| Secret GitHub | Variable de entorno usada internamente | Propósito | Cómo obtenerlo |
|---|---|---|---|
| `CF_API_TOKEN` | `CLOUDFLARE_API_TOKEN` | Autenticar wrangler para export D1 y upload R2 | Cloudflare → My Profile → API Tokens → Custom Token (D1: Edit + R2: Edit) |
| `CF_ACCOUNT_ID` | `CLOUDFLARE_ACCOUNT_ID` | Identificar la cuenta Cloudflare en wrangler | Cloudflare Dashboard → Overview → Account ID |
| `CF_R2_ACCESS_KEY` | `--s3-access-key-id` (rclone) | Access Key ID para rclone (S3-compatible) | R2 → Manage R2 API Tokens → Account token → Object Read & Write |
| `CF_R2_SECRET_KEY` | `--s3-secret-access-key` (rclone) | Secret Access Key para rclone (S3-compatible) | Mismo token que el anterior (se muestra una sola vez) |

> **Nota de implementación:** wrangler no lee los secrets directamente por su nombre de GitHub. El workflow los mapea explícitamente a las variables de entorno que wrangler espera (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`). Al depurar errores de autenticación de wrangler, buscar estas variables de entorno en los logs, no los nombres de los secrets.

> Los valores de estos secrets **nunca aparecen en el código fuente**. El archivo `.github/workflows/backup.yml` solo referencia sus nombres (`${{ secrets.CF_API_TOKEN }}`).

---

## Ejecución Manual

Para verificar o ejecutar el backup fuera del horario programado:

1. Ir al repositorio en GitHub → pestaña **Actions**
2. Seleccionar **"Backup Gastro Manager"**
3. Botón **"Run workflow"** → **"Run workflow"**

Los dos jobs aparecerán en ejecución. El resultado se puede ver en los logs de cada job.

---

## Procedimiento de Restauración

### Restaurar la base de datos

```bash
# 1. Descargar el backup desde R2 (via Cloudflare Dashboard o wrangler)
wrangler r2 object get [bucket-produccion]/backups/d1/YYYY-MM-DD/[nombre-db].sql \
  --file backup-restaurar.sql

# 2. Verificar integridad del archivo antes de restaurar
sqlite3 test-restore.db < backup-restaurar.sql
sqlite3 test-restore.db ".tables"
# Debe mostrar las 19 tablas del sistema

# 3. Aplicar en producción (⚠️ sobreescribe datos actuales)
wrangler d1 execute [nombre-db] --remote --file backup-restaurar.sql
```

> **⚠️ Advertencia:** El comando `d1 execute` en producción sobreescribe los datos existentes. Ejecutar solo en caso de pérdida confirmada de datos. Si la base de datos tiene datos parciales válidos, evaluar primero qué tablas restaurar.

### Restaurar archivos de comprobantes

```bash
# Sincronizar de vuelta desde el bucket de backup a producción
rclone sync \
  :s3:[bucket-backup]/compras \
  :s3:[bucket-produccion]/compras \
  --s3-provider Cloudflare \
  --s3-access-key-id [CF_R2_ACCESS_KEY] \
  --s3-secret-access-key [CF_R2_SECRET_KEY] \
  --s3-endpoint https://[CF_ACCOUNT_ID].r2.cloudflarestorage.com
```

---

## Verificación Post-Backup

Después de cada ejecución del workflow, verificar:

1. **En GitHub Actions:** ambos jobs muestran ✅ verde.
2. **En R2 (Cloudflare Dashboard):** existe un objeto en `backups/d1/YYYY-MM-DD/` con la fecha del día.
3. **Integridad del SQL** (opcional, periódico):
   ```bash
   wrangler r2 object get [bucket-produccion]/backups/d1/YYYY-MM-DD/[nombre-db].sql \
     --file test.sql
   sqlite3 test.db < test.sql && sqlite3 test.db ".tables"
   ```

---

## Consideraciones de Seguridad

- **El archivo `.sql` contiene datos sensibles** (información de negocios, empleados, etc.). No descargarlo en equipos sin cifrado en reposo ni enviarlo por canales no seguros.
- **El bucket de backup debe tener acceso restringido.** No habilitar acceso público. El token R2 de backup tiene permisos de Object Read & Write, no Admin.
- **Rotación de tokens:** si se compromete alguno de los 4 secrets, revocar el token en Cloudflare y generar uno nuevo antes de actualizar el secret en GitHub.
- **Los secrets de GitHub** están encriptados en reposo y solo son inyectados en memoria durante la ejecución del workflow. No aparecen en los logs.

---

## Detalles de Implementación

### Logs de rclone

El job de backup R2 corre rclone con `--verbose`, lo que imprime una línea por cada archivo procesado. Si el bucket de producción tiene muchos comprobantes, los logs del job en GitHub Actions pueden ser extensos. Esto no afecta el funcionamiento, pero puede dificultar encontrar errores entre el output. Para reducir verbosidad, se puede cambiar a `--stats-one-line` o eliminar el flag.

### Instalación de rclone

El workflow instala rclone en cada ejecución mediante:

```bash
curl https://rclone.org/install.sh | sudo bash
```

Este patrón descarga y ejecuta un script externo sin verificación de checksum. Es aceptable dado que los runners de GitHub Actions son entornos efímeros y descartados tras cada job, lo que limita el impacto potencial. Es una decisión consciente de simplicidad sobre verificación de integridad.

### Versión de Node.js

El job `backup-d1` usa Node.js 20 para ejecutar wrangler. GitHub Actions eliminará Node.js 20 de sus runners el **16 de septiembre de 2026** (advertencias activas desde junio 2026). Antes de esa fecha se debe actualizar `node-version: '20'` a `'22'` o superior en el workflow.

---

## Limitaciones Conocidas

| Limitación | Impacto | Mitigación |
|---|---|---|
| RPO de 24 horas | Pérdida máxima de 1 día de datos | Aceptable para el volumen actual; aumentar frecuencia si crece |
| Backup de archivos es réplica, no historial | Los borrados en producción se propagan al backup | El backup D1 conserva los metadatos; evaluar `rclone copy` si se necesita historial de archivos |
| Backup en el mismo proveedor | Un fallo total de Cloudflare afecta producción y backup simultáneamente | Bajo riesgo; evaluar backup offsite si el sistema es crítico |
| Archivos R2 previos a la activación | Comprobantes anteriores a la primera ejecución no están en el bucket de backup | Los metadatos sí están en el backup D1 |
| Sin backup de `wrangler.json` ni código | Pérdida de configuración de infraestructura | El código y `wrangler.json` están en el repositorio Git |
