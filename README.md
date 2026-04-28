# Gastro Manager

Sistema de gestión de restaurantes multi-usuario desplegado en Cloudflare Workers. Permite administrar personal, sueldos, calendario, compras y seguimiento de empleados, con soporte para negocios compartidos, control de cuotas por plan de usuario y un asistente virtual potenciado por IA.

---

## Características Principales

| Módulo | Descripción |
|---|---|
| Empleados | CRUD completo con búsqueda, filtros, roles personalizados y tópicos de seguimiento |
| Sueldos | Registro de salarios, adelantos, pagos individuales y por lote |
| Calendario | Eventos propios + tópicos con fecha límite integrados visualmente |
| Compras | Registro de compras y gastos del negocio por categoría, con upload de comprobantes |
| Facturación | Registro de ventas/facturas con vista de calendario mensual, totales y promedios |
| Seguimiento | Tópicos y notas por empleado con deadlines y alertas de vencimiento |
| Negocios compartidos | Múltiples usuarios pueden colaborar en el mismo negocio |
| Asistente Virtual IA | Chatbot contextual sobre los datos del negocio (Google Gemini) |
| Panel de Admin | Estadísticas globales, gestión de cuotas, roles de usuario |
| Panel Owner | Restricciones de módulos para gerentes, gestión de solicitudes de owner |
| Modal de upgrade | Modal global al exceder cuota: informa herramienta bloqueada y sugiere upgrade |

---

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + React Router 7 + Tailwind CSS v4 + shadcn/ui |
| Backend | Hono (Cloudflare Workers) |
| Base de datos | Cloudflare D1 (SQLite serverless) |
| Almacenamiento | Cloudflare R2 (comprobantes de compras) |
| Autenticación | Google OAuth nativo + JWT (jose) |
| Validación | Zod |
| IA | Google Gemini 2.5 Flash |
| Hosting Frontend | Cloudflare Pages |
| Hosting Backend | Cloudflare Workers (edge global) |

---

## Arquitectura en una línea

```
Cloudflare Pages (React SPA) → Hono Worker (auth + quota middleware) → D1 (SQLite) + Gemini API
```

El frontend estático se despliega en Cloudflare Pages (`public/_redirects` requerido para SPA routing). El Worker sirve exclusivamente la API REST.

---

## Sistema de Multi-Negocio

Cada usuario puede crear o unirse a varios **negocios**. Todos los datos (empleados, sueldos, eventos) están aislados por `negocio_id`. El frontend envía el negocio activo en el header `X-Negocio-ID` en cada petición.

El negocio activo se selecciona desde el dropdown del sidebar izquierdo. Cambiarlo actualiza el contexto global `currentNegocio`, persiste la selección localmente y obliga a recargar las vistas que dependen del negocio actual.

Los usuarios se unen a negocios mediante enlaces de invitación con token de un solo uso.

**Convención frontend:** para endpoints ligados al negocio activo se usa `apiFetch` en vez de `fetch` directo, para centralizar el header `X-Negocio-ID` y evitar datos cruzados entre negocios.

---

## Sistema de Roles y Cuotas

### Roles de usuario

| Rol | Descripción |
|---|---|
| `usuario_basico` | Sujeto a cuotas mensuales configurables |
| `usuario_inteligente` | Sin cuotas, acceso ilimitado |

El rol se almacena en la tabla `users` y se lee de la base de datos en cada request (no del JWT) para garantizar que los cambios sean inmediatos.

### Roles de negocio

Dentro de cada negocio, los miembros tienen un rol adicional:

| Rol | Descripción |
|---|---|
| `owner` | Control total del negocio, puede restringir módulos a gerentes |
| `gerente` | Rol por defecto al ser invitado, sujeto a restricciones del owner |

### Cuotas mensuales (usuario_basico)

Las cuotas son **por usuario por negocio** y se reinician mensualmente. Los límites por defecto son configurables desde el panel de administración:

| Herramienta | Límite por defecto |
|---|---|
| Empleados | 5 / mes |
| Puestos | 3 / mes |
| Temas | 10 / mes |
| Notas | 20 / mes |
| Anticipos | 10 / mes |
| Pagos de sueldo | 10 / mes |
| Eventos | 15 / mes |
| Chat IA | 20 / mes |
| Compras | sin límite por defecto* |
| Facturación | sin límite por defecto* |

*El límite de compras es `null` hasta que el admin lo configure desde el panel.

El middleware de cuotas usa un patrón **increment-then-revert atómico** para evitar condiciones de carrera (TOCTOU).

Cuando el backend responde `429 USAGE_LIMIT_EXCEEDED`, `apiFetch` emite un evento global `USAGE_LIMIT_EVENT` que dispara el **modal de upgrade** (`UsageLimitModalContext`). El modal muestra la herramienta bloqueada y puede cerrarse con `Escape` o click en el backdrop.

---

## Módulos de la Aplicación

### Dashboard
- Resumen de estadísticas: empleados activos, eventos del día, temas pendientes
- Acciones rápidas a todos los módulos
- Reacciona al cambio de negocio activo y vuelve a consultar overview, eventos, tópicos e invitaciones con el contexto correcto

### Empleados
- CRUD completo con filtros por estado y búsqueda por nombre
- Roles predefinidos + roles personalizados por negocio
- Tópicos de seguimiento con fecha límite (aparecen en el calendario)
- Notas por tópico
- Banner de cuota cuando se acerca o alcanza el límite mensual

### Sueldos
- Vista mensual: salario base, adelantos, neto calculado, estado de pago
- Registro de adelantos con monto y descripción
- Marcar pagado: individual o todos a la vez (lote atómico)
- Solo muestra empleados activos

