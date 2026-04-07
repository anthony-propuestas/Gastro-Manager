# API Documentation

API RESTful construida con Hono en Cloudflare Workers.

## Base URL

```
Producción:  https://<tu-worker>.workers.dev  (o dominio personalizado)
Desarrollo:  http://localhost:5173
```

---

## Autenticación

Todas las rutas `/api/*` (excepto OAuth) requieren una cookie de sesión válida.

```
Cookie: session_token=<jwt>
```

El token se establece automáticamente tras el login con Google OAuth.

---

## Header de Negocio

Todos los endpoints de datos operativos (empleados, sueldos, eventos, etc.) requieren adicionalmente:

```
X-Negocio-ID: <id_del_negocio_activo>
```

Si el header está ausente o el usuario no es miembro del negocio, la respuesta es `403 FORBIDDEN`.

**Convención de frontend:** las pantallas y hooks React deben enviar este header usando `apiFetch(url, options, negocioId)` desde `src/react-app/lib/api.ts`, en lugar de construir el header manualmente o usar `fetch` directo.

---

## Formato de Respuestas

```json
// Éxito
{ "success": true, "data": { ... } }

// Error
{ "success": false, "error": { "code": "ERROR_CODE", "message": "Descripción" } }
```

---

## Endpoints

### Autenticación

#### `GET /api/oauth/google/redirect_url`
Obtiene la URL de redirección para iniciar Google OAuth.

#### `POST /api/sessions`
Intercambia el código OAuth por una cookie de sesión. Persiste al usuario en la tabla `users` (UPSERT).

```json
// Request
{ "code": "oauth_code_from_google" }
```

#### `GET /api/logout`
Cierra la sesión del usuario actual. Elimina la cookie `session_token`.

#### `GET /api/users/me`
Información del usuario autenticado.

```json
// Response data
{
  "id": "google_sub_123",
  "email": "usuario@example.com",
  "name": "Juan Pérez",
  "picture": "https://...",
  "role": "usuario_basico"
}
```

---

### Negocios

#### `POST /api/negocios`
Crea un nuevo negocio. El creador queda automáticamente como miembro.

```json
// Request
{ "name": "Restaurante La Paloma" }
```

#### `GET /api/negocios`
Lista los negocios en los que el usuario es miembro.

```json
// Response data (array)
[{
  "id": 1,
  "name": "Restaurante La Paloma",
  "created_by": "google_sub_123",
  "created_at": "2026-01-15T10:00:00Z",
  "members": [{ "user_id": "...", "user_email": "...", "user_name": "..." }]
}]
```

**Uso en frontend:** esta colección alimenta el selector de negocio del sidebar. Cambiar el negocio activo no cambia la membresía del usuario; solo cambia el contexto operativo para requests posteriores.

#### `GET /api/negocios/:id`
Detalle de un negocio (solo si el usuario es miembro).

#### `POST /api/negocios/:id/invitations`
Genera un enlace de invitación de un solo uso para unirse al negocio.

```json
// Response data
{ "inviteUrl": "https://<dominio>/invite/abc123token" }
```

#### `GET /api/invitations/:token`
Verifica un token de invitación sin canjearlo.

```json
// Response data
{ "negocioName": "Restaurante La Paloma", "invitedBy": "admin@example.com" }
```

#### `POST /api/invitations/:token/redeem`
Canjea el token: agrega al usuario autenticado como miembro del negocio. El token queda invalidado.

#### `DELETE /api/negocios/:id/members/:userId`
Expulsa a un miembro del negocio (solo el creador puede hacerlo).

#### `DELETE /api/negocios/:id/leave`
El usuario actual abandona el negocio.

---

### Sistema de Owner
*Solo requieren autenticación (sin `X-Negocio-ID`)*

#### `GET /api/negocios/:id/my-owner-request`
Consulta el estado del usuario respecto al rol owner en un negocio.

```json
// Response data
{ "status": "none" }       // No es owner ni tiene solicitud
{ "status": "owner" }      // Ya es owner
{ "status": "pending" }    // Solicitud pendiente de aprobación
```

