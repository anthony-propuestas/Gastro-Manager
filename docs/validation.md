# Sistema de Validación

Sistema de validación de datos robusto usando Zod en backend y validación manual en frontend.

## Zod

Librería de validación y parsing con TypeScript-first.

**Instalación:**
```bash
npm install zod
```

**Ventajas:**
- Esquemas declarativos
- Inferencia automática de tipos TypeScript
- Mensajes de error personalizables
- Composición de esquemas
- Transformaciones de datos

## Esquemas de Validación

Ubicados en `src/worker/validation.ts`

### Helpers

#### Validación de Fechas

```typescript
const isReasonableDate = (date: string): boolean => {
  const d = new Date(date);
  const now = new Date();
  const hundredYearsAgo = new Date(now.getFullYear() - 100, now.getMonth(), now.getDate());
  const tenYearsAhead = new Date(now.getFullYear() + 10, now.getMonth(), now.getDate());
  return d >= hundredYearsAgo && d <= tenYearsAhead;
};
```

**Rango aceptado:** 100 años atrás - 10 años adelante

**Razón:** Prevenir errores de usuario (ej: 1024 en lugar de 2024)

#### Validación de Hora

```typescript
const isValidTime = (time: string): boolean => {
  return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
};
```

**Formato aceptado:** HH:MM (00:00 - 23:59)

### Empleados

#### Crear Empleado

```typescript
export const createEmployeeSchema = z.object({
  name: z.string()
    .min(1, "Nombre es requerido")
    .max(100, "Nombre muy largo"),
  
  role: z.string()
    .min(1, "Puesto es requerido")
    .max(50, "Puesto muy largo"),
  
  phone: z.string()
    .max(20, "Teléfono muy largo")
    .optional()
    .nullable(),
  
  email: z.string()
    .email("Email inválido")
    .max(100, "Email muy largo")
    .optional()
    .nullable(),
  
  hire_date: z.string()
    .refine((date) => !date || isReasonableDate(date), "Fecha de contratación inválida")
    .optional()
    .nullable(),
  
  is_active: z.boolean()
    .optional(),
  
  monthly_salary: z.number()
    .min(0, "Salario no puede ser negativo")
    .max(1000000, "Salario muy alto")
    .optional(),
});
```

**Reglas:**
- `name`: 1-100 caracteres, requerido
- `role`: 1-50 caracteres, requerido
- `phone`: máx 20 caracteres, opcional
- `email`: formato válido, máx 100 caracteres, opcional
- `hire_date`: rango razonable, opcional
- `is_active`: booleano, opcional (default: true)
- `monthly_salary`: 0-1,000,000, opcional

#### Actualizar Empleado

```typescript
export const updateEmployeeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.string().min(1).max(50).optional(),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email("Email inválido").max(100).optional().nullable(),
  hire_date: z.string()
    .refine((date) => !date || isReasonableDate(date), "Fecha de contratación inválida")
    .optional()
    .nullable(),
  is_active: z.boolean().optional(),
  monthly_salary: z.number().min(0).max(1000000).optional(),
});
```

Todos los campos opcionales (permite actualización parcial).

### Puestos de Trabajo

```typescript
export const createJobRoleSchema = z.object({
  name: z.string()
    .min(1, "Nombre es requerido")
    .max(50, "Nombre muy largo"),
});
```

### Tópicos

#### Crear Tópico

```typescript
export const createTopicSchema = z.object({
  title: z.string()
    .min(1, "Título es requerido")
    .max(200, "Título muy largo"),
  
  due_date: z.string()
    .refine((date) => !date || isReasonableDate(date), "Fecha límite inválida")
    .optional()
    .nullable(),
  
  due_time: z.string()
    .refine((time) => !time || isValidTime(time), "Hora inválida (formato HH:MM)")
    .optional()
    .nullable(),
});
```

**Reglas:**
- `title`: 1-200 caracteres, requerido
- `due_date`: rango razonable, opcional
- `due_time`: formato HH:MM, opcional

#### Actualizar Tópico

