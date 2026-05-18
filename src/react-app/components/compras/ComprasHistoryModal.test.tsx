import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import ComprasHistoryModal from "./ComprasHistoryModal";

vi.mock("@/react-app/hooks/useCompras", () => ({
  COMPRAS_CATEGORIAS: [
    { value: "carnes", label: "Carnes" },
    { value: "verduras", label: "Verduras" },
    { value: "bebidas", label: "Bebidas" },
    { value: "servicios", label: "Servicios" },
    { value: "otros", label: "Otros" },
  ],
  useCompras: vi.fn(),
}));
vi.mock("@/react-app/components/ui/toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("./CompraModal", () => ({ default: () => null }));

import { useCompras } from "@/react-app/hooks/useCompras";
const mockUseCompras = vi.mocked(useCompras);

const COMPRA = {
  id: 1,
  negocio_id: 1,
  user_id: "user-1",
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

const DEFAULT_PROPS = {
  isOpen: true,
  onClose: vi.fn(),
  compras: [],
  onChanged: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseCompras.mockReturnValue({ deleteCompra: vi.fn() } as any);
});

// ─── Visibilidad ──────────────────────────────────────────────────────────────

describe("ComprasHistoryModal — visibilidad", () => {
  it("no renderiza nada cuando isOpen es false", () => {
    const { container } = render(<ComprasHistoryModal {...DEFAULT_PROPS} isOpen={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("muestra 'No hay compras para mostrar' cuando la lista está vacía", () => {
    render(<ComprasHistoryModal {...DEFAULT_PROPS} />);
    expect(screen.getByText("No hay compras para mostrar")).toBeInTheDocument();
  });

  it("muestra el item cuando hay compras", () => {
    render(<ComprasHistoryModal {...DEFAULT_PROPS} compras={[COMPRA]} />);
    expect(screen.getAllByText("Pan").length).toBeGreaterThan(0);
  });
});

// ─── Filtros ──────────────────────────────────────────────────────────────────

describe("ComprasHistoryModal — filtros", () => {
  it("filtra por búsqueda: oculta items que no coinciden", () => {
    render(<ComprasHistoryModal {...DEFAULT_PROPS} compras={[COMPRA]} />);
    const searchInput = screen.getByPlaceholderText(/Buscar por item/i);
    fireEvent.change(searchInput, { target: { value: "xyz" } });
    expect(screen.getByText("No hay compras para mostrar")).toBeInTheDocument();
  });

  it("muestra el item cuando la búsqueda coincide", () => {
    render(<ComprasHistoryModal {...DEFAULT_PROPS} compras={[COMPRA]} />);
    const searchInput = screen.getByPlaceholderText(/Buscar por item/i);
    fireEvent.change(searchInput, { target: { value: "Pa" } });
    expect(screen.getAllByText("Pan").length).toBeGreaterThan(0);
  });
});