#### `POST /api/negocios/:id/request-owner`
Solicita ser `owner` del negocio. Crea un registro en `owner_requests` con `status = 'pending'`.

#### `GET /api/negocios/:id/owner-requests`
Lista las solicitudes de owner pendientes (solo owners del negocio).

```json
// Response data (array)
[{
  "id": 1,
  "user_id": "google_sub_456",
  "user_name": "María García",
  "user_email": "maria@example.com",
  "status": "pending",
  "requested_at": "2026-04-01T10:00:00Z"
}]
```

#### `POST /api/negocios/:id/owner-requests/:requestId/approve`
Aprueba una solicitud de owner (solo owners). Actualiza `negocio_members.negocio_role` a `'owner'`.

#### `POST /api/negocios/:id/owner-requests/:requestId/reject`
Rechaza una solicitud de owner (solo owners).

---

### Restricciones de Módulos
*Solo requieren autenticación (sin `X-Negocio-ID`)*

#### `GET /api/negocios/:id/module-restrictions`
Obtiene las restricciones de módulos del negocio (cualquier miembro puede consultar).

```json
// Response data
{ "calendario": false, "personal": false, "sueldos": false, "compras": false }
```

#### `PUT /api/negocios/:id/module-restrictions`
Activa o desactiva la restricción de un módulo para los gerentes (solo owners).

```json
// Request
{ "module_key": "compras", "is_restricted": true }
```

---

### Preferencias de Módulos
*Solo requieren autenticación (sin `X-Negocio-ID`)*

#### `GET /api/modules/prefs`
Obtiene las preferencias de visibilidad de módulos del usuario. Módulos sin fila devuelven `true` por defecto.

```json
// Response data
{ "calendario": true, "compras": true, "personal": true, "sueldos": false }
```

#### `PUT /api/modules/prefs`
Activa o desactiva un módulo para el usuario. Upsert via `ON CONFLICT`.

```json
// Request
{ "module_key": "sueldos", "is_active": false }
```

Las restricciones por negocio del owner viven aparte en `GET/PUT /api/negocios/:id/module-restrictions` y sí dependen de `X-Negocio-ID` cuando se consultan desde el frontend operativo.

---

### Empleados
*Requieren `X-Negocio-ID`* ⚠️ *Restringible por owner (módulo `personal`)*

#### `GET /api/employees`
Lista todos los empleados del negocio activo.

#### `GET /api/employees/:id`
Detalle de un empleado.

#### `POST /api/employees` ⚠️ *Sujeto a cuota `employees`*
Crea un empleado.

```json
// Request
{
  "name": "María García",
  "role": "Mesera",
  "phone": "5551234567",
  "email": "maria@example.com",
  "hire_date": "2026-01-15",
  "is_active": true,
  "monthly_salary": 8000
}
```

#### `PUT /api/employees/:id`
Actualiza un empleado (todos los campos opcionales).

#### `DELETE /api/employees/:id`
Elimina un empleado.

---

### Puestos de Trabajo
*Requieren `X-Negocio-ID`* ⚠️ *Restringible por owner (módulo `personal`)*

#### `GET /api/job-roles`
Lista los puestos personalizados del negocio.

#### `POST /api/job-roles` ⚠️ *Sujeto a cuota `job_roles`*
```json
{ "name": "Supervisor de Barra" }
```

#### `DELETE /api/job-roles/:id`
Elimina un puesto personalizado.

---

### Tópicos
*Requieren `X-Negocio-ID`* ⚠️ *Restringible por owner (módulo `personal`)*

#### `GET /api/employees/:employeeId/topics`
Lista los tópicos de un empleado.

#### `POST /api/employees/:employeeId/topics` ⚠️ *Sujeto a cuota `topics`*
```json
{
  "title": "Capacitación en seguridad alimentaria",
  "due_date": "2026-05-01",
  "due_time": "14:00"
}
```

#### `PUT /api/topics/:id`
Actualiza un tópico (incluyendo `is_open`).

