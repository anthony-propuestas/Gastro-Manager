# Frontend

Aplicación React moderna con arquitectura basada en componentes.

## Stack Frontend

- **React 19**: Framework UI
- **React Router 7**: Enrutamiento del lado del cliente
- **Tailwind CSS**: Estilos utility-first
- **Vite**: Build tool y dev server
- **TypeScript**: Tipado estático
- **shadcn/ui**: Componentes base (Radix UI)

## Estructura de Directorios

```
src/react-app/
├── components/           # Componentes reutilizables
│   ├── ui/              # Componentes base (shadcn)
│   ├── layout/          # Layouts de la app
│   ├── auth/            # Componentes de autenticación
│   ├── employees/       # Componentes de empleados
│   └── salaries/        # Componentes de sueldos
├── pages/               # Páginas/vistas principales
│   ├── modulos/         # Módulos operativos (personal, sueldos, calendario)
│   └── ...
├── hooks/               # Custom hooks
├── lib/                 # Utilidades
├── index.css            # Estilos globales y tema
└── main.tsx             # Entry point
```

## Componentes UI Base

Todos en `components/ui/`, basados en Radix UI (shadcn/ui):

- **Button** (`button.tsx`): Botones con variantes (default, destructive, outline, ghost)
- **Card** (`card.tsx`): Contenedores con header, content, footer
- **Input** (`input.tsx`): Campos de texto
- **Select** (`select.tsx`): Dropdowns y selects
- **Textarea** (`textarea.tsx`): Áreas de texto multilinea
- **Label** (`label.tsx`): Etiquetas de formulario
- **Badge** (`badge.tsx`): Etiquetas de estado
- **Separator** (`separator.tsx`): Líneas divisoras
- **Table** (`table.tsx`): Tablas de datos
- **Toast** (`toast.tsx`): Notificaciones temporales (success, error, info, warning)

**Uso:**
```tsx
import { Button } from "@/react-app/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/react-app/components/ui/card";
import { Badge } from "@/react-app/components/ui/badge";

<Button variant="default">Guardar</Button>
<Card>
  <CardHeader><CardTitle>Título</CardTitle></CardHeader>
  <CardContent>Contenido</CardContent>
</Card>
<Badge variant="outline">Activo</Badge>
```

## Layouts

### MainLayout

Layout principal con sidebar y contenido.

```tsx
// components/layout/MainLayout.tsx
<div className="flex h-screen">
  <Sidebar />
  <main className="flex-1 overflow-y-auto p-8">
    {children}
  </main>
</div>
```

### Sidebar

Navegación lateral adaptativa.

**Desktop:**
- Modo colapsado: 64px (solo íconos)
- Modo expandido: 256px (íconos + texto)
- Toggle entre modos

**Mobile:**
- Hamburger menu
- Slide-out drawer
- Overlay oscuro

```tsx
// Navegación — items con moduleKey se filtran según preferencias de módulo
const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "Calendario", icon: Calendar, path: "/calendario", moduleKey: "calendario" },
  { label: "Personal", icon: Users, path: "/empleados", moduleKey: "personal" },
  { label: "Sueldos", icon: Banknote, path: "/sueldos", moduleKey: "sueldos" },
  { label: "Configuración", icon: Settings, path: "/configuracion" },
];

// El enlace Admin se renderiza condicionalmente fuera de navItems
{isAdmin && <NavLink to="/admin" ... />}
```

**Selector de negocio:** El sidebar incluye un dropdown para cambiar entre negocios del usuario (icono `Building2` + `ChevronDown`), con opción de crear un nuevo negocio directamente desde el menú.

**Comportamiento actual del selector:**
- El click fuera del menú cierra el dropdown sin bloquear los botones internos.
- Seleccionar otro negocio actualiza `currentNegocio` en `AuthContext`, persiste el valor en `localStorage` y cierra el menú.
- La opción "Crear nuevo negocio" navega a `NegocioSetup`.
- Los items del dropdown usan colores explícitos para `popover`, `hover` y `selected`, evitando contraste insuficiente en light/dark mode.

