import { describe, expect, it } from "vitest";
import {
  createEmployeeSchema,
  createEventSchema,
  validateData,
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