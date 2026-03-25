# Plan de Migración a Cloudflare

Plan detallado para migrar Gastro Manager de Mocha a servicios nativos de Cloudflare.

## Resumen Ejecutivo

**Objetivo:** Migrar la aplicación de Mocha a Cloudflare directo para tener control total de la infraestructura.

**Opción Recomendada:** **Cloudflare Pages** con Functions (Workers)

**Tiempo estimado:** 2-4 días de trabajo

**Complejidad:** Media

**Componentes a migrar:**
- Frontend React (SPA)
- Backend Hono (API REST)
- Base de datos D1
- Autenticación OAuth
- **Chatbot con Google Gemini AI**

## Arquitectura Actual vs Propuesta

### Arquitectura Actual (Mocha)

```
Mocha Platform
├── Frontend (React) → Cloudflare Workers
├── Backend (Hono) → Cloudflare Workers
├── Database → Cloudflare D1
├── Auth → Mocha Users Service (OAuth wrapper)
├── AI/Chatbot → Google Gemini API (REST)
└── Hosting → Cloudflare Edge
```

**Ventajas:**
- Setup simple, todo integrado
- Autenticación lista para usar
- No requiere configuración de Cloudflare
- Gestión visual de secretos y base de datos
- Integración Gemini ya configurada

**Desventajas:**
- Dependencia de plataforma third-party
- Menos control sobre infraestructura
- Costos de la plataforma Mocha

### Arquitectura Propuesta (Cloudflare Pages)

```
Cloudflare Pages
├── Frontend (React) → Pages (Static hosting)
├── Backend (Hono) → Pages Functions (Workers)
├── Database → D1
├── Auth → OAuth directo (Google, GitHub, etc.)
├── AI/Chatbot → Google Gemini API (REST directo)
├── Object Storage → R2
├── Email → Resend/SendGrid (externo)
└── CDN → Cloudflare Edge (100% nativo)
```

**Ventajas:**
- Control total de infraestructura
- Costos potencialmente menores
- Integración nativa con todos los servicios Cloudflare
- No hay vendor lock-in con plataforma
- Mejor para CI/CD
- Escalabilidad ilimitada

**Desventajas:**
- Requiere configurar autenticación manualmente
- Más configuración inicial
- Necesitas cuenta de Cloudflare configurada
- Gestión manual de secretos

## Cloudflare Pages vs Workers

### Cloudflare Pages

**Descripción:** Plataforma Jamstack para sitios estáticos y aplicaciones full-stack.

**Características:**
- Hosting de archivos estáticos (HTML, CSS, JS, images)
- Pages Functions (Workers en `/functions` directory)
- Build automático desde Git (GitHub, GitLab)
- Preview deployments por cada commit
- Dominios personalizados gratis
- SSL automático
- Rollbacks con un click

**Ideal para:** SPAs (React, Vue, Svelte) con backend

**Pricing Free Tier:**
- Unlimited requests
- 500 builds/mes
- 100 GB-hours/mes

### Cloudflare Workers

**Descripción:** Plataforma serverless para ejecutar código JavaScript/TypeScript.

**Características:**
- Solo backend (API)
- Necesitas hosting separado para frontend
- Más flexibilidad en configuración
- Mejor para microservicios

**Ideal para:** APIs puras, backend separado

**Pricing Free Tier:**
- 100,000 requests/día
- 10ms CPU time/request

### Recomendación: Cloudflare Pages

**Razón:**
1. Gastro Manager es una SPA (Single Page Application)
2. Pages incluye hosting + backend en un solo lugar
3. Git integration para deploy automático
4. Free tier más generoso
5. Preview environments gratis
6. Más simple que Workers + hosting separado

## Plan de Migración Detallado

### Fase 1: Preparación (Día 1)

#### 1.1 Crear Cuenta Cloudflare