#### `DELETE /api/topics/:id`
Elimina un tópico.

#### `GET /api/topics/deadlines`
Lista todos los tópicos abiertos con fecha límite del negocio.

```json
// Response data (array)
[{
  "id": 1,
  "employee_id": 5,
  "employee_name": "María García",
  "title": "Capacitación seguridad",
  "is_open": 1,
  "due_date": "2026-05-01",
  "due_time": "14:00"
}]
```

---

### Notas
*Requieren `X-Negocio-ID`* ⚠️ *Restringible por owner (módulo `personal`)*

#### `GET /api/topics/:topicId/notes`
Lista las notas de un tópico.

#### `POST /api/topics/:topicId/notes` ⚠️ *Sujeto a cuota `notes`*
```json
{ "content": "Completó el módulo 1 de seguridad alimentaria" }
```

#### `PUT /api/notes/:id`
Actualiza el contenido de una nota.

#### `DELETE /api/notes/:id`
Elimina una nota.

---

### Eventos
*Requieren `X-Negocio-ID`* ⚠️ *Restringible por owner (módulo `calendario`)*

#### `GET /api/events`
Lista eventos del negocio. Soporta filtros por mes y año.

```
GET /api/events?month=4&year=2026
```

#### `GET /api/events/:id`
Detalle de un evento.

#### `POST /api/events` ⚠️ *Sujeto a cuota `events`*
```json
{
  "title": "Reunión de equipo",
  "description": "Revisión mensual de indicadores",
  "event_date": "2026-04-15",
  "start_time": "10:00",
  "end_time": "11:30",
  "event_type": "meeting",
  "location": "Sala principal"
}
```

#### `PUT /api/events/:id`
Actualiza un evento.

#### `DELETE /api/events/:id`
Elimina un evento.

---

### Sueldos
*Requieren `X-Negocio-ID`* ⚠️ *Restringible por owner (módulo `sueldos`)*

#### `GET /api/salaries/overview`
Resumen de sueldos del mes para todos los empleados activos.

```
GET /api/salaries/overview?month=4&year=2026
```

```json
// Response data
{
  "employees": [{
    "id": 1,
    "name": "María García",
    "monthly_salary": 8000,
    "advances_total": 1500,
    "net_amount": 6500,
    "is_paid": 0
  }],
  "totals": {
    "total_salaries": 25000,
    "total_advances": 4500,
    "total_net": 20500,
    "paid_count": 2,
    "pending_count": 3
  }
}
```

---

### Anticipos
*Requieren `X-Negocio-ID`* ⚠️ *Restringible por owner (módulo `sueldos`)*

#### `GET /api/employees/:employeeId/advances`
Lista anticipos de un empleado. Filtrable por `month` y `year`.

#### `POST /api/employees/:employeeId/advances` ⚠️ *Sujeto a cuota `advances`*
```json
{
  "amount": 1000,
  "period_month": 4,
  "period_year": 2026,
  "advance_date": "2026-04-10",
  "description": "Anticipo de quincena"
}
```

#### `DELETE /api/advances/:id`
Elimina un anticipo.

---

### Pagos de Sueldo
*Requieren `X-Negocio-ID`* ⚠️ *Restringible por owner (módulo `sueldos`)*

#### `GET /api/salary-payments`
Lista los registros de pago del negocio.

#### `POST /api/salary-payments/mark-paid` ⚠️ *Sujeto a cuota `salary_payments`*
Marca un pago individual como realizado.

```json
{ "employee_id": 1, "period_month": 4, "period_year": 2026, "paid_date": "2026-04-30" }
```

#### `POST /api/salary-payments/mark-all-paid`
Marca todos los pagos pendientes de un período. Cuenta N usos de la cuota `salary_payments` (uno por empleado marcado). El incremento es atómico.

```json
{ "period_month": 4, "period_year": 2026, "paid_date": "2026-04-30" }
```

---

### Compras
*Requieren `X-Negocio-ID`*

#### `GET /api/compras` ⚠️ *Restringible por owner*
Lista las compras del negocio. Filtrable por `month` y `year`.

