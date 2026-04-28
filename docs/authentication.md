# Autenticación

Sistema de autenticación basado en Google OAuth nativo con sesiones JWT firmadas por el propio Worker.

## Flujo de Autenticación

### 1. Login Inicial

```
Usuario → Click "Login con Google"
        ↓
GET /api/oauth/google/redirect_url
        ↓ Construye URL de Google OAuth con GOOGLE_CLIENT_ID
Redirect a accounts.google.com/o/oauth2/v2/auth
        ↓
Usuario autoriza la app
        ↓
Google redirect a /auth/callback?code=XXX
        ↓
POST /api/sessions { code }
        ↓ Valida que code esté presente (400 si no)
        ↓ Worker intercambia code con Google (oauth2.googleapis.com/token)
        ↓ Fetch info del usuario (googleapis.com/oauth2/v2/userinfo)
        ↓ Lee email_verified del usuario ANTES del UPSERT
        ↓ UPSERT en tabla users (sin sobrescribir role ni email_verified)
        ↓
        ├─ Si el usuario ya está verificado:
        │    ↓ Lee role fresco de la DB
        │    ↓ Crea JWT firmado con JWT_SECRET (jose, HS256, TTL 7 días)
        │  Cookie session_token=<jwt> (HttpOnly, Secure, SameSite=Lax)
        │    ↓
        │  { success: true } — frontend redirige a /
        ↓
        └─ Si el usuario es nuevo o no está verificado:
             ↓ Invalida tokens anteriores no usados (used_at = now)
             ↓ Genera token de verificación (32 bytes hex, 24h TTL) y lo guarda hasheado
             ↓ Envía email via Resend con enlace /verify-email?token=...
             ↓ Responde error.code=PENDING_VERIFICATION
             ↓ Frontend redirige a /verify-email
```

### 2. Verificación de Email

```
Usuario abre enlace /verify-email?token=<plainToken>
        ↓
GET /api/auth/verify-email?token=<plainToken>
        ↓ Hashea el token y busca en email_verification_tokens
        ↓ Valida: existe, not used_at, not expirado
        ↓ Batch atómico:
        │    UPDATE email_verification_tokens SET used_at = now
        │    UPDATE users SET email_verified = 1
        ↓ Crea sesión JWT y setea cookie
        ↓ { success: true } — frontend redirige a /
```

### 3. Requests Subsecuentes

```
Usuario navega en la app
        ↓
Request a /api/endpoint (con header X-Negocio-ID: <id> si aplica)
        ↓
Cookie session_token enviada automáticamente
        ↓
authMiddleware: jwtVerify(token, JWT_SECRET)
  ↓ Lee role y email_verified frescos de tabla users
Si válido → continúa con el handler
Si inválido → 401 INVALID_SESSION
        ↓ (para endpoints de datos)
negocioMiddleware: valida X-Negocio-ID
  ↓ Verifica que el usuario sea miembro del negocio (tabla negocio_members)
Si no es miembro → 403 NEGOCIO_ACCESS_DENIED
```

### 4. Logout

```
Usuario → Click "Cerrar Sesión"
        ↓
GET /api/logout
        ↓
Cookie session_token eliminada (Max-Age=0)
        ↓
{ success: true } — AuthContext limpia estado y redirige a /login
```

---

## Variables de Entorno Requeridas

| Variable | Descripción |
|---|---|
| `GOOGLE_CLIENT_ID` | Client ID de la app en Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Client Secret de Google OAuth |
| `JWT_SECRET` | Clave secreta para firmar/verificar JWTs (mínimo 32 bytes, hex aleatorio) |
| `RESEND_API_KEY` | API key de Resend para enviar emails de verificación |
| `INITIAL_ADMIN_EMAIL` | Email del primer administrador del sistema (opcional) |

---

## Implementación Backend

### Tipos

```typescript
type UserPayload = { id: string; email: string; name: string; picture: string; role: string };
type NegocioPayload = { id: number; name: string; member_role: string };

type Variables = {
  user: UserPayload;    // seteado por authMiddleware
  negocio: NegocioPayload; // seteado por negocioMiddleware
};
```

### JWT / Sesiones

El Worker usa la librería `jose` para crear y verificar JWTs. No hay servicio externo de autenticación.

