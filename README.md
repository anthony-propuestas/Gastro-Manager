# Gastro Manager

Sistema de gestión de restaurantes multi-usuario desplegado en Cloudflare Workers. Permite administrar personal, sueldos, calendario y seguimiento de empleados, con soporte para negocios compartidos, control de cuotas por plan de usuario y un asistente virtual potenciado por IA.

---

## Características Principales

| Módulo | Descripción |
|---|---|
| Empleados | CRUD completo con búsqueda, filtros, roles personalizados y tópicos de seguimiento |
| Sueldos | Registro de salarios, adelantos, pagos individuales y por lote |
| Calendario | Eventos propios + tópicos con fecha límite integrados visualmente |
| Seguimiento | Tópicos y notas por empleado con deadlines y alertas de vencimiento |
| Negocios compartidos | Múltiples usuarios pueden colaborar en el mismo negocio |
| Asistente Virtual IA | Chatbot contextual sobre los datos del negocio (Google Gemini) |
| Panel de Admin | Estadísticas globales, gestión de cuotas, roles de usuario |

---

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + React Router 7 + Tailwind CSS + shadcn/ui |
| Backend | Hono (Cloudflare Workers) |
| Base de datos | Cloudflare D1 (SQLite serverless) |
| Autenticación | Mocha Users Service (Google OAuth) |
| Validación | Zod |
| IA | Google Gemini 2.5 Flash |
| Hosting | Cloudflare Workers (edge global) |

---

## Arquitectura en una línea

```
React SPA → Hono Worker (auth + quota middleware) → D1 (SQLite) + Gemini API
```

El Worker sirve tanto el frontend estático como la API REST. No hay servidores separados.

---

## Sistema de Multi-Negocio

Cada usuario puede crear o unirse a varios **negocios**. Todos los datos (empleados, sueldos, eventos) están aislados por `negocio_id`. El frontend envía el negocio activo en el header `X-Negocio-ID` en cada petición.

Los usuarios se unen a negocios mediante enlaces de invitación con token de un solo uso.

---

## Sistema de Roles y Cuotas

### Roles de usuario

| Rol | Descripción |
|---|---|
| `usuario_basico` | Sujeto a cuotas mensuales configurables |
| `usuario_inteligente` | Sin cuotas, acceso ilimitado |

El rol se almacena en la tabla `users` y se lee de la base de datos en cada request (no del JWT) para garantizar que los cambios sean inmediatos.

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

El middleware de cuotas usa un patrón **increment-then-revert atómico** para evitar condiciones de carrera (TOCTOU).

---

## Módulos de la Aplicación

### Dashboard
- Resumen de estadísticas: empleados activos, eventos del día, temas pendientes
- Acciones rápidas a todos los módulos

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

### Asistente Virtual (Chatbot IA)
- Widget flotante accesible desde cualquier página
- Consultas en lenguaje natural sobre los datos del negocio activo
- Contexto incluye: empleados, sueldos, adelantos, eventos, temas pendientes
- Historial de conversación durante la sesión
- Potenciado por Google Gemini 2.5 Flash

### Panel de Administración
Solo visible para usuarios con rol `administrador` (configurado por email).

- **Estadísticas globales**: total de usuarios, promedios de uso
- **Cuotas del mes**: uso acumulado por herramienta y por usuario+negocio
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
| `GEMINI_API_KEY` | API key de Google Gemini (chatbot) |
| `INITIAL_ADMIN_EMAIL` | Email del primer administrador del sistema |
| `MOCHA_SESSION_TOKEN` | Secret para validar tokens de sesión |

---

## Comandos NPM

```bash
npm run dev          # Servidor de desarrollo
npm run build        # Compilar para producción
npm run check        # Verificar build y configuración
npm run lint         # Ejecutar linter
npm run knip         # Detectar código sin usar
npm run cf-typegen   # Generar tipos de Cloudflare
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
| [Despliegue](docs/deployment.md) | Configuración y variables de entorno |

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

**Versión**: 2.0.0 · **Plataforma**: [Mocha](https://getmocha.com) · **Última actualización**: 2026-04-04
