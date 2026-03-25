# Autenticación

Sistema de autenticación basado en Google OAuth mediante Mocha Users Service.

## Flujo de Autenticación

### 1. Login Inicial

```
Usuario → Click "Login con Google" 
        ↓
GET /api/oauth/google/redirect_url
        ↓
Redirect a Google OAuth
        ↓
Usuario autoriza la app
        ↓
Google redirect a /auth/callback?code=XXX
        ↓
POST /api/sessions con código OAuth
        ↓
Backend intercambia código por session token
        ↓
Token guardado en cookie httpOnly
        ↓
Redirect a Dashboard
```

### 2. Requests Subsecuentes

```
Usuario navega en la app
        ↓
Request a /api/endpoint
        ↓
Cookie con session token enviada automáticamente
        ↓
authMiddleware verifica token
        ↓
Si válido: procesa request
Si inválido: 401 Unauthorized
```

### 3. Logout

```
Usuario → Click "Cerrar Sesión"
        ↓
DELETE /api/sessions
        ↓
Cookie eliminada
        ↓
Redirect a /login
```

## Implementación Backend

### Mocha Users Service

SDK oficial de Mocha para autenticación.

**Instalación:**
```bash
npm install @getmocha/users-service
```

**Variables de entorno (auto-inyectadas):**
- `MOCHA_USERS_SERVICE_API_URL`: URL del servicio de usuarios
- `MOCHA_USERS_SERVICE_API_KEY`: API key de autenticación

### Endpoints de Auth

#### Obtener URL de redirect

```typescript
import { getOAuthRedirectUrl } from "@getmocha/users-service/backend";

app.get("/api/oauth/google/redirect_url", async (c) => {
  const redirectUrl = await getOAuthRedirectUrl("google", {
    apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
    apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
  });

  return c.json({ redirectUrl }, 200);
});
```

#### Intercambiar código por token

```typescript
import { exchangeCodeForSessionToken } from "@getmocha/users-service/backend";

app.post("/api/sessions", async (c) => {
  const { code } = await c.req.json();

  const { sessionToken } = await exchangeCodeForSessionToken(code, {
    apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
    apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
  });

  // Guardar token en cookie
  setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 días
  });

  return c.json({ success: true, data: { token: sessionToken } });
});
```

#### Cerrar sesión

```typescript
import { deleteSession } from "@getmocha/users-service/backend";

app.delete("/api/sessions", async (c) => {
  const sessionToken = getCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME);

  if (sessionToken) {
    await deleteSession(sessionToken, {
      apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
      apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
    });
  }

  // Eliminar cookie
  setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, "", {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 0,
  });

  return c.json({ success: true, data: {} });
});
```

### Auth Middleware

Protege rutas que requieren autenticación.

```typescript
import { authMiddleware } from "@getmocha/users-service/backend";

// Aplicar a todas las rutas /api/*
app.use("/api/*", authMiddleware({
  apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
  apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
  excludePaths: [
    "/api/oauth/google/redirect_url",
    "/api/sessions",
  ],
}));

// En handlers, acceder al usuario
app.get("/api/employees", async (c) => {
  const user = c.get("user"); // { id: "...", email: "..." }
  
  // Filtrar datos por user_id
  const employees = await db
    .prepare("SELECT * FROM employees WHERE user_id = ?")
    .bind(user.id)
    .all();
    
  return c.json({ success: true, data: employees.results });
});
```

### Obtener Info del Usuario

```typescript
app.get("/api/users/me", async (c) => {
  const user = c.get("user");
  
  return c.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
    },
  });
});
```

## Implementación Frontend

### AuthProvider

Wrapper de la aplicación con contexto de auth.

```tsx
import { AuthProvider } from "@getmocha/users-service/react";

function App() {
  return (
    <AuthProvider>
      <Router>
        {/* Rutas */}
      </Router>
    </AuthProvider>
  );
}
```

### ProtectedRoute

Componente para proteger rutas.

