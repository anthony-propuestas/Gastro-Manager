import { describe, it, expect } from "vitest";
import { calcSalaryRow } from "./salaryHelpers";

describe("calcSalaryRow", () => {
  it("sin pagar, sin anticipos: paid_amount=0, remaining=salary", () => {
    const r = calcSalaryRow(1000, 0, false);
    expect(r.paid_amount).toBe(0);
    expect(r.remaining).toBe(1000);
  });

  it("sin pagar, con anticipos: paid_amount=anticipos, remaining=net", () => {
    const r = calcSalaryRow(1000, 200, false);
    expect(r.paid_amount).toBe(200);
    expect(r.remaining).toBe(800);
  });

  it("pagado, sin anticipos: paid_amount=salary, remaining=0", () => {
    const r = calcSalaryRow(1000, 0, true);
    expect(r.paid_amount).toBe(1000);
    expect(r.remaining).toBe(0);
  });

  it("pagado, con anticipos: paid_amount=salary completo, remaining=0", () => {
    const r = calcSalaryRow(1000, 200, true);
    expect(r.paid_amount).toBe(1000);
    expect(r.remaining).toBe(0);
  });

  it("salary=0: todo en cero", () => {
    const r = calcSalaryRow(0, 0, false);
    expect(r.paid_amount).toBe(0);
    expect(r.remaining).toBe(0);
  });
});