**Filtrado por módulos:** Los items con `moduleKey` se ocultan si el usuario ha desactivado ese módulo en la página de Configuración (via `useModulePrefsContext`).

## Páginas

### Dashboard (`pages/Dashboard.tsx`)

Vista principal con resumen del negocio activo.

**Características:**
- 4 tarjetas de estadísticas clicables (Empleados Activos, Eventos Hoy, Temas Abiertos, Sueldos del Mes)
- Lista de los primeros 5 empleados
- Eventos del día (filtrados desde la consulta mensual)
- Acciones rápidas (Ver Personal, Gestionar Sueldos, Ver Calendario, Configuración)
- **Sección de invitaciones:** genera URLs de invitación para el negocio actual via `POST /api/negocios/{id}/invitations`

**Datos:**
```tsx
const { employees } = useEmployees();
const { fetchOverview } = useSalaries();
// Eventos, tópicos e invitaciones usan apiFetch(..., {}, currentNegocio?.id)
```

**Actualización por cambio de negocio:**
- El dashboard vuelve a cargar overview, eventos y tópicos cuando cambia `currentNegocio`.
- Antes de recargar, limpia el estado derivado (`salaryOverview`, `eventsToday`, `openTopics`) para no mostrar datos del negocio anterior.

### Employees (`pages/modulos/Employees.tsx`)

Gestión completa de empleados.

**Características:**
- Barra de búsqueda (nombre)
- Filtros (puesto, estado activo/inactivo)
- Grid de tarjetas de empleados
- Modal para crear/editar
- Modal de detalles con tópicos y notas
- Gestión de puestos personalizados

**Componentes usados:**
- `EmployeeModal`: Formulario de empleado
- `EmployeeDetailModal`: Vista detallada con tópicos/notas
- `JobRolesModal`: Gestión de puestos

### Salaries (`pages/modulos/Salaries.tsx`)

Sistema de sueldos y adelantos.

**Características:**
- Selector de período (mes/año)
- Resumen de totales
- Tabla de empleados con sueldo neto
- Botón de marcar pagado (individual/lote)
- Modal de adelantos por empleado
- Histórico de períodos

**Componentes usados:**
- `AdvanceModal`: Registrar adelanto
- `EmployeeAdvancesModal`: Ver/gestionar adelantos de empleado

### CalendarPage (`pages/modulos/CalendarPage.tsx`)

Calendario mensual con eventos y tópicos.

**Características:**
- Vista mensual con navegación
- Eventos y tópicos en cada día
- Panel lateral con lista de items del día
- Modal para crear/editar eventos
- Indicadores visuales (rojo: vencido, ámbar: pendiente)

**Estructura:**
```tsx
<div className="grid lg:grid-cols-[1fr_300px]">
  {/* Calendario mensual */}
  <div className="calendar-grid">
    {/* 7x6 grid de días */}
  </div>
  
  {/* Panel lateral */}
  <div className="side-panel">
    {/* Eventos del día seleccionado */}
    {/* Tópicos pendientes */}
  </div>
</div>
```

### NegocioSetup (`pages/NegocioSetup.tsx`)

Pantalla completa para selección o creación de negocio. Se muestra cuando un usuario autenticado no tiene ningún negocio seleccionado.

**Características:**
- Lista de negocios existentes del usuario con conteo de miembros
- Formulario de creación de nuevo negocio con validación
- Link de logout para cambiar de cuenta
- Usa `useNegocios` y `useAuth`

### InvitePage (`pages/InvitePage.tsx`)

Flujo de invitación accesible desde `/invite/:token`.

**Máquina de estados:**
1. **Loading** → consulta `GET /api/invitations/:token` para previsualizar
2. **Preview** → muestra nombre del negocio, quién invita, fecha de expiración
3. **Redeeming** → si el usuario está autenticado, botón "Unirme" canjea el token
4. **Success** → refresca negocios, establece el nuevo como actual
5. Si no está autenticado → redirige a login con `?next=/invite/:token`

### Settings (`pages/Settings.tsx`)

Configuración de la cuenta y del negocio.

