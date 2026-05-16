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
│   ├── layout/          # Layouts de la app (MainLayout, Sidebar, BottomNav)
│   ├── auth/            # Componentes de autenticación
│   ├── employees/       # Componentes de empleados
│   ├── salaries/        # Componentes de sueldos
│   ├── compras/         # Componentes de compras
│   └── facturacion/     # Componentes de facturación
├── pages/               # Páginas/vistas principales
│   ├── modulos/         # Módulos operativos (personal, sueldos, calendario, compras, facturacion)
│   └── ...
├── hooks/               # Custom hooks
├── lib/                 # Utilidades (api, utils, usageLimitModal)
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
- **Switch** (`switch.tsx`): Toggle switches para activar/desactivar opciones
- **Dialog** (`dialog.tsx`): Modales con overlay (basado en Radix UI)
- **Popover** (`popover.tsx`): Dropdowns y tooltips (basado en Radix UI)

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
  { label: "Agente IA",     icon: Bot,             path: "/agente-ia" },
  { label: "Calendario",    icon: Calendar,        path: "/calendario",   moduleKey: "calendario" },
  { label: "Personal",      icon: Users,           path: "/empleados",    moduleKey: "personal" },
  { label: "Sueldos",       icon: Banknote,        path: "/sueldos",      moduleKey: "sueldos" },
  { label: "Compras",       icon: ShoppingCart,    path: "/compras",      moduleKey: "compras" },
  { label: "Facturación",   icon: Receipt,         path: "/facturacion",  moduleKey: "facturacion" },
  { label: "Vendedores",    icon: Megaphone,       path: "/sellers" },
  { label: "Configuración", icon: Settings,        path: "/configuracion" },
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

### BottomNav

Navegación inferior para dispositivos móviles (`components/layout/BottomNav.tsx`).

**Comportamiento:**
- Visible solo en pantallas pequeñas (`lg:hidden`)
- Muestra los mismos items de navegación que el Sidebar (Agente IA, Calendario, Personal, Sueldos, Compras, Facturación, Vendedores, Config)
- Respeta las mismas reglas de filtrado por `moduleKey` y restricciones del owner
- Íconos compactos con label debajo
- Indicador visual del item activo

## Páginas

### Dashboard / Agente IA (`pages/Dashboard.tsx`)

Página principal del asistente de IA en la ruta `/agente-ia`.

**Características:**
- Interfaz de chat con el agente DeepSeek
- Banner de cuota mensual (`UsageBanner` via `useMyUsage`)
- Auto-scroll al último mensaje
- Animación de escritura (puntos rebotando) mientras carga
- Mensaje de bienvenida cuando no hay historial
- Botón "Limpiar" visible solo cuando hay mensajes
- Texto de error cuando `error` tiene valor
- Input deshabilitado mientras `isLoading` es `true`

**Datos:**
```tsx
const { messages, isLoading, error, sendMessage, clearMessages, triggerDailyGreeting } = useChatContext();
const { data: myUsage } = useMyUsage();
```

Al montar, un `useEffect` llama a `triggerDailyGreeting()` una vez para disparar el saludo del día si corresponde.

### Suscripcion (`pages/Suscripcion.tsx`)

Gestión de suscripción en la ruta `/suscripcion`.

**Características:**
- Muestra el plan actual y tabla de pagos (aprobado, rechazado, pendiente, cancelado, en proceso)
- Botón "Suscribirse" → llama a `crear()` con código de referido opcional, redirige a `initPoint` de MercadoPago
- Botón "Cancelar" si la suscripción está activa
- Botón "Actualizar método de pago" si está en período de gracia
- Botón "Completar pago" si hay pago pendiente
- Comparativa plan gratuito vs Plan Inteligente

**Datos:**
```tsx
const { suscripcion, pagos, crear, cancelar } = useSuscripcion();
```

### SuscripcionEstado (`pages/SuscripcionEstado.tsx`)

Página de resultado de pago en la ruta `/suscripcion/estado`.

