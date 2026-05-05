import { describe, it, expect, vi, beforeEach } from "vitest";
import app from "./index";

const mockJwtVerify = vi.fn();
vi.mock("jose", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jose")>();
  return {
    ...actual,
    jwtVerify: (...args: any[]) => mockJwtVerify(...args),
  };
});

vi.mock("hono/cookie", () => ({
  getCookie: () => "valid_token"
}));

describe("KV Caching — Employees", () => {
  const NEGOCIO_ID = 1;
  const CACHE_KEY = `emp:${NEGOCIO_ID}`;

  beforeEach(() => {
    vi.clearAllMocks();
    mockJwtVerify.mockResolvedValue({
      payload: { id: "user1", email: "test@test.com", role: "usuario_basico" }
    });
  });

  function makeMockDb(opts: { employees?: any[], firstResponse?: any } = {}) {
    return {
      prepare: vi.fn().mockImplementation((sql: string) => ({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockImplementation(async () => {
          if (sql.includes("FROM users")) return { role: "usuario_basico", email_verified: 1 };
          if (sql.includes("negocio_members")) return { negocio_id: NEGOCIO_ID, negocio_role: "owner" };
          if (sql.includes("FROM negocios")) return { id: NEGOCIO_ID, name: "Test Negocio" };
          if (sql.includes("usage_counters")) return { count: 1 };
          if (sql.includes("usage_limits")) return { limit: 100 };
          return opts.firstResponse || null;
        }),
        all: vi.fn().mockResolvedValue({ results: opts.employees || [] }),
        run: vi.fn().mockResolvedValue({ meta: { last_row_id: 1 } }),
      })),
    };
  }

  it("serves from KV cache if available", async () => {
    const cachedData = [{ id: 1, name: "Cached Employee" }];
    const mockKV = {
      get: vi.fn().mockResolvedValue(cachedData),
      put: vi.fn(),
    };
    const mockDb = makeMockDb();

    const req = new Request("http://localhost/api/employees", {
      headers: { "X-Negocio-ID": String(NEGOCIO_ID) }
    });
    const env = { DB: mockDb, CACHE: mockKV, JWT_SECRET: "secret" };

    const res = await app.fetch(req, env as any);
    expect(res.status).toBe(200);
    const data = await res.json() as { data: unknown };
    expect(data.data).toEqual(cachedData);
    
    expect(mockKV.get).toHaveBeenCalledWith(CACHE_KEY, "json");
  });

  it("fetches from DB and populates KV if cache is empty", async () => {
    const dbData = [{ id: 2, name: "DB Employee" }];
    const mockKV = {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
    };
    const mockDb = makeMockDb({ employees: dbData });

    const req = new Request("http://localhost/api/employees", {
      headers: { "X-Negocio-ID": String(NEGOCIO_ID) }
    });
    const env = { DB: mockDb, CACHE: mockKV, JWT_SECRET: "secret" };

    const res = await app.fetch(req, env as any, { waitUntil: (p: any) => p } as any);
    expect(res.status).toBe(200);
    const data = await res.json() as { data: unknown };
    expect(data.data).toEqual(dbData);
    
    expect(mockKV.get).toHaveBeenCalledWith(CACHE_KEY, "json");
    expect(mockKV.put).toHaveBeenCalledWith(CACHE_KEY, JSON.stringify(dbData), { expirationTtl: 60 });
  });

  it("invalidates KV cache on employee creation", async () => {
    const mockKV = {
      delete: vi.fn().mockResolvedValue(undefined),
    };
    const mockDb = makeMockDb();

    const req = new Request("http://localhost/api/employees", {
      method: "POST",
      headers: { "X-Negocio-ID": String(NEGOCIO_ID), "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New", role: "Role" })
    });
    const env = { DB: mockDb, CACHE: mockKV, JWT_SECRET: "secret" };

    await app.fetch(req, env as any, { waitUntil: (p: any) => p } as any);
    expect(mockKV.delete).toHaveBeenCalledWith(CACHE_KEY);
  });
});
