# API Documentation

API RESTful construida con Hono en Cloudflare Workers.

## Base URL

```
Production: https://gastro-manager.mocha.app
Development: http://localhost:5173
```

## Autenticación

Todas las rutas `/api/*` (excepto OAuth) requieren autenticación.

### Headers

```
Cookie: mocha_session_token=<token>
```

El token se establece automáticamente después del login con Google OAuth.

## Formato de Respuestas

### Success Response

```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Descripción del error"
  }
}
```

## Endpoints

### Autenticación

#### `GET /api/oauth/google/redirect_url`

Obtiene la URL de redirección para iniciar login con Google.

**Response:**
```json
{
  "redirectUrl": "https://accounts.google.com/..."
}
```

#### `POST /api/sessions`

Intercambia el código OAuth por un token de sesión.

**Request Body:**
```json
{
  "code": "oauth_code_from_google"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "session_token"
  }
}
```

#### `DELETE /api/sessions`

Cierra la sesión del usuario actual.

**Response:**
```json
{
  "success": true,
  "data": {}
}
```

#### `GET /api/users/me`

Obtiene información del usuario autenticado.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "email": "usuario@example.com",
    "name": "Juan Pérez",
    "picture": "https://..."
  }
}
```

---

### Empleados

#### `GET /api/employees`

Lista todos los empleados del usuario.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "María García",
      "role": "Mesera",
      "phone": "1234567890",
      "email": "maria@example.com",
      "hire_date": "2024-01-15",
      "is_active": 1,
      "monthly_salary": 8000,
      "created_at": "2024-01-01T10:00:00Z",
      "updated_at": "2024-01-15T14:30:00Z"
    }
  ]
}
```

#### `POST /api/employees`

Crea un nuevo empleado.

**Request Body:**
```json
{
  "name": "Carlos López",
  "role": "Cocinero",
  "phone": "0987654321",
  "email": "carlos@example.com",
  "hire_date": "2024-03-01",
  "is_active": true,
  "monthly_salary": 10000
}
```

**Validaciones:**
- `name`: requerido, 1-100 caracteres
- `role`: requerido, 1-50 caracteres
- `phone`: opcional, máx 20 caracteres
- `email`: opcional, formato válido
- `monthly_salary`: 0-1,000,000

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "Carlos López",
    ...
  }
}
```

#### `GET /api/employees/:id`

Obtiene un empleado específico.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "María García",
    ...
  }
}
```

#### `PUT /api/employees/:id`

Actualiza un empleado existente.

**Request Body:** (todos los campos opcionales)
```json
{
  "name": "María García Pérez",
  "monthly_salary": 8500,
  "is_active": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "María García Pérez",
    ...
  }
}
```

#### `DELETE /api/employees/:id`

Elimina un empleado.

**Response:**
```json
{
  "success": true,
  "data": {}
}
```

---

### Puestos de Trabajo

#### `GET /api/job-roles`

Lista los puestos personalizados del usuario.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Supervisor de Cocina",
      "created_at": "2024-01-01T10:00:00Z"
    }
  ]
}
```

#### `POST /api/job-roles`

Crea un nuevo puesto personalizado.

**Request Body:**
```json
{
  "name": "Bartender"
}
```

#### `DELETE /api/job-roles/:id`

Elimina un puesto personalizado.

---

### Tópicos

#### `GET /api/employees/:employeeId/topics`

Lista los tópicos de un empleado.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "employee_id": 1,
      "title": "Capacitación en seguridad",
      "is_open": 1,
      "due_date": "2024-04-15",
      "due_time": "14:00",
      "created_at": "2024-03-01T10:00:00Z"
    }
  ]
}
```

#### `POST /api/employees/:employeeId/topics`

Crea un tópico para un empleado.

**Request Body:**
```json
{
  "title": "Evaluación de desempeño",
  "due_date": "2024-05-01",
  "due_time": "10:00"
}
```

**Validaciones:**
- `title`: requerido, 1-200 caracteres
- `due_date`: opcional, formato válido
- `due_time`: opcional, formato HH:MM

#### `PUT /api/topics/:id`

Actualiza un tópico.

**Request Body:**
```json
{
  "title": "Evaluación trimestral",
  "is_open": false
}
```

#### `DELETE /api/topics/:id`

Elimina un tópico.

#### `GET /api/topics/deadlines`

Obtiene todos los tópicos con deadline del usuario.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "employee_id": 1,
      "employee_name": "María García",
      "title": "Capacitación",
      "is_open": 1,
      "due_date": "2024-04-15",
      "due_time": "14:00"
    }
  ]
}
```

---

### Notas

#### `GET /api/topics/:topicId/notes`

Lista las notas de un tópico.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "topic_id": 1,
      "content": "Completó el módulo 1 de capacitación",
      "created_at": "2024-03-15T10:00:00Z"
    }
  ]
}
```