```typescript
export const updateTopicSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  is_open: z.boolean().optional(),
  due_date: z.string()
    .refine((date) => !date || isReasonableDate(date), "Fecha límite inválida")
    .optional()
    .nullable(),
  due_time: z.string()
    .refine((time) => !time || isValidTime(time), "Hora inválida (formato HH:MM)")
    .optional()
    .nullable(),
});
```

### Notas

```typescript
export const createNoteSchema = z.object({
  content: z.string()
    .min(1, "Contenido es requerido")
    .max(1000, "Contenido muy largo"),
});

export const updateNoteSchema = z.object({
  content: z.string().min(1).max(1000),
});
```

**Reglas:**
- `content`: 1-1000 caracteres, requerido

### Eventos

#### Crear Evento

```typescript
export const createEventSchema = z.object({
  title: z.string()
    .min(1, "Título es requerido")
    .max(200, "Título muy largo"),
  
  description: z.string()
    .max(1000, "Descripción muy larga")
    .optional()
    .nullable(),
  
  event_date: z.string()
    .refine((date) => isReasonableDate(date), "Fecha de evento inválida"),
  
  start_time: z.string()
    .refine((time) => !time || isValidTime(time), "Hora de inicio inválida")
    .optional()
    .nullable(),
  
  end_time: z.string()
    .refine((time) => !time || isValidTime(time), "Hora de fin inválida")
    .optional()
    .nullable(),
  
  event_type: z.string()
    .max(50)
    .optional(),
  
  location: z.string()
    .max(200, "Ubicación muy larga")
    .optional()
    .nullable(),
});
```

**Reglas:**
- `title`: 1-200 caracteres, requerido
- `description`: máx 1000 caracteres, opcional
- `event_date`: requerido, rango razonable
- `start_time`, `end_time`: formato HH:MM, opcionales
- `event_type`: máx 50 caracteres, opcional
- `location`: máx 200 caracteres, opcional

#### Actualizar Evento

Similar pero todos los campos opcionales.

### Adelantos

```typescript
export const createAdvanceSchema = z.object({
  amount: z.number()
    .min(0.01, "El monto debe ser mayor a cero")
    .max(1000000, "Monto muy alto"),
  
  period_month: z.number()
    .min(1)
    .max(12)
    .optional(),
  
  period_year: z.number()
    .min(2000)
    .max(2100)
    .optional(),
  
  advance_date: z.string()
    .refine((date) => !date || isReasonableDate(date), "Fecha de adelanto inválida")
    .optional(),
  
  description: z.string()
    .max(500, "Descripción muy larga")
    .optional()
    .nullable(),
});
```

**Reglas:**
- `amount`: 0.01-1,000,000, requerido
- `period_month`: 1-12, opcional (default: mes actual)
- `period_year`: 2000-2100, opcional (default: año actual)
- `advance_date`: rango razonable, opcional
- `description`: máx 500 caracteres, opcional

### Pagos de Sueldo

```typescript
export const markSalaryPaidSchema = z.object({
  paid_date: z.string()
    .refine((date) => !date || isReasonableDate(date), "Fecha de pago inválida")
    .optional(),
});
```

## Uso en Backend

### Helper de Validación

```typescript
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): {
  success: boolean;
  data?: T;
  error?: string;
} {
  try {
    const parsed = schema.parse(data);
    return { success: true, data: parsed };
  } catch (err) {
    if (err instanceof z.ZodError) {
      const firstError = err.issues[0];
      return {
        success: false,
        error: firstError?.message || "Datos inválidos",
      };
    }
    return { success: false, error: "Error de validación" };
  }
}
```

### En Endpoints

