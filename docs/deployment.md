# Despliegue y Configuración

Guía para configurar variables de entorno, secretos y desplegar la aplicación.

## Plataforma

**Mocha** - Plataforma de desarrollo de aplicaciones basada en Cloudflare Workers.

### Características
- Despliegue automático a Cloudflare Edge
- Base de datos D1 administrada
- Autenticación integrada
- Gestión de secretos
- Versionado de aplicaciones

## Variables de Entorno

### Auto-inyectadas por Mocha

Estas variables están disponibles automáticamente en el entorno de ejecución:

#### `MOCHA_USERS_SERVICE_API_URL`
- **Tipo:** String (URL)
- **Descripción:** URL del servicio de autenticación de Mocha
- **Uso:** Autenticación OAuth
- **Configuración:** Automática, no requiere acción

#### `MOCHA_USERS_SERVICE_API_KEY`
- **Tipo:** String (API Key)
- **Descripción:** API key para autenticar con el servicio de usuarios
- **Uso:** Autenticación OAuth
- **Configuración:** Automática, no requiere acción

**Ejemplo de uso:**
```typescript
const redirectUrl = await getOAuthRedirectUrl("google", {
  apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
  apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
});
```

### Secretos Configurados

#### `INITIAL_ADMIN_EMAIL`
- **Tipo:** String (Email)
- **Descripción:** Email del administrador inicial del sistema
- **Valor:** (configurado en secretos, no expuesto aquí)
- **Uso:** Identificar al usuario con permisos de administrador
- **Configuración:** Via Mocha Dashboard → Settings → Secrets

**Acceso en código:**
```typescript
type Env = {
  INITIAL_ADMIN_EMAIL?: string;
  // ...
};

async function isAdmin(email: string, env: Env) {
  if (email.toLowerCase() === env.INITIAL_ADMIN_EMAIL?.toLowerCase()) {
    return true;
  }
  // ...
}
```

**IMPORTANTE:** Este valor nunca debe aparecer en:
- Código fuente
- Documentación pública
- Logs
- Respuestas de API

## Configurar Secretos

### Via Mocha Dashboard

