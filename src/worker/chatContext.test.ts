import { describe, it, expect, vi, beforeEach } from "vitest";
import app from "./index";

vi.mock("hono/cookie", () => ({
  getCookie: () => "valid_token"
}));

vi.mock("jose", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jose")>();
  return {
    ...actual,
    jwtVerify: vi.fn().mockResolvedValue({
      payload: { id: "user1", email: "test@test.com", name: "Test", picture: "", role: "usuario_inteligente" }
    })
  };
});

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

/**
 * Build a mock D1Database that responds correctly to each middleware query:
 *   1. authMiddleware: SELECT role, email_verified FROM users
 *   2. authMiddleware: SELECT estado FROM suscripciones (for inteligente)
 *   3. negocioMiddleware: SELECT negocio_id, negocio_role FROM negocio_members
 *   4. negocioMiddleware: SELECT id, name FROM negocios
 *   5. createUsageLimitMiddleware: INSERT INTO usage_counters ... RETURNING count
 *   6. chat handler: SELECT context_text, fetched_at FROM chat_context_cache
 *   7. chat handler: batch() for context data queries
 *   8. chat handler: INSERT INTO chat_context_cache (upsert)
 *   9. geminiCache: SELECT gemini_cache_name FROM chat_context_cache
 *  10. chat handler: INSERT INTO gemini_usage_log
 *
 * `forceContextCacheMiss` – when true, the context_text SELECT returns null
 * so the handler rebuilds context via batch().
 */
function makeChatDb(opts: { forceContextCacheMiss?: boolean } = {}) {
  const prepareCalls: string[] = [];

  const mockDb = {
    prepare: vi.fn().mockImplementation((sql: string) => {
      prepareCalls.push(sql);
      return {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockImplementation(async () => {
          // 1. authMiddleware: users
          if (sql.includes("FROM users") && sql.includes("role")) {
            return { role: "usuario_inteligente", email_verified: 1 };
          }
          // 2. authMiddleware: suscripciones
          if (sql.includes("suscripciones") && sql.includes("estado")) {
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
          // 5. usageLimitMiddleware: INSERT INTO usage_counters RETURNING count
          if (sql.includes("usage_counters") && sql.includes("RETURNING")) {
            return { count: 1 };
          }
          // 6. chat handler: context_text cache check
          if (sql.includes("context_text") && sql.includes("fetched_at")) {
            if (opts.forceContextCacheMiss) return null;
            return { context_text: "Cached context", fetched_at: new Date().toISOString() };
          }
          // 9. geminiCache: SELECT gemini_cache_name
          if (sql.includes("gemini_cache_name") && sql.includes("gemini_cache_expires_at")) {
            return { gemini_cache_name: null, gemini_cache_expires_at: null };
          }
          // 5b. negocio_module_restrictions
          if (sql.includes("negocio_module_restrictions")) {
            return null;
          }
          return null;
        }),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({ success: true }),
      };
    }),
    batch: vi.fn().mockResolvedValue([
      { results: [] }, // employees
      { results: [] }, // events
      { results: [] }, // topics
      { results: [] }, // advances
      { results: [] }, // salary_payments
    ]),
  } as unknown as D1Database;

  return { mockDb, prepareCalls };
}

const execCtx = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
} as unknown as ExecutionContext;

describe("POST /api/chat SQL Context Queries", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockImplementation(() => {
      return Promise.resolve(new Response(JSON.stringify({
        choices: [{ message: { content: "Hola" } }],
        usage: { prompt_tokens: 10, completion_tokens: 10 }
      })));
    });
  });

  it("adds LIMIT and ORDER BY to context queries to reduce tokens", async () => {
    const { mockDb, prepareCalls } = makeChatDb({ forceContextCacheMiss: true });

    const env = {
      DB: mockDb,
      JWT_SECRET: "secret",
      DEEPSEEK_API_KEY: "deepseek_key",
      APP_URL: "http://localhost",
    };

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: {
        "Cookie": "session_token=valid_token",
        "X-Negocio-ID": "1",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message: "test", history: [] })
    });

    const res = await app.fetch(req, env as any, execCtx);

    const bodyText = await res.text();
    if (res.status !== 200) {
      throw new Error(`Test failed with status ${res.status}: ${bodyText}`);
    }

    expect(res.status).toBe(200);

    // When context is stale, the handler builds context via batch().
    // Verify the batch was called and the SQL queries contain LIMIT + ORDER BY.
    expect(mockDb.batch).toHaveBeenCalledOnce();

    // Find the SQL strings passed to batch via prepareCalls
    // (batch receives prepared statements, but we captured the SQL in prepareCalls)
    const employeesQuery = prepareCalls.find(sql => sql.includes("FROM employees") && sql.includes("ORDER BY is_active DESC"));
    const eventsQuery = prepareCalls.find(sql => sql.includes("FROM events") && sql.includes("ORDER BY event_date ASC"));
    const topicsQuery = prepareCalls.find(sql => sql.includes("FROM topics") && sql.includes("ORDER BY t.due_date ASC"));

    expect(employeesQuery).toBeDefined();
    expect(employeesQuery).toMatch(/LIMIT 30/);

    expect(eventsQuery).toBeDefined();
    expect(eventsQuery).toMatch(/LIMIT 20/);

    expect(topicsQuery).toBeDefined();
    expect(topicsQuery).toMatch(/LIMIT 15/);
  });

  it("truncates history to maximum 5 messages", async () => {
    const { mockDb } = makeChatDb({ forceContextCacheMiss: false });

    const env = {
      DB: mockDb,
      JWT_SECRET: "secret",
      DEEPSEEK_API_KEY: "deepseek_key",
      APP_URL: "http://localhost",
    };

    const longHistory = Array.from({ length: 10 }).map((_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `msg ${i}`
    }));

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: {
        "Cookie": "session_token=valid_token",
        "X-Negocio-ID": "1",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message: "test", history: longHistory })
    });

    const res = await app.fetch(req, env as any, execCtx);
    expect(res.status).toBe(200);

    const fetchCall = mockFetch.mock.calls.find((call: any[]) => call[0].includes("chat/completions"));
    expect(fetchCall).toBeDefined();

    const requestBody = JSON.parse(fetchCall![1].body);

    // DeepSeek uses `messages`: 1 system (context) + 5 trimmed history + 1 new user = 7.
    expect(requestBody.messages).toBeDefined();
    expect(requestBody.messages.length).toBe(7);
  });
});