**Características:**
- **Perfil:** Card con header (contenido pendiente de implementar)
- **Módulos de Gestión:** Switches para activar/desactivar los 3 módulos visibles en el sidebar (calendario, personal, sueldos) via `useModulePrefsContext`
- **Administradores del negocio:** Lista de miembros del negocio actual, botón para remover miembros (solo el creador), y botón para abandonar el negocio

### Admin (`pages/Admin.tsx`)

Panel de administración (solo admins). Si el usuario no es admin, muestra una tarjeta de "Acceso Restringido".

**6 secciones:**
1. **Stats cards:** Total de usuarios, emails registrados, promedio de empleados y eventos por negocio
2. **Estadísticas de uso:** Gráficos de barras por módulo (empleados, sueldos, calendario)
3. **Cuotas mensuales usadas:** Grid de 8 herramientas (employees, job_roles, topics, notes, advances, salary_payments, events, chat) con tabla de uso por usuario/negocio
4. **Configuración de límites mensuales:** Inputs editables por herramienta para usuarios "Básico", con botón guardar (`updateLimits`)
5. **Gestión de roles de usuario:** Buscar usuarios por email, promover a "Usuario Inteligente" (sin límites) o degradar a "Básico", tabla de usuarios inteligentes actuales
6. **Gestión de emails administradores:** Agregar/eliminar emails admin

### Login (`pages/Login.tsx`)

Página de inicio de sesión.

**Características:**
- Botón de login con Google
- Redirección automática si ya está autenticado

### AuthCallback (`pages/AuthCallback.tsx`)

Callback de OAuth.

**Flujo:**
1. Recibe código OAuth de Google
2. Intercambia por token de sesión
3. Guarda token en cookie
4. Redirige a Dashboard

## Custom Hooks

### useEmployees

Gestión de empleados.

```tsx
export function useEmployees() {
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEmployees = async () => { ... };
  const createEmployee = async (data) => { ... };

### Convención de llamadas a API

Para cualquier endpoint ligado al negocio activo debe usarse `apiFetch` desde `lib/api.ts` en lugar de `fetch` directo.

```tsx
const response = await apiFetch("/api/employees", {}, currentNegocio?.id);
```

**Objetivo:**
- Inyectar `X-Negocio-ID` de forma consistente.
- Evitar vistas desincronizadas al cambiar de negocio desde el sidebar.
- Reducir headers manuales repetidos en hooks y páginas.
  const updateEmployee = async (id, data) => { ... };
  const deleteEmployee = async (id) => { ... };

  return {
    employees,
    isLoading,
    fetchEmployees,
    createEmployee,
    updateEmployee,
    deleteEmployee,
  };
}
```

### useSalaries

Gestión de sueldos y adelantos.

```tsx
export function useSalaries() {
  const fetchOverview = async (month, year) => { ... };
  const createAdvance = async (employeeId, data) => { ... };
  const deleteAdvance = async (id) => { ... };
  const markSalaryPaid = async (id, paidDate) => { ... };
  const markAllPaid = async (month, year, paidDate) => { ... };

  return {
    fetchOverview,
    createAdvance,
    deleteAdvance,
    markSalaryPaid,
    markAllPaid,
  };
}
```

### useEvents

Gestión de eventos del calendario.

```tsx
export function useEvents() {
  const [events, setEvents] = useState([]);

  const fetchEvents = async (month, year) => { ... };
  const createEvent = async (data) => { ... };
  const updateEvent = async (id, data) => { ... };
  const deleteEvent = async (id) => { ... };

  return {
    events,
    fetchEvents,
    createEvent,
    updateEvent,
    deleteEvent,
  };
}
```

### useTopics

Gestión de tópicos y notas.

```tsx
export function useTopics(employeeId) {
  const [topics, setTopics] = useState([]);

  const fetchTopics = async () => { ... };
  const createTopic = async (data) => { ... };
  const updateTopic = async (id, data) => { ... };
  const deleteTopic = async (id) => { ... };
  const createNote = async (topicId, content) => { ... };

  return {
    topics,
    fetchTopics,
    createTopic,
    updateTopic,
    deleteTopic,
    createNote,
  };
}
```