1. Ir a tu app en [Mocha](https://getmocha.com)
2. Click en el dropdown del nombre de la app (top left)
3. Seleccionar **Settings**
4. Tab **Secrets**
5. Click **Add Secret**
6. Ingresar:
   - **Name:** `INITIAL_ADMIN_EMAIL` (UPPER_SNAKE_CASE)
   - **Value:** El email del administrador
7. Click **Save**

### Via Wrangler CLI (Alternativa)

```bash
# Configurar secreto
wrangler secret put INITIAL_ADMIN_EMAIL

# Se abrirá prompt para ingresar el valor
# No se mostrará en pantalla al escribir
```

## Bindings de Cloudflare

Configurados en `wrangler.json`:

### D1 Database

```json
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "019d212b-537a-7ac0-9cb2-7cd6072f876a",
      "database_id": "019d212b-537a-7ac0-9cb2-7cd6072f876a"
    }
  ]
}
```

**Acceso en código:**
```typescript
const result = await c.env.DB.prepare("SELECT * FROM employees").all();
```

### R2 Bucket (Object Storage)

```json
{
  "r2_buckets": [
    {
      "binding": "R2_BUCKET",
      "bucket_name": "019d212b-537a-7ac0-9cb2-7cd6072f876a"
    }
  ]
}
```

**Acceso en código:**
```typescript
await c.env.R2_BUCKET.put("file.txt", fileContent);
```

**Nota:** Actualmente no se usa R2 en la aplicación, pero está disponible para almacenar archivos en el futuro.

### Email Service

```json
{
  "services": [
    {
      "binding": "EMAILS",
      "service": "emails-service",
      "entrypoint": "EmailService",
      "props": {
        "appId": "019d212b-537a-7ac0-9cb2-7cd6072f876a"
      }
    }
  ]
}
```

**Acceso en código:**
```typescript
await c.env.EMAILS.send({
  to: "usuario@example.com",
  subject: "Bienvenido",
  html: "<p>Hola!</p>",
});
```

**Nota:** Actualmente no se usa email service, pero está disponible para notificaciones futuras.

## Tipos de TypeScript

Definir tipos para el entorno:

```typescript
// src/worker/index.ts
type Env = {
  DB: D1Database;
  R2_BUCKET: R2Bucket;
  MOCHA_USERS_SERVICE_API_URL: string;
  MOCHA_USERS_SERVICE_API_KEY: string;
  INITIAL_ADMIN_EMAIL?: string;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();
```

## Migraciones de Base de Datos

### Crear Migración

Via Mocha CLI o creando migration files:

```typescript
// up_sql: Aplicar cambios
CREATE TABLE nueva_tabla (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ...
);

// down_sql: Revertir cambios
DROP TABLE nueva_tabla;
```

### Aplicar Migraciones

**Automático:** Al publicar la app, migraciones se aplican automáticamente.

**Importante:** Las migraciones son **inmutables** - no se pueden editar o eliminar una vez creadas.

### Rollback

Si una migración causa problemas:

1. Ir a Mocha Dashboard
2. Click en dropdown del nombre de la app
3. Seleccionar **Versions**
4. Hacer click en "Restore" en la versión anterior
5. Esto revertirá código Y migraciones

## Desarrollo Local

### Iniciar Servidor

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: Same origin (Vite proxy)

### Base de Datos Local

Mocha usa base de datos de **desarrollo** separada.

**Importante:** 
- Datos en dev NO se transfieren a producción al publicar
- Migraciones sí se aplican en ambos ambientes
- Para datos iniciales, usar migraciones con INSERT statements

### Hot Reload

Vite recarga automáticamente en cambios:
- Archivos React: Hot Module Replacement (HMR)
- Archivos Worker: Restart del servidor dev

## Publicar a Producción

### Via Mocha Dashboard

1. Hacer cambios en código
2. Mocha detecta cambios automáticamente
3. Click **Publish** en la barra superior
4. Esperar despliegue (~30 segundos)
5. App publicada en `https://tu-app.mocha.app`

### Build Local

Verificar que todo compila:

```bash
npm run build
```

Esto ejecuta:
1. TypeScript compilation (`tsc -b`)
2. Vite build (frontend)
3. Worker build (backend)

### Check Pre-publish

```bash
npm run check
```

Esto ejecuta:
1. TypeScript compilation
2. Vite build
3. Wrangler dry-run (verifica config)

## Ambientes

### Development

- **URL:** `http://localhost:5173`
- **Base de datos:** D1 development instance
- **Secrets:** Configurados localmente
- **Logs:** Console del navegador + terminal

### Production

- **URL:** `https://gastro-manager.mocha.app`
- **Base de datos:** D1 production instance
- **Secrets:** Configurados en Mocha Dashboard
- **Logs:** Cloudflare Dashboard → Workers → Logs

**IMPORTANTE:** Dev y production tienen bases de datos **completamente separadas**.

## Monitoreo

### Logs en Producción

1. Ir a [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Workers & Pages
3. Seleccionar tu worker
4. Tab **Logs**

**O** via Mocha:
1. Dashboard → Dropdown de app
2. **Debug** → **View Logs**

### Métricas

Cloudflare Dashboard muestra:
- Requests/segundo
- CPU time usado
- Errores
- Latencia

### Alertas

Configurar en Cloudflare para:
- Error rate alto
- Latencia alta
- Uso de recursos

## Troubleshooting

### "App no carga"

1. Verificar logs en Cloudflare Dashboard
2. Verificar que migraciones se aplicaron
3. Revisar secretos configurados
4. Hacer rollback a versión anterior

### "Base de datos vacía después de publicar"

**Normal** - dev y prod son separados.

**Solución:** Poblar datos en producción:
- Crear contenido manualmente
- O usar migraciones con INSERT statements

### "Secreto no definido"

Verificar:
1. Secreto está configurado en Mocha Dashboard
2. Nombre es exactamente igual (case-sensitive)
3. Tipo `Env` incluye el secreto

### "Migración fallida"

1. Ir a Mocha Dashboard → Versions
2. Restaurar versión anterior
3. Corregir migración
4. Volver a publicar

**Recuerda:** Migraciones son inmutables, no se pueden editar.

## Seguridad en Producción

### HTTPS

- **Automático** en Mocha apps
- Certificados SSL gestionados por Cloudflare
- Forzar HTTPS: siempre habilitado

### Cookies Seguras

En producción, cookies usan:
```typescript
setCookie(c, "cookie_name", value, {
  httpOnly: true,
  secure: true, // Solo HTTPS
  sameSite: "Lax",
});
```

### Headers de Seguridad

Cloudflare añade automáticamente:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Strict-Transport-Security`

### Rate Limiting

**Free tier:**
- 100,000 requests/día
- Límites por IP automáticos

**Para más:** Upgrade a plan pago en Cloudflare.

## Backup y Recuperación

### Código

- Git: Todos los cambios en repositorio
- Mocha Versions: Historial completo de versiones

### Base de Datos

- **Backups automáticos:** Cloudflare hace snapshots diarios
- **Point-in-time recovery:** Disponible en planes pagos
- **Manual export:** Via Wrangler CLI

```bash
# Exportar base de datos
wrangler d1 export <database_name> --output backup.sql
```

### Restaurar Versión Anterior

1. Mocha Dashboard → Versions
2. Seleccionar versión
3. Click **Restore**
4. Confirma restauración

Esto restaura:
- Código
- Migraciones aplicadas
- Configuración

**NO restaura:**
- Datos en base de datos
- Archivos en R2

## Escalado

### Automático

Workers escalan automáticamente:
- Sin configuración necesaria
- Paga por uso
- Sin límite de instancias

### Límites Free Tier

- **Requests:** 100,000/día
- **CPU time:** 10ms/request
- **D1 Storage:** 5GB

### Upgrade

Para más recursos:
1. Cloudflare Dashboard
2. Workers & Pages → Plan
3. Seleccionar plan pago

## Dominios Personalizados

### Configurar Dominio

1. Mocha Dashboard → Settings → Domains
2. Agregar dominio personalizado
3. Configurar DNS según instrucciones
4. Esperar verificación

**O** via Cloudflare:
1. Agregar ruta en Workers
2. Configurar DNS en Cloudflare

## CI/CD (Futuro)

Para automatizar despliegues:

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm ci
      - run: npm run build
      - run: npm run deploy
```

## Mejores Prácticas

1. **Nunca commitear secretos** en git
2. **Testear localmente** antes de publicar
3. **Usar versions** para rollback fácil
4. **Monitorear logs** regularmente
5. **Backups** antes de cambios grandes
6. **Documentar** cambios de schema
7. **Versionado semántico** para releases

## Recursos

- **Mocha Docs:** [https://docs.getmocha.com](https://docs.getmocha.com)
- **Cloudflare Workers:** [https://workers.cloudflare.com](https://workers.cloudflare.com)
- **D1 Database:** [https://developers.cloudflare.com/d1](https://developers.cloudflare.com/d1)
- **Soporte Mocha:** support@getmocha.com
- **Discord:** Mocha community

## Checklist de Despliegue

Antes de publicar cambios importantes:

- [ ] Código compila sin errores (`npm run check`)
- [ ] Migraciones tienen `up_sql` y `down_sql`
- [ ] Secretos configurados correctamente
- [ ] Cambios testeados en desarrollo
- [ ] Documentación actualizada
- [ ] Version anterior funcional (para rollback)
- [ ] Usuarios notificados de downtime (si aplica)

---

**Última actualización:** 2024  
**Plataforma:** Mocha v3  
**Cloudflare Workers:** Runtime