1. Ir a [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Crear cuenta o login
3. Verificar email

#### 1.2 Preparar Repositorio Git

Si aún no está en Git:

```bash
# Inicializar repo
git init
git add .
git commit -m "Initial commit"

# Crear repo en GitHub
gh repo create gastro-manager --private
git remote add origin https://github.com/tu-usuario/gastro-manager.git
git push -u origin main
```

#### 1.3 Instalar Wrangler CLI

```bash
npm install -g wrangler

# Login a Cloudflare
wrangler login
```

### Fase 2: Configurar Base de Datos (Día 1)

#### 2.1 Crear D1 Database

```bash
# Crear database
wrangler d1 create gastro-manager-db

# Output mostrará:
# database_name = "gastro-manager-db"
# database_id = "xxxx-xxxx-xxxx-xxxx"
```

#### 2.2 Exportar Datos de Mocha (Opcional)

Si tienes datos en producción que quieres migrar:

```bash
# En Mocha, exportar datos manualmente o via API
# Crear scripts SQL con INSERT statements
```

#### 2.3 Aplicar Migraciones

```bash
# Crear directorio de migraciones
mkdir -p migrations

# Copiar migraciones actuales o recrear schema
cat > migrations/0001_initial_schema.sql << 'EOF'
-- Copiar todo el schema de docs/database.md
CREATE TABLE employees (...);
CREATE TABLE topics (...);
-- etc.
EOF

# Aplicar migraciones
wrangler d1 execute gastro-manager-db --file=migrations/0001_initial_schema.sql
```

#### 2.4 Importar Datos (Si aplica)

```bash
# Si tienes datos a migrar
wrangler d1 execute gastro-manager-db --file=migrations/0002_seed_data.sql
```

### Fase 3: Configurar Autenticación (Día 2)

**Cambio Principal:** Reemplazar Mocha Users Service con OAuth directo.

### Fase 3.5: Migrar Chatbot con Google Gemini (Día 2)

El chatbot utiliza Google Gemini AI para responder preguntas sobre los datos del usuario. Esta integración es relativamente simple de migrar ya que usa llamadas REST directas.

#### 3.5.1 Configurar Google AI Studio

1. Ir a [Google AI Studio](https://aistudio.google.com)
2. Crear cuenta o iniciar sesión con Google
3. Ir a "Get API Key" → "Create API Key"
4. Copiar la API Key generada

**Importante:** La API Key es gratuita con límites generosos:
- 15 solicitudes por minuto
- 1 millón de tokens por minuto
- 1,500 solicitudes por día

#### 3.5.2 Agregar Secret en Cloudflare

```bash
# Usando wrangler CLI
wrangler secret put GEMINI_API_KEY

# O en el dashboard de Cloudflare
# Pages → tu-proyecto → Settings → Environment Variables
# Agregar: GEMINI_API_KEY = tu_api_key
```

#### 3.5.3 Código del Endpoint de Chat

El endpoint actual funciona con llamadas REST directas a Gemini, compatible con Cloudflare Workers:

```typescript
// functions/api/chat.ts (o en tu archivo de rutas Hono)
app.post("/api/chat", async (c) => {
  const user = c.get("user");
  const { message } = await c.req.json();
  
  if (!message || message.length > 1000) {
    return c.json({ success: false, error: "Mensaje inválido" }, 400);
  }

  const apiKey = c.env.GEMINI_API_KEY;
  if (!apiKey) {
    return c.json({ success: false, error: "GEMINI_API_KEY no configurada" }, 500);
  }

  // Obtener contexto del usuario desde D1
  const employees = await c.env.DB.prepare(
    "SELECT name, role, monthly_salary, is_active FROM employees WHERE user_id = ?"
  ).bind(user.id).all();

  const events = await c.env.DB.prepare(
    "SELECT title, event_date, start_time FROM events WHERE user_id = ? AND event_date >= date('now', '-7 days')"
  ).bind(user.id).all();

  const topics = await c.env.DB.prepare(`
    SELECT t.title, t.is_open, t.due_date, e.name as employee_name
    FROM topics t
    JOIN employees e ON t.employee_id = e.id
    WHERE e.user_id = ? AND t.is_open = 1
  `).bind(user.id).all();

  // Construir contexto para Gemini
  const context = `
Eres un asistente virtual para un sistema de gestión de restaurantes llamado Gastro Manager.
Responde siempre en español, de forma concisa y útil.

DATOS DEL USUARIO:

Empleados (${employees.results?.length || 0}):
${employees.results?.map(e => `- ${e.name} (${e.role}) - Salario: $${e.monthly_salary} - ${e.is_active ? 'Activo' : 'Inactivo'}`).join('\n') || 'Sin empleados'}

Eventos próximos (${events.results?.length || 0}):
${events.results?.map(e => `- ${e.title} - ${e.event_date} ${e.start_time || ''}`).join('\n') || 'Sin eventos'}

Tópicos pendientes (${topics.results?.length || 0}):
${topics.results?.map(t => `- ${t.title} (${t.employee_name}) - Vence: ${t.due_date || 'Sin fecha'}`).join('\n') || 'Sin tópicos pendientes'}
`;

  // Llamar a Gemini API (REST)
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const geminiResponse = await fetch(geminiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: `${context}\n\nPREGUNTA DEL USUARIO: ${message}` }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      }
    }),
  });

  if (!geminiResponse.ok) {
    const errorData = await geminiResponse.json();
    const errorMessage = errorData.error?.message || "Error desconocido";
    console.error("Gemini API error:", errorMessage);
    return c.json({ 
      success: false, 
      error: `API de Gemini: ${errorMessage}` 
    }, 500);
  }

  const data = await geminiResponse.json();
  const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No pude generar una respuesta.";

  return c.json({
    success: true,
    data: { response: responseText }
  });
});
```

#### 3.5.4 Consideraciones Importantes para Workers

**SDK vs REST API:**
- El SDK oficial de Google (`@google/genai`) **NO es compatible** con Cloudflare Workers
- Usar siempre llamadas REST directas con `fetch()`
- Endpoint correcto: `https://generativelanguage.googleapis.com/v1beta/`

**Modelos disponibles:**
- `gemini-2.5-flash` - Recomendado (rápido, económico)
- `gemini-2.5-pro` - Más capaz pero más lento
- `gemini-1.5-flash` - Versión anterior

**Errores comunes:**
- "model not found": Usar `v1beta` en lugar de `v1` en la URL
- "fetch failed": Verificar que no estés usando el SDK
- "API key invalid": Verificar que la key esté correctamente configurada

#### 3.5.5 Prueba de Integración

```bash
# Probar localmente con wrangler
wrangler dev

# En otra terminal
curl -X POST http://localhost:8788/api/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: session_token=YOUR_TOKEN" \
  -d '{"message": "¿Cuántos empleados tengo?"}'
```

#### 3.5.6 Migrar el Frontend (ChatWidget)

El componente ChatWidget no requiere cambios ya que usa rutas relativas:

```typescript
// useChat.ts - sin cambios necesarios
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message }),
});
```

El único cambio sería si usas variables de entorno para la URL base del API.

#### 3.5.7 Límites y Costos de Gemini

**Free Tier (suficiente para la mayoría):**
| Límite | Valor |
|--------|-------|
| Solicitudes/minuto | 15 |
| Solicitudes/día | 1,500 |
| Tokens/minuto | 1,000,000 |

**Pay-as-you-go (si necesitas más):**
- Input: $0.075 / 1M tokens
- Output: $0.30 / 1M tokens

Para un restaurante típico con 5-10 usuarios, el free tier es más que suficiente.

---

#### 3.1 Opción A: Implementar OAuth Manualmente

**Google OAuth:**

1. Ir a [Google Cloud Console](https://console.cloud.google.com)
2. Crear proyecto nuevo
3. Habilitar Google+ API
4. Credentials → Create OAuth 2.0 Client ID
5. Authorized redirect URIs: `https://tu-app.pages.dev/auth/callback`
6. Copiar Client ID y Client Secret

**Código:**

```typescript
// functions/api/oauth/google/redirect.ts
export async function onRequestGet(context) {
  const clientId = context.env.GOOGLE_CLIENT_ID;
  const redirectUri = `${context.request.url.split('/api')[0]}/auth/callback`;
  
  const url = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=email profile`;
  
  return Response.json({ redirectUrl: url });
}

// functions/api/sessions.ts
export async function onRequestPost(context) {
  const { code } = await context.request.json();
  const clientId = context.env.GOOGLE_CLIENT_ID;
  const clientSecret = context.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${context.request.url.split('/api')[0]}/auth/callback`;
  
  // Intercambiar código por token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  
  const { access_token } = await tokenResponse.json();
  
  // Obtener info del usuario
  const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  
  const user = await userResponse.json();
  
  // Crear session token (JWT)
  const sessionToken = await createJWT({ userId: user.id, email: user.email }, context.env.JWT_SECRET);
  
  return new Response(JSON.stringify({ success: true, data: { token: sessionToken } }), {
    headers: {
      'Set-Cookie': `session_token=${sessionToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`,
      'Content-Type': 'application/json',
    },
  });
}
```

#### 3.2 Opción B: Usar Librería (Más Simple)

**Recomendado:** `arctic` - Librería moderna de OAuth

```bash
npm install arctic
```

```typescript
import { Google } from 'arctic';

const google = new Google(
  context.env.GOOGLE_CLIENT_ID,
  context.env.GOOGLE_CLIENT_SECRET,
  'https://tu-app.pages.dev/auth/callback'
);

// Generar URL de autorización
const url = await google.createAuthorizationURL();

// Validar callback
const tokens = await google.validateAuthorizationCode(code);
```

#### 3.3 Implementar JWT para Sesiones

```bash
npm install jose
```

```typescript
import { SignJWT, jwtVerify } from 'jose';

// Crear JWT
async function createJWT(payload, secret) {
  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(new TextEncoder().encode(secret));
  return jwt;
}

// Verificar JWT
async function verifyJWT(token, secret) {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
  return payload;
}

// Middleware de autenticación
async function authMiddleware(context, next) {
  const cookie = context.request.headers.get('Cookie');
  const sessionToken = cookie?.match(/session_token=([^;]+)/)?.[1];
  
  if (!sessionToken) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const user = await verifyJWT(sessionToken, context.env.JWT_SECRET);
    context.user = user;
    return next();
  } catch (error) {
    return Response.json({ error: 'Invalid token' }, { status: 401 });
  }
}
```

### Fase 4: Configurar Cloudflare Pages (Día 2)

#### 4.1 Restructurar Proyecto

Cloudflare Pages espera esta estructura:

```
gastro-manager/
├── public/              # Assets estáticos
├── src/
│   ├── react-app/      # Frontend (sin cambios)
│   └── worker/         # Mover a /functions
├── functions/          # ← NUEVO: Pages Functions (backend)
│   └── api/
│       ├── employees/
│       │   ├── index.ts       # GET/POST /api/employees
│       │   └── [id].ts        # GET/PUT/DELETE /api/employees/:id
│       ├── events/
│       ├── oauth/
│       └── _middleware.ts     # Auth middleware global
├── wrangler.toml       # Config de Cloudflare
├── package.json
└── vite.config.ts
```

#### 4.2 Crear wrangler.toml

```toml
name = "gastro-manager"
compatibility_date = "2024-01-01"
pages_build_output_dir = "dist"

# D1 Database
[[d1_databases]]
binding = "DB"
database_name = "gastro-manager-db"
database_id = "tu-database-id-aqui"

# R2 Bucket (opcional)
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "gastro-manager-files"

# KV Namespace (para sessions alternativo a JWT)
[[kv_namespaces]]
binding = "SESSIONS"
id = "tu-kv-id-aqui"
```

#### 4.3 Convertir Backend a Pages Functions

**Hono Actual:**
```typescript
// src/worker/index.ts
app.get('/api/employees', async (c) => {
  const user = c.get('user');
  // ...
});
```

**Pages Functions:**
```typescript
// functions/api/employees/index.ts
export async function onRequestGet(context) {
  const { DB } = context.env;
  const user = context.user; // del middleware
  
  const result = await DB.prepare('SELECT * FROM employees WHERE user_id = ?')
    .bind(user.id)
    .all();
  
  return Response.json({ success: true, data: result.results });
}

export async function onRequestPost(context) {
  // Crear empleado
}
```

**Middleware Global:**
```typescript
// functions/api/_middleware.ts
export async function onRequest(context) {
  // Verificar autenticación
  const cookie = context.request.headers.get('Cookie');
  const token = cookie?.match(/session_token=([^;]+)/)?.[1];
  
  if (!token) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const user = await verifyJWT(token, context.env.JWT_SECRET);
  context.user = user;
  
  return context.next();
}
```

#### 4.4 Actualizar Vite Config

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    outDir: 'dist',
  },
  // Para desarrollo local con Pages
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8788',
        changeOrigin: true,
      },
    },
  },
});
```

### Fase 5: Despliegue (Día 3)

#### 5.1 Deploy via Git

1. Ir a [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Pages → Create a project
3. Connect to Git → Seleccionar GitHub
4. Autorizar Cloudflare
5. Seleccionar repositorio `gastro-manager`
6. Build settings:
   - Framework preset: `Vite`
   - Build command: `npm run build`
   - Build output directory: `dist`
7. Environment variables:
   - `GOOGLE_CLIENT_ID`: tu_client_id
   - `GOOGLE_CLIENT_SECRET`: tu_client_secret
   - `JWT_SECRET`: generar string aleatorio seguro
   - `INITIAL_ADMIN_EMAIL`: email_admin
8. Save and Deploy

#### 5.2 Deploy via CLI (Alternativa)

```bash
# Build local
npm run build