```
GET /api/compras?month=4&year=2026
```

```json
// Response data (array)
[{
  "id": 1,
  "negocio_id": 1,
  "user_id": "google_sub_123",
  "fecha": "2026-04-10",
  "monto": 3500.00,
  "item": "Carne vacuna",
  "tipo": "producto",
  "categoria": "carnes",
  "comprador_id": 2,
  "descripcion": "Compra semanal",
  "comprobante_key": null,
  "created_at": "2026-04-10T14:00:00Z",
  "updated_at": "2026-04-10T14:00:00Z"
}]
```

#### `GET /api/compras/summary` ⚠️ *Restringible por owner*
Totales diarios de compras para el mes (usado por la grilla del calendario de compras).

```
GET /api/compras/summary?month=4&year=2026
```

```json
// Response data (array de totales por día)
[{
  "fecha": "2026-04-10",
  "total_dia": 3500.00,
  "total_productos": 2800.00,
  "total_servicios": 700.00,
  "cantidad": 3
}]
```

#### `POST /api/compras` ⚠️ *Sujeto a cuota `compras` · Restringible por owner*
Registra una nueva compra.

```json
// Request
{
  "fecha": "2026-04-10",
  "monto": 3500.00,
  "item": "Carne vacuna",
  "tipo": "producto",
  "categoria": "carnes",
  "comprador_id": 2,
  "descripcion": "Compra semanal"
}
```

**Valores válidos de `tipo`:** `"producto"` | `"servicio"`

**Valores válidos de `categoria`:** `"carnes"` | `"verduras"` | `"bebidas"` | `"limpieza"` | `"descartables"` | `"servicios"` | `"mantenimiento"` | `"alquiler"` | `"otros"`

#### `PUT /api/compras/:id` ⚠️ *Sujeto a cuota `compras` · Restringible por owner*
Actualiza una compra (todos los campos opcionales, mismos valores válidos que POST).

#### `DELETE /api/compras/:id` ⚠️ *Restringible por owner*
Elimina una compra. Si tiene `comprobante_key`, también elimina el archivo de R2.

#### `POST /api/compras/upload` ⚠️ *Restringible por owner*
Sube una imagen de comprobante a Cloudflare R2.

```
Content-Type: multipart/form-data
Body: file (campo "file")
```

**Restricciones:**
- Tamaño máximo: 5 MB
- Tipos aceptados: `image/jpeg`, `image/png`, `image/webp`, `image/heic`

```json
// Response data
{ "key": "compras/1/abc123.jpg" }
```

La key devuelta se usa como `comprobante_key` al crear o actualizar la compra.

#### `GET /api/compras/files/*` ⚠️ *Requiere `X-Negocio-ID`*
Sirve una imagen de comprobante desde R2. La ruta debe estar scoped al negocio actual.

---

### Cuotas del Usuario

#### `GET /api/usage/me`
*Requiere `X-Negocio-ID`*

Devuelve el uso actual y los límites del usuario para el negocio activo en el periodo corriente.

```json
// Response data
{
  "period": "2026-04",
  "role": "usuario_basico",
  "usage": {
    "employees":        { "count": 3, "limit": 5 },
    "job_roles":        { "count": 1, "limit": 3 },
    "topics":           { "count": 7, "limit": 10 },
    "notes":            { "count": 12, "limit": 20 },
    "advances":         { "count": 2, "limit": 10 },
    "salary_payments":  { "count": 5, "limit": 10 },
    "events":           { "count": 4, "limit": 15 },
    "chat":             { "count": 8, "limit": 20 },
    "compras":          { "count": 1, "limit": null }
  }
}
```

Para `usuario_inteligente`, todos los `limit` son `null`.

---

### Administración
*Solo accesible con rol administrador*

#### `GET /api/admin/check`
Verifica si el usuario actual es administrador.

```json
// Response data
{ "isAdmin": true }
```

#### `GET /api/admin/stats`
Estadísticas globales del sistema.