**Características:**
- Lee los query params `collection_status` o `status` del redirect de MercadoPago
- Muestra ícono `CheckCircle` (éxito) si el valor es `approved`, `XCircle` (fallo) en cualquier otro caso
- Sin fetches — UI informativa pura post-redirect

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
- 4 tarjetas de resumen: Total Sueldos, Total Adelantos, Saldo Pendiente, Total Pagado
- Tabla de empleados con sueldo neto; badge "Pagado" cuando `is_paid=true`, botón cuando `is_paid=false`
- Botón de marcar pagado individual y "Marcar Todos" (con confirmación)
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

**Componentes usados:**
- `EventModal` (`components/EventModal.tsx`): Formulario de evento (crear/editar)

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

### Compras (`pages/modulos/Compras.tsx`)

Registro y gestión de compras y gastos del negocio.

**Características:**
- Selector de período (mes/año) con totales del mes
- Tabla de compras con ítem, monto, tipo, categoría, comprador y fecha
- Modal para crear/editar compras
- Filtros y ordenamiento por fecha
- Banner de cuota cuando se acerca o alcanza el límite mensual (tool `compras`)
- Si una acción de escritura falla por `429 USAGE_LIMIT_EXCEEDED`, se abre el modal global de upgrade a Usuario Inteligente
- Módulo restringible por el owner desde `/owner`

**Componentes usados:**
- `CompraModal`: Formulario de compra (crear/editar)
- `ComprasHistoryModal`: Historial de compras con filtros
- `DayDetailModal`: Detalle de compras de un día específico

### Facturacion (`pages/modulos/Facturacion.tsx`)

Registro y seguimiento de ventas del negocio, con vista de calendario mensual.

**Características:**
- Selector de período (mes/año) — el selector de año tiene valores **hardcodeados**: 2024, 2025, 2026, 2027
- 3 tarjetas de resumen: Total del Mes, Cantidad de Ventas, Promedio por Venta
- Calendario interactivo — grid de 7 columnas (Lun–Dom) con totales y cantidad de ventas por día
- Click en día con ventas abre `DayDetailModal`
- Botón "Nueva Venta" abre `FacturaModal` en modo creación
- Botón "Historial" abre `FacturasHistoryModal` con tabla completa filtrable
- Si una acción de escritura falla por `429 USAGE_LIMIT_EXCEEDED`, se abre el modal global de upgrade a Usuario Inteligente
- Módulo restringible por el owner desde `/owner`

**Hooks usados:**
- `useFacturacion()` — datos y operaciones CRUD
- `useMyUsage()` — cuota del tool `facturacion` (para mostrar `UsageBanner` si corresponde)

**Componentes usados:**
- `FacturaModal`: Formulario para crear o editar una venta
- `DayDetailModal`: Detalle de ventas de un día, agrupadas por turno
- `FacturasHistoryModal`: Historial completo con búsqueda y filtros

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
5. Si no está autenticado → muestra botón "Iniciar sesión para unirme" que navega a `/` (LandingPage)

### Settings (`pages/Settings.tsx`)

Configuración de la cuenta y del negocio.

**Características:**
- **Perfil:** Card con header (contenido pendiente de implementar)
- **Módulos de Gestión:** Switches para activar/desactivar los 5 módulos visibles en el sidebar (calendario, personal, sueldos, compras, facturacion) via `useModulePrefsContext`
- **Administradores del negocio:** Lista de miembros del negocio actual, botón para remover miembros (solo el creador), y botón para abandonar el negocio

### Admin (`pages/Admin.tsx`)

Panel de administración (solo admins). Si el usuario no es admin, muestra una tarjeta de "Acceso Restringido".

