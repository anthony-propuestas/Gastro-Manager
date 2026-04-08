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
        ↓ Worker intercambia code con Google (oauth2.googleapis.com/token)
        ↓ Fetch info del usuario (googleapis.com/oauth2/v2/userinfo)
        ↓ UPSERT en tabla users (sin sobrescribir role ni email_verified)
        ↓
        ├─ Si el usuario ya está verificado:
        │    ↓ Crea JWT firmado con JWT_SECRET (jose, HS256, TTL 7 días)
        │  Cookie session_token=<jwt> (HttpOnly, Secure, SameSite=Lax)
        │    ↓
        │  Redirect a /
        ↓
        └─ Si el usuario es nuevo o no está verificado:
             ↓ Genera token de verificación (24h) y lo guarda hasheado
             ↓ Envía email via Resend con enlace /verify-email?token=...
             ↓ Responde error.code=PENDING_VERIFICATION
             ↓ Frontend redirige a /verify-email
```

### 2. Requests Subsecuentes

```
Usuario navega en la app
        ↓
Request a /api/endpoint
        ↓
Cookie session_token enviada automáticamente
        ↓
authMiddleware: jwtVerify(token, JWT_SECRET)
  ↓ Lee role y email_verified frescos de tabla users
Si válido → continúa con el handler
Si inválido → 401 INVALID_SESSION
```

### 3. Logout

```
Usuario → Click "Cerrar Sesión"
        ↓
GET /api/logout
        ↓
Cookie session_token eliminada (Max-Age=0)
        ↓
Redirect a /login
```

---

## Variables de Entorno Requeridas

| Variable | Descripción |
|---|---|
| `GOOGLE_CLIENT_ID` | Client ID de la app en Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Client Secret de Google OAuth |
| `JWT_SECRET` | Clave secreta para firmar/verificar JWTs (mínimo 32 bytes, hex aleatorio) |
| `RESEND_API_KEY` | API key de Resend para enviar emails de verificación |
| `INITIAL_ADMIN_EMAIL` | Email del primer administrador del sistema |

---

## Implementación Backend

### JWT / Sesiones

El Worker usa la librería `jose` para crear y verificar JWTs. No hay servicio externo de autenticación.

```typescript
import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "session_token";

// Crear sesión (en POST /api/sessions)
async function createSession(payload: UserPayload, secret: string): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(new TextEncoder().encode(secret));
}

