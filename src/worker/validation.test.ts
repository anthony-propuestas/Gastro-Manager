import { z } from "zod";
import { describe, expect, it } from "vitest";
import {
  createEmployeeSchema,
  createEventSchema,
  validateData,
  createJobRoleSchema,
  createNegocioSchema,
  createTopicSchema,
  updateTopicSchema,
  updateEmployeeSchema,
  updateEventSchema,
  createNoteSchema,
  updateNoteSchema,
  createAdvanceSchema,
  markSalaryPaidSchema,
  createCompraSchema,
  updateCompraSchema,
  createFacturaSchema,
  updateFacturaSchema,
  chatHistoryItemSchema,
  chatHistoryArraySchema,
} from "./validation";

describe("createEmployeeSchema", () => {
  it("accepts valid employee data", () => {
    const result = createEmployeeSchema.safeParse({
      name: "Ana",
      role: "Chef",
      monthly_salary: 1200,
      email: "ana@example.com",
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = createEmployeeSchema.safeParse({
      name: "Ana",
      role: "Chef",
      email: "correo-invalido",
    });

    expect(result.success).toBe(false);
  });

  it("rejects hire_date outside the reasonable range", () => {
    const result = createEmployeeSchema.safeParse({
      name: "Ana",
      role: "Chef",
      hire_date: "2200-01-01",
    });

    expect(result.success).toBe(false);
  });
});

describe("updateEmployeeSchema", () => {
  it("accepts a partial employee update", () => {
    const result = updateEmployeeSchema.safeParse({ is_active: false });

    expect(result.success).toBe(true);
  });

  it("rejects invalid hire_date on partial updates", () => {
    const result = updateEmployeeSchema.safeParse({ hire_date: "1800-01-01" });

    expect(result.success).toBe(false);
  });
});

describe("validateData", () => {
  it("returns success with parsed data for valid payloads", () => {
    const result = validateData(createEventSchema, {
      title: "Reunion",
      event_date: "2026-04-06",
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      title: "Reunion",
      event_date: "2026-04-06",
    });
  });

  it("returns the first zod error message for invalid payloads", () => {
    const result = validateData(createEventSchema, {
      title: "",
      event_date: "2026-04-06",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Título es requerido");
  });

  it("falls back to a generic zod message when there are no issues", () => {
    const emptyZodErrorSchema = {
      parse: () => {
        throw new z.ZodError([]);
      },
    } as unknown as z.ZodSchema<{ ok: boolean }>;

    const result = validateData(emptyZodErrorSchema, { ok: true });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Datos inválidos");
  });

  it("returns a generic error when parsing throws a non-zod error", () => {
    const explodingSchema = {
      parse: () => {
        throw new Error("boom");
      },
    } as unknown as z.ZodSchema<{ ok: boolean }>;

    const result = validateData(explodingSchema, { ok: true });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Error de validación");
  });
});

describe("createJobRoleSchema", () => {
  it("accepts a valid job role name", () => {
    const result = createJobRoleSchema.safeParse({ name: "Chef" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = createJobRoleSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });
});

describe("createNegocioSchema", () => {
  it("accepts a valid negocio name", () => {
    const result = createNegocioSchema.safeParse({ name: "La Cantina" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = createNegocioSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });
});

describe("createTopicSchema", () => {
  it("accepts a valid topic with due_time", () => {
    const result = createTopicSchema.safeParse({
      title: "Revisar inventario",
      due_date: "2026-05-01",
      due_time: "09:30",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty title", () => {
    const result = createTopicSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects due_time with invalid format (missing leading zero)", () => {
    const result = createTopicSchema.safeParse({
      title: "Tarea",
      due_time: "9:5",
    });
    expect(result.success).toBe(false);
  });

  it("rejects due_time with hour out of range", () => {
    const result = createTopicSchema.safeParse({
      title: "Tarea",
      due_time: "25:00",
    });
    expect(result.success).toBe(false);
  });

  it("rejects due_date outside the reasonable range", () => {
    const result = createTopicSchema.safeParse({
      title: "Tarea",
      due_date: "2200-01-01",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateTopicSchema", () => {
  it("accepts a partial update with only is_open", () => {
    const result = updateTopicSchema.safeParse({ is_open: false });
    expect(result.success).toBe(true);
  });

  it("rejects invalid due_time even in a partial update", () => {
    const result = updateTopicSchema.safeParse({ due_time: "99:99" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid due_date even in a partial update", () => {
    const result = updateTopicSchema.safeParse({ due_date: "1800-01-01" });
    expect(result.success).toBe(false);
  });
});

describe("createNoteSchema", () => {
  it("accepts valid note content", () => {
    const result = createNoteSchema.safeParse({ content: "Llevar facturas al contador" });
    expect(result.success).toBe(true);
  });

  it("rejects empty content", () => {
    const result = createNoteSchema.safeParse({ content: "" });
    expect(result.success).toBe(false);
  });

  it("rejects content exceeding 1000 characters", () => {
    const result = createNoteSchema.safeParse({ content: "x".repeat(1001) });
    expect(result.success).toBe(false);
  });
});

describe("updateNoteSchema", () => {
  it("accepts valid note content", () => {
    const result = updateNoteSchema.safeParse({ content: "Nota actualizada" });
    expect(result.success).toBe(true);
  });

  it("rejects empty content", () => {
    const result = updateNoteSchema.safeParse({ content: "" });
    expect(result.success).toBe(false);
  });
});

describe("createEventSchema", () => {
  it("accepts valid event data with optional times", () => {
    const result = createEventSchema.safeParse({
      title: "Capacitacion",
      event_date: "2026-04-08",
      start_time: "09:00",
      end_time: "11:30",
    });
    expect(result.success).toBe(true);
  });

  it("rejects event_date outside the reasonable range", () => {
    const result = createEventSchema.safeParse({
      title: "Capacitacion",
      event_date: "1800-01-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid start_time format", () => {
    const result = createEventSchema.safeParse({
      title: "Capacitacion",
      event_date: "2026-04-08",
      start_time: "99:99",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid end_time format", () => {
    const result = createEventSchema.safeParse({
      title: "Capacitacion",
      event_date: "2026-04-08",
      end_time: "25:00",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateEventSchema", () => {
  it("accepts an empty object", () => {
    const result = updateEventSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects invalid event_date on partial updates", () => {
    const result = updateEventSchema.safeParse({ event_date: "2200-01-01" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid start_time on partial updates", () => {
    const result = updateEventSchema.safeParse({ start_time: "ab:cd" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid end_time on partial updates", () => {
    const result = updateEventSchema.safeParse({ end_time: "24:61" });
    expect(result.success).toBe(false);
  });
});

describe("createAdvanceSchema", () => {
  it("accepts a valid advance with amount and date", () => {
    const result = createAdvanceSchema.safeParse({
      amount: 500,
      advance_date: "2026-04-01",
    });
    expect(result.success).toBe(true);
  });

  it("rejects amount of 0", () => {
    const result = createAdvanceSchema.safeParse({ amount: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects negative amount", () => {
    const result = createAdvanceSchema.safeParse({ amount: -100 });
    expect(result.success).toBe(false);
  });

  it("rejects advance_date outside the reasonable range", () => {
    const result = createAdvanceSchema.safeParse({
      amount: 500,
      advance_date: "2200-01-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects period_month outside 1 to 12", () => {
    const result = createAdvanceSchema.safeParse({ amount: 500, period_month: 13 });
    expect(result.success).toBe(false);
  });

  it("rejects period_year outside the allowed range", () => {
    const result = createAdvanceSchema.safeParse({ amount: 500, period_year: 1999 });
    expect(result.success).toBe(false);
  });
});

describe("markSalaryPaidSchema", () => {
  it("accepts an empty object (all fields are optional)", () => {
    const result = markSalaryPaidSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts a valid paid_date", () => {
    const result = markSalaryPaidSchema.safeParse({ paid_date: "2026-04-30" });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid paid_date", () => {
    const result = markSalaryPaidSchema.safeParse({ paid_date: "2200-01-01" });
    expect(result.success).toBe(false);
  });
});

describe("createCompraSchema", () => {
  const base = {
    fecha: "2026-04-01",
    monto: 1500,
    item: "Carne vacuna",
    tipo: "producto",
    categoria: "carnes",
  };

  it("accepts valid compra data", () => {
    const result = createCompraSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("rejects monto of 0", () => {
    const result = createCompraSchema.safeParse({ ...base, monto: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid categoria", () => {
    const result = createCompraSchema.safeParse({ ...base, categoria: "electrodomesticos" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid tipo", () => {
    const result = createCompraSchema.safeParse({ ...base, tipo: "regalo" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid fecha", () => {
    const result = createCompraSchema.safeParse({ ...base, fecha: "1800-01-01" });
    expect(result.success).toBe(false);
  });

  it("rejects comprador_id when it is not positive", () => {
    const result = createCompraSchema.safeParse({ ...base, comprador_id: 0 });
    expect(result.success).toBe(false);
  });
});

describe("updateCompraSchema", () => {
  it("accepts an empty object (all fields are optional)", () => {
    const result = updateCompraSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects monto of 0 when provided", () => {
    const result = updateCompraSchema.safeParse({ monto: 0 });
    expect(result.success).toBe(false);
  });
});

describe("createFacturaSchema", () => {
  const base = {
    fecha: "2026-04-01",
    monto_total: 3200,
  };

  it("accepts valid factura data", () => {
    const result = createFacturaSchema.safeParse({
      ...base,
      metodo_pago: "efectivo",
      turno: "tarde",
    });
    expect(result.success).toBe(true);
  });

  it("rejects monto_total of 0", () => {
    const result = createFacturaSchema.safeParse({ ...base, monto_total: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects fecha with invalid format (DD/MM/YYYY)", () => {
    const result = createFacturaSchema.safeParse({ ...base, fecha: "01/04/2026" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid metodo_pago", () => {
    const result = createFacturaSchema.safeParse({ ...base, metodo_pago: "cripto" });
    expect(result.success).toBe(false);
  });
});

describe("updateFacturaSchema", () => {
  it("accepts an empty object (all fields are optional)", () => {
    const result = updateFacturaSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects monto_total of 0 when provided", () => {
    const result = updateFacturaSchema.safeParse({ monto_total: 0 });
    expect(result.success).toBe(false);
  });
});

describe("chatHistoryItemSchema", () => {
  it("accepts valid user turn", () => {
    expect(chatHistoryItemSchema.safeParse({ role: "user", content: "hola" }).success).toBe(true);
  });

  it("accepts valid model turn", () => {
    expect(chatHistoryItemSchema.safeParse({ role: "model", content: "hola" }).success).toBe(true);
  });

  it("rejects unknown role", () => {
    expect(chatHistoryItemSchema.safeParse({ role: "system", content: "hola" }).success).toBe(false);
  });

  it("rejects empty content", () => {
    expect(chatHistoryItemSchema.safeParse({ role: "user", content: "" }).success).toBe(false);
  });

  it("rejects content exceeding 2000 chars", () => {
    expect(chatHistoryItemSchema.safeParse({ role: "user", content: "a".repeat(2001) }).success).toBe(false);
  });
});

describe("chatHistoryArraySchema", () => {
  it("accepts an empty array", () => {
    expect(chatHistoryArraySchema.safeParse([]).success).toBe(true);
  });

  it("accepts valid history", () => {
    const history = [
      { role: "user", content: "pregunta" },
      { role: "model", content: "respuesta" },
    ];
    expect(chatHistoryArraySchema.safeParse(history).success).toBe(true);
  });

  it("rejects array with invalid item", () => {
    const history = [{ role: "admin", content: "hack" }];
    expect(chatHistoryArraySchema.safeParse(history).success).toBe(false);
  });
});