# Deploy a Pages
wrangler pages deploy dist --project-name=gastro-manager
```

#### 5.3 Configurar Dominio

1. Pages → tu-proyecto → Custom domains
2. Agregar dominio: `gastro-manager.com`
3. Configurar DNS:
   - CNAME: `gastro-manager.com` → `gastro-manager.pages.dev`
4. Esperar propagación (5-10 min)

### Fase 6: Testing y Verificación (Día 3-4)

#### 6.1 Smoke Tests

- [ ] Login con Google funciona
- [ ] Dashboard carga con datos reales
- [ ] CRUD de empleados funciona
- [ ] Sistema de sueldos funciona
- [ ] Calendario funciona
- [ ] Panel admin funciona (si eres admin)
- [ ] Chatbot responde preguntas correctamente
- [ ] Chatbot tiene acceso a datos del usuario

#### 6.2 Performance

Comparar con versión Mocha:
- Tiempo de carga (Lighthouse)
- Tiempo de respuesta API
- Build time

#### 6.3 Monitoreo

Configurar en Cloudflare:
- Analytics habilitados
- Error tracking
- Alertas de uptime

### Fase 7: Cutover (Día 4)

#### 7.1 Migración de Datos

Si tienes usuarios en producción:

1. Exportar datos de Mocha DB
2. Importar a Cloudflare D1
3. Notificar usuarios del downtime
4. Hacer switch de DNS
5. Verificar todo funciona

#### 7.2 Redirección

Si mantienes ambos temporalmente:

```typescript
// En Mocha app, agregar banner
<div className="bg-yellow-100 p-4 text-center">
  Nos mudamos! Nueva URL: <a href="https://gastro-manager.com">gastro-manager.com</a>
