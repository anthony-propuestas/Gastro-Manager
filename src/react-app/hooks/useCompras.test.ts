import { renderHook, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { useCompras } from "./useCompras";

const mockUseAuth = vi.fn();
const mockApiFetch = vi.fn();
const mockFetch = vi.fn();

vi.mock("@/react-app/context/AuthContext", () => ({ useAuth: () => mockUseAuth() }));
vi.mock("@/react-app/lib/api", () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));

function jsonResponse(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } })
  );
}

const COMPRA = {
  id: 1,
  negocio_id: 1,
  user_id: "u1",
  fecha: "2026-05-15",
  monto: 150,
  item: "Pan",
  tipo: "producto" as const,
  categoria: "otros",
  comprador_id: null,
  comprador_name: null,
  descripcion: null,
  comprobante_key: null,
  created_at: "2026-05-15",
  updated_at: "2026-05-15",
};

const SUMMARY = { fecha: "2026-05-15", total_dia: 150, total_productos: 150, total_servicios: 0, cantidad: 1 };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mockFetch);
  mockUseAuth.mockReturnValue({ currentNegocio: { id: 1 } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── Estado inicial ───────────────────────────────────────────────────────────

describe("useCompras — estado inicial", () => {
  it("isLoading empieza en true, compras y summary en [], error en null", () => {
    mockApiFetch.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useCompras());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.compras).toEqual([]);
    expect(result.current.summary).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});

// ─── fetchCompras ─────────────────────────────────────────────────────────────

describe("useCompras — fetchCompras", () => {
  it("setea compras cuando success es true", async () => {
    mockApiFetch.mockResolvedValue(jsonResponse({ success: true, data: [COMPRA] }));
    const { result } = renderHook(() => useCompras());
    await act(async () => { await result.current.fetchCompras(5, 2026); });
    expect(result.current.compras).toHaveLength(1);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("setea error cuando success es false", async () => {
    mockApiFetch.mockResolvedValue(
      jsonResponse({ success: false, error: { message: "Sin autorización" } })
    );
    const { result } = renderHook(() => useCompras());
    await act(async () => { await result.current.fetchCompras(5, 2026); });
    expect(result.current.compras).toEqual([]);
    expect(result.current.error).toBe("Sin autorización");
    expect(result.current.isLoading).toBe(false);
  });

  it("usa mensaje fallback cuando error.message no viene en la respuesta", async () => {
    mockApiFetch.mockResolvedValue(jsonResponse({ success: false }));
    const { result } = renderHook(() => useCompras());
    await act(async () => { await result.current.fetchCompras(5, 2026); });
    expect(result.current.error).toBe("Error al cargar compras");
  });

  it("setea 'Error de conexión' cuando el fetch lanza excepción", async () => {
    mockApiFetch.mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useCompras());
    await act(async () => { await result.current.fetchCompras(5, 2026); });
    expect(result.current.error).toBe("Error de conexión");
    expect(result.current.isLoading).toBe(false);
  });

  it("no llama apiFetch cuando currentNegocio es null", async () => {
    mockUseAuth.mockReturnValue({ currentNegocio: null });
    const { result } = renderHook(() => useCompras());
    await act(async () => { await result.current.fetchCompras(5, 2026); });
    expect(mockApiFetch).not.toHaveBeenCalled();
  });
});

// ─── fetchSummary ─────────────────────────────────────────────────────────────

describe("useCompras — fetchSummary", () => {
  it("setea summary cuando success es true", async () => {
    mockApiFetch.mockResolvedValue(jsonResponse({ success: true, data: [SUMMARY] }));
    const { result } = renderHook(() => useCompras());
    await act(async () => { await result.current.fetchSummary(5, 2026); });
    expect(result.current.summary).toHaveLength(1);
    expect(result.current.summary[0].total_dia).toBe(150);
  });

  it("no setea error cuando el fetch lanza excepción (silencioso)", async () => {
    mockApiFetch.mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useCompras());
    await act(async () => { await result.current.fetchSummary(5, 2026); });
    expect(result.current.error).toBeNull();
  });

  it("no llama apiFetch cuando currentNegocio es null", async () => {
    mockUseAuth.mockReturnValue({ currentNegocio: null });
    const { result } = renderHook(() => useCompras());
    await act(async () => { await result.current.fetchSummary(5, 2026); });
    expect(mockApiFetch).not.toHaveBeenCalled();
  });
});

// ─── createCompra ─────────────────────────────────────────────────────────────

describe("useCompras — createCompra", () => {
  const INPUT = { fecha: "2026-05-15", monto: 150, item: "Pan", tipo: "producto" as const, categoria: "otros" };

  it("retorna true cuando el servidor responde success: true", async () => {
    mockApiFetch.mockResolvedValue(jsonResponse({ success: true }));
    const { result } = renderHook(() => useCompras());
    let ok!: boolean;
    await act(async () => { ok = await result.current.createCompra(INPUT); });
    expect(ok).toBe(true);
  });

  it("retorna false cuando el servidor responde success: false", async () => {
    mockApiFetch.mockResolvedValue(jsonResponse({ success: false }));
    const { result } = renderHook(() => useCompras());
    let ok!: boolean;
    await act(async () => { ok = await result.current.createCompra(INPUT); });
    expect(ok).toBe(false);
  });

  it("retorna false cuando currentNegocio es null", async () => {
    mockUseAuth.mockReturnValue({ currentNegocio: null });
    const { result } = renderHook(() => useCompras());
    let ok!: boolean;
    await act(async () => { ok = await result.current.createCompra(INPUT); });
    expect(ok).toBe(false);
    expect(mockApiFetch).not.toHaveBeenCalled();
  });
});

// ─── updateCompra ─────────────────────────────────────────────────────────────

describe("useCompras — updateCompra", () => {
  it("retorna true cuando el servidor responde success: true", async () => {
    mockApiFetch.mockResolvedValue(jsonResponse({ success: true }));
    const { result } = renderHook(() => useCompras());
    let ok!: boolean;
    await act(async () => { ok = await result.current.updateCompra(1, { monto: 200 }); });
    expect(ok).toBe(true);
  });

  it("retorna false cuando el servidor responde success: false", async () => {
    mockApiFetch.mockResolvedValue(jsonResponse({ success: false }));
    const { result } = renderHook(() => useCompras());
    let ok!: boolean;
    await act(async () => { ok = await result.current.updateCompra(1, { monto: 200 }); });
    expect(ok).toBe(false);
  });
});

// ─── deleteCompra ─────────────────────────────────────────────────────────────

describe("useCompras — deleteCompra", () => {
  it("retorna true cuando el servidor responde success: true", async () => {
    mockApiFetch.mockResolvedValue(jsonResponse({ success: true }));
    const { result } = renderHook(() => useCompras());
    let ok!: boolean;
    await act(async () => { ok = await result.current.deleteCompra(1); });
    expect(ok).toBe(true);
  });

  it("retorna false cuando el servidor responde success: false", async () => {
    mockApiFetch.mockResolvedValue(jsonResponse({ success: false }));
    const { result } = renderHook(() => useCompras());
    let ok!: boolean;
    await act(async () => { ok = await result.current.deleteCompra(1); });
    expect(ok).toBe(false);
  });
});

// ─── uploadComprobante ────────────────────────────────────────────────────────

describe("useCompras — uploadComprobante", () => {
  const file = new File(["data"], "ticket.jpg", { type: "image/jpeg" });

  it("retorna la key cuando el servidor responde success: true", async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: { key: "abc123" } }),
    });
    const { result } = renderHook(() => useCompras());
    let key!: string | null;
    await act(async () => { key = await result.current.uploadComprobante(file); });
    expect(key).toBe("abc123");
  });

  it("retorna null cuando el servidor responde success: false", async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ success: false }),
    });
    const { result } = renderHook(() => useCompras());
    let key!: string | null;
    await act(async () => { key = await result.current.uploadComprobante(file); });
    expect(key).toBeNull();
  });

  it("retorna null cuando currentNegocio es null", async () => {
    mockUseAuth.mockReturnValue({ currentNegocio: null });
    const { result } = renderHook(() => useCompras());
    let key!: string | null;
    await act(async () => { key = await result.current.uploadComprobante(file); });
    expect(key).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ─── getComprobanteUrl ────────────────────────────────────────────────────────

describe("useCompras — getComprobanteUrl", () => {
  it("retorna la URL correcta para una key dada", () => {
    mockApiFetch.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useCompras());
    expect(result.current.getComprobanteUrl("abc123")).toBe("/api/compras/files/abc123");
  });
});