```typescript
import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "session_token";

async function createSession(payload: UserPayload, secret: string): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(new TextEncoder().encode(secret));
}

async function verifySession(token: string, secret: string): Promise<UserPayload> {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
  return payload as unknown as UserPayload;
}
```

### Crypto helpers (tokens de verificación)

```typescript
async function generateToken(): Promise<string> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}
```

### Endpoints de Auth

#### Obtener URL de redirect

```typescript
app.get("/api/oauth/google/redirect_url", (c) => {
  const origin = new URL(c.req.url).origin;
  const redirectUri = `${origin}/auth/callback`;
  const url =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(c.env.GOOGLE_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=openid%20email%20profile`;
  return c.json({ success: true, data: { redirect_url: url } });
});
```

#### Intercambiar código por sesión

```typescript
app.post("/api/sessions", async (c) => {
  const body = await c.req.json();
  if (!body.code) {
    return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: "..." } }, 400);
  }

  const origin = new URL(c.req.url).origin;

  // 1. Intercambiar code con Google
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", { /* ... */ });
  if (!tokenRes.ok) return c.json({ success: false, error: { code: "AUTH_ERROR", message: "Error al procesar la autenticación" } }, 500);
  const { access_token } = await tokenRes.json();

  // 2. Obtener datos del usuario de Google
  const googleUser = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
  }).then(r => r.json());

  // 3. Leer email_verified ANTES del UPSERT (para preservarlo)
  const existingUser = await db.prepare("SELECT id, email_verified FROM users WHERE id = ?")
    .bind(googleUser.id).first();

  // 4. UPSERT — email_verified no está en DO UPDATE (intencional)
  await db.prepare(`
    INSERT INTO users (id, email, name, picture, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'usuario_basico', datetime('now'), datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email, name = excluded.name,
      picture = excluded.picture, updated_at = excluded.updated_at
  `).bind(googleUser.id, googleUser.email, googleUser.name, googleUser.picture ?? "").run();

  if (existingUser?.email_verified !== 1) {
    // Invalida tokens anteriores no usados
    await db.prepare("UPDATE email_verification_tokens SET used_at = datetime('now') WHERE user_id = ? AND used_at IS NULL")
      .bind(googleUser.id).run();

    const plainToken = await generateToken();
    const tokenHash = await hashToken(plainToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await db.prepare("INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)")
      .bind(googleUser.id, tokenHash, expiresAt).run();

    await sendVerificationEmail(c.env.RESEND_API_KEY, googleUser.email, googleUser.name,
      `${origin}/verify-email?token=${plainToken}`);

    return c.json(
      { success: false, error: { code: "PENDING_VERIFICATION", message: `Revisá tu email...` } },
      200
    );
  }

  // 5. Lee role fresco (puede haber sido promovido)
  const dbUser = await db.prepare("SELECT role FROM users WHERE id = ?").bind(googleUser.id).first();

  const jwt = await createSession(
    { id: googleUser.id, email: googleUser.email, name: googleUser.name,
      picture: googleUser.picture ?? "", role: dbUser?.role ?? "usuario_basico" },
    c.env.JWT_SECRET
  );

  c.header("Set-Cookie", `${COOKIE_NAME}=${jwt}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`);
  return c.json({ success: true }, 200);
});
```

#### Verificar email

```typescript
app.get("/api/auth/verify-email", async (c) => {
  const token = c.req.query("token");
  if (!token) return c.redirect("/login?error=invalid_token");

  const tokenHash = await hashToken(token);

  const row = await db.prepare(`
    SELECT evt.id, evt.user_id, evt.expires_at, evt.used_at,
           u.email, u.name, u.picture, u.role
    FROM email_verification_tokens evt
    JOIN users u ON u.id = evt.user_id
    WHERE evt.token_hash = ?
  `).bind(tokenHash).first();

  if (!row) return c.redirect("/login?error=invalid_token");
  if (row.used_at !== null) return c.redirect("/verify-email?error=token_used");
  if (new Date(row.expires_at) < new Date()) return c.redirect("/verify-email?error=token_expired");

  // Batch atómico: marcar token como usado y usuario como verificado
  await db.batch([
    db.prepare("UPDATE email_verification_tokens SET used_at = datetime('now') WHERE id = ?").bind(row.id),
    db.prepare("UPDATE users SET email_verified = 1, updated_at = datetime('now') WHERE id = ?").bind(row.user_id),
  ]);

  const jwt = await createSession(
    { id: row.user_id, email: row.email, name: row.name, picture: row.picture, role: row.role },
    c.env.JWT_SECRET
  );

  c.header("Set-Cookie", `${COOKIE_NAME}=${jwt}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`);
  return c.json({ success: true }, 200);
});
```

#### Cerrar sesión

```typescript
// El redirect a /login lo hace AuthContext.logout() en el cliente
app.get("/api/logout", (c) => {
  c.header("Set-Cookie", `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
  return c.json({ success: true }, 200);
});
```

### Auth Middleware

Protege todas las rutas `/api/*` excepto las de OAuth. Lee `role` y `email_verified` de la DB en **cada request** para que los cambios del admin sean inmediatos.

```typescript
const authMiddleware = async (c, next) => {
  const token = getCookie(c, "session_token");
  if (!token) {
    return c.json({ success: false, error: { code: "UNAUTHORIZED" } }, 401);
  }

  try {
    const user = await verifySession(token, c.env.JWT_SECRET);

    const dbUser = await c.env.DB
      .prepare("SELECT role, email_verified FROM users WHERE id = ?")
      .bind(user.id)
      .first();
    user.role = dbUser?.role ?? "usuario_basico";
    (user as any).email_verified = dbUser?.email_verified === 1;

    c.set("user", user);
    await next();
  } catch {
    return c.json(
      { success: false, error: { code: "INVALID_SESSION", message: "Sesión inválida o expirada" } },
      401
    );
  }
};
```

### Negocio Middleware

Aplica después de `authMiddleware` en todas las rutas de datos. Valida el header `X-Negocio-ID` y verifica que el usuario sea miembro del negocio.

```typescript
const negocioMiddleware = async (c, next) => {
  const negocioIdHeader = c.req.header("X-Negocio-ID");
  if (!negocioIdHeader || isNaN(Number(negocioIdHeader))) {
    return c.json({ success: false, error: { code: "NEGOCIO_REQUIRED" } }, 400);
  }

  const negocioId = Number(negocioIdHeader);
  const user = c.get("user");

  const member = await c.env.DB
    .prepare("SELECT negocio_id, negocio_role FROM negocio_members WHERE negocio_id = ? AND user_id = ?")
    .bind(negocioId, user.id)
    .first();

  if (!member) {
    return c.json({ success: false, error: { code: "NEGOCIO_ACCESS_DENIED" } }, 403);
  }

  const negocio = await c.env.DB.prepare("SELECT id, name FROM negocios WHERE id = ?").bind(negocioId).first();
  c.set("negocio", { id: negocio.id, name: negocio.name, member_role: member.negocio_role });
  await next();
};
```

---

## Implementación Frontend

### AuthContext

El contexto de autenticación está implementado en [src/react-app/context/AuthContext.tsx](../src/react-app/context/AuthContext.tsx). Expone:

```tsx
const { user, isPending, currentNegocio, negocios, setCurrentNegocio, refreshNegocios, logout } = useAuth();
```

Al montar la app llama a `GET /api/users/me`. Si la cookie es válida devuelve los datos del usuario. Luego carga los negocios del usuario via `GET /api/negocios`.

`currentNegocio` se persiste en `localStorage` para sobrevivir recargas. Se re-sincroniza con datos frescos tras cada `refreshNegocios()`.

### ProtectedRoute

```tsx
// src/react-app/components/auth/ProtectedRoute.tsx
export default function ProtectedRoute({ children }) {
  const { user, isPending, currentNegocio } = useAuth();
  const location = useLocation();

  if (isPending) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.email_verified) return <Navigate to="/verify-email" replace />;

  // Si no tiene negocio activo, redirige a setup (excepto en /negocio/setup e /invite/*)
  const isSetupRoute = location.pathname === "/negocio/setup";
  const isInviteRoute = location.pathname.startsWith("/invite/");
  if (!currentNegocio && !isSetupRoute && !isInviteRoute) {
    return <Navigate to="/negocio/setup" replace />;
  }

  return <>{children}</>;
}

// Para rutas que gerentes pueden tener restringidas por el owner
export function RestrictedModuleRoute({ moduleKey, children }) {
  const { negocioRestrictions, isGerente } = useModulePrefsContext();
  if (isGerente && negocioRestrictions[moduleKey]) return <Navigate to="/" replace />;
  return <>{children}</>;
}
```

### Login Page

```tsx
// src/react-app/pages/Login.tsx
const handleLogin = async () => {
  const response = await fetch("/api/oauth/google/redirect_url");
  const { data } = await response.json();
  window.location.href = data.redirect_url;
};
```

### Auth Callback

```tsx
// src/react-app/pages/AuthCallback.tsx
// Muestra UI de estados: loading → success (redirect a /) | error (botón reintentar)
useEffect(() => {
  const code = new URLSearchParams(window.location.search).get("code");
  if (!code) throw new Error("No code in URL");

  fetch("/api/sessions", { method: "POST", body: JSON.stringify({ code }) })
    .then(res => res.json())
    .then(data => {
      if (data.error?.code === "PENDING_VERIFICATION") {
        navigate("/verify-email", { replace: true });
        return;
      }
      if (data.success) {
        setStatus("success");
        setTimeout(() => navigate("/", { replace: true }), 1000);
      } else {
        throw new Error(data.error?.message);
      }
    })
    .catch(() => setStatus("error"));
}, []);
```

### VerifyEmailPage

La ruta `/verify-email` cumple dos funciones:

- **Sin `token`**: muestra el estado "revisá tu correo" luego del login pendiente. También muestra mensajes de error si el token ya fue usado o expiró (`?error=token_used`, `?error=token_expired`).
- **Con `token`**: llama a `GET /api/auth/verify-email?token=...`, valida el enlace, crea sesión y redirige al dashboard.

El frontend usa `BroadcastChannel` para notificar a la pestaña original cuando la verificación se completa en otra pestaña.

---

## Sistema de Roles

### Roles de Usuario (globales)

| Rol | Acceso |
|---|---|
| `usuario_basico` | Acceso estándar con cuotas mensuales por herramienta |
| `usuario_inteligente` | Sin cuotas; acceso ilimitado a todas las herramientas |

El rol se almacena en `users.role` y el `authMiddleware` lo lee de la DB en **cada request** — nunca del JWT.

### Roles por Negocio

| Rol | Acceso |
|---|---|
| `owner` | Control total del negocio; puede invitar miembros y restringir módulos |
| `gerente` | Acceso operativo; puede ser bloqueado de módulos específicos por el owner |

El `negocio_role` se almacena en `negocio_members.negocio_role` y lo lee `negocioMiddleware`. Independiente del rol global.

---

## Sistema de Administradores

Los admins tienen acceso a `/api/admin/*`. No es un rol en `users.role`; se determina por email:

```typescript
async function isAdmin(email: string, db: D1Database, env: Env): Promise<boolean> {
  if (email.toLowerCase() === env.INITIAL_ADMIN_EMAIL?.toLowerCase()) {
    return true;
  }
  const result = await db
    .prepare("SELECT id FROM admin_emails WHERE LOWER(email) = LOWER(?)")
    .bind(email)
    .first();
  return !!result;
}
```

---

## Seguridad

| Mecanismo | Detalle |
|---|---|
| `httpOnly` | Cookie no accesible desde JavaScript (protege XSS) |
| `Secure` | Solo enviada sobre HTTPS |
| `SameSite=Lax` | Previene CSRF |
| `Max-Age=604800` | Expira en 7 días |
| Rol fresco | `role` leído de DB en cada request, nunca del JWT |
| `email_verified` fresco | Estado de verificación leído de DB en cada request |
| UPSERT sin sobrescribir role | El login nunca revierte una promoción a `usuario_inteligente` |
| Token hash | Los tokens de verificación se almacenan hasheados (SHA-256); el plain text solo viaja por email |
| Token invalidation | Login de usuario no verificado invalida tokens anteriores antes de emitir uno nuevo |
| Batch atómico | La verificación de email marca token y usuario en una sola operación batch |

---

## Debugging

### Verificar Cookie

En DevTools → Application → Cookies: buscar `session_token`. Debe tener flags `HttpOnly` y `Secure` (en producción).

### Testing Manual

```bash
# Obtener redirect URL
curl http://localhost:5173/api/oauth/google/redirect_url

# Intercambiar código
curl -X POST http://localhost:5173/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"code": "oauth_code_from_google"}'

# Request autenticado con negocio
curl http://localhost:5173/api/employees \
  -H "Cookie: session_token=<jwt>" \
  -H "X-Negocio-ID: 1"

# Logout
curl http://localhost:5173/api/logout
```