**6 secciones:**
1. **Stats cards:** Total de usuarios, emails registrados, promedio de empleados y eventos por negocio
2. **Estadísticas de uso:** Gráficos de barras por módulo (empleados, sueldos, calendario, puestos, tópicos, notas, chat)
3. **Cuotas mensuales usadas:** Grid de 10 herramientas (employees, job_roles, topics, notes, advances, salary_payments, events, chat, compras, facturacion) con tabla de uso por usuario/negocio
4. **Configuración de límites mensuales:** Inputs editables por herramienta para usuarios "Básico" — renderizados a partir del array `TOOL_LABELS` en `Admin.tsx`. Agregar una nueva herramienta requiere añadir una entrada a `TOOL_LABELS` además de la configuración backend.
5. **Gestión de roles de usuario:** Buscar usuarios por email, promover a "Usuario Inteligente" (sin límites) o degradar a "Básico", tabla de usuarios inteligentes actuales
6. **Gestión de emails administradores:** Agregar/eliminar emails admin

### OwnerPanel (`pages/OwnerPanel.tsx`)

Panel de gestión de negocio para owners. Accesible desde `/owner`. Si el usuario no es `owner` del negocio actual, redirige a `/`.

**Características:**
- **Restricciones de módulos:** Toggles para activar/desactivar la visibilidad de cada módulo (calendario, personal, sueldos, compras, facturacion) para los gerentes del negocio
- **Solicitudes de owner:** Lista de solicitudes pendientes con botones para aprobar o rechazar
- Usa `useOwnerPanel` para las llamadas API

### LandingPage (`pages/LandingPage.tsx`)

Página pública en `/`. Reemplaza la antigua `Login.tsx`.

**Características:**
- Redirección automática a `/dashboard` si el usuario ya está autenticado
- Botón "Continuar con Google" que llama a `/api/oauth/google/redirect_url`
- Secciones de marketing: hero, pain points (6 cards), módulos (6 cards), pasos, stats, CTA final
- Banner de email verificado cuando la URL incluye `?verified=true`
- Animaciones de scroll reveal via `IntersectionObserver`

### AuthCallback (`pages/AuthCallback.tsx`)

Callback de OAuth.

**Flujo:**
1. Recibe código OAuth de Google
2. Intercambia por token de sesión via `POST /api/sessions`
3. Servidor setea cookie `session_token` (HttpOnly)
4. Llama a `window.location.assign("/dashboard")` — reload completo para que `AuthContext` monte fresco con la cookie ya presente
5. Si el usuario no está verificado → redirige a `/verify-email`

### VerifyEmailPage (`pages/VerifyEmailPage.tsx`)

Página de verificación de email mediante token.

