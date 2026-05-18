import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import Facturacion from "./Facturacion";

vi.mock("@/react-app/hooks/useFacturacion");
vi.mock("@/react-app/hooks/useMyUsage", () => ({ useMyUsage: () => ({ data: null }) }));
vi.mock("@/react-app/components/UsageBanner", () => ({ UsageBanner: () => null }));
vi.mock("@/react-app/components/facturacion/FacturaModal", () => ({ default: () => null }));
vi.mock("@/react-app/components/facturacion/FacturasHistoryModal", () => ({ default: () => null }));
vi.mock("@/react-app/components/facturacion/DayDetailModal", () => ({ default: () => null }));

import { useFacturacion } from "@/react-app/hooks/useFacturacion";
const mockUseFacturacion = vi.mocked(useFacturacion);

const BASE_MOCK = {
  facturas: [] as any[],
  summary: [] as any[],
  isLoading: false,
  error: null as string | null,
  fetchFacturas: vi.fn(),
  fetchSummary: vi.fn(),
  createFactura: vi.fn(),
  updateFactura: vi.fn(),
  deleteFactura: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseFacturacion.mockReturnValue(BASE_MOCK);
});

// ─── Estados base ─────────────────────────────────────────────────────────────

describe("Facturacion — estados base", () => {
  it("muestra spinner cuando isLoading es true y facturas está vacío", () => {
    mockUseFacturacion.mockReturnValue({ ...BASE_MOCK, isLoading: true });
    render(<Facturacion />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("muestra el título 'Facturación' cuando cargó", () => {
    render(<Facturacion />);
    expect(screen.getByRole("heading", { name: "Facturación" })).toBeInTheDocument();
  });

  it("muestra selectores de mes y año", () => {
    render(<Facturacion />);
    const selects = document.querySelectorAll("select");
    expect(selects.length).toBeGreaterThanOrEqual(2);
  });

  it("muestra el mensaje de error cuando error tiene valor", () => {
    mockUseFacturacion.mockReturnValue({ ...BASE_MOCK, error: "Error de conexión" });
    render(<Facturacion />);
    expect(screen.getByText("Error de conexión")).toBeInTheDocument();
  });
});

// ─── Acciones ─────────────────────────────────────────────────────────────────

describe("Facturacion — acciones", () => {
  it("botón 'Nueva Venta' está presente", () => {
    render(<Facturacion />);
    expect(screen.getByRole("button", { name: /Nueva Venta/i })).toBeInTheDocument();
  });

  it("botón 'Historial' está presente", () => {
    render(<Facturacion />);
    expect(screen.getByRole("button", { name: /Historial/i })).toBeInTheDocument();
  });
});

// ─── Calendario ───────────────────────────────────────────────────────────────

describe("Facturacion — calendario", () => {
  it("muestra monto en celda cuando summary tiene datos para ese día", () => {
    const now = new Date();
    const fecha = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-15`;
    const summary = [{ fecha, total_dia: 1200, cantidad: 4 }];
    mockUseFacturacion.mockReturnValue({ ...BASE_MOCK, summary });
    render(<Facturacion />);
    expect(screen.getAllByText(/1.200|1200/).length).toBeGreaterThan(0);
  });

  it("muestra conteo de ventas en la celda cuando hay datos", () => {
    const now = new Date();
    const fecha = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-15`;
    const summary = [{ fecha, total_dia: 800, cantidad: 2 }];
    mockUseFacturacion.mockReturnValue({ ...BASE_MOCK, summary });
    render(<Facturacion />);
    expect(screen.getByText(/2 venta/i)).toBeInTheDocument();
  });
});
