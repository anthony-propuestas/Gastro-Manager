# Arquitectura del Sistema

## Visión General

Gastro Manager es una aplicación web full-stack construida con arquitectura moderna basada en:

- **Frontend SPA**: React con enrutamiento del lado del cliente
- **Backend API**: Hono ejecutándose en Cloudflare Workers
- **Base de Datos**: D1 (SQLite administrado por Cloudflare)
- **Edge Computing**: Todo desplegado en la red global de Cloudflare

## Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENTE                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         React App (Frontend SPA)                      │   │
│  │  - React Router para navegación                       │   │
│  │  - Hooks personalizados para lógica                   │   │
│  │  - Componentes UI (shadcn/ui)                         │   │
│  │  - ChatWidget (Asistente Virtual IA)                  │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              CLOUDFLARE WORKERS (Edge)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Hono API (Backend)                       │   │
│  │  - Autenticación middleware                           │   │
│  │  - Validación con Zod                                 │   │
│  │  - Endpoints REST                                     │   │
│  │  - Logging de uso                                     │   │
│  │  - Integración con Gemini AI                          │   │
│  └────────────┬─────────────────────┬────────────────────┘   │
│               │                     │                         │
│               ▼                     ▼                         │
│  ┌─────────────────────┐  ┌──────────────────────┐          │
│  │   D1 Database       │  │  Mocha Users Service │          │
│  │   (SQLite)          │  │  (OAuth Provider)    │          │
│  │  - 8 tablas         │  │  - Google OAuth      │          │
│  │  - Relaciones       │  │  - Session tokens    │          │
│  └─────────────────────┘  └──────────────────────┘          │
│               │                                               │
│               ▼                                               │
│  ┌─────────────────────┐                                     │
│  │  Google Gemini API  │                                     │
│  │  (IA Generativa)    │                                     │
│  │  - gemini-2.5-flash │                                     │
│  │  - REST API         │                                     │
│  └─────────────────────┘                                     │
└─────────────────────────────────────────────────────────────┘
```

## Flujo de Datos

### 1. Autenticación

```
Usuario → Login Page → Google OAuth → Mocha Users Service
                                              ↓
                                      Session Token
                                              ↓
                                    Cookie (httpOnly)
                                              ↓
                              Requests con token en cookie
                                              ↓
                              authMiddleware valida token
                                              ↓
                                   Acceso a recursos
```

### 2. Operaciones CRUD

```
Componente React → Custom Hook (useEmployees, useSalaries, etc.)
                          ↓
                    fetch() API call
                          ↓
              Hono Route Handler (worker/index.ts)
                          ↓
              authMiddleware (verificar sesión)
                          ↓
              validateData (Zod schemas)
                          ↓
                D1 Database Query
                          ↓
              logUsage (registrar acción)
                          ↓
              Response JSON → Hook → Estado React → UI
```

### 3. Chatbot con IA (Asistente Virtual)

```
Usuario escribe pregunta → ChatWidget (componente flotante)
                                   ↓
                          useChat hook → POST /api/chat
                                   ↓
                      authMiddleware (verificar sesión)
                                   ↓
              Obtener contexto del usuario de D1:
              - Empleados (nombres, roles, salarios)
              - Eventos del mes
              - Tópicos pendientes/vencidos
              - Adelantos y pagos
                                   ↓
              Construir prompt con contexto + pregunta
                                   ↓
              Llamada REST a Google Gemini API
              (gemini-2.5-flash via v1beta endpoint)
                                   ↓
              Respuesta IA → JSON → useChat → UI
                                   ↓
              Mostrar respuesta en ChatWidget
```

## Capas de la Aplicación

### Frontend (React)

**Responsabilidades:**
- Presentación de la interfaz de usuario
- Manejo de estado local y global (Context API)
- Validación de formularios (cliente)
- Enrutamiento (React Router)
- Llamadas a API

**Estructura:**
```
src/react-app/
├── components/        # Componentes reutilizables
│   ├── ui/           # Componentes base (shadcn)
│   ├── layout/       # Layouts (Sidebar, MainLayout)
│   ├── auth/         # Componentes de autenticación
│   ├── employees/    # Componentes de empleados
│   └── salaries/     # Componentes de sueldos
├── pages/            # Páginas/vistas principales
├── hooks/            # Custom hooks
└── lib/              # Utilidades
```

### Backend (Hono + Cloudflare Workers)

**Responsabilidades:**
- Autenticación y autorización
- Validación de datos (servidor)
- Lógica de negocio
- Operaciones de base de datos
- Logging y auditoría

**Estructura:**
```
src/worker/
├── index.ts          # API endpoints y middlewares
└── validation.ts     # Esquemas Zod
```

### Base de Datos (D1)

**Responsabilidades:**
- Almacenamiento persistente
- Integridad de datos
- Consultas SQL

## Patrones de Diseño Utilizados

### 1. **Custom Hooks Pattern**

Encapsula lógica de negocio y llamadas a API:

```typescript
// useEmployees.ts
export function useEmployees() {
  const [employees, setEmployees] = useState([]);
  
  const fetchEmployees = async () => {
    // Lógica de fetch
  };
  
  return { employees, fetchEmployees, ... };
}
```

**Beneficios:**
- Reutilización de lógica
- Separación de concerns
- Fácil testing

### 2. **Context Provider Pattern**

Para estado global (sidebar, toast, auth):

```typescript
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  
  const addToast = (message, type) => {
    // Lógica
  };
  
  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
    </ToastContext.Provider>
  );
}
```

### 3. **Middleware Pattern**

Para autenticación y validación:

```typescript
// Autenticación
app.use("/api/*", authMiddleware(...));

