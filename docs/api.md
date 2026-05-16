# API Documentation

API RESTful construida con Hono en Cloudflare Workers.

## Base URL

```
Producción:  https://<tu-worker>.workers.dev  (o dominio personalizado)
Desarrollo:  http://localhost:5173
```

---

## Autenticación

Todas las rutas `/api/*` (excepto OAuth y verificación de email) requieren una cookie de sesión válida.

```
Cookie: session_token=<jwt>
```

El token se establece automáticamente tras el login con Google OAuth o después de verificar un email pendiente.

---

## Header de Negocio

Todos los endpoints de datos operativos (empleados, sueldos, eventos, etc.) requieren adicionalmente:

```
X-Negocio-ID: <id_del_negocio_activo>
```

Respuestas posibles si falla la validación:
- `400 NEGOCIO_REQUIRED` — header ausente o no numérico.
- `403 NEGOCIO_ACCESS_DENIED` — el usuario no es miembro del negocio.
- `404 NEGOCIO_NOT_FOUND` — el negocio no existe en la base de datos.

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

**Comportamiento especial:** si el usuario todavía no está verificado, este endpoint no crea sesión. En su lugar genera un token de verificación, envía un correo y responde con `error.code = "PENDING_VERIFICATION"`.

**Rate limiting:** máximo 10 intentos por IP en ventanas de 15 minutos. Al excederse devuelve `429 TOO_MANY_REQUESTS` (distinto de `429 USAGE_LIMIT_EXCEEDED` de cuota). El frontend no muestra el modal de upgrade para este código.

#### `GET /api/auth/verify-email`
Valida el token de verificación recibido por email. Si el token es válido, marca al usuario como verificado, crea la cookie `session_token` y devuelve éxito.

```json
// Query string
?token=token_plano_recibido_por_email
```

