import { describe, it, expect, vi } from "vitest";
import { incrementAndCheckInteligenteLimit, CHAT_CAP_INTELIGENTE } from "./usageLimit";
import { USAGE_TOOLS } from "./usageTools";

// Returns a db where the INSERT RETURNING count yields `insertCount`,
// and captures the args passed to the UPDATE revert bind.
function makeDb(insertCount: number | null) {
  const revertBind = vi.fn().mockReturnThis();
  const revertRun = vi.fn().mockResolvedValue({ success: true });
  const db = {
    prepare: vi.fn().mockImplementation((sql: string) => {
      if (sql.includes("INSERT")) {
        return {
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(insertCount !== null ? { count: insertCount } : null),
        };
      }
      // UPDATE revert
      return { bind: revertBind, run: revertRun };
    }),
  } as unknown as D1Database;
  return { db, revertBind, revertRun };
}

const USER_ID = "user-abc";
const NEGOCIO_ID = 1;
const PERIOD = "2026-05";

describe("incrementAndCheckInteligenteLimit — chat", () => {
  it("allows request when count is below cap", async () => {
    const { db } = makeDb(CHAT_CAP_INTELIGENTE - 1);
    const result = await incrementAndCheckInteligenteLimit(db, USER_ID, NEGOCIO_ID, USAGE_TOOLS.CHAT, PERIOD);
    expect(result.blocked).toBe(false);
  });

  it("allows request when count equals cap exactly (boundary)", async () => {
    const { db } = makeDb(CHAT_CAP_INTELIGENTE);
    const result = await incrementAndCheckInteligenteLimit(db, USER_ID, NEGOCIO_ID, USAGE_TOOLS.CHAT, PERIOD);
    expect(result.blocked).toBe(false);
  });

  it("blocks request when count exceeds cap by one", async () => {
    const { db } = makeDb(CHAT_CAP_INTELIGENTE + 1);
    const result = await incrementAndCheckInteligenteLimit(db, USER_ID, NEGOCIO_ID, USAGE_TOOLS.CHAT, PERIOD);
    expect(result.blocked).toBe(true);
  });

  it("runs revert UPDATE when blocked", async () => {
    const { db, revertRun } = makeDb(CHAT_CAP_INTELIGENTE + 1);
    await incrementAndCheckInteligenteLimit(db, USER_ID, NEGOCIO_ID, USAGE_TOOLS.CHAT, PERIOD);
    expect(revertRun).toHaveBeenCalledOnce();
  });

  it("passes correct args to revert UPDATE", async () => {
    const { db, revertBind } = makeDb(CHAT_CAP_INTELIGENTE + 1);
    await incrementAndCheckInteligenteLimit(db, USER_ID, NEGOCIO_ID, USAGE_TOOLS.CHAT, PERIOD);
    expect(revertBind).toHaveBeenCalledWith(USER_ID, NEGOCIO_ID, USAGE_TOOLS.CHAT, PERIOD);
  });

  it("does not run revert when not blocked", async () => {
    const { db, revertRun } = makeDb(CHAT_CAP_INTELIGENTE);
    await incrementAndCheckInteligenteLimit(db, USER_ID, NEGOCIO_ID, USAGE_TOOLS.CHAT, PERIOD);
    expect(revertRun).not.toHaveBeenCalled();
  });

  it("allows first-ever request when D1 returns null (count defaults to 1)", async () => {
    const { db } = makeDb(null);
    const result = await incrementAndCheckInteligenteLimit(db, USER_ID, NEGOCIO_ID, USAGE_TOOLS.CHAT, PERIOD);
    expect(result.blocked).toBe(false);
  });
});

describe("incrementAndCheckInteligenteLimit — non-chat tools", () => {
  it("never blocks employees even when count far exceeds chat cap", async () => {
    const { db, revertRun } = makeDb(CHAT_CAP_INTELIGENTE + 9999);
    const result = await incrementAndCheckInteligenteLimit(db, USER_ID, NEGOCIO_ID, USAGE_TOOLS.EMPLOYEES, PERIOD);
    expect(result.blocked).toBe(false);
    expect(revertRun).not.toHaveBeenCalled();
  });

  it("never blocks events even when count far exceeds chat cap", async () => {
    const { db } = makeDb(CHAT_CAP_INTELIGENTE + 9999);
    const result = await incrementAndCheckInteligenteLimit(db, USER_ID, NEGOCIO_ID, USAGE_TOOLS.EVENTS, PERIOD);
    expect(result.blocked).toBe(false);
  });

  it("never blocks facturacion even when count far exceeds chat cap", async () => {
    const { db } = makeDb(CHAT_CAP_INTELIGENTE + 9999);
    const result = await incrementAndCheckInteligenteLimit(db, USER_ID, NEGOCIO_ID, USAGE_TOOLS.FACTURACION, PERIOD);
    expect(result.blocked).toBe(false);
  });
});

describe("incrementAndCheckInteligenteLimit — INSERT SQL", () => {
  it("always calls INSERT before the cap check", async () => {
    const { db } = makeDb(1);
    await incrementAndCheckInteligenteLimit(db, USER_ID, NEGOCIO_ID, USAGE_TOOLS.CHAT, PERIOD);
    const insertCall = (db.prepare as ReturnType<typeof vi.fn>).mock.calls.find(
      ([sql]: [string]) => sql.includes("INSERT")
    );
    expect(insertCall).toBeDefined();
  });

  it("INSERT SQL includes RETURNING count", async () => {
    const { db } = makeDb(1);
    await incrementAndCheckInteligenteLimit(db, USER_ID, NEGOCIO_ID, USAGE_TOOLS.CHAT, PERIOD);
    const insertSql = (db.prepare as ReturnType<typeof vi.fn>).mock.calls.find(
      ([sql]: [string]) => sql.includes("INSERT")
    )?.[0] as string;
    expect(insertSql).toContain("RETURNING count");
  });
});
