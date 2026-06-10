import { jwtVerify } from "jose";
import { describe, expect, it } from "vitest";
import { createSession, COOKIE_MAX_AGE } from "./index";

const SECRET = "test-secret-key-32-chars-minimum!!";

const PAYLOAD = {
  id: "u1",
  email: "a@b.com",
  name: "Test",
  picture: "",
  role: "admin",
  negocio: { id: 1, nombre: "X", plan: "basico", role: "owner" },
} as Parameters<typeof createSession>[0];

// ─── createSession ────────────────────────────────────────────────────────────

describe("createSession", () => {
  it("produce un JWT verificable con el payload correcto", async () => {
    const token = await createSession(PAYLOAD, SECRET);
    const { payload: decoded } = await jwtVerify(token, new TextEncoder().encode(SECRET));
    expect(decoded.id).toBe("u1");
    expect(decoded.email).toBe("a@b.com");
  });

  it("el JWT expira en aproximadamente 30 días", async () => {
    const token = await createSession(PAYLOAD, SECRET);
    const { payload: decoded } = await jwtVerify(token, new TextEncoder().encode(SECRET));
    const nowSec = Math.floor(Date.now() / 1000);
    const thirtyDaysSec = 30 * 24 * 3600;
    expect(decoded.exp).toBeGreaterThanOrEqual(nowSec + thirtyDaysSec - 5);
    expect(decoded.exp).toBeLessThanOrEqual(nowSec + thirtyDaysSec + 5);
  });
});

// ─── COOKIE_MAX_AGE ───────────────────────────────────────────────────────────

describe("COOKIE_MAX_AGE", () => {
  it("equivale a 30 días en segundos", () => {
    expect(COOKIE_MAX_AGE).toBe(30 * 24 * 3600);
  });
});