### useJobRoles

Gestión de puestos personalizados.

```tsx
export function useJobRoles() {
  const [jobRoles, setJobRoles] = useState([]);

  const fetchJobRoles = async () => { ... };
  const createJobRole = async (name) => { ... };
  const deleteJobRole = async (id) => { ... };

  return {
    jobRoles,
    fetchJobRoles,
    createJobRole,
    deleteJobRole,
  };
}
```

### useAdmin

Funcionalidades de administración.

```tsx
export function useAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [adminEmails, setAdminEmails] = useState([]);
  const [usageData, setUsageData] = useState(null);
  const [limits, setLimits] = useState(null);
  const [users, setUsers] = useState([]);

  const checkAdminStatus = async () => { ... };  // auto-runs on mount
  const fetchStats = async () => { ... };
  const fetchAdminEmails = async () => { ... };
  const addAdminEmail = async (email) => { ... };
  const removeAdminEmail = async (id) => { ... };
  const fetchUsage = async () => { ... };           // GET /api/admin/usage
  const fetchLimits = async () => { ... };           // GET /api/admin/usage-limits
  const updateLimits = async (limits) => { ... };    // PUT /api/admin/usage-limits
  const fetchUsers = async () => { ... };            // GET /api/admin/users
  const promoteUser = async (userId) => { ... };     // POST /api/admin/users/:id/promote
  const demoteUser = async (userId) => { ... };      // POST /api/admin/users/:id/demote

  return {
    isAdmin, loading, stats, adminEmails,
    usageData, limits, users,
    checkAdminStatus, fetchStats, fetchAdminEmails,
    addAdminEmail, removeAdminEmail,
    fetchUsage, fetchLimits, updateLimits,
    fetchUsers, promoteUser, demoteUser,
  };
}
```

### useSidebar

Estado global del sidebar.

```tsx
export function useSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleSidebar = () => { ... };
  const toggleCollapse = () => { ... };

  return {
    isOpen,
    isCollapsed,
    toggleSidebar,
    toggleCollapse,
  };
}
```

### useNegocios

Gestión de negocios (multi-tenancy). Usa `fetch()` directo (cookie-based, sin `X-Negocio-ID`).

```tsx
export function useNegocios() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createNegocio = async (name) => { ... };          // POST /api/negocios
  const getNegocioDetail = async (id) => { ... };          // GET /api/negocios/:id
  const generateInvitation = async (id) => { ... };        // POST /api/negocios/:id/invitations
  const removeMember = async (negocioId, userId) => { ... }; // DELETE /api/negocios/:id/members/:userId
  const leaveNegocio = async (id) => { ... };              // DELETE /api/negocios/:id/leave

  return { isLoading, error, createNegocio, getNegocioDetail,
           generateInvitation, removeMember, leaveNegocio };
}
```

> **Nota:** comparte un solo estado `isLoading`/`error` para todas las operaciones; llamadas concurrentes pueden colisionar.

### useModulePrefs

Preferencias de visibilidad de módulos en el sidebar. Optimistic updates con revert on failure.

```tsx
export function useModulePrefs() {
  const [prefs, setPrefs] = useState<Record<ModuleKey, boolean>>(
    { calendario: true, personal: true, sueldos: true }
  );

  const toggleModule = async (key: ModuleKey) => { ... };  // PUT /api/modules/prefs

  return { prefs, toggleModule };
}

// Constante exportada con metadata de cada módulo
export const MODULES: { key, label, order, path, description }[];
```

**Runtime type guards:** Valida la forma de la respuesta del server (`isModulePrefsResponse`, `isToggleModuleResponse`). Es el único hook con validación de shape en runtime.

### useMyUsage

Cuotas de uso del usuario actual para el negocio activo.

```tsx
export function useMyUsage() {
  const [data, setData] = useState(null);  // { period, role, usage: Record<tool, {count, limit}> }
  const [isLoading, setIsLoading] = useState(false);

  // Fetches GET /api/usage/me on currentNegocio.id change
  return { data, isLoading };
}
```

Usado por `ChatWidget` para mostrar `UsageBanner` del tool "chat".

