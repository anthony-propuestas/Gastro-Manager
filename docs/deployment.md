# Despliegue y Configuración

Guía para configurar variables de entorno y desplegar la aplicación en Cloudflare Workers.

## Plataforma

**Cloudflare Workers** — Runtime serverless edge. El Worker sirve tanto el frontend React (SPA) como la API REST desde el mismo proceso. La base de datos es Cloudflare D1 (SQLite serverless).

---

## Variables de Entorno

Todas las variables se configuran manualmente. No hay ningún servicio externo que las inyecte automáticamente.

### Para desarrollo local (`.dev.vars`)

Crea un archivo `.dev.vars` en la raíz del proyecto:

```bash
# Google OAuth (obtener en https://console.cloud.google.com)
GOOGLE_CLIENT_ID=tu_google_client_id
GOOGLE_CLIENT_SECRET=tu_google_client_secret

# JWT Secret (genera con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_SECRET=string_hex_64_caracteres_aleatorio

# Google Gemini AI (obtener en https://aistudio.google.com)
GEMINI_API_KEY=tu_gemini_api_key

# Resend (obtener en https://resend.com)
RESEND_API_KEY=tu_resend_api_key

# Primer administrador del sistema
INITIAL_ADMIN_EMAIL=tu_email@gmail.com
```

### Para producción (Cloudflare Dashboard o Wrangler)

#### Via Wrangler CLI

```bash
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put JWT_SECRET
wrangler secret put GEMINI_API_KEY
wrangler secret put RESEND_API_KEY
wrangler secret put INITIAL_ADMIN_EMAIL
```

#### Via Cloudflare Dashboard

