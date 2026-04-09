import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/react-app/lib/api";
import { USAGE_LIMIT_EVENT } from "@/react-app/lib/usageLimitModal";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiFetch", () => {
  it("injects the negocio header when negocioId exists", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/api/employees", { method: "GET" }, 12);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/employees",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-Negocio-ID": "12",
        }),
      })
    );
  });

  it("does not inject the negocio header when negocioId is missing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/api/employees", { method: "POST" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/employees",
      expect.objectContaining({
        method: "POST",
        headers: expect.not.objectContaining({
          "X-Negocio-ID": expect.any(String),
        }),
      })
    );
  });

  it("dispatches a usage-limit event when the API returns USAGE_LIMIT_EXCEEDED", async () => {
    const listener = vi.fn();
    const payload = {
      success: false,
      error: {
        code: "USAGE_LIMIT_EXCEEDED",
        message: "Límite mensual alcanzado (20). Actualiza a Usuario Inteligente para continuar.",
      },
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      })
    );

    vi.stubGlobal("fetch", fetchMock);
    window.addEventListener(USAGE_LIMIT_EVENT, listener as EventListener);

    await apiFetch("/api/chat", { method: "POST" }, 3);
    await Promise.resolve();
    await Promise.resolve();

    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0]?.[0] as CustomEvent).detail).toMatchObject({
      endpoint: "/api/chat",
      moduleLabel: "Chat IA",
      limit: 20,
    });

    window.removeEventListener(USAGE_LIMIT_EVENT, listener as EventListener);
  });
});