### useChat

Comunicación con el asistente virtual IA.

```tsx
export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (content: string) => {
    // Agregar mensaje del usuario al historial
    setMessages(prev => [...prev, { role: 'user', content, timestamp: new Date() }]);
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Agregar respuesta del asistente
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.data.response,
          timestamp: new Date()
        }]);
      } else {
        // Mostrar error como mensaje del sistema
        setMessages(prev => [...prev, { 
          role: 'error', 
          content: data.error,
          timestamp: new Date()
        }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'error', 
        content: 'Error de conexión',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearMessages = () => setMessages([]);

  return {
    messages,
    isLoading,
    sendMessage,
    clearMessages,
  };
}
```

**Características:**
- Manejo de historial de mensajes en la sesión
- Estados de carga mientras espera respuesta
- Manejo de errores con mensajes descriptivos
- Función para limpiar historial

## Context Providers

### AuthProvider

Proveedor de autenticación implementado en `context/AuthContext.tsx`. Al montar la app llama a `GET /api/users/me` para verificar la sesión activa y expone `user`, `role`, `currentNegocio`, `negocios` y `logout` al árbol de componentes.

```tsx
import { AuthProvider } from "@/react-app/context/AuthContext";

<AuthProvider>
  <App />
</AuthProvider>
```

### ToastProvider

Sistema de notificaciones.

```tsx
<ToastProvider>
  {children}
  {/* Renderiza toasts en esquina superior derecha */}
</ToastProvider>

// Uso en componentes
const { addToast } = useToast();
addToast("Empleado creado", "success");
```

### SidebarProvider

Estado del sidebar.

```tsx
<SidebarProvider>
  <MainLayout>
    {/* Sidebar y contenido */}
  </MainLayout>
</SidebarProvider>
```

### ModulePrefsProvider

Distribuye las preferencias de módulos (`useModulePrefs`) al árbol de componentes. Consumido por el Sidebar (para filtrar navItems) y por Settings (para los switches de toggle).

```tsx
<ModulePrefsProvider>
  {children}
</ModulePrefsProvider>

// Uso en componentes
const { prefs, toggleModule } = useModulePrefsContext();
```

## Componentes Especiales

### UsageBanner (`components/UsageBanner.tsx`)

Banner de advertencia de cuota mensual. Se integra en componentes que consumen herramientas con límite (e.g. ChatWidget).

**Props:** `label` (string), `usage` ({ count, limit })

**Comportamiento:**
- No se muestra si `usage` es undefined, `limit` es null (`usuario_inteligente`), o uso < 80%
- **80-99%:** Banner ámbar — "Acercándote al límite mensual"
- **100%+:** Banner rojo — "Límite mensual alcanzado. Actualiza a Usuario Inteligente para continuar"

### ChatWidget (Asistente Virtual IA)

Widget flotante para interactuar con el asistente virtual potenciado por Google Gemini.

**Ubicación:** `components/ChatWidget.tsx`

**Características:**
- Botón flotante en esquina inferior derecha
- Panel de chat expandible (`w-[380px]`, altura 500px)
- Integra `UsageBanner` para la herramienta "chat" (via `useMyUsage`)
- Historial de mensajes en la sesión
- Animación de carga con puntos rebotando
- Botón para limpiar historial
- Soporte completo en español
- Mensaje de bienvenida con lista de capacidades

**Estructura:**
```tsx
<ChatWidget>
  {/* Botón flotante (cuando está cerrado) */}
  <button className="fixed bottom-6 right-6">
    <MessageCircle /> {/* o X cuando está abierto */}
  </button>
  
  {/* Panel de chat (cuando está abierto) */}
  <div className="fixed bottom-24 right-6 w-[380px]">
    {/* Header gradient */}
    <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
      Asistente Virtual
      <button onClick={clearMessages}><Trash /></button>
    </div>

    {/* UsageBanner del tool "chat" */}
    <UsageBanner label="Chat IA" usage={chatUsage} />
    
    {/* Mensajes */}
    <div className="messages-container">
      {messages.map(msg => (
        <MessageBubble role={msg.role} content={msg.content} />
      ))}
    </div>
    
    {/* Error (estado separado, no como mensaje) */}
    {error && <div className="error-box red">{error}</div>}
    
    {/* Input */}
    <form onSubmit={sendMessage}>
      <input placeholder="Escribe tu pregunta..." />
      <button type="submit"><Send /></button>
    </form>
  </div>
</ChatWidget>
```