</div>
```

## Cambios de Código Necesarios

### 1. Autenticación

**Antes (Mocha):**
```typescript
import { authMiddleware } from '@getmocha/users-service/backend';
app.use('/api/*', authMiddleware(...));
```

**Después (Cloudflare):**
```typescript
// functions/api/_middleware.ts
export async function onRequest(context) {
  const user = await verifySessionToken(context);
  context.user = user;
  return context.next();
}
```

### 2. Environment Variables

**Antes:**
```typescript
c.env.MOCHA_USERS_SERVICE_API_URL
```

**Después:**
```typescript
context.env.GOOGLE_CLIENT_ID
context.env.JWT_SECRET
context.env.GEMINI_API_KEY
```

### 3. Chatbot (Google Gemini)

**Sin cambios significativos** - La integración actual usa REST directo que es compatible con Workers:

```typescript
// El código actual funciona igual en Cloudflare Pages Functions
const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
const response = await fetch(geminiUrl, { ... });
```

**Solo necesitas:**
1. Copiar `GEMINI_API_KEY` a los Environment Variables de Cloudflare Pages
2. Mantener el endpoint `/api/chat` en las Pages Functions

### 4. Base de Datos

**Sin cambios** - D1 funciona igual

### 5. Frontend

**Mínimos cambios:**
- Actualizar URLs de OAuth endpoints
- Remover `@getmocha/users-service/react` (si se usa)
- Implementar custom auth context
- ChatWidget funciona sin cambios

## Costos Comparativos

### Mocha (Estimado)

```
Free tier: Limitado
Paid tiers: $X/mes (consultar pricing)
```

### Cloudflare Pages

```
Free tier:
- Unlimited requests
- Unlimited bandwidth
- 500 builds/mes
- Hosting ilimitado

