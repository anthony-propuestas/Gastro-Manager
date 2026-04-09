import { describe, expect, it } from "vitest";
import {
  createEmployeeSchema,
  createEventSchema,
  validateData,
  createJobRoleSchema,
  createNegocioSchema,
  createTopicSchema,
  updateTopicSchema,
  createNoteSchema,
  createAdvanceSchema,
  markSalaryPaidSchema,
  createCompraSchema,
  updateCompraSchema,
  createFacturaSchema,
  updateFacturaSchema,
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