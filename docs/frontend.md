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
├── hooks/               # Custom hooks
├── lib/                 # Utilidades
├── index.css            # Estilos globales y tema
└── main.tsx             # Entry point
```

## Componentes UI Base

Todos en `components/ui/`, basados en Radix UI:

### Core Components

- **Button** (`button.tsx`): Botones con variantes (default, destructive, outline, ghost)
- **Card** (`card.tsx`): Contenedores con header, content, footer
- **Dialog** (`dialog.tsx`): Modales y diálogos
- **Input** (`input.tsx`): Campos de texto
- **Select** (`select.tsx`): Dropdowns y selects
- **Textarea** (`textarea.tsx`): Áreas de texto multilinea
- **Label** (`label.tsx`): Etiquetas de formulario
- **Badge** (`badge.tsx`): Etiquetas de estado
- **Separator** (`separator.tsx`): Líneas divisoras
- **Tabs** (`tabs.tsx`): Navegación por pestañas
- **Table** (`table.tsx`): Tablas de datos

### Feedback Components

- **Toast** (`toast.tsx`): Notificaciones temporales (success, error, info, warning)
- **Alert Dialog** (`alert-dialog.tsx`): Confirmaciones
- **Skeleton** (`skeleton.tsx`): Loading states
- **Progress** (`progress.tsx`): Barras de progreso

### Advanced Components

- **Popover** (`popover.tsx`): Contenido flotante
- **Dropdown Menu** (`dropdown-menu.tsx`): Menús contextuales
- **Accordion** (`accordion.tsx`): Secciones colapsables
- **Collapsible** (`collapsible.tsx`): Contenido expandible
- **Scroll Area** (`scroll-area.tsx`): Áreas scrollables personalizadas

### Form Components

- **Field** (`field.tsx`): Wrapper para campos de formulario con label y error
- **Input Group** (`input-group.tsx`): Inputs con prefijos/sufijos
- **Checkbox** (`checkbox.tsx`): Casillas de verificación
- **Radio Group** (`radio-group.tsx`): Grupos de radio buttons
- **Switch** (`switch.tsx`): Interruptores on/off
- **Slider** (`slider.tsx`): Controles deslizantes

**Uso:**
```tsx
import { Button } from "@/react-app/components/ui/button";
import { Card } from "@/react-app/components/ui/card";

<Button variant="default">Guardar</Button>
<Card>
  <CardHeader>
    <CardTitle>Título</CardTitle>
  </CardHeader>
  <CardContent>Contenido</CardContent>
</Card>
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
// Navegación
const navItems = [
  { label: "Dashboard", icon: Home, path: "/" },
  { label: "Empleados", icon: Users, path: "/empleados" },
  { label: "Sueldos", icon: Banknote, path: "/sueldos" },
  { label: "Calendario", icon: Calendar, path: "/calendario" },
  { label: "Configuración", icon: Settings, path: "/configuracion" },
  { label: "Admin", icon: Shield, path: "/admin" }, // Solo admins
];
```

## Páginas

### Dashboard (`pages/Dashboard.tsx`)

Vista principal con resumen.

**Características:**
- 4 tarjetas de estadísticas (empleados, eventos, temas, sueldos)
- Lista de empleados recientes
- Eventos del día
- Acciones rápidas

**Datos:**
```tsx
const { employees } = useEmployees();
const { fetchOverview } = useSalaries();
const [eventsToday, setEventsToday] = useState([]);
const [openTopics, setOpenTopics] = useState(0);
```

### Employees (`pages/Employees.tsx`)

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

### Salaries (`pages/Salaries.tsx`)

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

### CalendarPage (`pages/CalendarPage.tsx`)

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

### Settings (`pages/Settings.tsx`)

Configuración de la cuenta.

**Características:**
- Información del usuario
- Preferencias (futuro)
- Cerrar sesión

### Admin (`pages/Admin.tsx`)

Panel de administración (solo admins).

**Características:**
- Estadísticas del sistema
- Gráfico de uso por módulo
- Gestión de emails administradores

**Protección:**
```tsx
const { isAdmin } = useAdmin();

useEffect(() => {
  if (!isAdmin) {
    navigate("/");
  }
}, [isAdmin]);
```

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
  const [stats, setStats] = useState(null);
  const [adminEmails, setAdminEmails] = useState([]);

  const checkAdmin = async () => { ... };
  const fetchStats = async () => { ... };
  const fetchAdminEmails = async () => { ... };
  const addAdminEmail = async (email) => { ... };
  const removeAdminEmail = async (id) => { ... };

  return {
    isAdmin,
    stats,
    adminEmails,
    checkAdmin,
    fetchStats,
    fetchAdminEmails,
    addAdminEmail,
    removeAdminEmail,
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

Proveedor de autenticación de Mocha.

```tsx
import { AuthProvider } from "@getmocha/users-service/react";

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

## Componentes Especiales

### ChatWidget (Asistente Virtual IA)

Widget flotante para interactuar con el asistente virtual potenciado por Google Gemini.

**Ubicación:** `components/ChatWidget.tsx`

**Características:**
- Botón flotante en esquina inferior derecha
- Panel de chat expandible
- Historial de mensajes en la sesión
- Indicador de carga mientras procesa
- Botón para limpiar historial
- Soporte completo en español
- Diseño responsive (se adapta a móvil)

**Estructura:**
```tsx
<ChatWidget>
  {/* Botón flotante (cuando está cerrado) */}
  <button className="fixed bottom-6 right-6">
    <MessageCircle /> {/* o X cuando está abierto */}
  </button>
  
  {/* Panel de chat (cuando está abierto) */}
  <div className="fixed bottom-24 right-6 w-80 md:w-96">
    {/* Header */}
    <div className="bg-primary text-white">
      Asistente Virtual
      <button onClick={clearMessages}><Trash /></button>
    </div>
    
    {/* Mensajes */}
    <div className="messages-container">
      {messages.map(msg => (
        <MessageBubble role={msg.role} content={msg.content} />
      ))}
    </div>
    
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
- **Error:** Burbujas rojas con mensaje de error

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
// App.tsx
import { ChatWidget } from "./components/ChatWidget";

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <SidebarProvider>
          <Routes>
            {/* ... rutas ... */}
          </Routes>
          <ChatWidget /> {/* Siempre visible para usuarios autenticados */}
        </SidebarProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
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

  {/* Protected */}
  <Route path="/" element={
    <ProtectedRoute>
      <MainLayout>
        <PageErrorBoundary>
          <Dashboard />
        </PageErrorBoundary>
      </MainLayout>
    </ProtectedRoute>
  } />
  {/* ... más rutas protegidas */}
</Routes>
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

<Suspense fallback={<Skeleton />}>
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

Los modales atrapan el foco:

```tsx
<Dialog>
  {/* Foco automático en primer elemento */}
  {/* Tab navega dentro del modal */}
  {/* Escape cierra el modal */}
</Dialog>
```

## Testing

**Pendiente de implementar:**

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e
```

Herramientas recomendadas:
- **Vitest**: Unit tests
- **Playwright**: E2E tests
- **Testing Library**: React testing

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