**Características:**
- Usa `BroadcastChannel` (channel: `email-verification`) para sincronización entre tabs
- Si hay token en query params: verifica via `GET /api/auth/verify-email?token=...`
- Si no hay token: muestra estado de espera ("Revisá tu correo") — sin formulario de reenvío
- Redirección automática al dashboard tras verificación exitosa
- Manejo de errores: token_used, token_expired, invalid_token

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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const fetchOverview   = async (month?: number, year?: number): Promise<SalaryOverview | null> => { ... };
  const fetchAdvances   = async (employeeId: number, month?: number, year?: number): Promise<Advance[]> => { ... };
  const createAdvance   = async (employeeId: number, input: AdvanceInput): Promise<Advance | null> => { ... };
  const deleteAdvance   = async (advanceId: number): Promise<boolean> => { ... };
  const markAsPaid      = async (employeeId: number, month: number, year: number): Promise<boolean> => { ... };
  const markAllAsPaid   = async (month: number, year: number): Promise<boolean> => { ... };

  return {
    isLoading,
    error,
    fetchOverview,
    fetchAdvances,
    createAdvance,
    deleteAdvance,
    markAsPaid,
    markAllAsPaid,
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

### useCompras

Gestión de compras y gastos del negocio.

```tsx
export function useCompras() {
  const [compras, setCompras]     = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const fetchCompras = async (month, year) => { ... };  // GET /api/compras?month&year
  const createCompra = async (data) => { ... };          // POST /api/compras
  const updateCompra = async (id, data) => { ... };      // PUT /api/compras/:id
  const deleteCompra = async (id) => { ... };            // DELETE /api/compras/:id

  return {
    compras,
    isLoading,
    error,
    fetchCompras,
    createCompra,
    updateCompra,
    deleteCompra,
  };
}
```

### useFacturacion

Gestión de ventas del negocio. Exporta también los tipos y constantes de métodos de pago.

```tsx
// Tipos exportados
type MetodoPago = "efectivo" | "tarjeta_credito" | "tarjeta_debito" | "transferencia" | "mercado_pago" | "mixto" | "otros"
type Turno = "mañana" | "tarde"

interface PagoDetalle { metodo_pago: MetodoPago; monto: number }

interface Factura {
  id: number; negocio_id: number; user_id: string;
  fecha: string; monto_total: number;
  metodo_pago: MetodoPago | null;  // ⚠️ nullable en el tipo TS, pero NOT NULL en la DB (ver database.md)
  concepto: string | null; numero_comprobante: string | null; notas: string | null;
  turno: Turno | null;
  pagos_detalle: string | null;  // JSON string de PagoDetalle[]; NULL si hay un solo método de pago
  created_at: string; updated_at: string;
}

interface FacturaDailySummary { fecha: string; total_dia: number; cantidad: number }

// Helper — parsea pagos_detalle de JSON a array; retorna [] si falla o si raw es null
export function parsePagosDetalle(raw: string | null): PagoDetalle[]

// Constantes de métodos de pago seleccionables por el usuario.
// "mixto" NO está en ninguna de las dos — se asigna automáticamente por lógica
// cuando hay 2+ filas de pago. Ambas constantes son idénticas (misma referencia).
export const METODOS_PAGO:              { value: MetodoPago; label: string }[]  // 6 items: efectivo, tarjeta_credito, tarjeta_debito, transferencia, mercado_pago, otros
export const METODOS_PAGO_SELECCIONABLES: { value: MetodoPago; label: string }[] // = METODOS_PAGO (misma referencia, sin distinción real)

export function useFacturacion() {
  const [facturas, setFacturas]   = useState<Factura[]>([]);
  const [summary, setSummary]     = useState<FacturaDailySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState<string | null>(null);

  // Carga facturas del mes. Actualiza error state si falla.
  const fetchFacturas = async (month: number, year: number) => void;  // GET /api/facturacion?month&year

  // Carga totales diarios para el calendario.
  // ⚠️ Falla silenciosamente — si el request falla, no actualiza el estado error.
  // El catch está vacío; summary mantiene su valor anterior.
  const fetchSummary  = async (month: number, year: number) => void;  // GET /api/facturacion/summary?month&year

  const createFactura = async (input: FacturaInput): Promise<boolean>;  // POST /api/facturacion
  const updateFactura = async (id: number, input: Partial<FacturaInput>): Promise<boolean>;  // PUT /api/facturacion/:id
  const deleteFactura = async (id: number): Promise<boolean>;           // DELETE /api/facturacion/:id

  return { facturas, summary, isLoading, error,
           fetchFacturas, fetchSummary, createFactura, updateFactura, deleteFactura };
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
    { calendario: true, compras: true, personal: true, sueldos: true }
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

Usado por `ChatWidget` y módulos (Compras, Facturación) para mostrar `UsageBanner` cuando se acerca al límite.

Cuando una operación protegida por cuota falla con `429 USAGE_LIMIT_EXCEEDED`, el frontend también puede abrir el modal global de upgrade a Usuario Inteligente usando el evento `USAGE_LIMIT_EVENT` (implementado en `lib/usageLimitModal.ts`).

### useOwnerPanel

Gestión del panel de owner (restricciones de módulos y solicitudes de owner).

```tsx
export function useOwnerPanel() {
  const fetchMyOwnerRequest = async (negocioId) => { ... };     // GET /api/negocios/:id/my-owner-request
  const requestOwner = async (negocioId) => { ... };            // POST /api/negocios/:id/request-owner
  const fetchOwnerRequests = async (negocioId) => { ... };      // GET /api/negocios/:id/owner-requests
  const approveOwnerRequest = async (negocioId, reqId) => { ... }; // POST .../approve
  const rejectOwnerRequest = async (negocioId, reqId) => { ... };  // POST .../reject
  const fetchModuleRestrictions = async (negocioId) => { ... }; // GET /api/negocios/:id/module-restrictions
  const updateModuleRestriction = async (negocioId, data) => { ... }; // PUT /api/negocios/:id/module-restrictions

  return { ... };
}
```

### useSuscripcion

Gestión de suscripción del usuario.

```tsx
export function useSuscripcion() {
  // Carga GET /api/suscripciones/me al montar
  const { suscripcion, pagos, crear, cancelar } = useSuscripcion();
  // suscripcion: objeto de suscripción activa o null
  // pagos: historial de pagos (aprobado, rechazado, pendiente, cancelado, en proceso)
  // crear(refCode?): POST /api/suscripciones/crear → retorna initPoint de MercadoPago
  // cancelar(): POST /api/suscripciones/cancelar
}
```

### useSellers

Datos y operaciones del programa de vendedores/referidos.

```tsx
export function useSellers() {
  const [vendedor, setVendedor] = useState<Vendedor | null>(null);
  const [referidos, setReferidos] = useState<Referido[]>([]);
  const [stats, setStats] = useState<SellerStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // fetchMe(): GET /api/sellers/me — auto-corre al montar
  // activate(): POST /api/sellers/activate — activa al usuario como vendedor

  return { vendedor, referidos, stats, isLoading, error, activate, refresh };
}
```

**Nota:** Usa `fetch()` directo (sin `apiFetch`); los datos de sellers son platform-level, no particionados por `negocio_id`.

### useChat

Comunicación con el asistente virtual IA.

```tsx
export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async (message: string) => {
    if (!message.trim()) return;
    setMessages(prev => [...prev, { role: 'user', content: message, timestamp: new Date() }]);
    setIsLoading(true);
    setError(null);

    const history = messages.slice(-5).map(m => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const response = await apiFetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message, history }),
      }, currentNegocio?.id);

      const data = await response.json();

      if (response.ok && data.success) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.data.reply,
          timestamp: new Date(),
        }]);
      } else {
        setError(data.error?.message || 'Error al enviar mensaje');
      }
    } catch (err) {
      setError('Error desconocido');
    } finally {
      setIsLoading(false);
    }
  };

  const clearMessages = () => { setMessages([]); setError(null); };
  return { messages, isLoading, error, sendMessage, clearMessages, triggerDailyGreeting };
}
```

**Características:**
- Historial de mensajes de la sesión; se envían los últimos 5 al backend (`slice(-5)`)
- Los roles (`"user"` / `"assistant"`) se envían sin transformar al backend
- `X-Negocio-ID` propagado via `apiFetch` con `currentNegocio?.id` como tercer argumento
- Estados de carga y error independientes
- `clearMessages()` resetea el historial local y el estado de error
- `triggerDailyGreeting()`: envía el saludo automático si `isFirstUse || isInactive (>8h) || isNewDay` — siempre que el historial esté vacío y no haya carga en curso. Persiste la fecha del último saludo en `greetingKey` (localStorage) como ISO `YYYY-MM-DD` para evitar duplicados en el mismo día.

## Context Providers

### AuthProvider

Proveedor de autenticación implementado en `context/AuthContext.tsx`. Al montar la app llama a `GET /api/users/me` para verificar la sesión activa y expone `user`, `currentNegocio`, `negocios`, `refreshNegocios` y `logout` al árbol de componentes.

El objeto `user` incluye `email_verified`. Ese campo se usa para bloquear rutas protegidas hasta que el usuario complete la activación por correo.

```tsx
import { AuthProvider } from "@/react-app/context/AuthContext";