```tsx
// components/auth/ProtectedRoute.tsx
import { useAuth } from "@getmocha/users-service/react";
import { Navigate } from "react-router";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div>Cargando...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
```

**Uso:**
```tsx
<Route path="/empleados" element={
  <ProtectedRoute>
    <Employees />
  </ProtectedRoute>
} />
```

### Login Page

```tsx
// pages/Login.tsx
import { useAuth } from "@getmocha/users-service/react";

export default function Login() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated]);

  const handleLogin = async () => {
    // Obtener URL de redirect
    const response = await fetch("/api/oauth/google/redirect_url");
    const { redirectUrl } = await response.json();
    
    // Redirigir a Google
    window.location.href = redirectUrl;
  };

  return (
    <div className="login-container">
      <h1>Gastro Manager</h1>
      <button onClick={handleLogin}>
        Login con Google
      </button>
    </div>
  );
}
```

### Auth Callback

```tsx
// pages/AuthCallback.tsx
export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      // Extraer código de URL
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (!code) {
        navigate("/login");
        return;
      }

      try {
        // Intercambiar código por token
        const response = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });

        const data = await response.json();

        if (data.success) {
          // Token guardado en cookie, redirigir a dashboard
          navigate("/");
        } else {
          navigate("/login");
        }
      } catch (error) {
        console.error("Error en callback:", error);
        navigate("/login");
      }
    };

    handleCallback();
  }, []);

  return <div>Autenticando...</div>;
}
```

### Logout

```tsx
// En cualquier componente
const handleLogout = async () => {
  await fetch("/api/sessions", { method: "DELETE" });
  window.location.href = "/login";
};

<button onClick={handleLogout}>
  Cerrar Sesión
</button>
```

### Obtener Usuario Actual

```tsx
import { useAuth } from "@getmocha/users-service/react";

function UserProfile() {
  const { user } = useAuth();

  return (
    <div>
      <img src={user.picture} alt={user.name} />
      <p>{user.name}</p>
      <p>{user.email}</p>
    </div>
  );
}
```

## Isolación de Datos

Cada usuario solo puede acceder a sus propios datos.

### En Backend

**Todas las queries filtran por user_id:**

```typescript
// ✅ CORRECTO
const employees = await db
  .prepare("SELECT * FROM employees WHERE user_id = ?")
  .bind(user.id)
  .all();

// ❌ INCORRECTO - Expone datos de todos los usuarios
const employees = await db
  .prepare("SELECT * FROM employees")
  .all();
```

### Verificación de Propiedad

Antes de operaciones UPDATE/DELETE:

```typescript
app.delete("/api/employees/:id", async (c) => {
  const user = c.get("user");
  const employeeId = c.req.param("id");

  // Verificar que el empleado pertenece al usuario
  const employee = await db
    .prepare("SELECT * FROM employees WHERE id = ? AND user_id = ?")
    .bind(employeeId, user.id)
    .first();

  if (!employee) {
    return c.json(
      { success: false, error: { code: "NOT_FOUND", message: "Empleado no encontrado" } },
      404
    );
  }

  // Eliminar
  await db
    .prepare("DELETE FROM employees WHERE id = ?")
    .bind(employeeId)
    .run();

  return c.json({ success: true, data: {} });
});
```

## Sistema de Administradores

Usuarios con permisos elevados para ver estadísticas globales.

### Verificar Admin

```typescript
async function isAdmin(email: string, db: D1Database, env: Env): Promise<boolean> {
  // Verificar admin inicial (variable de entorno)
  if (email.toLowerCase() === env.INITIAL_ADMIN_EMAIL?.toLowerCase()) {
    return true;
  }
  
  // Verificar en tabla admin_emails
  const result = await db
    .prepare("SELECT id FROM admin_emails WHERE LOWER(email) = LOWER(?)")
    .bind(email)
    .first();
  
  return !!result;
}
```

### Endpoints Solo Admin

