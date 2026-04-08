import { z } from "zod";

// Helper functions
const isReasonableDate = (date: string): boolean => {
  const d = new Date(date);
  const now = new Date();
  const hundredYearsAgo = new Date(now.getFullYear() - 100, now.getMonth(), now.getDate());
  const tenYearsAhead = new Date(now.getFullYear() + 10, now.getMonth(), now.getDate());
  return d >= hundredYearsAgo && d <= tenYearsAhead;
};

const isValidTime = (time: string): boolean => {
  return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
};

// Employee validation schemas
export const createEmployeeSchema = z.object({
  name: z.string().min(1, "Nombre es requerido").max(100, "Nombre muy largo"),
  role: z.string().min(1, "Puesto es requerido").max(50, "Puesto muy largo"),
  phone: z.string().max(20, "Teléfono muy largo").optional().nullable(),
  email: z.string().email("Email inválido").max(100, "Email muy largo").optional().nullable(),
  hire_date: z
    .string()
    .refine((date) => !date || isReasonableDate(date), "Fecha de contratación inválida")
    .optional()
    .nullable(),
  is_active: z.boolean().optional(),
  monthly_salary: z
    .number()
    .min(0, "Salario no puede ser negativo")
    .max(1000000, "Salario muy alto")
    .optional(),
});

export const updateEmployeeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.string().min(1).max(50).optional(),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email("Email inválido").max(100).optional().nullable(),
  hire_date: z
    .string()
    .refine((date) => !date || isReasonableDate(date), "Fecha de contratación inválida")
    .optional()
    .nullable(),
  is_active: z.boolean().optional(),
  monthly_salary: z.number().min(0).max(1000000).optional(),
});

// Job Role validation
export const createJobRoleSchema = z.object({
  name: z.string().min(1, "Nombre es requerido").max(50, "Nombre muy largo"),
});

// Topic validation schemas
export const createTopicSchema = z.object({
  title: z.string().min(1, "Título es requerido").max(200, "Título muy largo"),
  due_date: z
    .string()
    .refine((date) => !date || isReasonableDate(date), "Fecha límite inválida")
    .optional()
    .nullable(),
  due_time: z
    .string()
    .refine((time) => !time || isValidTime(time), "Hora inválida (formato HH:MM)")
    .optional()
    .nullable(),
});

export const updateTopicSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  is_open: z.boolean().optional(),
  due_date: z
    .string()
    .refine((date) => !date || isReasonableDate(date), "Fecha límite inválida")
    .optional()
    .nullable(),
  due_time: z
    .string()
    .refine((time) => !time || isValidTime(time), "Hora inválida (formato HH:MM)")
    .optional()
    .nullable(),
});

// Note validation schemas
export const createNoteSchema = z.object({
  content: z.string().min(1, "Contenido es requerido").max(1000, "Contenido muy largo"),
});

export const updateNoteSchema = z.object({
  content: z.string().min(1).max(1000),
});

// Event validation schemas
export const createEventSchema = z.object({
  title: z.string().min(1, "Título es requerido").max(200, "Título muy largo"),
  description: z.string().max(1000, "Descripción muy larga").optional().nullable(),
  event_date: z
    .string()
    .refine((date) => isReasonableDate(date), "Fecha de evento inválida"),
  start_time: z
    .string()
    .refine((time) => !time || isValidTime(time), "Hora de inicio inválida")
    .optional()
    .nullable(),
  end_time: z
    .string()
    .refine((time) => !time || isValidTime(time), "Hora de fin inválida")
    .optional()
    .nullable(),
  event_type: z.string().max(50).optional(),
  location: z.string().max(200, "Ubicación muy larga").optional().nullable(),
});

export const updateEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  event_date: z
    .string()
    .refine((date) => !date || isReasonableDate(date), "Fecha de evento inválida")
    .optional(),
  start_time: z
    .string()
    .refine((time) => !time || isValidTime(time), "Hora de inicio inválida")
    .optional()
    .nullable(),
  end_time: z
    .string()
    .refine((time) => !time || isValidTime(time), "Hora de fin inválida")
    .optional()
    .nullable(),
  event_type: z.string().max(50).optional(),
  location: z.string().max(200).optional().nullable(),
});

// Advance validation schemas
export const createAdvanceSchema = z.object({
  amount: z.number().min(0.01, "El monto debe ser mayor a cero").max(1000000, "Monto muy alto"),
  period_month: z.number().min(1).max(12).optional(),
  period_year: z.number().min(2000).max(2100).optional(),
  advance_date: z
    .string()
    .refine((date) => !date || isReasonableDate(date), "Fecha de adelanto inválida")
    .optional(),
  description: z.string().max(500, "Descripción muy larga").optional().nullable(),
});

// Salary payment validation
export const markSalaryPaidSchema = z.object({
  paid_date: z
    .string()
    .refine((date) => !date || isReasonableDate(date), "Fecha de pago inválida")
    .optional(),
});

// Negocio validation schemas
export const createNegocioSchema = z.object({
  name: z.string().min(1, "Nombre es requerido").max(100, "Nombre muy largo"),
});


// Compras validation schemas
const COMPRAS_CATEGORIAS = [
  "carnes", "verduras", "bebidas", "limpieza", "descartables",
  "servicios", "mantenimiento", "alquiler", "otros",
] as const;

export const createCompraSchema = z.object({
  fecha: z.string().refine((date) => isReasonableDate(date), "Fecha de compra inválida"),
  monto: z.number().min(0.01, "El monto debe ser mayor a cero").max(10000000, "Monto muy alto"),
  item: z.string().min(1, "Item es requerido").max(200, "Item muy largo"),
  tipo: z.enum(["producto", "servicio"]),
  categoria: z.enum(COMPRAS_CATEGORIAS),
  comprador_id: z.number().int().positive().optional().nullable(),
  descripcion: z.string().max(500, "Descripción muy larga").optional().nullable(),
  comprobante_key: z.string().max(300).optional().nullable(),
});

export const updateCompraSchema = createCompraSchema.partial();

// Facturación validation schemas
export const createFacturaSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  monto_total: z.number().positive("El monto debe ser positivo").max(10000000, "Monto muy alto"),
  metodo_pago: z.enum(["efectivo", "tarjeta_credito", "tarjeta_debito", "transferencia", "mercado_pago", "mixto", "otros"]).optional().nullable(),
  concepto: z.string().max(200, "Concepto muy largo").optional().nullable(),
  numero_comprobante: z.string().max(50, "Número de comprobante muy largo").optional().nullable(),
  notas: z.string().max(500, "Notas muy largas").optional().nullable(),
  turno: z.enum(["mañana", "tarde"]).optional().nullable(),
  pagos_detalle: z.string().max(2000, "Pagos detalle muy largo").optional().nullable(),
});

export const updateFacturaSchema = createFacturaSchema.partial();

// Helper to validate and parse with Zod
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): {
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