#### `POST /api/topics/:topicId/notes`

Crea una nota en un tópico.

**Request Body:**
```json
{
  "content": "Pendiente: revisar certificado"
}
```

**Validaciones:**
- `content`: requerido, 1-1000 caracteres

#### `PUT /api/notes/:id`

Actualiza una nota.

#### `DELETE /api/notes/:id`

Elimina una nota.

---

### Eventos

#### `GET /api/events`

Lista eventos del usuario.

**Query Parameters:**
- `month`: Mes (1-12, opcional)
- `year`: Año (opcional)

**Ejemplo:** `/api/events?month=3&year=2024`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Reunión de equipo",
      "description": "Revisión mensual",
      "event_date": "2024-03-15",
      "start_time": "10:00",
      "end_time": "11:00",
      "event_type": "meeting",
      "location": "Oficina principal",
      "created_at": "2024-03-01T10:00:00Z"
    }
  ]
}
```

#### `POST /api/events`

Crea un evento.

**Request Body:**
```json
{
  "title": "Entrega de uniformes",
  "description": "Nuevos uniformes para staff",
  "event_date": "2024-04-01",
  "start_time": "09:00",
  "end_time": "12:00",
  "event_type": "task",
  "location": "Almacén"
}
```

**Validaciones:**
- `title`: requerido, 1-200 caracteres
- `description`: opcional, máx 1000 caracteres
- `event_date`: requerido, fecha válida
- `start_time`, `end_time`: formato HH:MM
- `location`: máx 200 caracteres

#### `PUT /api/events/:id`

Actualiza un evento.

#### `DELETE /api/events/:id`

Elimina un evento.

---

### Sueldos

#### `GET /api/salaries/overview`

Obtiene resumen de sueldos del mes.

**Query Parameters:**
- `month`: Mes (1-12)
- `year`: Año

**Ejemplo:** `/api/salaries/overview?month=3&year=2024`

**Response:**
```json
{
  "success": true,
  "data": {
    "employees": [
      {
        "id": 1,
        "name": "María García",
        "monthly_salary": 8000,
        "advances_total": 1500,
        "net_amount": 6500,
        "is_paid": 0
      }
    ],
    "totals": {
      "total_salaries": 25000,
      "total_advances": 4500,
      "total_net": 20500,
      "paid_count": 2,
      "pending_count": 3
    }
  }
}
```

---

### Adelantos

#### `GET /api/employees/:employeeId/advances`

Lista adelantos de un empleado.

**Query Parameters:**
- `month`: Mes (opcional)
- `year`: Año (opcional)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "employee_id": 1,
      "amount": 500,
      "period_month": 3,
      "period_year": 2024,
      "advance_date": "2024-03-10",
      "description": "Adelanto para gastos médicos",
      "created_at": "2024-03-10T10:00:00Z"
    }
  ]
}
```

#### `POST /api/employees/:employeeId/advances`

Registra un adelanto.

**Request Body:**
```json
{
  "amount": 1000,
  "period_month": 3,
  "period_year": 2024,
  "advance_date": "2024-03-15",
  "description": "Adelanto de quincena"
}
```

**Validaciones:**
- `amount`: requerido, 0.01-1,000,000
- `period_month`: 1-12 (default: mes actual)
- `period_year`: 2000-2100 (default: año actual)

#### `DELETE /api/advances/:id`

Elimina un adelanto.

---

### Pagos de Sueldos

#### `POST /api/salary-payments`

Crea un registro de pago de sueldo.

**Request Body:**
```json
{
  "employee_id": 1,
  "period_month": 3,
  "period_year": 2024,
  "salary_amount": 8000,
  "advances_total": 1500,
  "net_amount": 6500
}
```

#### `PUT /api/salary-payments/:id/mark-paid`

Marca un pago como realizado.

**Request Body:**
```json
{
  "paid_date": "2024-04-01"
}
```

#### `POST /api/salary-payments/mark-all-paid`

Marca todos los pagos pendientes de un período como pagados.

**Request Body:**
```json
{
  "period_month": 3,
  "period_year": 2024,
  "paid_date": "2024-04-01"
}
```

---

### Administración

#### `GET /api/admin/check`

Verifica si el usuario actual es administrador.

**Response:**
```json
{
  "success": true,
  "data": {
    "isAdmin": true
  }
}
```

#### `GET /api/admin/stats`