**Estilos de mensajes:**
- **Usuario:** Burbujas verdes alineadas a la derecha
- **Asistente:** Burbujas grises alineadas a la izquierda
- **Error:** Caja roja separada del historial (no como burbuja de mensaje)

**Ejemplos de uso:**
```
Usuario: ¿Cuántos empleados tengo?
Asistente: Tienes 8 empleados registrados, de los cuales 6 están activos...

Usuario: ¿Quién tiene el sueldo más alto?
Asistente: El empleado con el sueldo más alto es Juan Pérez (Chef) con $15,000 mensuales.

Usuario: ¿Qué eventos tengo hoy?
Asistente: Hoy tienes 2 eventos programados: Reunión de equipo a las 10:00 y Entrega de uniformes a las 15:00.
```

**Integración:**
```tsx
// main.tsx
import { ChatWidget } from "./components/ChatWidget";

// ChatWidget se monta dentro del layout principal,
// visible para todos los usuarios autenticados
<MainLayout>
  <Outlet />
  <ChatWidget />
</MainLayout>
```

## Error Boundaries

### ErrorBoundary (Global)

Captura errores en toda la app.

```tsx
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

### PageErrorBoundary

Por página individual.

```tsx
<PageErrorBoundary>
  <Dashboard />
</PageErrorBoundary>
```

**Características:**
- Muestra mensaje amigable al usuario
- Opción para recargar la página
- No crashea toda la aplicación

## Rutas

```tsx
<Routes>
  {/* Public */}
  <Route path="/login" element={<Login />} />
  <Route path="/auth/callback" element={<AuthCallback />} />
  <Route path="/invite/:token" element={<InvitePage />} />

  {/* Protected — sin requerir negocio */}
  <Route path="/negocio/setup" element={<ProtectedRoute><NegocioSetup /></ProtectedRoute>} />

  {/* Protected — requieren negocio activo */}
  <Route path="/" element={<ProtectedRoute><MainLayout><Dashboard /></MainLayout></ProtectedRoute>} />
  <Route path="/empleados" element={<ProtectedRoute><MainLayout><Employees /></MainLayout></ProtectedRoute>} />
  <Route path="/sueldos" element={<ProtectedRoute><MainLayout><Salaries /></MainLayout></ProtectedRoute>} />
  <Route path="/calendario" element={<ProtectedRoute><MainLayout><CalendarPage /></MainLayout></ProtectedRoute>} />
  <Route path="/configuracion" element={<ProtectedRoute><MainLayout><Settings /></MainLayout></ProtectedRoute>} />
  <Route path="/admin" element={<ProtectedRoute><MainLayout><Admin /></MainLayout></ProtectedRoute>} />
</Routes>

{/* Provider hierarchy: ErrorBoundary > AuthProvider > ToastProvider > Router > ModulePrefsProvider > SidebarProvider > ChatWidget */}
```

## Estilos y Tema

### Tailwind Configuration

**Colores del tema:**
```js
// tailwind.config.js
colors: {
  background: "hsl(var(--background))",
  foreground: "hsl(var(--foreground))",
  primary: "hsl(var(--primary))",
  accent: "hsl(var(--accent))",
  success: "hsl(var(--success))",
  // ...
}
```

### Variables CSS

**Light mode:**
```css
:root {
  --primary: 152 45% 28%;      /* Verde bosque */
  --accent: 35 85% 55%;         /* Ámbar */
  --background: 40 30% 97%;     /* Beige claro */
  --success: 152 55% 40%;       /* Verde éxito */
}
```

**Dark mode:**
```css
.dark {
  --primary: 152 50% 45%;
  --accent: 35 85% 55%;
  --background: 150 15% 8%;
  --success: 152 55% 45%;
}
```

### Tipografía

```css
body {
  font-family: "DM Sans", system-ui, sans-serif;
}