// Verificar sesión (en authMiddleware)
async function verifySession(token: string, secret: string): Promise<UserPayload> {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
  return payload as unknown as UserPayload;
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
  const { code } = await c.req.json();

  // 1. Intercambiar code con Google
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${origin}/auth/callback`,
      grant_type: "authorization_code",
    }),
  });
  const { access_token } = await tokenRes.json();

  // 2. Obtener datos del usuario de Google
  const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const googleUser = await userRes.json();

  // 3. UPSERT en users (role nunca se sobreescribe)
  await db.prepare(`
    INSERT INTO users (id, email, name, picture, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'usuario_basico', datetime('now'), datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email, name = excluded.name,
      picture = excluded.picture, updated_at = excluded.updated_at
  `).bind(googleUser.id, googleUser.email, googleUser.name, googleUser.picture).run();

  // 4. Si el usuario no está verificado, enviar email y no crear sesión todavía
  const existingUser = await db.prepare("SELECT id, email_verified FROM users WHERE id = ?")
    .bind(googleUser.id).first();

  if (existingUser?.email_verified !== 1) {
    return c.json(
      { success: false, error: { code: "PENDING_VERIFICATION", message: `Revisá tu email. Te enviamos un correo a ${googleUser.email}` } },
      200
    );
  }

  // 5. Leer role asignado (puede haber sido promovido previamente)
  const dbUser = await db.prepare("SELECT role FROM users WHERE id = ?")
    .bind(googleUser.id).first();

  // 6. Crear JWT y setear cookie
  const jwt = await createSession(
    { id: googleUser.id, email: googleUser.email, name: googleUser.name,
      picture: googleUser.picture, role: dbUser?.role ?? "usuario_basico" },
    c.env.JWT_SECRET
  );

  c.header("Set-Cookie",
    `${COOKIE_NAME}=${jwt}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`
  );
  return c.json({ success: true }, 200);
});
```

#### Verificar email

```typescript
app.get("/api/auth/verify-email", async (c) => {
  const token = c.req.query("token");
  if (!token) return c.redirect("/login?error=invalid_token");

  // Busca el token hasheado, valida expiración/uso y marca al usuario como verificado.
  // Si es válido, crea la sesión y devuelve { success: true }.
});
```

#### Cerrar sesión

```typescript
app.get("/api/logout", (c) => {
  c.header("Set-Cookie",
    `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
  );
  return c.json({ success: true }, 200);
});
```

### Auth Middleware

Protege todas las rutas `/api/*` excepto las de OAuth.

```typescript
const authMiddleware = async (c, next) => {
  const token = getCookie(c, "session_token");
  if (!token) {
    return c.json({ success: false, error: { code: "UNAUTHORIZED" } }, 401);
  }

  try {
    const user = await verifySession(token, c.env.JWT_SECRET);

    // Rol y email_verified siempre desde DB, nunca del JWT
    const dbUser = await c.env.DB
      .prepare("SELECT role, email_verified FROM users WHERE id = ?")
      .bind(user.id)
      .first();
    user.role = dbUser?.role ?? "usuario_basico";
    user.email_verified = dbUser?.email_verified === 1;

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

---

## Implementación Frontend

### AuthContext

El contexto de autenticación está implementado en `src/react-app/context/AuthContext.tsx`. Expone:

```tsx
const { user, currentNegocio, negocios, logout } = useAuth();
```

Al montar la app, llama a `GET /api/users/me`. Si la cookie `session_token` es válida, el servidor devuelve los datos del usuario, incluyendo `email_verified`. Si no, deja `user = null`.

### ProtectedRoute

```tsx
// components/auth/ProtectedRoute.tsx
export default function ProtectedRoute({ children }) {
  const { user, isPending } = useAuth();

  if (isPending) return <div>Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.email_verified) return <Navigate to="/verify-email" replace />;
  return <>{children}</>;
}
```

### Login Page

```tsx
// pages/Login.tsx
const handleLogin = async () => {
  const response = await fetch("/api/oauth/google/redirect_url");
  const { data } = await response.json();
  window.location.href = data.redirect_url;
};
```

### Auth Callback

```tsx
// pages/AuthCallback.tsx
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");

  fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  }).then(res => res.json()).then(data => {
    if (data.error?.code === "PENDING_VERIFICATION") {
      navigate("/verify-email", { replace: true });
      return;
    }
    if (data.success) navigate("/");
    else navigate("/login");
  });
}, []);
```

### VerifyEmailPage

La ruta `/verify-email` cumple dos funciones:

- Sin `token`: muestra el estado "revisá tu correo" luego del login pendiente.
- Con `token`: llama a `GET /api/auth/verify-email?token=...`, valida el enlace y redirige al usuario autenticado al dashboard.

El frontend también usa `BroadcastChannel` para notificar a la pestaña original cuando la verificación se completa en otra pestaña.

---

## Sistema de Roles

| Rol | Acceso |
|---|---|
| `usuario_basico` | Acceso estándar con cuotas mensuales |
| `usuario_inteligente` | Sin cuotas; acceso ilimitado a todas las herramientas |

El rol se almacena en `users.role` y el `authMiddleware` lo lee de la DB en **cada request** — nunca del JWT — para que los cambios aplicados por el admin sean efectivos de inmediato.

---

## Sistema de Administradores

Los admins tienen acceso a `/api/admin/*`. No es un rol en `users.role`; se determina por email:

```typescript
async function isAdmin(email: string, db: D1Database, env: Env): Promise<boolean> {
  // Admin inicial configurado como variable de entorno
  if (email.toLowerCase() === env.INITIAL_ADMIN_EMAIL?.toLowerCase()) {
    return true;
  }
  // Admins adicionales en tabla admin_emails
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
| Rol fresco | Role leído de DB, nunca del JWT |
| `email_verified` fresco | Estado de verificación leído de DB en cada request |
| UPSERT sin sobrescribir role | El login nunca revierte una promoción a `usuario_inteligente` |

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

# Request autenticado
curl http://localhost:5173/api/employees \
  -H "Cookie: session_token=<jwt>" \
  -H "X-Negocio-ID: 1"

# Logout
curl http://localhost:5173/api/logout
```