```json
// Response data
{
  "totalUsers": 32,
  "registeredEmails": 32,
  "avgEmployees": 7.4,
  "avgEvents": 11.2,
  "usage": { "employees": 48, "salaries": 30, "calendar": 22 }
}
```

#### `GET /api/admin/emails`
Lista todos los administradores registrados.

#### `POST /api/admin/emails`
Agrega un email como administrador.
```json
{ "email": "nuevo_admin@example.com" }
```

#### `DELETE /api/admin/emails/:id`
Elimina un administrador (no puede eliminar al admin inicial).

---

#### `GET /api/admin/usage`
Uso mensual desglosado por **usuario + negocio**. Devuelve una fila por cada par (usuario, negocio) que tenga actividad en el periodo actual.

```json
// Response data
{
  "period": "2026-04",
  "rows": [{
    "user_id": "google_sub_123",
    "email": "usuario@example.com",
    "role": "usuario_basico",
    "negocio_id": 1,
    "negocio_name": "Restaurante La Paloma",
    "usage": { "employees": 3, "events": 5, "chat": 8 }
  }]
}
```

#### `GET /api/admin/usage-limits`
Devuelve los límites mensuales actuales para todas las herramientas.

```json
// Response data
{ "employees": 5, "job_roles": 3, "topics": 10, "notes": 20, "advances": 10, "salary_payments": 10, "events": 15, "chat": 20, "compras": null }
```

#### `PUT /api/admin/usage-limits`
Actualiza los límites mensuales. Solo los tools válidos son aceptados; la actualización es atómica (`db.batch`).

```json
// Request (campos parciales permitidos)
{ "employees": 10, "chat": 50 }
```

---

#### `GET /api/admin/users`
Lista todos los usuarios registrados con su rol actual.

```json
// Response data (array)
[{
  "id": "google_sub_123",
  "email": "usuario@example.com",
  "name": "Juan Pérez",
  "role": "usuario_basico",
  "created_at": "2026-01-10T09:00:00Z"
}]
```

#### `POST /api/admin/users/:userId/promote`
Promueve a `usuario_inteligente`. No tiene efecto si ya lo es.

#### `POST /api/admin/users/:userId/demote`
Regresa a `usuario_basico`. No puede aplicarse al propio admin (devuelve `403`).

---

### Chatbot IA
*Requiere `X-Negocio-ID`* ⚠️ *Sujeto a cuota `chat`*

#### `POST /api/chat`
Envía un mensaje al asistente virtual (Google Gemini 2.5 Flash).

```json
// Request
{ "message": "¿Cuántos empleados activos tengo?" }

// Response data
{ "response": "Actualmente tienes 5 empleados activos..." }
```

El contexto enviado a Gemini incluye: empleados activos, sueldos del mes, anticipos, eventos del mes, tópicos pendientes. Todas las respuestas son en español.

---

## Códigos de Error

| Código | HTTP | Descripción |
|---|---|---|
| `UNAUTHORIZED` | 401 | Sin sesión válida |
| `FORBIDDEN` | 403 | Sin permisos para esta acción |
| `NOT_FOUND` | 404 | Recurso no encontrado |
| `VALIDATION_ERROR` | 400 | Datos inválidos (detalle en `message`) |
| `USAGE_LIMIT_EXCEEDED` | 429 | Cuota mensual alcanzada |
| `DUPLICATE_EMAIL` | 409 | Email de admin ya registrado |
| `DATABASE_ERROR` | 500 | Error interno de base de datos |
| `OAUTH_ERROR` | 400 | Error en autenticación OAuth |
| `GEMINI_ERROR` | 500 | Error en API de Gemini |
| `API_KEY_MISSING` | 500 | `GEMINI_API_KEY` no configurada |

---

## Notas Generales

- **Sin paginación**: todos los listados retornan el conjunto completo. Filtrado se realiza en cliente.
- **Sin rate limiting propio**: Cloudflare Workers aplica 100,000 req/día en Free tier.
- **CORS**: no configurado explícitamente; funciona por same-origin (SPA y API servidos por el mismo Worker via `not_found_handling: single-page-application`).
