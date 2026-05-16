import { renderHook, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { useSalaries, Advance } from "./useSalaries";

const mockUseAuth = vi.fn();
const mockApiFetch = vi.fn();

vi.mock("@/react-app/context/AuthContext", () => ({ useAuth: () => mockUseAuth() }));
vi.mock("@/react-app/lib/api", () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));

function jsonResponse(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } })
  );
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({ currentNegocio: { id: 1 } });
  vi.clearAllMocks();
});

const ADVANCE: Advance = {
  id: 1,
  negocio_id: 1,
  user_id: "u1",
  employee_id: 2,
  amount: 500,
  period_month: 5,
  period_year: 2026,
  advance_date: "2026-05-10",
  description: null,
  created_at: "2026-05-10",
  updated_at: "2026-05-10",
};

const OVERVIEW = {
  employees: [{ id: 2, name: "Ana", role: "Chef", monthly_salary: 15000, advances_total: 500, remaining: 14500, is_paid: false }],
  totals: { total_salaries: 15000, total_advances: 500, total_remaining: 14500, total_paid: 0 },
  period: { month: 5, year: 2026 },
};

// ─── Estado inicial ───────────────────────────────────────────────────────────

describe("useSalaries — estado inicial", () => {
  it("isLoading empieza en false y error en null", () => {
    const { result } = renderHook(() => useSalaries());
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});

// ─── fetchOverview ────────────────────────────────────────────────────────────

describe("useSalaries — fetchOverview", () => {
  it("retorna SalaryOverview e isLoading vuelve a false cuando success es true", async () => {
    mockApiFetch.mockReturnValue(jsonResponse({ success: true, data: OVERVIEW }));

    const { result } = renderHook(() => useSalaries());

    let data: typeof OVERVIEW | null = null;
    await act(async () => {
      data = await result.current.fetchOverview(5, 2026);
    });

    expect(data).toEqual(OVERVIEW);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("retorna null y setea error cuando success es false", async () => {
    mockApiFetch.mockReturnValue(jsonResponse({ success: false, error: { message: "Sin datos" } }));

    const { result } = renderHook(() => useSalaries());

    let data: unknown;
    await act(async () => {
      data = await result.current.fetchOverview();
    });

    expect(data).toBeNull();
    expect(result.current.error).toBe("Sin datos");
    expect(result.current.isLoading).toBe(false);
  });

  it("retorna null y setea 'Error de conexión' cuando el fetch lanza excepción", async () => {
    mockApiFetch.mockRejectedValue(new Error("network"));

    const { result } = renderHook(() => useSalaries());

    let data: unknown;
    await act(async () => {
      data = await result.current.fetchOverview();
    });

    expect(data).toBeNull();
    expect(result.current.error).toBe("Error de conexión");
  });
});

// ─── fetchAdvances ────────────────────────────────────────────────────────────

describe("useSalaries — fetchAdvances", () => {
  it("retorna Advance[] cuando success es true", async () => {
    mockApiFetch.mockReturnValue(jsonResponse({ success: true, data: [ADVANCE] }));

    const { result } = renderHook(() => useSalaries());

    let advances: typeof ADVANCE[] = [];
    await act(async () => {
      advances = await result.current.fetchAdvances(2, 5, 2026);
    });

    expect(advances).toHaveLength(1);
    expect(advances[0]).toEqual(ADVANCE);
  });

  it("retorna [] cuando data es undefined en success true", async () => {
    mockApiFetch.mockReturnValue(jsonResponse({ success: true, data: undefined }));

    const { result } = renderHook(() => useSalaries());

    let advances: unknown[] = [];
    await act(async () => {
      advances = await result.current.fetchAdvances(2);
    });

    expect(advances).toEqual([]);
  });

  it("lanza error cuando success es false", async () => {
    mockApiFetch.mockReturnValue(jsonResponse({ success: false, error: { message: "No autorizado" } }));

    const { result } = renderHook(() => useSalaries());

    await act(async () => {
      await expect(result.current.fetchAdvances(2)).rejects.toThrow("No autorizado");
    });
  });
});

// ─── createAdvance ────────────────────────────────────────────────────────────

describe("useSalaries — createAdvance", () => {
  it("retorna el Advance creado cuando success es true", async () => {
    mockApiFetch.mockReturnValue(jsonResponse({ success: true, data: ADVANCE }));

    const { result } = renderHook(() => useSalaries());

    let created: unknown;
    await act(async () => {
      created = await result.current.createAdvance(2, { amount: 500 });
    });

    expect(created).toEqual(ADVANCE);
  });

  it("lanza error cuando success es false", async () => {
    mockApiFetch.mockReturnValue(jsonResponse({ success: false, error: { message: "Límite alcanzado" } }));

    const { result } = renderHook(() => useSalaries());

    await act(async () => {
      await expect(result.current.createAdvance(2, { amount: 500 })).rejects.toThrow("Límite alcanzado");
    });
  });
});

// ─── deleteAdvance ────────────────────────────────────────────────────────────

describe("useSalaries — deleteAdvance", () => {
  it("retorna true cuando success es true", async () => {
    mockApiFetch.mockReturnValue(jsonResponse({ success: true }));

    const { result } = renderHook(() => useSalaries());

    let ok: boolean = false;
    await act(async () => {
      ok = await result.current.deleteAdvance(1);
    });

    expect(ok).toBe(true);
  });

  it("lanza error cuando success es false", async () => {
    mockApiFetch.mockReturnValue(jsonResponse({ success: false, error: { message: "No encontrado" } }));

    const { result } = renderHook(() => useSalaries());

    await act(async () => {
      await expect(result.current.deleteAdvance(1)).rejects.toThrow("No encontrado");
    });
  });
});

// ─── markAsPaid ──────────────────────────────────────────────────────────────

describe("useSalaries — markAsPaid", () => {
  it("retorna true cuando success es true", async () => {
    mockApiFetch.mockReturnValue(jsonResponse({ success: true }));

    const { result } = renderHook(() => useSalaries());

    let ok: boolean = false;
    await act(async () => {
      ok = await result.current.markAsPaid(2, 5, 2026);
    });

    expect(ok).toBe(true);
  });

  it("lanza error cuando success es false", async () => {
    mockApiFetch.mockReturnValue(jsonResponse({ success: false, error: { message: "Ya pagado" } }));

    const { result } = renderHook(() => useSalaries());

    await act(async () => {
      await expect(result.current.markAsPaid(2, 5, 2026)).rejects.toThrow("Ya pagado");
    });
  });
});

// ─── markAllAsPaid ────────────────────────────────────────────────────────────

describe("useSalaries — markAllAsPaid", () => {
  it("retorna true cuando success es true", async () => {
    mockApiFetch.mockReturnValue(jsonResponse({ success: true }));

    const { result } = renderHook(() => useSalaries());

    let ok: boolean = false;
    await act(async () => {
      ok = await result.current.markAllAsPaid(5, 2026);
    });

    expect(ok).toBe(true);
  });

  it("lanza error cuando success es false", async () => {
    mockApiFetch.mockReturnValue(jsonResponse({ success: false, error: { message: "Límite de pagos" } }));

    const { result } = renderHook(() => useSalaries());

    await act(async () => {
      await expect(result.current.markAllAsPaid(5, 2026)).rejects.toThrow("Límite de pagos");
    });
  });
});