// Endpoint con validación
app.post("/api/employees", async (c) => {
  const validation = validateData(createEmployeeSchema, data);
  if (!validation.success) {
    return c.json({ error: validation.error }, 400);
  }
  // ...
});
```

### 4. **Repository Pattern (implícito)**

Hooks actúan como repositorios para acceso a datos:

```typescript
// Hook = Repository
const { employees, createEmployee, updateEmployee } = useEmployees();

// En lugar de queries directas
const employees = await db.select(...);
```

### 5. **Error Boundary Pattern**

Manejo de errores en React:

```typescript
<ErrorBoundary>
  <App />
</ErrorBoundary>

<PageErrorBoundary>
  <Dashboard />
</PageErrorBoundary>
```

## Convenciones de Código

### Naming Conventions

**Base de datos:**
- Tablas: `snake_case` plural (employees, events)
- Columnas: `snake_case` (created_at, user_id)
- Booleanos: `is_active`, `is_open`, `has_*`

**TypeScript/React:**
- Componentes: `PascalCase` (Dashboard, EmployeeModal)
- Hooks: `camelCase` con prefijo `use` (useEmployees)
- Funciones: `camelCase` (fetchEmployees)
- Constantes: `UPPER_SNAKE_CASE` (MOCHA_SESSION_TOKEN)

**API Endpoints:**
- RESTful: `/api/resource` (GET all), `/api/resource/:id` (GET one)
- Acciones: `/api/resource/:id/action` (POST /api/employees/:id/topics)

### Response Format

Todas las respuestas de API siguen el formato:

```typescript
// Success
{
  success: true,
  data: { ... }
}

// Error
{
  success: false,
  error: {
    code: "ERROR_CODE",
    message: "Mensaje descriptivo"
  }
}
```

## Consideraciones de Rendimiento

### 1. **Edge Computing**
- Workers ejecutan en +200 ubicaciones globalmente
- Latencia ~10-50ms vs ~200-500ms de servidores centralizados

### 2. **Database Queries**
- D1 está co-localizado con Workers
- Consultas optimizadas con índices
- Evitar N+1 queries

### 3. **Frontend Optimization**
- Code splitting por ruta (React Router)
- Lazy loading de componentes pesados
- Memoización con useMemo/useCallback donde necesario

### 4. **Caching**
- Estado local en hooks reduce llamadas API
- React Query podría agregarse para caché más sofisticado

## Seguridad

### Capas de Seguridad

1. **Autenticación (Capa 1)**: Google OAuth + Session tokens
2. **Autorización (Capa 2)**: Middleware verifica user_id
3. **Validación (Capa 3)**: Zod schemas en backend
4. **Isolación de datos (Capa 4)**: Queries filtran por user_id

### Principios Aplicados

- **Least Privilege**: Usuarios solo ven sus propios datos
- **Defense in Depth**: Validación en cliente Y servidor
- **Secure by Default**: Rutas protegidas por defecto
- **Secret Management**: Variables de entorno, nunca hardcoded

## Escalabilidad

### Horizontal Scaling
- Workers escalan automáticamente
- Sin límite de instancias concurrentes
- Pay-per-request modelo

### Database Scaling
- D1 maneja ~500 req/s por database
- Para mayor escala: múltiples databases o migrar a D1 Premium

### Limitaciones Actuales
- D1 tiene límite de 10GB (Free tier)
- Workers tienen 50ms CPU time (Free tier)

## Monitoreo y Debugging

### Logs
- `console.log()` en Workers → Cloudflare Dashboard
- Error tracking con ErrorBoundary
- Usage logs en `usage_logs` table

### Debugging
- Local development con Vite
- Source maps habilitados
- React DevTools compatible

## Próximas Mejoras Potenciales

1. **React Query**: Caché y sincronización de datos
2. **WebSockets**: Actualizaciones en tiempo real
3. **Testing**: Unit tests con Vitest, E2E con Playwright
4. **Analytics**: Integración con plataforma de analytics
5. **Internationalization**: Soporte multi-idioma
6. **Progressive Web App**: Offline support
7. **Chatbot mejorado**: Memoria de conversaciones, más contexto