Paid ($20/mes):
- Build concurrentes ilimitados
- Acceso a features avanzados
```

### Cloudflare D1

```
Free tier:
- 5GB storage
- 5M reads/día
- 100k writes/día

Paid (según uso):
- $0.50/GB storage
- $0.001 per 1k reads
- $1 per 1M writes
```

**Estimado para app pequeña-mediana:**
- **Mocha:** ~$20-50/mes
- **Cloudflare:** $0-20/mes (dependiendo de tráfico)

## Ventajas de la Migración

### Control

✅ Acceso completo a configuración
✅ No hay limitaciones de plataforma
✅ Modificar cualquier aspecto

### Costos

✅ Potencialmente más barato
✅ Pay-per-use modelo más transparente
✅ Free tier muy generoso

### Performance

✅ Sin overhead de plataforma intermedia
✅ Optimización directa
✅ CDN global nativo

### Desarrollo

✅ Mejor integración con Git
✅ Preview deployments automáticos
✅ CI/CD más flexible
✅ Testing más fácil

### Portabilidad

✅ Código más portable
✅ No vendor lock-in con Mocha
✅ Estándares web nativos

## Desventajas y Consideraciones

### Setup Inicial

❌ Más trabajo de configuración
❌ Implementar autenticación manualmente
❌ Gestionar secretos manualmente

### Mantenimiento

❌ Más responsabilidad
❌ Actualizar dependencias tú mismo
❌ No hay soporte directo de Mocha

### Features

❌ No hay Mocha Users Service (debes implementar OAuth)
❌ No hay UI visual para DB/secrets
❌ Más técnico en general

## Alternativas a Considerar

### 1. Quedarse en Mocha

**Si:**
- El costo no es problema
- Prefieres simplicidad sobre control
- No necesitas features avanzadas
- El equipo es pequeño/no técnico

### 2. Vercel

**Si:**
- Quieres DX similar a Mocha
- Next.js es opción
- Presupuesto mayor

### 3. Netlify

**Si:**
- Similar a Cloudflare Pages
- Prefieres su UI/UX
- Funcionalidades específicas de Netlify

### 4. Self-hosted (VPS/Docker)

**Si:**
- Necesitas control absoluto
- Requisitos de compliance específicos
- Costos muy optimizados a gran escala

## Checklist de Migración

### Pre-migración

- [ ] Backup completo de datos Mocha
- [ ] Cuenta Cloudflare creada y verificada
- [ ] Repositorio Git configurado
- [ ] OAuth credentials obtenidos (Google, etc.)
- [ ] Plan de rollback definido

### Durante Migración

- [ ] D1 database creada
- [ ] Migraciones aplicadas
- [ ] Datos importados (si aplica)
- [ ] Backend adaptado a Pages Functions
- [ ] Frontend actualizado (auth)
- [ ] Secretos configurados en Cloudflare
- [ ] Deploy exitoso
- [ ] DNS configurado

### Post-migración

- [ ] Tests completos realizados
- [ ] Performance verificado
- [ ] Monitoreo configurado
- [ ] Usuarios migrados (si aplica)
- [ ] Documentación actualizada
- [ ] Mocha app deprecated/eliminado
- [ ] Chatbot funcionando correctamente
- [ ] GEMINI_API_KEY configurada en producción

## Recursos Útiles

### Documentación

- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages)
- [Pages Functions Guide](https://developers.cloudflare.com/pages/functions)
- [D1 Documentation](https://developers.cloudflare.com/d1)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler)
- [Google AI Studio](https://aistudio.google.com) - Para obtener API Key de Gemini
- [Gemini API Docs](https://ai.google.dev/docs) - Documentación oficial de Gemini

### Tutoriales

- [Full-stack app with Pages](https://developers.cloudflare.com/pages/tutorials/build-a-blog)
- [OAuth with Workers](https://developers.cloudflare.com/workers/tutorials/oauth)
- [D1 Migrations](https://developers.cloudflare.com/d1/migrations)
- [Gemini REST API Quickstart](https://ai.google.dev/tutorials/rest_quickstart)

### Comunidad

- [Cloudflare Discord](https://discord.gg/cloudflaredev)
- [Cloudflare Community](https://community.cloudflare.com)
- [GitHub Discussions](https://github.com/cloudflare/workers-sdk/discussions)

## Conclusión

**Recomendación:** Migrar a **Cloudflare Pages** es viable y beneficioso a largo plazo.

**Complejidad:** Media - requiere conocimiento técnico pero es manejable

**Tiempo:** 2-4 días para desarrollador con experiencia

**ROI:** Positivo - ahorro de costos, más control, mejor performance

**Chatbot:** La integración con Gemini es la parte más fácil de migrar, ya que usa REST directo sin dependencias específicas de Mocha.

**Cuándo hacerlo:**
- ✅ Si quieres reducir costos
- ✅ Si necesitas más control
- ✅ Si el equipo es técnico
- ✅ Si planeas escalar
- ❌ Si prefieres simplicidad sobre todo
- ❌ Si el tiempo de desarrollo es limitado

**Siguiente paso:** Decidir si proceder con migración o permanecer en Mocha según tus prioridades (costo vs simplicidad vs control).

---

## Apéndice: Solución de Problemas del Chatbot

### Errores Comunes de Gemini API

| Error | Causa | Solución |
|-------|-------|----------|
| "model not found" | URL con versión incorrecta | Usar `v1beta` en lugar de `v1` |
| "fetch failed" | Usando SDK en Workers | Cambiar a llamadas REST con fetch() |
| "API key invalid" | Key mal configurada | Verificar secret en dashboard |
| "quota exceeded" | Límites de free tier | Esperar o pasar a plan de pago |
| "content blocked" | Filtros de seguridad | Revisar contenido del prompt |

### Debugging del Chatbot

```typescript
// Agregar logs para debugging
app.post("/api/chat", async (c) => {
  console.log("Chat request received");
  console.log("API Key exists:", !!c.env.GEMINI_API_KEY);
  
  try {
    const response = await fetch(geminiUrl, { ... });
    console.log("Gemini response status:", response.status);
    
    if (!response.ok) {
      const error = await response.text();
      console.error("Gemini error:", error);
    }
    // ...
  } catch (err) {
    console.error("Fetch error:", err);
  }
});
```

### Verificar Conectividad

```bash
# Probar API directamente
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=TU_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "parts": [{"text": "Hola, responde con un saludo corto"}]
    }]
  }'
```

### Modelos Alternativos

Si `gemini-2.5-flash` no está disponible, prueba:
- `gemini-1.5-flash` - Versión anterior estable
- `gemini-1.5-pro` - Más capaz
- `gemini-2.5-pro` - Última versión premium