Obtiene estadísticas generales del sistema (solo admins).

**Response:**
```json
{
  "success": true,
  "data": {
    "totalUsers": 25,
    "totalEmails": 25,
    "avgEmployeesPerUser": 8.5,
    "avgEventsPerUser": 12.3,
    "usageBreakdown": {
      "employees": 45,
      "salaries": 30,
      "calendar": 25
    }
  }
}
```

#### `GET /api/admin/emails`

Lista todos los emails de administradores (solo admins).

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "email": "admin@example.com",
      "added_by": "initial_admin@example.com",
      "created_at": "2024-01-01T10:00:00Z"
    }
  ]
}
```

#### `POST /api/admin/emails`

Agrega un email como administrador (solo admins).

**Request Body:**
```json
{
  "email": "nuevo_admin@example.com"
}
```

#### `DELETE /api/admin/emails/:id`

Elimina un administrador (solo admins).

---

### Chatbot (Asistente Virtual IA)

#### `POST /api/chat`

Envía una pregunta al asistente virtual potenciado por Google Gemini.

**Request Body:**
```json
{
  "message": "¿Cuántos empleados activos tengo?"
}
```

**Validaciones:**
- `message`: requerido, 1-1000 caracteres

**Response (éxito):**
```json
{
  "success": true,
  "data": {
    "response": "Actualmente tienes 5 empleados activos en tu restaurante. Los roles incluyen: 2 meseros, 1 cocinero, 1 cajero y 1 supervisor."
  }
}
```

**Response (error de API key):**
```json
{
  "success": false,
  "error": "GEMINI_API_KEY no está configurada"
}
```

**Response (error de Gemini):**
```json
{
  "success": false,
  "error": "API de Gemini: [mensaje de error específico]"
}
```

**Contexto disponible para el chatbot:**

El asistente tiene acceso a los siguientes datos del usuario:
- Lista completa de empleados (nombre, puesto, salario, estado)
- Eventos del mes actual
- Tópicos pendientes con fechas límite
- Adelantos registrados
- Estado de pagos de sueldos

**Ejemplos de preguntas:**
- "¿Cuántos empleados activos tengo?"
- "¿Quiénes tienen tópicos vencidos?"
- "¿Cuál es el total de sueldos de este mes?"
- "¿Qué eventos tengo programados?"
- "¿Cuánto debo en adelantos?"

**Detalles técnicos:**
- Modelo: Google Gemini 2.5 Flash
- Endpoint: `https://generativelanguage.googleapis.com/v1beta/`
- Idioma de respuestas: Español
- Timeout: 30 segundos
- Requiere: `GEMINI_API_KEY` configurada en secretos

---

## Códigos de Error

| Código | Descripción |
|--------|-------------|
| `UNAUTHORIZED` | No autenticado o sesión inválida |
| `FORBIDDEN` | Sin permisos para esta acción |
| `NOT_FOUND` | Recurso no encontrado |
| `VALIDATION_ERROR` | Datos inválidos |
| `DUPLICATE_EMAIL` | Email de admin ya existe |
| `DATABASE_ERROR` | Error en base de datos |
| `OAUTH_ERROR` | Error en autenticación OAuth |
| `GEMINI_ERROR` | Error en API de Gemini (chatbot) |
| `API_KEY_MISSING` | GEMINI_API_KEY no configurada |

## Rate Limiting

No hay rate limiting actual, pero Cloudflare Workers tiene límites:
- **Free tier**: 100,000 requests/día
- **Paid tier**: 10M+ requests/mes

## CORS

CORS está habilitado para el dominio de la aplicación.

## Paginación

Actualmente no hay paginación implementada. Para datasets grandes, considerar agregar:

```
GET /api/employees?page=1&limit=20
```

## Filtering y Sorting

No implementado actualmente. Filtrado se hace en cliente.

Posible mejora futura:
```
GET /api/employees?role=Mesero&is_active=1&sort=name
```

## Webhooks

No hay webhooks implementados. Todas las actualizaciones son síncronas.

## Versionado

No hay versionado de API actualmente. Cambios breaking serían manejados con:
```
/api/v2/employees
```

## Testing

Puedes probar la API con:

```bash
# Login (obtener código OAuth manualmente)
curl -X POST https://gastro-manager.mocha.app/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"code": "oauth_code"}'

# Obtener empleados (con cookie de sesión)
curl https://gastro-manager.mocha.app/api/employees \
  -H "Cookie: mocha_session_token=your_token"
```

## Logging

Todos los endpoints de creación, actualización y eliminación registran acciones en `usage_logs` para estadísticas.
