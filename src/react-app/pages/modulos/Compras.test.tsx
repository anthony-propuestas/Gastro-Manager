import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import Compras from "./Compras";

vi.mock("@/react-app/hooks/useCompras");
vi.mock("@/react-app/hooks/useMyUsage", () => ({ useMyUsage: () => ({ data: null }) }));
vi.mock("@/react-app/components/UsageBanner", () => ({ UsageBanner: () => null }));
vi.mock("@/react-app/components/compras/CompraModal", () => ({ default: () => null }));
vi.mock("@/react-app/components/compras/ComprasHistoryModal", () => ({ default: () => null }));
vi.mock("@/react-app/components/compras/DayDetailModal", () => ({ default: () => null }));

import { useCompras } from "@/react-app/hooks/useCompras";
const mockUseCompras = vi.mocked(useCompras);

const BASE_MOCK = {
  compras: [] as any[],
  summary: [] as any[],
  isLoading: false,
  error: null as string | null,
  fetchCompras: vi.fn(),
  fetchSummary: vi.fn(),
  createCompra: vi.fn(),
  updateCompra: vi.fn(),
  deleteCompra: vi.fn(),
  uploadComprobante: vi.fn(),
  getComprobanteUrl: vi.fn().mockReturnValue('/api/compras/files/test'),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseCompras.mockReturnValue(BASE_MOCK);
});

// ─── Estados base ─────────────────────────────────────────────────────────────

describe("Compras — estados base", () => {
  it("muestra spinner cuando isLoading es true y compras está vacío", () => {
    mockUseCompras.mockReturnValue({ ...BASE_MOCK, isLoading: true });
    render(<Compras />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("muestra el título 'Compras' cuando cargó", () => {
    render(<Compras />);
    expect(screen.getByRole("heading", { name: "Compras" })).toBeInTheDocument();
  });

  it("muestra selectores de mes y año", () => {
    render(<Compras />);
    const selects = document.querySelectorAll("select");
    expect(selects.length).toBeGreaterThanOrEqual(2);
  });

  it("muestra el mensaje de error cuando error tiene valor", () => {
    mockUseCompras.mockReturnValue({ ...BASE_MOCK, error: "Error de conexión" });
    render(<Compras />);
    expect(screen.getByText("Error de conexión")).toBeInTheDocument();
  });
});

// ─── Acciones ─────────────────────────────────────────────────────────────────

describe("Compras — acciones", () => {
  it("botón 'Nueva Compra' está presente", () => {
    render(<Compras />);
    expect(screen.getByRole("button", { name: /Nueva Compra/i })).toBeInTheDocument();
  });

  it("botón 'Historial' está presente", () => {
    render(<Compras />);
    expect(screen.getByRole("button", { name: /Historial/i })).toBeInTheDocument();
  });
});

// ─── Calendario ───────────────────────────────────────────────────────────────

describe("Compras — calendario", () => {
  it("muestra monto en celda cuando summary tiene datos para ese día", () => {
    const now = new Date();
    const fecha = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-15`;
    const summary = [{ fecha, total_dia: 500, total_productos: 300, total_servicios: 200, cantidad: 2 }];
    mockUseCompras.mockReturnValue({ ...BASE_MOCK, summary });
    render(<Compras />);
    expect(screen.getAllByText(/500/).length).toBeGreaterThan(0);
  });

  it("muestra conteo de items en la celda cuando hay datos", () => {
    const now = new Date();
    const fecha = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-15`;
    const summary = [{ fecha, total_dia: 200, total_productos: 200, total_servicios: 0, cantidad: 3 }];
    mockUseCompras.mockReturnValue({ ...BASE_MOCK, summary });
    render(<Compras />);
    expect(screen.getByText(/3 items/i)).toBeInTheDocument();
  });
});