<AuthProvider>
  <App />
</AuthProvider>
```

La app también registra la ruta pública `/verify-email`, usada tanto para mostrar el estado "revisá tu correo" como para consumir el token recibido por email.

### ToastProvider

Sistema de notificaciones temporales basado en el componente `toast.tsx` de shadcn/ui.

```tsx
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

### ChatProvider

Provee el estado global de chat (implementado en `context/ChatContext.tsx`) al árbol de componentes. Comparte la misma instancia de `useChat()` entre `Dashboard` (página full-screen) y `ChatWidget` (widget flotante), evitando historiales duplicados.

```tsx
<ChatProvider>
  {children}
</ChatProvider>

// Uso en componentes
const { messages, isLoading, error, sendMessage, clearMessages, triggerDailyGreeting } = useChatContext();
// Lanza error si se usa fuera de ChatProvider
```

## Componentes Especiales

### UsageBanner (`components/UsageBanner.tsx`)

Banner de advertencia de cuota mensual. Se integra en componentes que consumen herramientas con límite (e.g. ChatWidget).

**Props:** `label` (string), `usage` ({ count, limit })

**Comportamiento:**
- No se muestra si `usage` es undefined, `limit` es null (`usuario_inteligente`), o uso < 80%
- **80-99%:** Banner ámbar — "Acercándote al límite mensual"
- **100%+:** Banner rojo — "Límite mensual alcanzado. Actualiza a Usuario Inteligente para continuar"

