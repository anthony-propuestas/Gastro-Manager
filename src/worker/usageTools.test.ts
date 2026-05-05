import { describe, it, expect } from "vitest";
import { USAGE_TOOLS, type UsageTool } from "./usageTools";

const EXPECTED_TOOLS = [
  "employees",
  "job_roles",
  "topics",
  "notes",
  "advances",
  "salary_payments",
  "events",
  "chat",
  "compras",
  "facturacion",
] as const;

describe("USAGE_TOOLS constants", () => {
  it("has exactly 10 tool keys", () => {
    expect(Object.keys(USAGE_TOOLS)).toHaveLength(10);
  });

  it("each tool value is a non-empty lowercase string", () => {
    for (const [key, value] of Object.entries(USAGE_TOOLS)) {
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
      expect(value).toBe(value.toLowerCase());
      // Key should be UPPERCASE, value should be lowercase
      expect(key).toBe(key.toUpperCase());
    }
  });

  it("contains all expected tool names matching the DB seed", () => {
    const values = Object.values(USAGE_TOOLS);
    for (const expected of EXPECTED_TOOLS) {
      expect(values).toContain(expected);
    }
  });
});

describe("UsageTool type guard", () => {
  it("all USAGE_TOOLS values satisfy UsageTool at runtime", () => {
    // This verifies that the const assertion + type export are consistent.
    const allValues: UsageTool[] = Object.values(USAGE_TOOLS);
    expect(allValues.every((v) => typeof v === "string")).toBe(true);
  });
});