### Calendario
- Vista mensual interactiva
- Eventos propios + tópicos con deadline integrados
- Indicadores: rojo = vencido, ámbar = pendiente
- CRUD completo de eventos

### Compras
- Registro de compras y gastos del negocio
- Filtro por mes/año con totales del período
- Campos: ítem, monto, fecha, tipo (`producto` / `servicio`), categoría, comprador (empleado opcional)
- Sujeto a cuota mensual configurable (`compras`)
- Restringible por el owner desde `/owner`

### Facturación
- Registro de ventas/facturas del negocio
- Vista de calendario mensual con totales por día
- Estadísticas del período: total del mes, cantidad de ventas, promedio por venta
- CRUD completo de facturas con historial
- Sujeto a cuota mensual configurable (`facturacion`)
- Restringible por el owner desde `/owner`

### Asistente Virtual (Chatbot IA)
- Widget flotante accesible desde cualquier página
- Consultas en lenguaje natural sobre los datos del negocio activo
- Contexto incluye: empleados, sueldos, adelantos, eventos, temas pendientes
- **Conversación multi-turno**: el modelo recuerda los turnos anteriores dentro de la misma sesión
- **Caché de contexto**: los datos del negocio se cargan una sola vez por sesión (TTL 30 min) y no se reenvían en cada mensaje, reduciendo el consumo de tokens ~3x
- El cliente envía el historial de la conversación (últimos 20 mensajes) y el servidor lo inyecta en el prompt de Gemini junto al contexto del negocio
- Potenciado por Google Gemini 2.5 Flash

### Panel de Administración
Solo visible para usuarios con rol `administrador` (configurado por email).

- **Estadísticas globales**: total de usuarios, promedios de uso
- **Uso del Sistema**: tarjeta unificada con uso acumulado por herramienta — muestra `usado / (límite × usuarios_básicos)`, porcentaje, barra de progreso con color dinámico (verde → ámbar ≥70% → rojo ≥90%) y límite por usuario. Los usuarios inteligentes se excluyen del denominador. Incluye estados de carga, error con botón "Reintentar" y sin datos.
- **Uso por usuario**: tabla detallada por usuario+negocio con filtros por rol, negocio, herramienta y búsqueda por email, paginada a 50 filas
- **Gestión de límites**: editar cuotas globales para usuarios básicos
- **Gestión de roles**: promover/degradar usuarios entre básico e inteligente
- **Gestión de admins**: agregar/eliminar emails de administradores

---

## Inicio Rápido

### Desarrollo local

```bash
npm install
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`.

### Producción

```bash
npm run build
npm run check
```

### Variables de entorno requeridas

| Variable | Descripción |
|---|---|
| `GOOGLE_CLIENT_ID` | Client ID de Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Client Secret de Google OAuth |
| `JWT_SECRET` | Clave secreta para firmar sesiones JWT |
| `GEMINI_API_KEY` | API key de Google Gemini (chatbot, opcional) |
| `INITIAL_ADMIN_EMAIL` | Email del primer administrador del sistema |

---

## Comandos NPM

```bash
npm run dev             # Servidor de desarrollo
npm run build           # Compilar para producción
npm run check           # Verificar build y configuración
npm run deploy          # Compilar y desplegar a Cloudflare Workers
npm run lint            # Ejecutar linter
npm test                # Ejecutar suite de tests (Vitest)
npm run test:watch      # Tests en modo interactivo
npm run test:coverage   # Tests con reporte de cobertura
npm run knip            # Detectar código sin usar
npm run cf-typegen      # Generar tipos de Cloudflare
```

---

## Documentación Detallada

| Documento | Contenido |
|---|---|
| [Arquitectura](docs/architecture.md) | Estructura general, flujos, patrones de diseño |
| [Base de Datos](docs/database.md) | Esquema completo, tablas y relaciones |
| [API](docs/api.md) | Endpoints REST y ejemplos de uso |
| [Frontend](docs/frontend.md) | Componentes, páginas y hooks |
| [Autenticación](docs/authentication.md) | Sistema de login y autorización |
| [Validación](docs/validation.md) | Reglas y esquemas Zod |
| [Roles y Permisos](docs/roles.md) | Sistema de roles, cuotas y permisos |
| [Tests](docs/test.md) | Guía de ejecución y cobertura de tests |
| [Seguridad](docs/security.md) | Autenticación, autorización, cuotas, validación y superficie de ataque |
| [Agregar un módulo](docs/agregar-nuevo-modulo.md) | Checklist paso a paso para nuevos módulos |
| [Despliegue](docs/deployment.md) | Configuración y variables de entorno |
| [Sistema de Backup](docs/backup.md) | Copias de seguridad automáticas de base de datos y archivos |

---

## Seguridad

- Autenticación Google OAuth (sin manejo de contraseñas)
- Rol leído de DB en cada request (inmune a tokens JWT desactualizados)
- Aislamiento de datos por negocio en todas las queries
- Validación Zod en servidor para todas las entradas
- Middleware de cuotas con incremento atómico (sin TOCTOU)
- Admin protegido por variable de entorno + tabla de emails

---

## Diseño Visual

- **Paleta**: Verde bosque (#2D5940) + ámbar (#E59645) + beige (#F8F6F2)
- **Tipografía**: Playfair Display (títulos) + DM Sans (cuerpo)
- **Responsive**: Mobile-first, sidebar adaptativo

---

**Versión**: 2.3.0 · **Plataforma**: Cloudflare Workers · **Última actualización**: 2026-04-28