```typescript
import { validateData, createEmployeeSchema } from "./validation";

app.post("/api/employees", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();

  // Validar datos
  const validation = validateData(createEmployeeSchema, body);
  
  if (!validation.success) {
    return c.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: validation.error,
        },
      },
      400
    );
  }

  // Usar datos validados
  const data = validation.data;
  
  // Insertar en DB
  const now = new Date().toISOString();
  const result = await c.env.DB.prepare(
    `INSERT INTO employees (user_id, name, role, phone, email, hire_date, is_active, monthly_salary, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      user.id,
      data.name,
      data.role,
      data.phone || null,
      data.email || null,
      data.hire_date || null,
      data.is_active ? 1 : 0,
      data.monthly_salary || 0,
      now,
      now
    )
    .run();

  return c.json({ success: true, data: { id: result.meta.last_row_id } });
});
```

## Validación en Frontend

Frontend implementa las **mismas reglas** antes de enviar requests.

### Ejemplo: Formulario de Empleado

```typescript
// EmployeeModal.tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  // Validar nombre
  if (!formData.name || formData.name.trim().length === 0) {
    addToast("El nombre es requerido", "error");
    return;
  }

  if (formData.name.length > 100) {
    addToast("El nombre es muy largo (máx 100 caracteres)", "error");
    return;
  }

  // Validar puesto
  if (!formData.role || formData.role.trim().length === 0) {
    addToast("El puesto es requerido", "error");
    return;
  }

  if (formData.role.length > 50) {
    addToast("El puesto es muy largo (máx 50 caracteres)", "error");
    return;
  }

  // Validar email (si se proporciona)
  if (formData.email && formData.email.trim().length > 0) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      addToast("El email no es válido", "error");
      return;
    }
    if (formData.email.length > 100) {
      addToast("El email es muy largo (máx 100 caracteres)", "error");
      return;
    }
  }

  // Validar teléfono
  if (formData.phone && formData.phone.length > 20) {
    addToast("El teléfono es muy largo (máx 20 caracteres)", "error");
    return;
  }

  // Validar salario
  if (formData.monthly_salary !== undefined) {
    const salary = Number(formData.monthly_salary);
    if (isNaN(salary) || salary < 0 || salary > 1000000) {
      addToast("El salario debe estar entre 0 y 1,000,000", "error");
      return;
    }
  }

  // Validar fecha de contratación
  if (formData.hire_date) {
    const hireDate = new Date(formData.hire_date);
    const now = new Date();
    const hundredYearsAgo = new Date(now.getFullYear() - 100, now.getMonth(), now.getDate());
    const tenYearsAhead = new Date(now.getFullYear() + 10, now.getMonth(), now.getDate());

    if (hireDate < hundredYearsAgo || hireDate > tenYearsAhead) {
      addToast("La fecha de contratación no es válida", "error");
      return;
    }
  }

  // Si pasa todas las validaciones, enviar
  try {
    if (employee) {
      await updateEmployee(employee.id, formData);
      addToast("Empleado actualizado correctamente", "success");
    } else {
      await createEmployee(formData);
      addToast("Empleado creado correctamente", "success");
    }
    onClose();
  } catch (error) {
    addToast("Error al guardar empleado", "error");
  }
};
```

## Validaciones Específicas

### Email

**Regex:**
```typescript
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
```

**Limitaciones:**
- No valida todos los casos edge de RFC 5322
- Suficiente para casos comunes
- Backend también valida con Zod

### Teléfono

**Sin formato específico** - solo longitud máxima.

**Razón:** Formatos de teléfono varían por país.

**Mejora futura:** Librería como `libphonenumber-js`

### Fechas

**Rango razonable:** 100 años pasado - 10 años futuro

**Previene:**
- Errores de tipeo (1024 → 2024)
- Fechas imposibles
- Datos corruptos

### Horas

**Formato:** HH:MM (24 horas)

**Ejemplos válidos:**
- `09:00`
- `14:30`
- `23:59`

**Inválidos:**
- `9:00` (sin cero inicial está permitido)
- `25:00` (hora inválida)
- `14:60` (minuto inválido)

### Montos

**Rangos:**
- Salarios: 0 - 1,000,000
- Adelantos: 0.01 - 1,000,000

**Razón del máximo:** Prevenir errores de entrada (ej: agregar ceros de más)

## Mensajes de Error

### Claros y Específicos

✅ **Bueno:**
```
"El nombre es muy largo (máx 100 caracteres)"
"El email no es válido"
"El monto debe ser mayor a cero"
```

❌ **Malo:**
```
"Error de validación"
"Datos inválidos"
"Error"
```

### En Español

Todos los mensajes en español para usuarios hispanohablantes.

### Mostrados al Usuario

Via toast notifications en frontend:

```typescript
addToast(validation.error, "error");
```

## Testing de Validaciones

### Unit Tests (futuro)

```typescript
describe("createEmployeeSchema", () => {
  it("should accept valid employee data", () => {
    const data = {
      name: "Juan Pérez",
      role: "Mesero",
      email: "juan@example.com",
      monthly_salary: 8000,
    };

    const result = validateData(createEmployeeSchema, data);
    expect(result.success).toBe(true);
  });

  it("should reject empty name", () => {
    const data = {
      name: "",
      role: "Mesero",
    };

    const result = validateData(createEmployeeSchema, data);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Nombre es requerido");
  });

  it("should reject invalid email", () => {
    const data = {
      name: "Juan Pérez",
      role: "Mesero",
      email: "not-an-email",
    };

    const result = validateData(createEmployeeSchema, data);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Email inválido");
  });
});
```

## Mejores Prácticas

### 1. Validar en Cliente Y Servidor

**Cliente:** Feedback inmediato al usuario
**Servidor:** Seguridad (nunca confiar en cliente)

### 2. Mensajes Específicos

No genéricos - decir exactamente qué está mal.

### 3. Validar Tipos

Zod asegura tipos correctos:

```typescript
monthly_salary: z.number() // No acepta strings
```

### 4. Opcionales vs Requeridos

Ser explícito:

```typescript
name: z.string().min(1) // Requerido
phone: z.string().optional().nullable() // Opcional
```

### 5. Transformaciones

Zod puede transformar datos:

```typescript
email: z.string().email().toLowerCase() // Normalizar a minúsculas
```

### 6. Validaciones Custom

Para lógica compleja:

```typescript
z.string().refine(
  (val) => customValidation(val),
  "Mensaje de error"
)
```

### 7. Reutilizar Esquemas

```typescript
const baseEmployeeSchema = z.object({
  name: z.string().min(1).max(100),
  role: z.string().min(1).max(50),
});

