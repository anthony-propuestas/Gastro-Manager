import { describe, it, expect, vi, beforeEach } from "vitest";
import app from "./index";

// ── Auth mocks (same pattern as chatContext.test.ts) ──────────────────────────
vi.mock("hono/cookie", () => ({
  getCookie: () => "valid_token",
}));

vi.mock("jose", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jose")>();
  return {
    ...actual,
    jwtVerify: vi.fn().mockResolvedValue({
      payload: {
        id: "user1",
        email: "test@test.com",
        name: "Test",
        picture: "",
        role: "usuario_inteligente",
      },
    }),
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Common env fields shared by every test. */
function baseEnv(r2Delete: ReturnType<typeof vi.fn>) {
  return {
    JWT_SECRET: "secret",
    APP_URL: "http://localhost",
    R2_BUCKET: { delete: r2Delete, put: vi.fn(), get: vi.fn() },
  };
}

/**
 * Build a mock D1Database that returns the right rows for each middleware query
 * in sequence:
 *   1. authMiddleware: SELECT role, email_verified FROM users
 *   2. authMiddleware: SELECT estado FROM suscripciones (for inteligente)
 *   3. negocioMiddleware: SELECT negocio_id, negocio_role FROM negocio_members
 *   4. negocioMiddleware: SELECT id, name FROM negocios
 *   5. createModuleRestrictionMiddleware: SELECT is_restricted FROM negocio_module_restrictions
 *   6. createUsageLimitMiddleware: INSERT INTO usage_counters ... RETURNING count
 *   7. Handler: SELECT * FROM compras WHERE id = ...
 *   8. Handler: UPDATE/DELETE ... RETURNING *
 *
 * `existingCompra` controls what the "SELECT * FROM compras …" returns.
 * `updatedRow` is what the "UPDATE/INSERT … RETURNING *" returns from the handler.
 */
function makeMockDb(
  existingCompra: Record<string, unknown> | null,
  updatedRow: Record<string, unknown> | null = { id: 1 }
) {
  return {
    prepare: vi.fn().mockImplementation((sql: string) => ({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockImplementation(async () => {
        // 1. authMiddleware: users query
        if (sql.includes("FROM users") && sql.includes("role")) {
          return { role: "usuario_inteligente", email_verified: 1 };
        }
        // 2. authMiddleware: suscripciones check for inteligente
        if (sql.includes("suscripciones")) {
          return { estado: "activa", grace_deadline: null };
        }
        // 3. negocioMiddleware: negocio_members
        if (sql.includes("negocio_members")) {
          return { negocio_id: 1, negocio_role: "owner" };
        }
        // 4. negocioMiddleware: negocios
        if (sql.includes("FROM negocios")) {
          return { id: 1, name: "Test Negocio" };
        }
        // 5. moduleRestrictionMiddleware: not reached for owner, but just in case
        if (sql.includes("negocio_module_restrictions")) {
          return null; // no restriction
        }
        // 6. usageLimitMiddleware: INSERT INTO usage_counters RETURNING count
        if (sql.includes("usage_counters") && sql.includes("RETURNING")) {
          return { count: 1 };
        }
        // 7. Handler: SELECT * FROM compras WHERE id = ?
        if (sql.includes("FROM compras") && sql.includes("WHERE id")) {
          return existingCompra;
        }
        // 8. Handler: UPDATE/INSERT … RETURNING *
        if (sql.includes("RETURNING")) {
          return updatedRow;
        }
        return null;
      }),
      all: vi.fn().mockResolvedValue({ results: [] }),
      run: vi.fn().mockResolvedValue({ success: true }),
    })),
    batch: vi.fn().mockResolvedValue([{ results: [] }]),
  } as unknown as D1Database;
}

/** Build a PUT /api/compras/:id request with the given JSON body. */
function putCompraRequest(id: number, body: Record<string, unknown>) {
  return new Request(`http://localhost/api/compras/${id}`, {
    method: "PUT",
    headers: {
      Cookie: "session_token=valid_token",
      "X-Negocio-ID": "1",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

/** Build a DELETE /api/compras/:id request. */
function deleteCompraRequest(id: number) {
  return new Request(`http://localhost/api/compras/${id}`, {
    method: "DELETE",
    headers: {
      Cookie: "session_token=valid_token",
      "X-Negocio-ID": "1",
    },
  });
}

const execCtx = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
} as unknown as ExecutionContext;

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/compras/:id — R2 cleanup on comprobante_key change
// ─────────────────────────────────────────────────────────────────────────────

describe("PUT /api/compras/:id — R2 cleanup", () => {
  let r2Delete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    r2Delete = vi.fn().mockResolvedValue(undefined);
  });

  it("deletes old R2 object when comprobante_key changes", async () => {
    const oldKey = "compras/1/old-receipt.jpg";
    const newKey = "compras/1/new-receipt.jpg";

    const db = makeMockDb(
      { id: 1, comprobante_key: oldKey },
      { id: 1, comprobante_key: newKey }
    );
    const env = { ...baseEnv(r2Delete), DB: db };

    const req = putCompraRequest(1, {
      fecha: "2026-05-01",
      monto: 1500,
      item: "Carne",
      tipo: "producto",
      categoria: "carnes",
      comprobante_key: newKey,
    });

    const res = await app.fetch(req, env as any, execCtx);
    expect(res.status).toBe(200);
    expect(r2Delete).toHaveBeenCalledWith(oldKey);
    expect(r2Delete).toHaveBeenCalledOnce();
  });

  it("does NOT delete R2 when comprobante_key stays the same", async () => {
    const sameKey = "compras/1/same-receipt.jpg";

    const db = makeMockDb(
      { id: 1, comprobante_key: sameKey },
      { id: 1, comprobante_key: sameKey }
    );
    const env = { ...baseEnv(r2Delete), DB: db };

    const req = putCompraRequest(1, {
      fecha: "2026-05-01",
      monto: 2000,
      item: "Verduras",
      tipo: "producto",
      categoria: "verduras",
      comprobante_key: sameKey,
    });

    const res = await app.fetch(req, env as any, execCtx);
    expect(res.status).toBe(200);
    expect(r2Delete).not.toHaveBeenCalled();
  });

  it("does NOT delete R2 when the existing compra has no comprobante_key", async () => {
    const newKey = "compras/1/first-receipt.jpg";

    const db = makeMockDb(
      { id: 1, comprobante_key: null },
      { id: 1, comprobante_key: newKey }
    );
    const env = { ...baseEnv(r2Delete), DB: db };

    const req = putCompraRequest(1, {
      fecha: "2026-05-01",
      monto: 800,
      item: "Pan",
      tipo: "producto",
      categoria: "otros",
      comprobante_key: newKey,
    });

    const res = await app.fetch(req, env as any, execCtx);
    expect(res.status).toBe(200);
    expect(r2Delete).not.toHaveBeenCalled();
  });

  it("does NOT delete R2 when update sends no comprobante_key", async () => {
    const db = makeMockDb(
      { id: 1, comprobante_key: "compras/1/existing.jpg" },
      { id: 1 }
    );
    const env = { ...baseEnv(r2Delete), DB: db };

    const req = putCompraRequest(1, {
      monto: 999,
    });

    const res = await app.fetch(req, env as any, execCtx);
    expect(res.status).toBe(200);
    expect(r2Delete).not.toHaveBeenCalled();
  });

  it("ignores R2 delete errors gracefully (no 500)", async () => {
    r2Delete.mockRejectedValueOnce(new Error("R2 network error"));

    const db = makeMockDb(
      { id: 1, comprobante_key: "compras/1/old.jpg" },
      { id: 1, comprobante_key: "compras/1/new.jpg" }
    );
    const env = { ...baseEnv(r2Delete), DB: db };

    const req = putCompraRequest(1, {
      fecha: "2026-05-01",
      monto: 1500,
      item: "Pollo",
      tipo: "producto",
      categoria: "carnes",
      comprobante_key: "compras/1/new.jpg",
    });

    const res = await app.fetch(req, env as any, execCtx);
    // The endpoint should still succeed even if R2 delete fails
    expect(res.status).toBe(200);
    expect(r2Delete).toHaveBeenCalledWith("compras/1/old.jpg");
  });

  it("returns 404 when the compra does not exist", async () => {
    const db = makeMockDb(null);
    const env = { ...baseEnv(r2Delete), DB: db };

    const req = putCompraRequest(999, {
      monto: 100,
    });

    const res = await app.fetch(req, env as any, execCtx);
    expect(res.status).toBe(404);
    expect(r2Delete).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/compras/:id — R2 cleanup (pre-existing logic, coverage)
// ─────────────────────────────────────────────────────────────────────────────

describe("DELETE /api/compras/:id — R2 cleanup", () => {
  let r2Delete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    r2Delete = vi.fn().mockResolvedValue(undefined);
  });

  it("deletes R2 object when compra has a comprobante_key", async () => {
    const key = "compras/1/receipt.jpg";
    const db = makeMockDb({ id: 1, comprobante_key: key });
    const env = { ...baseEnv(r2Delete), DB: db };

    const req = deleteCompraRequest(1);
    const res = await app.fetch(req, env as any, execCtx);

    expect(res.status).toBe(200);
    expect(r2Delete).toHaveBeenCalledWith(key);
  });

  it("does NOT call R2 delete when compra has no comprobante_key", async () => {
    const db = makeMockDb({ id: 1, comprobante_key: null });
    const env = { ...baseEnv(r2Delete), DB: db };

    const req = deleteCompraRequest(1);
    const res = await app.fetch(req, env as any, execCtx);

    expect(res.status).toBe(200);
    expect(r2Delete).not.toHaveBeenCalled();
  });

  it("returns 404 and skips R2 when compra does not exist", async () => {
    const db = makeMockDb(null);
    const env = { ...baseEnv(r2Delete), DB: db };

    const req = deleteCompraRequest(999);
    const res = await app.fetch(req, env as any, execCtx);

    expect(res.status).toBe(404);
    expect(r2Delete).not.toHaveBeenCalled();
  });

  it("ignores R2 delete errors gracefully on delete", async () => {
    r2Delete.mockRejectedValueOnce(new Error("R2 down"));

    const db = makeMockDb({ id: 1, comprobante_key: "compras/1/old.jpg" });
    const env = { ...baseEnv(r2Delete), DB: db };

    const req = deleteCompraRequest(1);
    const res = await app.fetch(req, env as any, execCtx);

    expect(res.status).toBe(200);
    expect(r2Delete).toHaveBeenCalledWith("compras/1/old.jpg");
  });
});