```typescript
app.get("/api/admin/stats", async (c) => {
  const user = c.get("user");
  const adminStatus = await isAdmin(user.email, c.env.DB, c.env);

  if (!adminStatus) {
    return c.json(
      { success: false, error: { code: "FORBIDDEN", message: "No autorizado" } },
      403
    );
  }

  // Obtener estadísticas globales
  const stats = await fetchGlobalStats(c.env.DB);
  
  return c.json({ success: true, data: stats });
});
```

### Frontend

```tsx
// hooks/useAdmin.ts
export function useAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const response = await fetch("/api/admin/check");
      const data = await response.json();
      setIsAdmin(data.data?.isAdmin || false);
    };
    checkAdmin();
  }, []);

  return { isAdmin };
}

// En componente
const { isAdmin } = useAdmin();

if (!isAdmin) {
  return <Navigate to="/" />;
}
```

## Seguridad

### Cookies httpOnly

Las cookies de sesión usan `httpOnly: true`:
- **No accesibles** desde JavaScript
- **Solo enviadas** en requests HTTP
- **Protección contra XSS**

### Secure Flag

En producción, `secure: true`:
- Solo enviadas sobre HTTPS
- Protección contra man-in-the-middle

### SameSite

`sameSite: "Lax"`:
- Previene CSRF (Cross-Site Request Forgery)
- Cookies solo en requests same-site

### Token Expiration

Tokens expiran después de 7 días (configurable).

### No Secrets en Cliente

Variables de entorno nunca se exponen al frontend:
- `MOCHA_USERS_SERVICE_API_KEY`: Solo en backend
- Admin email: Solo en backend

## Manejo de Errores

### Token Inválido

```typescript
// Middleware detecta token inválido
// Response: 401 Unauthorized

// Frontend debe redirigir a login
if (response.status === 401) {
  window.location.href = "/login";
}
```

### Session Expirada

```typescript
// Global fetch interceptor (opcional)
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const response = await originalFetch(...args);
  
  if (response.status === 401) {
    window.location.href = "/login";
  }
  
  return response;
};
```

## Testing de Auth

### Mock de Usuario

```typescript
// En tests
const mockUser = {
  id: "test_user_123",
  email: "test@example.com",
  name: "Test User",
};

c.set("user", mockUser);
```

### Bypass de Auth en Dev

**NO HACER ESTO EN PRODUCCIÓN:**

```typescript
// Solo para desarrollo local
if (process.env.NODE_ENV === "development") {
  app.use("/api/*", async (c, next) => {
    c.set("user", {
      id: "dev_user",
      email: "dev@example.com",
    });
    await next();
  });
}
```

## Limitaciones

### Scopes de Google OAuth

Mocha Users Service **solo incluye scopes básicos**:
- `email`
- `profile`

**NO incluye:**
- Google Calendar
- Google Drive
- Otros servicios de Google

Para acceder a otros servicios, necesitarías configurar OAuth separado.

### Single Provider

Actualmente solo soporta Google OAuth. 

Para agregar otros providers (GitHub, Facebook):
- Requiere configuración adicional en Mocha
- O implementar OAuth por separado

## Mejores Prácticas

1. **Siempre filtrar por user_id** en queries
2. **Verificar propiedad** antes de UPDATE/DELETE
3. **Usar authMiddleware** en todas las rutas API
4. **No confiar en datos del cliente** - validar en backend
5. **Logs de seguridad** para acciones sensibles
6. **Rotación de tokens** periódica (futuro)
7. **2FA** para admins (futuro)

## Debugging

### Verificar Cookie

En DevTools → Application → Cookies:
- Buscar `mocha_session_token`
- Debe tener flags: HttpOnly, Secure (prod), SameSite

### Logs de Auth

```typescript
console.log("User authenticated:", c.get("user"));
```

### Testing Manual

```bash
# Obtener redirect URL
curl http://localhost:5173/api/oauth/google/redirect_url

# Intercambiar código
curl -X POST http://localhost:5173/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"code": "oauth_code"}'

# Request autenticado
curl http://localhost:5173/api/employees \
  -H "Cookie: mocha_session_token=your_token"
```