const createEmployeeSchema = baseEmployeeSchema.extend({
  // Campos adicionales
});

const updateEmployeeSchema = baseEmployeeSchema.partial();
```

## Limitaciones Actuales

### No hay Validación de Relaciones

**Ejemplo:**
- No verifica que `employee_id` existe al crear tópico
- Se maneja con verificaciones manuales en endpoints

**Mejora futura:**
```typescript
const createTopicSchema = z.object({
  employee_id: z.number().refine(async (id) => {
    const employee = await db.query(...);
    return !!employee;
  }, "Empleado no encontrado"),
});
```

### No hay Validación de Lógica de Negocio

**Ejemplo:**
- No valida que `end_time > start_time` en eventos
- Se puede agregar con `refine`

### Sin Sanitización

Zod valida pero no sanitiza HTML/SQL.

**Para SQL injection:** Usar prepared statements (ya implementado)
**Para XSS:** React escapa por defecto

## Debugging

### Ver Errores de Validación

```typescript
const result = validateData(schema, data);
if (!result.success) {
  console.log("Validation error:", result.error);
}
```

### Probar Esquemas

```typescript
const testData = { ... };
try {
  const parsed = createEmployeeSchema.parse(testData);
  console.log("Valid:", parsed);
} catch (error) {
  console.log("Invalid:", error);
}
```

## Futuras Mejoras

1. **Validación de relaciones**: Verificar FKs existen
2. **Validación de lógica**: end_time > start_time, etc.
3. **Validación async**: Para verificar duplicados
4. **Internacionalización**: Mensajes en múltiples idiomas
5. **Refinamientos**: Validaciones de negocio más complejas
6. **Type guards**: Para narrowing de tipos en frontend