1. Ir a [dash.cloudflare.com](https://dash.cloudflare.com)
2. Workers & Pages → seleccionar worker `gastro-manager`
3. Settings → Variables and Secrets
4. Agregar cada variable como **Secret**

---

## Referencia de Variables

| Variable | Tipo | Descripción |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Secret | Client ID de Google OAuth app |
| `GOOGLE_CLIENT_SECRET` | Secret | Client Secret de Google OAuth |
| `JWT_SECRET` | Secret | Clave para firmar sesiones JWT (HS256) |
| `GEMINI_API_KEY` | Secret | API key para el chatbot IA (opcional) |
| `RESEND_API_KEY` | Secret | API key para enviar emails de verificación |
| `INITIAL_ADMIN_EMAIL` | Secret | Email del primer administrador |

**Notas:**
- `GEMINI_API_KEY` es opcional. Si no está configurada, el endpoint `/api/chat` devuelve error `API_KEY_MISSING`. El resto de la app funciona normalmente.
- `RESEND_API_KEY` es obligatoria para el flujo de verificación por correo. Si no está configurada, `POST /api/sessions` no podrá completar el alta/login de usuarios no verificados.

---

## Bindings de Cloudflare (`wrangler.json`)

```json
{
  "name": "gastro-manager",
  "main": "./src/worker/index.ts",
  "compatibility_date": "2025-06-17",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "gastro-manager-db",
      "database_id": "<tu-database-id>"
    }
  ],
  "r2_buckets": [
    {
      "binding": "R2_BUCKET",
      "bucket_name": "gastro-manager-files"
    }
  ]
}
```

**Acceso en código:**
```typescript
type Env = {
  DB: D1Database;
  R2_BUCKET: R2Bucket;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  JWT_SECRET: string;
  RESEND_API_KEY: string;
  INITIAL_ADMIN_EMAIL?: string;
  GEMINI_API_KEY?: string;
};
```

**Nota:** R2 se usa activamente en el módulo de **Compras** para almacenar comprobantes (imágenes de recibos). Los endpoints `POST /api/compras/upload` y `GET /api/compras/files/*` leen y escriben en este bucket.

---

## Migraciones de Base de Datos

Las migraciones SQL están en `migrations/` (archivos `1.sql` a `17.sql`). Son **inmutables** — una vez aplicadas no se modifican.

| Migración | Contenido |
|-----------|-----------|
| `1.sql` | Tablas `employees`, `topics`, `notes` |
| `2.sql` | Tabla `events` |
| `3.sql` | Columnas `due_date`/`due_time` en `topics` |
| `4.sql` | Columna `monthly_salary` en `employees` |
| `5.sql` | Tablas `advances`, `salary_payments` |
| `6.sql` | Tabla `job_roles` |
| `7.sql` | Tablas `admin_emails`, `usage_logs` |
| `8.sql` | Tablas `negocios`, `negocio_members`, `invitations` + `negocio_id` en tablas existentes |
| `9.sql` | Tabla `users` |
| `10.sql` | Tablas `usage_counters`, `usage_limits` con seed de límites |
| `11.sql` | Tabla `user_module_prefs` |
| `12.sql` | Columna `negocio_role` en `negocio_members`, tablas `owner_requests`, `negocio_module_restrictions` |
| `13.sql` | Tabla `compras` |
| `14.sql` | Tabla `facturas` |
| `15.sql` | Columnas `turno` y `pagos_detalle` en `facturas` |
| `16.sql` | Seeds de `usage_limits` para `compras` y `facturacion` |
| `17.sql` | Columna `email_verified` en `users` y tabla `email_verification_tokens` |

### Aplicar en desarrollo

```bash
# Aplicar todas las migraciones en DB local de desarrollo
wrangler d1 migrations apply gastro-manager-db --local
```

### Aplicar en producción

```bash
# Aplicar todas las migraciones en DB de producción
wrangler d1 migrations apply gastro-manager-db
```

### Crear nueva migración

Crear un nuevo archivo SQL numerado en `migrations/`, por ejemplo `18.sql`:

```sql
-- migrations/18.sql
ALTER TABLE employees ADD COLUMN nueva_columna TEXT;
```

---

## Desarrollo Local

### Iniciar servidor

```bash
npm run dev
```

Esto inicia Vite con el plugin de Cloudflare (`@cloudflare/vite-plugin`):
- Frontend React: `http://localhost:5173`
- API REST: mismo origen (no hay proxy separado)
- Base de datos: instancia D1 local de desarrollo

**Importante:** La base de datos de desarrollo es **completamente separada** de producción. Los datos locales no se transfieren al publicar.

### Hot Reload

- Archivos React: Hot Module Replacement (HMR) automático
- Archivos Worker: Reinicio del servidor dev automático

---

## Publicar a Producción

### Build

```bash
npm run build
```

Esto ejecuta:
1. TypeScript compilation (`tsc -b`)
2. Vite build (frontend)
3. Worker build (backend)

### Check pre-deploy

```bash
npm run check
```

Verifica que todo compile y hace un dry-run de Wrangler para detectar errores de configuración antes de publicar.

### Deploy

```bash
wrangler deploy
```

O via Cloudflare Dashboard: Workers & Pages → seleccionar worker → Deploy.

---

## Ambientes

| Ambiente | URL | Base de datos |
|---|---|---|
| Development | `http://localhost:5173` | D1 local (`.wrangler/`) |
| Production | `https://<worker>.workers.dev` | D1 producción |

---

## Configurar Google OAuth

Para que el login con Google funcione, la app debe estar registrada en Google Cloud Console:

1. Ir a [console.cloud.google.com](https://console.cloud.google.com)
2. APIs & Services → Credentials → Create OAuth 2.0 Client ID
3. Application type: **Web application**
4. Authorized redirect URIs:
   - Desarrollo: `http://localhost:5173/auth/callback`
   - Producción: `https://<tu-dominio>/auth/callback`
5. Copiar Client ID y Client Secret a las variables de entorno

---

## Monitoreo

### Logs en producción

```bash
# Stream de logs en tiempo real
wrangler tail
```

O via Cloudflare Dashboard: Workers & Pages → seleccionar worker → Logs.

### Métricas

Cloudflare Dashboard muestra:
- Requests/segundo
- CPU time usado
- Errores
- Latencia p50/p99

---

## Límites Free Tier de Cloudflare

| Recurso | Límite |
|---|---|
| Requests | 100,000/día |
| CPU time | 10ms/request |
| D1 Storage | 5GB |
| D1 Reads | 5M/día |
| D1 Writes | 100,000/día |

---

## Backup

> El sistema de copias de seguridad está automatizado vía GitHub Actions. Ver [Sistema de Backup](./backup.md) para la estrategia completa, procedimiento de restauración y consideraciones de seguridad.

Para exportar manualmente la base de datos en desarrollo:

```bash
wrangler d1 export [nombre-db] --local --output backup-dev.sql
```

---

## Secrets de CI/CD (GitHub Actions)

El workflow de backup automático requiere 4 secrets configurados en el repositorio (Settings → Secrets and variables → Actions):

| Secret | Propósito |
|---|---|
| `CF_API_TOKEN` | Autenticar wrangler (exportar D1 + subir a R2) |
| `CF_ACCOUNT_ID` | Identificar la cuenta Cloudflare |
| `CF_R2_ACCESS_KEY` | Access Key ID para rclone (API S3-compatible de R2) |
| `CF_R2_SECRET_KEY` | Secret Access Key para rclone |

---

## Troubleshooting

### "Auth error al hacer login"

- Verificar `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` están configurados
- Verificar que `http://localhost:5173/auth/callback` (dev) o la URL de producción están en los Authorized redirect URIs de Google Cloud

### "Secreto no definido en runtime"

- Verificar que el secret está configurado en Cloudflare Dashboard o con `wrangler secret put`
- El nombre es case-sensitive — debe coincidir exactamente con el tipo `Env` en `index.ts`

### "Migración fallida"

1. Hacer rollback via Cloudflare Dashboard → Workers → Deployments → previous version
2. Corregir la migración (crear nueva, no editar)
3. Volver a publicar

---

## Checklist de Despliegue

Antes de publicar cambios importantes:

- [ ] Código compila sin errores (`npm run check`)
- [ ] Migraciones nuevas creadas (si hay cambios de schema)
- [ ] Secrets configurados en producción
- [ ] Cambios testeados en desarrollo
- [ ] Documentación actualizada
- [ ] Versión anterior estable (para rollback si es necesario)