El banner es preventivo e informativo. No bloquea acciones por sí mismo.

### Modal global de upgrade por límite (`context/UsageLimitModalContext.tsx`)

Modal global que aparece cuando una acción con cuota falla por `429 USAGE_LIMIT_EXCEEDED`.

**Flujo:**
- `apiFetch()` detecta la respuesta `429`
- `notifyUsageLimitExceeded()` valida `error.code === "USAGE_LIMIT_EXCEEDED"`
- Se dispara el evento global `USAGE_LIMIT_EVENT`
- `UsageLimitModalProvider` escucha el evento y renderiza el modal

**Comportamiento:**
- Se abre solo cuando la operación fue rechazada por el backend, no al llegar al último uso válido
- Muestra el nombre amigable del módulo/herramienta, el mensaje del backend y el límite actual si está disponible
- Se puede cerrar con `Escape`, click en el backdrop, botón `X` o botón `Ahora no`
- Incluye CTA `Subir a inteligente`; por ahora es solo visual y no ejecuta ninguna acción real
- Bloquea temporalmente el scroll del `body` mientras está abierto

### ChatWidget (Asistente Virtual IA)

Widget flotante para interactuar con el asistente virtual potenciado por DeepSeek.

**Ubicación:** `components/ChatWidget.tsx`

**Características:**
- Botón flotante en esquina inferior derecha (`bottom-6` en desktop, `bottom-[72px]` en mobile para no solapar el BottomNav)
- Panel de chat expandible (`w-[380px]`, altura 500px)
- Integra `UsageBanner` para la herramienta "chat" (via `useMyUsage`)
- Si el envío de mensaje falla por límite de uso, el modal global de upgrade puede abrirse automáticamente
- Llama a `triggerDailyGreeting` al abrir (saludo automático en primera visita, si >8h de inactividad, o en un nuevo día calendario, siempre que el historial esté vacío)
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

**Hook:** Consume `useChatContext()` (comparte historial con `Dashboard`). Oculto automáticamente en la ruta `/agente-ia` para no duplicar la interfaz de chat.

