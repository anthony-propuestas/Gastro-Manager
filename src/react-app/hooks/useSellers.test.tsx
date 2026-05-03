import { renderHook, waitFor, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { useSellers } from "./useSellers";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function res(body: unknown) {
  return Promise.resolve({ json: () => Promise.resolve(body) } as Response);
}

const VENDEDOR = { user_id: "u1", codigo: "ANA123XX", activo: 1, created_at: "2026-01-01" };
const STATS = { total_referidos: 2, confirmados: 1, comision_total: 7500, comision_pendiente: 7500 };
const REFERIDO = {
  id: 1,
  vendedor_id: "u1",
  referido_user_id: "u2",
  suscripcion_id: null,
  estado: "pendiente",
  comision_monto: null,
  reembolso_monto: null,
  comision_pagada: 0,
  reembolso_pagado: 0,
  created_at: "2026-01-01",
  confirmed_at: null,
  referido_name: "Juan",
  referido_email: "juan@test.com",
  suscripcion_estado: null,
};

// ─── Estado inicial ───────────────────────────────────────────────────────────

describe("useSellers — estado inicial", () => {
  it("isLoading empieza en true y vendedor en null", () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useSellers());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.vendedor).toBeNull();
    expect(result.current.referidos).toEqual([]);
    expect(result.current.stats).toBeNull();
    expect(result.current.error).toBeNull();
  });
});

// ─── fetchMe ─────────────────────────────────────────────────────────────────

describe("useSellers — fetchMe", () => {
  it("setea vendedor, referidos y stats cuando el fetch tiene éxito", async () => {
    mockFetch.mockReturnValue(
      res({ success: true, data: { vendedor: VENDEDOR, referidos: [REFERIDO], stats: STATS } })
    );

    const { result } = renderHook(() => useSellers());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.vendedor).toEqual(VENDEDOR);
    expect(result.current.referidos).toHaveLength(1);
    expect(result.current.stats).toEqual(STATS);
    expect(result.current.error).toBeNull();
  });

  it("setea vendedor null cuando success es false", async () => {
    mockFetch.mockReturnValue(res({ success: false }));

    const { result } = renderHook(() => useSellers());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.vendedor).toBeNull();
    expect(result.current.referidos).toEqual([]);
    expect(result.current.stats).toBeNull();
  });

  it("setea referidos a [] cuando data.referidos es undefined", async () => {
    mockFetch.mockReturnValue(
      res({ success: true, data: { vendedor: VENDEDOR, stats: STATS } })
    );

    const { result } = renderHook(() => useSellers());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.referidos).toEqual([]);
  });

  it("setea error cuando el fetch lanza excepción", async () => {
    mockFetch.mockRejectedValue(new Error("network"));

    const { result } = renderHook(() => useSellers());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe("Error al cargar datos de vendedor");
    expect(result.current.vendedor).toBeNull();
  });

  it("isLoading pasa a false después de la carga", async () => {
    mockFetch.mockReturnValue(
      res({ success: true, data: { vendedor: VENDEDOR, referidos: [], stats: STATS } })
    );

    const { result } = renderHook(() => useSellers());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });
});

// ─── activate ────────────────────────────────────────────────────────────────

describe("useSellers — activate", () => {
  it("retorna true y re-llama fetchMe al activar con éxito", async () => {
    mockFetch
      .mockReturnValueOnce(res({ success: true, data: { vendedor: null, referidos: [], stats: null } }))
      .mockReturnValueOnce(res({ success: true, data: { codigo: "ANA123XX" } }))
      .mockReturnValueOnce(res({ success: true, data: { vendedor: VENDEDOR, referidos: [], stats: STATS } }));

    const { result } = renderHook(() => useSellers());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let activated!: boolean;
    await act(async () => {
      activated = await result.current.activate();
    });

    expect(activated).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(result.current.vendedor).toEqual(VENDEDOR);
  });

  it("retorna false y setea error cuando el servidor responde con error", async () => {
    mockFetch
      .mockReturnValueOnce(res({ success: true, data: { vendedor: null, referidos: [], stats: null } }))
      .mockReturnValueOnce(res({ success: false, error: { message: "Ya sos vendedor" } }));

    const { result } = renderHook(() => useSellers());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let activated!: boolean;
    await act(async () => {
      activated = await result.current.activate();
    });

    expect(activated).toBe(false);
    expect(result.current.error).toBe("Ya sos vendedor");
  });

  it("retorna false cuando hay error de red al activar", async () => {
    mockFetch
      .mockReturnValueOnce(res({ success: true, data: { vendedor: null, referidos: [], stats: null } }))
      .mockRejectedValueOnce(new Error("network"));

    const { result } = renderHook(() => useSellers());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let activated!: boolean;
    await act(async () => {
      activated = await result.current.activate();
    });

    expect(activated).toBe(false);
    expect(result.current.error).toBe("Error de red al activar");
  });
});

// ─── refresh ─────────────────────────────────────────────────────────────────

describe("useSellers — refresh", () => {
  it("refresh llama fetchMe por segunda vez", async () => {
    mockFetch.mockReturnValue(
      res({ success: true, data: { vendedor: VENDEDOR, referidos: [], stats: STATS } })
    );

    const { result } = renderHook(() => useSellers());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
