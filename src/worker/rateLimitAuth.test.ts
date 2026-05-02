import { describe, expect, it } from "vitest";
import { checkRateLimit } from "./rateLimitAuth";

function makeDb(returnCount: number): D1Database {
  return {
    prepare: () => ({
      bind: () => ({
        first: async () => ({ count: returnCount }),
      }),
    }),
  } as unknown as D1Database;
}

function makeCapturingDb() {
  const captured = { ipHash: "", endpoint: "", windowStart: "" };
  const db = {
    prepare: () => ({
      bind: (ipHash: string, endpoint: string, windowStart: string) => {
        captured.ipHash = ipHash;
        captured.endpoint = endpoint;
        captured.windowStart = windowStart;
        return { first: async () => ({ count: 1 }) };
      },
    }),
  } as unknown as D1Database;
  return { db, captured };
}

describe("checkRateLimit", () => {
  it("returns true when count is below the limit", async () => {
    expect(await checkRateLimit("1.2.3.4", "sessions", makeDb(5), 10)).toBe(true);
  });

  it("returns true when count equals the limit (boundary)", async () => {
    expect(await checkRateLimit("1.2.3.4", "sessions", makeDb(10), 10)).toBe(true);
  });

  it("returns false when count exceeds the limit by one", async () => {
    expect(await checkRateLimit("1.2.3.4", "sessions", makeDb(11), 10)).toBe(false);
  });

  it("returns true on first attempt (count 1)", async () => {
    expect(await checkRateLimit("1.2.3.4", "sessions", makeDb(1), 10)).toBe(true);
  });

  it("returns true when D1 returns null (allows request — fail open)", async () => {
    const db = {
      prepare: () => ({ bind: () => ({ first: async () => null }) }),
    } as unknown as D1Database;
    expect(await checkRateLimit("1.2.3.4", "sessions", db, 10)).toBe(true);
  });

  it("does not store the raw IP — passes a 64-char hex hash to D1", async () => {
    const { db, captured } = makeCapturingDb();
    await checkRateLimit("192.168.1.1", "sessions", db, 10);
    expect(captured.ipHash).not.toBe("192.168.1.1");
    expect(captured.ipHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("same IP produces the same hash on repeated calls", async () => {
    const hashes: string[] = [];
    for (let i = 0; i < 2; i++) {
      const { db, captured } = makeCapturingDb();
      await checkRateLimit("10.0.0.1", "sessions", db, 10);
      hashes.push(captured.ipHash);
    }
    expect(hashes[0]).toBe(hashes[1]);
  });

  it("different IPs produce different hashes", async () => {
    const { db: db1, captured: c1 } = makeCapturingDb();
    const { db: db2, captured: c2 } = makeCapturingDb();
    await checkRateLimit("10.0.0.1", "sessions", db1, 10);
    await checkRateLimit("10.0.0.2", "sessions", db2, 10);
    expect(c1.ipHash).not.toBe(c2.ipHash);
  });

  it("window_start is floored to the windowMinutes boundary (no partial minutes)", async () => {
    const { db, captured } = makeCapturingDb();
    await checkRateLimit("1.2.3.4", "sessions", db, 10, 15);
    const parsed = new Date(captured.windowStart);
    expect(parsed.getMinutes() % 15).toBe(0);
    expect(parsed.getSeconds()).toBe(0);
    expect(parsed.getMilliseconds()).toBe(0);
  });

  it("respects verify-email tighter limits (5 attempts / 60 min)", async () => {
    expect(await checkRateLimit("1.2.3.4", "verify-email", makeDb(5), 5, 60)).toBe(true);
    expect(await checkRateLimit("1.2.3.4", "verify-email", makeDb(6), 5, 60)).toBe(false);
  });

  it("passes the endpoint name unchanged to D1", async () => {
    const { db, captured } = makeCapturingDb();
    await checkRateLimit("1.2.3.4", "verify-email", db, 5, 60);
    expect(captured.endpoint).toBe("verify-email");
  });
});

describe("corsOriginValidator", () => {
  // Mirrors the inline origin function used in the Hono CORS middleware in index.ts:
  // (origin) => (allowed && origin === allowed) ? origin : null
  function validateOrigin(origin: string, appUrl: string | undefined): string | null {
    return appUrl && origin === appUrl ? origin : null;
  }

  it("allows a request from the exact APP_URL", () => {
    expect(validateOrigin("https://gastro.example.com", "https://gastro.example.com")).toBe(
      "https://gastro.example.com"
    );
  });

  it("rejects a completely different origin", () => {
    expect(validateOrigin("https://evil.com", "https://gastro.example.com")).toBeNull();
  });

  it("rejects a subdomain that is not an exact match", () => {
    expect(validateOrigin("https://sub.gastro.example.com", "https://gastro.example.com")).toBeNull();
  });

  it("rejects all origins when APP_URL is undefined (no CORS in dev without APP_URL)", () => {
    expect(validateOrigin("https://gastro.example.com", undefined)).toBeNull();
  });

  it("rejects an empty origin string", () => {
    expect(validateOrigin("", "https://gastro.example.com")).toBeNull();
  });

  it("is case-sensitive — http differs from https", () => {
    expect(validateOrigin("http://gastro.example.com", "https://gastro.example.com")).toBeNull();
  });
});
