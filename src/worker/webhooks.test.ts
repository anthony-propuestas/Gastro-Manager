import { describe, it, expect, vi, beforeEach } from "vitest";
import app from "./index";

/**
 * Helper to generate a valid MercadoPago webhook signature (v1)
 */
async function generateMPSignature(dataId: string, requestId: string, ts: string, secret: string) {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts}`;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const buf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  return `ts=${ts},v1=${hex}`;
}

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("POST /api/webhooks/mercadopago", () => {
  const SECRET = "webhook_secret";
  const DATA_ID = "12345";
  const REQ_ID = "req_abc";
  const TS = "1234567890";

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns 200 even if signature is invalid (security by obscurity/silent fail)", async () => {
    const req = new Request(`http://localhost/api/webhooks/mercadopago?type=payment&data.id=${DATA_ID}`, {
      method: "POST",
      headers: { "x-signature": "invalid", "x-request-id": REQ_ID }
    });
    const res = await app.fetch(req, { MERCADO_PAGO_WEBHOOK_SECRET: SECRET } as any);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("handles approved payment: updates subscription and user role", async () => {
    const signature = await generateMPSignature(DATA_ID, REQ_ID, TS, SECRET);
    
    // Mock MP Payment response
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      id: 12345,
      status: "approved",
      transaction_amount: 15000,
      currency_id: "ARS",
      date_approved: "2024-01-01T00:00:00Z",
      external_reference: "user_1",
      preapproval_id: "pre_1"
    }), { status: 200 }));

    const prepareCalls: string[] = [];
    const mockDb = {
      prepare: vi.fn().mockImplementation((sql: string) => {
        prepareCalls.push(sql);
        return {
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockImplementation(async () => {
            if (sql.includes("suscripciones")) return { id: 10, ultimo_pago_ok: null };
            return null;
          }),
          run: vi.fn().mockResolvedValue({ success: true }),
        };
      }),
      batch: vi.fn().mockResolvedValue([]),
    };

    const req = new Request(`http://localhost/api/webhooks/mercadopago?type=payment&data.id=${DATA_ID}`, {
      method: "POST",
      headers: { "x-signature": signature, "x-request-id": REQ_ID }
    });

    const res = await app.fetch(req, { 
      MERCADO_PAGO_WEBHOOK_SECRET: SECRET,
      DB: mockDb,
      MERCADO_PAGO_ACCESS_TOKEN: "token"
    } as any);

    expect(res.status).toBe(200);
    
    // Verify DB calls via prepareCalls since batch uses prepared statements
    expect(prepareCalls.some(sql => sql.includes("INSERT OR IGNORE INTO pagos_suscripcion"))).toBe(true);
    expect(prepareCalls.some(sql => sql.includes("UPDATE users SET role='usuario_inteligente'"))).toBe(true);
    expect(mockDb.batch).toHaveBeenCalled();
  });

  it("handles preapproval authorized: updates proximo_cobro", async () => {
    const signature = await generateMPSignature(DATA_ID, REQ_ID, TS, SECRET);
    
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      id: "pre_1",
      status: "authorized",
      external_reference: "user_1",
      next_payment_date: "2024-02-01T00:00:00Z"
    }), { status: 200 }));

    const mockDb = {
      prepare: vi.fn().mockImplementation(() => ({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      })),
    };

    const req = new Request(`http://localhost/api/webhooks/mercadopago?type=preapproval&data.id=${DATA_ID}`, {
      method: "POST",
      headers: { "x-signature": signature, "x-request-id": REQ_ID }
    });

    const res = await app.fetch(req, { 
      MERCADO_PAGO_WEBHOOK_SECRET: SECRET,
      DB: mockDb,
      MERCADO_PAGO_ACCESS_TOKEN: "token"
    } as any);

    expect(res.status).toBe(200);
    expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("UPDATE suscripciones SET estado='autorizada'"));
  });
});
