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

describe("POST /api/chat SQL Context Queries", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockImplementation(() => {
      return Promise.resolve(new Response(JSON.stringify({
        name: "cachedContents/xyz",
        candidates: [{ content: { parts: [{ text: "Hola" }] } }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10 }
      })));
    });
  });

  it("adds LIMIT and ORDER BY to context queries to reduce tokens", async () => {
    const prepareCalls: string[] = [];
    
    const mockDb = {
      prepare: vi.fn().mockImplementation((sql: string) => {
        prepareCalls.push(sql);
        return {
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockImplementation(async () => {
            if (sql.includes("SELECT context_text")) return null; // Force context cache miss
            if (sql.includes("suscripciones")) return { estado: "activa" };
            return {
              role: "usuario_inteligente", 
              email_verified: 1, 
              negocio_id: 1, 
              negocio_role: "owner", 
              id: 1, 
              name: "Test Negocio",
              limit: 50,
              count: 1
            };
          }),
          all: vi.fn().mockResolvedValue({ results: [] }),
          run: vi.fn().mockResolvedValue({ success: true }),
        };
      }),
      batch: vi.fn().mockResolvedValue([{ results: [] }]),
    } as unknown as D1Database;

    const env = {
      DB: mockDb,
      JWT_SECRET: "secret",
      GEMINI_API_KEY: "gemini_key",
      APP_URL: "http://localhost",
    };

    const token = "valid_token";

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: {
        "Cookie": `session_token=${token}`,
        "X-Negocio-ID": "1",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message: "test", history: [] })
    });

    const res = await app.fetch(req, env as any, { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as any);
    
    const bodyText = await res.text();
    if (res.status !== 200) {
      throw new Error(`Test failed with status ${res.status}: ${bodyText}`);
    }
    
    expect(res.status).toBe(200);

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
    const mockDb = {
      prepare: vi.fn().mockImplementation(() => {
        return {
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue({
            role: "usuario_inteligente", 
            email_verified: 1, 
            negocio_id: 1, 
            negocio_role: "owner", 
            id: 1, 
            name: "Test Negocio",
            limit: 50,
            count: 1
          }),
          all: vi.fn().mockResolvedValue({ results: [] }),
          run: vi.fn().mockResolvedValue({ success: true }),
        };
      }),
      batch: vi.fn().mockResolvedValue([{ results: [] }]),
    } as unknown as D1Database;

    const env = {
      DB: mockDb,
      JWT_SECRET: "secret",
      GEMINI_API_KEY: "gemini_key",
      APP_URL: "http://localhost",
    };

    const token = "valid_token";
    const longHistory = Array.from({ length: 10 }).map((_, i) => ({
      role: i % 2 === 0 ? "user" : "model",
      content: `msg ${i}`
    }));

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: {
        "Cookie": `session_token=${token}`,
        "X-Negocio-ID": "1",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message: "test", history: longHistory })
    });

    const res = await app.fetch(req, env as any, { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as any);
    expect(res.status).toBe(200);

    const fetchCall = mockFetch.mock.calls.find((call: any[]) => call[0].includes("generateContent"));
    expect(fetchCall).toBeDefined();
    
    const requestBody = JSON.parse(fetchCall[1].body);
    
    // The slice(-5) ensures we take only the last 5 messages from the history of 10.
    // If the cache was used or not, the logic adds the new message to the trimmed history.
    // However, if the cache was NOT used, the context text is prepended to the first message of the trimmed history.
    // So if trimmed history has 5 messages, and we add 1 new message, the total length of `contents` should be 6.
    expect(requestBody.contents).toBeDefined();
    expect(requestBody.contents.length).toBe(6);
  });
});
