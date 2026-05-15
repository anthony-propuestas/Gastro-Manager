import { describe, it, expect, vi, beforeEach } from "vitest";
import { getOrCreateGeminiCache } from "./geminiCache";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeDb(selectResult: unknown): D1Database {
  return {
    prepare: () => ({
      bind: function () { return this; },
      first: async () => selectResult,
      run: async () => ({ success: true }),
    }),
  } as unknown as D1Database;
}

function makeCapturingDb(selectResult: unknown) {
  const updateBind = vi.fn().mockReturnThis();
  const updateRun = vi.fn().mockResolvedValue({ success: true });
  const db = {
    prepare: vi.fn().mockImplementation((sql: string) => {
      if (sql.startsWith("SELECT")) {
        return { bind: vi.fn().mockReturnThis(), first: vi.fn().mockResolvedValue(selectResult) };
      }
      return { bind: updateBind, run: updateRun };
    }),
  } as unknown as D1Database;
  return { db, updateBind, updateRun };
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe("getOrCreateGeminiCache", () => {
  describe("cache hit", () => {
    it("returns existing name when not expired — no API call", async () => {
      const db = makeDb({
        gemini_cache_name: "cachedContents/abc",
        gemini_cache_expires_at: Date.now() + 1_000_000,
      });
      const result = await getOrCreateGeminiCache(db, "key", 2, "ctx");
      expect(result).toBe("cachedContents/abc");
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("cache miss — creates new cache", () => {
    it("creates cache when no row exists (null from D1)", async () => {
      const db = makeDb(null);
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ name: "cachedContents/new" }), { status: 200 })
      );
      const result = await getOrCreateGeminiCache(db, "key", 2, "ctx");
      expect(result).toBe("cachedContents/new");
      expect(mockFetch).toHaveBeenCalledOnce();
    });

    it("creates cache when gemini_cache_name is null", async () => {
      const db = makeDb({ gemini_cache_name: null, gemini_cache_expires_at: null });
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ name: "cachedContents/new" }), { status: 200 })
      );
      const result = await getOrCreateGeminiCache(db, "key", 2, "ctx");
      expect(result).toBe("cachedContents/new");
    });

    it("creates cache when existing cache is expired", async () => {
      const db = makeDb({
        gemini_cache_name: "cachedContents/old",
        gemini_cache_expires_at: Date.now() - 1,
      });
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ name: "cachedContents/refreshed" }), { status: 200 })
      );
      const result = await getOrCreateGeminiCache(db, "key", 2, "ctx");
      expect(result).toBe("cachedContents/refreshed");
    });

    it("creates cache when expires_at is null but name exists", async () => {
      const db = makeDb({
        gemini_cache_name: "cachedContents/stale",
        gemini_cache_expires_at: null,
      });
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ name: "cachedContents/renewed" }), { status: 200 })
      );
      const result = await getOrCreateGeminiCache(db, "key", 2, "ctx");
      expect(result).toBe("cachedContents/renewed");
      expect(mockFetch).toHaveBeenCalledOnce();
    });
  });

  describe("Gemini API payload", () => {
    it("sends correct model, systemInstruction and ttl", async () => {
      const db = makeDb(null);
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ name: "cachedContents/x" }), { status: 200 })
      );
      await getOrCreateGeminiCache(db, "my-api-key", 2, "contexto del negocio");

      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/cachedContents");
      expect((options.headers as Record<string, string>)["x-goog-api-key"]).toBe("my-api-key");
      const body = JSON.parse(options.body as string);
      expect(body.model).toBe("models/gemini-2.5-flash");
      expect(body.systemInstruction.parts[0].text).toBe("contexto del negocio");
      expect(body.ttl).toBe("7200s");
    });
  });

  describe("D1 persistence", () => {
    it("persists new cache name and expiry in D1", async () => {
      const { db, updateBind } = makeCapturingDb(null);
      const before = Date.now();
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ name: "cachedContents/stored" }), { status: 200 })
      );
      await getOrCreateGeminiCache(db, "key", 42, "ctx");

      const [name, expiresAt, negocioId] = updateBind.mock.calls[0] as [string, number, number];
      expect(name).toBe("cachedContents/stored");
      expect(expiresAt).toBeGreaterThanOrEqual(before + 7200 * 1000);
      expect(negocioId).toBe(42);
    });

    it("does not persist to D1 when Gemini API fails", async () => {
      const { db, updateRun } = makeCapturingDb(null);
      mockFetch.mockResolvedValueOnce(new Response("error", { status: 400 }));
      await getOrCreateGeminiCache(db, "key", 2, "ctx");
      expect(updateRun).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("returns null when Gemini API returns non-ok status", async () => {
      const db = makeDb(null);
      mockFetch.mockResolvedValueOnce(new Response("bad request", { status: 400 }));
      expect(await getOrCreateGeminiCache(db, "key", 2, "ctx")).toBeNull();
    });

    it("returns null when fetch throws a network error", async () => {
      const db = makeDb(null);
      mockFetch.mockRejectedValueOnce(new Error("network failure"));
      expect(await getOrCreateGeminiCache(db, "key", 2, "ctx")).toBeNull();
    });
  });
});