h1, h2, h3, h4, h5, h6 {
  font-family: "Playfair Display", Georgia, serif;
}
```

**Fonts cargadas:**
- **Playfair Display**: Títulos (serif elegante)
- **DM Sans**: Cuerpo (sans-serif moderna)

### Responsive Breakpoints

```
sm: 640px
md: 768px
lg: 1024px
xl: 1280px
2xl: 1536px
```

**Ejemplo:**
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
  {/* Responsive grid */}
</div>
```

## Validación de Formularios

Validación en cliente antes de enviar:

```tsx
// EmployeeModal.tsx
const handleSubmit = (e) => {
  e.preventDefault();
  
  // Validaciones
  if (!formData.name || formData.name.length > 100) {
    addToast("Nombre inválido", "error");
    return;
  }
  
  if (formData.email && !isValidEmail(formData.email)) {
    addToast("Email inválido", "error");
    return;
  }
  
  // Enviar si pasa validaciones
  await createEmployee(formData);
};
```

**Reglas:**
- Mismo esquema que backend (Zod)
- Feedback inmediato al usuario
- Previene requests inválidos

## Optimización

### Code Splitting

React Router hace code splitting automático por ruta.

### Lazy Loading

Para componentes pesados:

```tsx
const HeavyComponent = lazy(() => import("./HeavyComponent"));

<Suspense fallback={<div>Cargando...</div>}>
  <HeavyComponent />
</Suspense>
```

### Memoización

Para operaciones costosas:

```tsx
const filteredEmployees = useMemo(() => {
  return employees.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
}, [employees, searchTerm]);
```

### Event Handlers

Evitar recreación en cada render:

```tsx
const handleClick = useCallback(() => {
  // Handler logic
}, [dependencies]);
```

## Accesibilidad

### Keyboard Navigation

Todos los componentes son navegables con teclado.

### ARIA Labels

```tsx
<button aria-label="Cerrar modal">
  <X className="w-4 h-4" />
</button>
```

### Focus Management

Los modales usan `focus-trap` nativo de Radix UI: el foco queda atrapado dentro mientras están abiertos y se restaura al elemento anterior al cerrarse. `Escape` cierra el modal activo.

## Testing

### Unit tests

El proyecto usa **Vitest** con entorno **happy-dom** para pruebas unitarias y de componentes React.

```bash
npm run test
npm run test:watch
npm run test:coverage
```

**Configuración actual:**
- **Vitest**: Runner principal
- **happy-dom**: DOM simulado para componentes
- **Testing Library**: Render y assertions de UI

**Cobertura inicial recomendada:**
- Utilidades puras (`lib/`, validaciones Zod)
- Componentes sin acoplamiento fuerte a contexto global
- Guards y helpers de navegación con mocks acotados

### E2E tests

Pendiente de implementar.

Herramientas recomendadas:
- **Playwright**: E2E tests

## Performance Tips

1. **Evitar re-renders innecesarios**: Usar `memo`, `useMemo`, `useCallback`
2. **Virtualización**: Para listas muy largas (react-window)
3. **Optimistic updates**: Actualizar UI antes de respuesta del servidor
4. **Debouncing**: En búsquedas y filtros
5. **Lazy loading**: Imágenes y componentes pesados

## Debugging

### React DevTools

Extensión de browser para inspeccionar componentes.

### Console Logs

En desarrollo:

```tsx
console.log("Employee data:", employee);
```

### Error Tracking

ErrorBoundary captura errores y los muestra.

## Próximas Mejoras

1. **Dark mode toggle**: Botón para cambiar tema
2. **Internacionalización**: Soporte multi-idioma (i18next)
3. **Offline support**: Service workers (PWA)
4. **Real-time updates**: WebSockets para colaboración
5. **Advanced filtering**: Filtros combinados y guardados
6. **Export data**: Exportar a Excel/PDF
7. **Drag & drop**: Reordenar items
8. **Charts**: Visualización de datos (recharts)