**Integración:**
```tsx
// App.tsx — nivel ChatProvider, antes de <Routes>
import { ChatWidget } from "./components/ChatWidget";

// ChatWidget se renderiza dentro de ChatProvider, fuera de MainLayout,
// visible en todas las rutas excepto /agente-ia
<ChatProvider>
  <ChatWidget />
  <Routes>
    {/* ... */}
  </Routes>
</ChatProvider>
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
  <Route path="/" element={<LandingPage />} />
  <Route path="/auth/callback" element={<AuthCallback />} />
  <Route path="/verify-email" element={<VerifyEmailPage />} />
  <Route path="/invite/:token" element={<InvitePage />} />

  {/* Protected — sin requerir negocio */}
  <Route path="/negocio/setup" element={<ProtectedRoute><NegocioSetup /></ProtectedRoute>} />

  {/* Protected — requieren negocio activo */}
  <Route path="/agente-ia" element={<ProtectedRoute><MainLayout><Dashboard /></MainLayout></ProtectedRoute>} />
  <Route path="/empleados" element={<ProtectedRoute><MainLayout><RestrictedModuleRoute moduleKey="personal"><Employees /></RestrictedModuleRoute></MainLayout></ProtectedRoute>} />
  <Route path="/sueldos" element={<ProtectedRoute><MainLayout><RestrictedModuleRoute moduleKey="sueldos"><Salaries /></RestrictedModuleRoute></MainLayout></ProtectedRoute>} />
  <Route path="/calendario" element={<ProtectedRoute><MainLayout><RestrictedModuleRoute moduleKey="calendario"><CalendarPage /></RestrictedModuleRoute></MainLayout></ProtectedRoute>} />
  <Route path="/compras" element={<ProtectedRoute><MainLayout><RestrictedModuleRoute moduleKey="compras"><Compras /></RestrictedModuleRoute></MainLayout></ProtectedRoute>} />
  <Route path="/facturacion" element={<ProtectedRoute><MainLayout><RestrictedModuleRoute moduleKey="facturacion"><Facturacion /></RestrictedModuleRoute></MainLayout></ProtectedRoute>} />
  <Route path="/configuracion" element={<ProtectedRoute><MainLayout><Settings /></MainLayout></ProtectedRoute>} />
  <Route path="/owner" element={<ProtectedRoute><MainLayout><OwnerPanel /></MainLayout></ProtectedRoute>} />
  <Route path="/admin" element={<ProtectedRoute><MainLayout><Admin /></MainLayout></ProtectedRoute>} />
  <Route path="/suscripcion" element={<ProtectedRoute><MainLayout><SuscripcionPage /></MainLayout></ProtectedRoute>} />
  <Route path="/suscripcion/estado" element={<ProtectedRoute><MainLayout><SuscripcionEstadoPage /></MainLayout></ProtectedRoute>} />
  <Route path="/sellers" element={<ProtectedRoute><MainLayout><SellersPage /></MainLayout></ProtectedRoute>} />
</Routes>

{/* Provider hierarchy: ErrorBoundary > AuthProvider > ToastProvider > UsageLimitModalProvider > Router > ModulePrefsProvider > SidebarProvider > ChatProvider > ChatWidget + Routes */}
{/* ChatWidget se renderiza a nivel de ChatProvider, fuera de MainLayout, visible en todas las rutas excepto /agente-ia */}
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

## Próximas Mejoras (NO implementadas)

⚠️ **Las siguientes son ideas aspiracionales. Ninguna está implementada en el código actual.** No existen componentes, configuraciones ni dependencias para estas features en el proyecto.

1. **Dark mode toggle**: Botón para cambiar tema — Las variables CSS para `.dark` existen pero no hay toggle en la UI
2. **Internacionalización**: Soporte multi-idioma (i18next) — No hay dependencia `i18next` ni archivos de traducción
3. **Offline support**: Service workers (PWA) — No hay `service-worker.js` ni `manifest.json`
4. **Real-time updates**: WebSockets para colaboración — No hay implementación de WebSocket
5. **Advanced filtering**: Filtros combinados y guardados — No hay persistencia de filtros
6. **Export data**: Exportar a Excel/PDF — No hay dependencias de exportación
7. **Drag & drop**: Reordenar items — No hay librería dnd
8. **Charts**: Visualización de datos (recharts) — No hay dependencia `recharts` ni componentes de gráficos