**Rate limiting:** máximo 5 intentos por IP por hora. Al excederse redirige a `/login?error=too_many_requests` en lugar de procesar el token.

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
  "role": "usuario_basico",
  "email_verified": true
}
```

⚠️ **Nota:** El campo `suscripcion` NO se devuelve actualmente en esta respuesta. Para obtener información de suscripción, usa `GET /api/suscripciones/estado`.

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
{ "calendario": false, "personal": false, "sueldos": false, "compras": false, "facturacion": false }
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
Actualiza un empleado (todos los campos opcionales). Incluye campos de salida que se activan cuando el empleado pasa a inactivo (`is_active: false`).

```json
// Request (campos opcionales)
{
  "name": "María García",
  "role": "Mesera",
  "phone": "5551234567",
  "email": "maria@example.com",
  "hire_date": "2026-01-15",
  "is_active": false,
  "monthly_salary": 8000,
  "ausencia_desde": "2026-04-15",
  "informo": true,
  "cuando_informo": "2026-04-16",
  "sueldo_pendiente": 3200
}
```

Los campos de salida son independientes del campo `is_active` a nivel de API — el backend los almacena sin importar el estado. La UI los muestra condicionalmente solo cuando `is_active` es `false`. `sueldo_pendiente` debe ser `≥ 0`; `ausencia_desde` y `cuando_informo` aceptan `null`.

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
    "remaining": 6500,
    "is_paid": false
  }],
  "totals": {
    "total_salaries": 25000,
    "total_advances": 4500,
    "total_remaining": 18000,
    "total_paid": 7000
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
Lista los registros de pago del negocio. Filtrable por `month` y `year`.

```
GET /api/salary-payments?month=4&year=2026
```

#### `POST /api/salary-payments/mark-paid` ⚠️ *Sujeto a cuota `salary_payments`*
Marca un pago individual como realizado.

```json
{ "employee_id": 1, "period_month": 4, "period_year": 2026, "paid_date": "2026-04-30" }
```

#### `POST /api/salary-payments/mark-all-paid`
Marca todos los pagos pendientes de un período.

⚠️ **Consumo especial de cuota:** Este endpoint **no usa** el middleware estándar `createUsageLimitMiddleware`. En su lugar, implementa lógica inline que consume **N usos** de la cuota `salary_payments` (uno por cada empleado marcado). El incremento es atómico. Si la cuota se agota a mitad de la operación, los empleados ya marcados permanecen pagados pero los restantes no se procesan.

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

#### `PUT /api/compras/:id` ⚠️ *Restringible por owner*
Actualiza una compra (todos los campos opcionales, mismos valores válidos que POST).

**DISCREPANCIA DOCUMENTADA:** La documentación anterior indicaba que `PUT` consume cuota, pero **el código actual NO incluye `createUsageLimitMiddleware`**. Por lo tanto, las actualizaciones de compras **NO consumen cuota** (inconsistencia con la documentación).

#### `DELETE /api/compras/:id` ⚠️ *Restringible por owner*
Elimina una compra. Si tiene `comprobante_key`, también elimina el archivo de R2.

**DISCREPANCIA DOCUMENTADA:** El código actual **NO incluye `createUsageLimitMiddleware`**. Las eliminaciones de compras **NO consumen cuota**.

#### `POST /api/compras/upload` ⚠️ *Requiere autenticación + negocio · Restringible por owner*
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

**NOTA IMPORTANTE:** Este endpoint **NO consume cuota**, aunque cree registros en la base de datos.

#### `GET /api/compras/files/*` ⚠️ *Requiere `X-Negocio-ID`*
Sirve una imagen de comprobante desde R2. La ruta debe estar scoped al negocio actual.

⚠️ **Nota de seguridad:** Esta ruta **no tiene** `createModuleRestrictionMiddleware('compras')`. Un gerente con el módulo `compras` restringido podría acceder a imágenes de comprobantes si conoce la URL directa. Solo se valida que el key de R2 coincida con el `negocio_id` activo para prevenir acceso cross-negocio.

---

### Facturación
*Requieren `X-Negocio-ID`* ⚠️ *Restringible por owner (módulo `facturacion`)*

#### `GET /api/facturacion` ⚠️ *Restringible por owner*
Lista las ventas del negocio para un mes/año dado.

```
GET /api/facturacion?month=4&year=2026
```

```json
// Response data (array)
[{
  "id": 1,
  "negocio_id": 1,
  "user_id": "google_sub_123",
  "fecha": "2026-04-08",
  "monto_total": 1500.50,
  "metodo_pago": "mixto",
  "concepto": "Ventas turno mañana",
  "numero_comprobante": "0001-00001234",
  "notas": "Observaciones",
  "turno": "mañana",
  "pagos_detalle": "[{\"metodo_pago\":\"efectivo\",\"monto\":800},{\"metodo_pago\":\"tarjeta_credito\",\"monto\":700.50}]",
  "created_at": "2026-04-08T12:30:00Z",
  "updated_at": "2026-04-08T12:30:00Z"
}]
```

Parámetros `month` y `year` son opcionales; por defecto se usa el mes y año actuales. Ordenado por `fecha DESC`, luego `created_at DESC`.

#### `GET /api/facturacion/summary` ⚠️ *Restringible por owner*
Totales diarios de ventas para el mes (usado por el calendario de facturación).

```
GET /api/facturacion/summary?month=4&year=2026
```

```json
// Response data (array de totales por día)
[{
  "fecha": "2026-04-08",
  "total_dia": 2500.75,
  "cantidad": 3
}]
```

Ordenado por `fecha ASC`.

#### `POST /api/facturacion` ⚠️ *Sujeto a cuota `facturacion` · Restringible por owner*
Registra una nueva venta.

```json
// Request
{
  "fecha": "2026-04-08",
  "monto_total": 1500.50,
  "turno": "mañana",
  "pagos_detalle": "[{\"metodo_pago\":\"efectivo\",\"monto\":800},{\"metodo_pago\":\"tarjeta_credito\",\"monto\":700.50}]",
  "concepto": "Ventas turno mañana",
  "numero_comprobante": "0001-00001234",
  "notas": "Observaciones"
}
```

**Valores válidos de `turno`:** `"mañana"` | `"tarde"` | `null`

**Valores válidos de `metodo_pago`:** `"efectivo"` | `"tarjeta_credito"` | `"tarjeta_debito"` | `"transferencia"` | `"mercado_pago"` | `"mixto"` | `"otros"`

**Comportamiento real del frontend al enviar este endpoint:**
- Si el usuario carga **una sola fila** de pago → el cliente envía `metodo_pago` con ese método y `pagos_detalle: null`. No se almacena JSON.
- Si el usuario carga **dos o más filas** → el cliente envía `pagos_detalle` (JSON string) y `metodo_pago: null` (el backend lo recalcula).

**Lógica de `metodo_pago` en el backend:** si `pagos_detalle` está presente en el body, el servidor lo parsea y calcula `metodo_pago` automáticamente: 1 método → ese método; 2+ métodos → `"mixto"`. Si el parse de `pagos_detalle` falla, se usa el `metodo_pago` enviado por el cliente tal cual.

#### `PUT /api/facturacion/:id` ⚠️ *Restringible por owner*
Actualiza una venta existente. Solo actualiza los campos proporcionados. Verifica que la venta pertenezca al negocio activo.

**DISCREPANCIA DOCUMENTADA:** La documentación anterior indicaba que `PUT` consume cuota, pero **el código actual NO incluye `createUsageLimitMiddleware`**. Por lo tanto, las actualizaciones de facturas **NO consumen cuota** (inconsistencia con la documentación).

#### `DELETE /api/facturacion/:id` ⚠️ *Restringible por owner*
Elimina una venta. Verifica que pertenezca al negocio activo antes de borrar.

```json
// Response data
{ "deleted": true }
```

**DISCREPANCIA DOCUMENTADA:** La documentación anterior indicaba que `DELETE` consume cuota, pero **el código actual NO incluye `createUsageLimitMiddleware`**. Las eliminaciones de facturas **NO consumen cuota** (inconsistencia con la documentación).

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
    "compras":          { "count": 1, "limit": 50 },
    "facturacion":      { "count": 5, "limit": 50 }
  }
}
```

Para `usuario_inteligente`, todos los `limit` son `null`. Los `count` sí se registran (el middleware también contabiliza sus acciones desde la actualización de cuotas), por lo que el uso real se refleja aunque no haya límites que respetar.

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
  "usage": {
    "employees": 48,
    "salaries": 30,
    "calendar": 22,
    "job_roles": 15,
    "topics": 34,
    "notes": 67,
    "chat": 12,
    "compras": 5,
    "facturacion": 8
  }
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
{ "employees": 5, "job_roles": 3, "topics": 10, "notes": 20, "advances": 10, "salary_payments": 10, "events": 15, "chat": 20, "compras": 50, "facturacion": 50 }
```

#### `PUT /api/admin/usage-limits`
Actualiza los límites mensuales. Solo los tools válidos son aceptados; la actualización es atómica (`db.batch`). Usa `INSERT ... ON CONFLICT DO UPDATE SET` internamente — crea la fila si no existe, la actualiza si existe. Elimina la falla silenciosa que ocurría cuando la fila del tool no existía en `usage_limits`.

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

#### `GET /api/admin/sellers`

- **Auth:** JWT + admin
- **Respuesta `200`:** lista de vendedores activos con estadísticas agregadas (total_referidos, confirmados, comision_total, comision_pendiente, nombre y email del vendedor).

#### `GET /api/admin/referidos`

- **Auth:** JWT + admin
- **Respuesta `200`:** todos los referidos con contexto completo (email y nombre del vendedor, email y nombre del referido, estado del referido, estado de la suscripción, montos de comisión/reembolso, flags de pago).

#### `PUT /api/admin/referidos/:id/comision`

- **Auth:** JWT + admin
- **Body:** ninguno
- **Respuesta `200`:** marca `comision_pagada = 1` en el registro `referidos` indicado.

#### `PUT /api/admin/referidos/:id/reembolso`

- **Auth:** JWT + admin
- **Body:** ninguno
- **Respuesta `200`:** marca `reembolso_pagado = 1` en el registro `referidos` indicado.

---

### Chatbot IA
*Requiere `X-Negocio-ID`* ⚠️ *Sujeto a cuota `chat`*

⚠️ **Nota:** El chatbot **no tiene** `createModuleRestrictionMiddleware`. No es restringible por el owner. Además, el contexto que se envía a DeepSeek incluye datos de **todos** los módulos (empleados, eventos, tópicos, anticipos, pagos) independientemente de si el owner ha restringido algún módulo para gerentes.

#### `POST /api/chat`
Envía un mensaje al asistente virtual IA.

```json
// Request
{
  "message": "¿Cuántos empleados activos tengo?",
  "history": [
    { "role": "user", "content": "Mensaje previo" },
    { "role": "assistant", "content": "Respuesta previa" }
  ]
}

// Response data
{ "response": "Actualmente tienes 5 empleados activos..." }
```

- **`history`**: array opcional de turnos anteriores. El backend usa hasta los últimos 5 items (el frontend envía `slice(-5)`); ítems extra son ignorados. Cada item: `{ role: "user"|"assistant", content: string (1–2000) }`.
- **Contexto enviado al modelo:** empleados activos (`ORDER BY is_active DESC LIMIT 30`), eventos (`ORDER BY event_date ASC LIMIT 20`), tópicos pendientes (`ORDER BY due_date ASC LIMIT 15`), anticipos y pagos de sueldo del mes. Estas consultas se cachean en D1 (`chat_context_cache`) con TTL de 30 minutos.
- Todas las respuestas son en español.

---

## Códigos de Error

| Código | HTTP | Descripción |
|---|---|---|
| `UNAUTHORIZED` | 401 | Sin sesión válida (sin cookie) |
| `INVALID_SESSION` | 401 | Cookie presente pero JWT inválido o expirado |
| `FORBIDDEN` | 403 | Sin permisos para esta acción (ej. demote del propio admin) |
| `MODULE_RESTRICTED` | 403 | El módulo está restringido para gerentes por el owner |
| `NEGOCIO_ACCESS_DENIED` | 403 | El usuario no es miembro del negocio indicado |
| `NOT_FOUND` | 404 | Recurso no encontrado |
| `NEGOCIO_NOT_FOUND` | 404 | El negocio indicado en `X-Negocio-ID` no existe |
| `NEGOCIO_REQUIRED` | 400 | Header `X-Negocio-ID` ausente o no numérico |
| `VALIDATION_ERROR` | 400 | Datos inválidos (detalle en `message`) |
| `USAGE_LIMIT_EXCEEDED` | 429 | Cuota mensual alcanzada. En el frontend este caso puede abrir el modal global de upgrade a Usuario Inteligente |
| `TOO_MANY_REQUESTS` | 429 | Rate limit de auth excedido (distinto de `USAGE_LIMIT_EXCEEDED`; no abre el modal de upgrade) |
| `DUPLICATE_EMAIL` | 409 | Email de admin ya registrado |
| `AUTH_ERROR` | 500 | Error al intercambiar el código OAuth con Google |
| `DATABASE_ERROR` | 500 | Error interno de base de datos |
| `DEEPSEEK_API_ERROR` | 500 | Error en API de DeepSeek |
| `CONFIG_ERROR` | 500 | `DEEPSEEK_API_KEY` no configurada |
| `PENDING_VERIFICATION` | 200 | Usuario sin verificar; se envió email de verificación. No es un error de sesión |

---

### Sellers / Programa de Referidos
*Solo requieren autenticación (sin `X-Negocio-ID`)*

#### `POST /api/sellers/activate`
Registra al usuario autenticado como vendedor y genera su código único de referido.

- **Auth:** JWT
- **Body:** ninguno
- **Respuesta exitosa `201`:** `{ "success": true, "data": { "codigo": "ANA123XX" } }`
- **Error `409`:** el usuario ya es vendedor.

#### `GET /api/sellers/me`
Devuelve el perfil de vendedor, lista de referidos y estadísticas acumuladas.

- **Auth:** JWT
- **Respuesta `200`:**
```json
{
  "vendedor": { "user_id": "...", "codigo": "ANA123XX", "activo": 1, "created_at": "..." },
  "referidos": [{
    "id": 1,
    "referido_user_id": "...",
    "referido_name": "Juan Pérez",
    "referido_email": "juan@example.com",
    "estado": "pendiente",
    "comision_monto": null,
    "comision_pagada": 0,
    "reembolso_monto": null,
    "reembolso_pagado": 0,
    "suscripcion_estado": "autorizada",
    "created_at": "..."
  }],
  "stats": {
    "total_referidos": 3,
    "confirmados": 1,
    "comision_total": 7500,
    "comision_pendiente": 7500
  }
}
```

---

## Suscripciones (MercadoPago)

### `POST /api/suscripciones/crear`

- **Auth:** JWT requerido
- **Body:** `{ "ref_code": "ANA123XX" }` *(opcional)* — código de referido. Si se provee, crea un registro en `referidos` con estado `pendiente` vinculando al vendedor con el comprador. Validado con Zod: `min(1), max(20)`.
- **Respuesta exitosa `201`:**
```json
{ "success": true, "data": { "init_point": "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=..." } }
```
- **Errores:**
  - `400 ALREADY_SUBSCRIBED` — el usuario ya tiene una suscripción activa o en gracia.
  - `502` — fallo al comunicarse con MercadoPago. Cuerpo: `{ "success": false, "error": { "code": string, "message": string, "mp_status": number | null, "mp_detail": string | null } }`.
    - Códigos posibles: `MP_NETWORK_ERROR`, `MP_AUTH_ERROR`, `MP_VALIDATION_ERROR`, `MP_SERVER_ERROR`, `MP_NO_INIT_POINT`.

### `GET /api/suscripciones/estado`

- **Auth:** JWT requerido
- **Respuesta `200`:** `{ "success": true, "data": <registro suscripcion | null> }`. Incluye el campo calculado `grace_days_left: number | null` (días restantes del período de gracia, solo cuando `estado = "en_gracia"`).

### `POST /api/suscripciones/cancelar`

- **Auth:** JWT requerido
- **Body:** ninguno
- **Respuesta exitosa `200`:** `{ "success": true, "data": { "cancelled": true } }`
- **Error `404 NOT_FOUND`** — no hay suscripción activa o en gracia para el usuario.

### `GET /api/suscripciones/pagos`

- **Auth:** JWT requerido
- **Respuesta `200`:** lista con los últimos 5 registros de `pagos_suscripcion` del usuario, ordenados por `fecha_pago DESC`.

### `POST /api/webhooks/mercadopago`

- **Auth:** ninguna (endpoint público). La autenticidad se verifica internamente con firma HMAC (`x-signature` header).
- **Siempre retorna `200`:** `{ "received": true }` — independientemente del resultado del procesamiento.
- **Lógica:**
  - `type=payment` + `status=approved` → rol del usuario a `usuario_inteligente`, suscripción a `autorizada`.
  - `type=payment` + `status=rejected` → suscripción a `en_gracia` con `grace_deadline = último pago + 7 días`.
  - `type=preapproval` + `status=authorized|cancelled|paused` → actualiza estado y rol.

### `GET /api/admin/suscripciones`

- **Auth:** JWT + admin
- **Query param opcional:** `?estado=autorizada|pendiente|cancelada|en_gracia|pausada`
- **Respuesta `200`:** lista de suscripciones con datos del usuario (`email`, `name`, `role`) y contadores `total_pagos` y `pagos_ok`.

### `GET /api/admin/suscripciones/:userId/pagos`

- **Auth:** JWT + admin
- **Respuesta `200`:** últimos 100 registros de `pagos_suscripcion` para el usuario especificado, ordenados por `fecha_pago DESC`.

---

## Notas Generales

- **Total de endpoints**: 89 rutas registradas en el Worker (GET, POST, PUT, DELETE).
- **Sin paginación**: todos los listados retornan el conjunto completo. Filtrado se realiza en cliente.
- **Rate limiting**: solo los endpoints de autenticación tienen rate limiting propio (`POST /api/sessions`: 10/15 min por IP; `GET /api/auth/verify-email`: 5/hr por IP). El resto de endpoints no tiene rate limiting a nivel de aplicación; Cloudflare Workers aplica 100,000 req/día en Free tier.
- **CORS**: no configurado explícitamente; funciona por same-origin (SPA y API servidos por el mismo Worker via `not_found_handling: single-page-application`).

### Notas sobre cuotas por endpoint

| Endpoint | Middleware de cuota | Notas |
|---|---|---|
| `POST /api/employees` | `usageLimitMiddleware('employees')` | Estándar |
| `POST /api/job-roles` | `usageLimitMiddleware('job_roles')` | Estándar |
| `POST /api/employees/:id/topics` | `usageLimitMiddleware('topics')` | Estándar |
| `POST /api/topics/:id/notes` | `usageLimitMiddleware('notes')` | Estándar |
| `POST /api/employees/:id/advances` | `usageLimitMiddleware('advances')` | Estándar |
| `POST /api/salary-payments/mark-paid` | `usageLimitMiddleware('salary_payments')` | Estándar |
| `POST /api/salary-payments/mark-all-paid` | **Lógica inline** | N usos (1 por empleado). No usa middleware |
| `POST /api/events` | `usageLimitMiddleware('events')` | Estándar |
| `POST /api/chat` | `usageLimitMiddleware('chat')` | Estándar |
| `POST /api/compras` | `usageLimitMiddleware('compras')` | Estándar |
| `PUT /api/compras/:id` | `usageLimitMiddleware('compras')` | **Excepcional:** PUT también consume cuota |
| `POST /api/facturacion` | `usageLimitMiddleware('facturacion')` | Estándar |
| `PUT /api/facturacion/:id` | `usageLimitMiddleware('facturacion')` | PUT también consume cuota |
| `DELETE /api/facturacion/:id` | `usageLimitMiddleware('facturacion')` | DELETE también consume cuota |

### Notas sobre restricciones de módulo

| Ruta | Módulo | Restricción | Notas |
|---|---|---|---|
| `/api/employees*`, `/api/job-roles*`, `/api/topics*`, `/api/notes*` | `personal` | Sí | Todos los endpoints |
| `/api/events*` | `calendario` | Sí | Todos los endpoints |
| `/api/salaries*`, `/api/advances*`, `/api/salary-payments*` | `sueldos` | Sí | Todos los endpoints |
| `/api/compras` (CRUD + upload + summary) | `compras` | Sí | Todos excepto files |
| `GET /api/compras/files/*` | `compras` | **No** | Solo valida auth + negocio |
| `/api/facturacion` (CRUD + summary) | `facturacion` | Sí | Todos los endpoints |
| `POST /api/chat` | — | **No** | No restringible por owner |
