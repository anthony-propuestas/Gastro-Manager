import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import FacturasHistoryModal from "./FacturasHistoryModal";

vi.mock("@/react-app/hooks/useFacturacion", () => ({
  METODOS_PAGO: [
    { value: "efectivo", label: "Efectivo" },
    { value: "tarjeta", label: "Tarjeta" },
    { value: "transferencia", label: "Transferencia" },
  ],
  parsePagosDetalle: () => [],
  useFacturacion: vi.fn(),
}));
vi.mock("@/react-app/components/ui/toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("./FacturaModal", () => ({ default: () => null }));

import { useFacturacion } from "@/react-app/hooks/useFacturacion";
const mockUseFacturacion = vi.mocked(useFacturacion);

const FACTURA = {
  id: 1,
  negocio_id: 1,
  user_id: "user-1",
  fecha: "2026-05-15",
  monto_total: 500,
  metodo_pago: "efectivo" as const,
  concepto: "Almuerzo",
  numero_comprobante: "001",
  notas: null,
  turno: "mañana" as const,
  pagos_detalle: null,
  created_at: "2026-05-15",
  updated_at: "2026-05-15",
};

const DEFAULT_PROPS = {
  isOpen: true,
  onClose: vi.fn(),
  facturas: [],
  onChanged: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseFacturacion.mockReturnValue({ deleteFactura: vi.fn() } as any);
});

// ─── Visibilidad ──────────────────────────────────────────────────────────────

describe("FacturasHistoryModal — visibilidad", () => {
  it("no renderiza nada cuando isOpen es false", () => {
    const { container } = render(<FacturasHistoryModal {...DEFAULT_PROPS} isOpen={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("muestra 'No hay ventas para mostrar' cuando la lista está vacía", () => {
    render(<FacturasHistoryModal {...DEFAULT_PROPS} />);
    expect(screen.getByText("No hay ventas para mostrar")).toBeInTheDocument();
  });

  it("muestra el concepto cuando hay facturas", () => {
    render(<FacturasHistoryModal {...DEFAULT_PROPS} facturas={[FACTURA]} />);
    expect(screen.getAllByText("Almuerzo").length).toBeGreaterThan(0);
  });
});

// ─── Filtros ──────────────────────────────────────────────────────────────────

describe("FacturasHistoryModal — filtros", () => {
  it("filtra por turno: oculta facturas que no coinciden", () => {
    render(<FacturasHistoryModal {...DEFAULT_PROPS} facturas={[FACTURA]} />);
    const selects = document.querySelectorAll("select");
    const turnoSelect = Array.from(selects).find((s) =>
      s.textContent?.includes("Todos los turnos")
    ) as HTMLSelectElement;
    fireEvent.change(turnoSelect, { target: { value: "tarde" } });
    expect(screen.getByText("No hay ventas para mostrar")).toBeInTheDocument();
  });

  it("filtra por búsqueda: oculta facturas que no coinciden con el concepto", () => {
    render(<FacturasHistoryModal {...DEFAULT_PROPS} facturas={[FACTURA]} />);
    const searchInput = screen.getByPlaceholderText(/Buscar por concepto/i);
    fireEvent.change(searchInput, { target: { value: "xyz" } });
    expect(screen.getByText("No hay ventas para mostrar")).toBeInTheDocument();
  });
});
