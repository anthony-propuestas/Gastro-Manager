import { describe, it, expect, vi } from "vitest";
import worker from "./index";

describe("scheduled handler — R2 cleanup", () => {
  it("deletes expired R2 objects and clears their keys in DB", async () => {
    const mockR2 = {
      delete: vi.fn().mockResolvedValue(undefined),
    };

    const mockDb = {
      prepare: vi.fn().mockImplementation((_sql: string) => ({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({
          results: [
            { id: 1, comprobante_key: "compras/1/old1.jpg" },
            { id: 2, comprobante_key: "compras/1/old2.jpg" },
          ],
        }),
        run: vi.fn().mockResolvedValue({ success: true }),
      })),
    };

    const env = {
      DB: mockDb,
      R2_BUCKET: mockR2,
    };

    const event = {
      cron: "0 3 1 * *",
      scheduledTime: Date.now(),
      waitUntil: (p: Promise<any>) => p,
    } as unknown as ScheduledEvent;

    await worker.scheduled(event, env as any, {} as any);

    // Should have called SELECT
    expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("SELECT id, comprobante_key FROM compras WHERE expires_at <= datetime('now')"));

    // Should have called R2.delete for each expired item
    expect(mockR2.delete).toHaveBeenCalledTimes(2);
    expect(mockR2.delete).toHaveBeenCalledWith("compras/1/old1.jpg");
    expect(mockR2.delete).toHaveBeenCalledWith("compras/1/old2.jpg");

    // Should have called UPDATE for each expired item
    expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("UPDATE compras SET comprobante_key = NULL WHERE id = ?"));
  });

  it("does nothing if no expired items found", async () => {
    const mockR2 = { delete: vi.fn() };
    const mockDb = {
      prepare: vi.fn().mockImplementation(() => ({
        all: vi.fn().mockResolvedValue({ results: [] }),
      })),
    };

    const env = { DB: mockDb, R2_BUCKET: mockR2 };
    const event = { cron: "...", scheduledTime: 0, waitUntil: (p: any) => p } as any;

    await worker.scheduled(event, env as any, {} as any);

    expect(mockR2.delete).not.toHaveBeenCalled();
  });
});
