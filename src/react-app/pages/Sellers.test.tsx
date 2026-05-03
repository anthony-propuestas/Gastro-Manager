import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import Sellers from "./Sellers";

vi.mock("@/react-app/hooks/useSellers");
import { useSellers } from "@/react-app/hooks/useSellers";

const mockUseSellers = vi.mocked(useSellers);

const VENDEDOR = { user_id: "u1", codigo: "ANA123XX", activo: 1, created_at: "2026-01-01" };
const STATS = { total_referidos: 3, confirmados: 2, comision_total: 15000, comision_pendiente: 7500 };

const REFERIDO_PENDIENTE = {
  id: 1,
  vendedor_id: "u1",
  referido_user_id: "u2",
  suscripcion_id: null,
  estado: "pendiente",
  comision_monto: null,
  reembolso_monto: null,
  comision_pagada: 0,
  reembolso_pagado: 0,
  created_at: "2026-01-15T00:00:00Z",
  confirmed_at: null,
  referido_name: "Juan Perez",
  referido_email: "juan@test.com",
  suscripcion_estado: null,
};

const REFERIDO_CONFIRMADO = {
  ...REFERIDO_PENDIENTE,
  id: 2,
  estado: "confirmado",
  comision_monto: 7500,
  reembolso_monto: 6000,
  comision_pagada: 0,
  reembolso_pagado: 0,
  referido_name: "Maria Garcia",
  referido_email: "maria@test.com",
  suscripcion_estado: "autorizada",
  confirmed_at: "2026-02-01T00:00:00Z",
};

const BASE_MOCK = {
  vendedor: null as typeof VENDEDOR | null,
  referidos: [] as typeof REFERIDO_PENDIENTE[],
  stats: null as typeof STATS | null,
  isLoading: false,
  error: null as string | null,
  activate: vi.fn(),
  refresh: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn(() => Promise.resolve()) },
    configurable: true,
    writable: true,
  });
});

// ─── Estado no activado ───────────────────────────────────────────────────────

describe("Sellers — estado no activado", () => {
  it("muestra spinner cuando isLoading es true", () => {
    mockUseSellers.mockReturnValue({ ...BASE_MOCK, isLoading: true });
    render(<Sellers />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("muestra 'Convertite en vendedor' cuando no hay vendedor", () => {
    mockUseSellers.mockReturnValue({ ...BASE_MOCK });
    render(<Sellers />);
    expect(screen.getByText("Convertite en vendedor")).toBeInTheDocument();
  });

  it("muestra comisión ARS 7.500", () => {
    mockUseSellers.mockReturnValue({ ...BASE_MOCK });
    render(<Sellers />);
    expect(screen.getByText("ARS 7.500")).toBeInTheDocument();
  });

  it("muestra reembolso ARS 6.000", () => {
    mockUseSellers.mockReturnValue({ ...BASE_MOCK });
    render(<Sellers />);
    expect(screen.getByText("ARS 6.000")).toBeInTheDocument();
  });

  it("clic en 'Activarme como vendedor' llama activate()", async () => {
    const activate = vi.fn(() => Promise.resolve(true));
    mockUseSellers.mockReturnValue({ ...BASE_MOCK, activate });
    render(<Sellers />);

    fireEvent.click(screen.getByText("Activarme como vendedor"));

    await waitFor(() => expect(activate).toHaveBeenCalledTimes(1));
  });

  it("muestra el mensaje de error cuando error tiene valor", () => {
    mockUseSellers.mockReturnValue({ ...BASE_MOCK, error: "Error de red al activar" });
    render(<Sellers />);
    expect(screen.getByText("Error de red al activar")).toBeInTheDocument();
  });

  it("no muestra el link de referido cuando no hay vendedor", () => {
    mockUseSellers.mockReturnValue({ ...BASE_MOCK });
    render(<Sellers />);
    expect(screen.queryByText(/suscripcion\?ref=/)).toBeNull();
  });
});

// ─── Estado activado ──────────────────────────────────────────────────────────

describe("Sellers — estado activado", () => {
  it("muestra el link de referido con el código", () => {
    mockUseSellers.mockReturnValue({ ...BASE_MOCK, vendedor: VENDEDOR });
    render(<Sellers />);
    expect(screen.getByText(/ref=ANA123XX/)).toBeInTheDocument();
  });

  it("muestra el código del vendedor", () => {
    mockUseSellers.mockReturnValue({ ...BASE_MOCK, vendedor: VENDEDOR });
    render(<Sellers />);
    expect(screen.getByText("ANA123XX")).toBeInTheDocument();
  });

  it("no muestra 'Convertite en vendedor' cuando hay vendedor", () => {
    mockUseSellers.mockReturnValue({ ...BASE_MOCK, vendedor: VENDEDOR });
    render(<Sellers />);
    expect(screen.queryByText("Convertite en vendedor")).toBeNull();
  });

  it("muestra las 4 tarjetas de stats cuando stats tiene valor", () => {
    mockUseSellers.mockReturnValue({ ...BASE_MOCK, vendedor: VENDEDOR, stats: STATS });
    render(<Sellers />);
    expect(screen.getByText("3")).toBeInTheDocument();  // total_referidos
    expect(screen.getByText("2")).toBeInTheDocument();  // confirmados
  });

  it("muestra la comisión total en stats", () => {
    mockUseSellers.mockReturnValue({ ...BASE_MOCK, vendedor: VENDEDOR, stats: STATS });
    render(<Sellers />);
    expect(screen.getByText(/15\.000/)).toBeInTheDocument();
  });

  it("muestra la comisión pendiente en stats", () => {
    mockUseSellers.mockReturnValue({ ...BASE_MOCK, vendedor: VENDEDOR, stats: STATS });
    render(<Sellers />);
    expect(screen.getByText(/7\.500/)).toBeInTheDocument();
  });

  it("muestra mensaje vacío cuando no hay referidos", () => {
    mockUseSellers.mockReturnValue({ ...BASE_MOCK, vendedor: VENDEDOR, referidos: [] });
    render(<Sellers />);
    expect(screen.getByText(/Aún no tenés referidos/)).toBeInTheDocument();
  });

  it("muestra nombre y email del referido en la tabla", () => {
    mockUseSellers.mockReturnValue({ ...BASE_MOCK, vendedor: VENDEDOR, referidos: [REFERIDO_PENDIENTE] });
    render(<Sellers />);
    expect(screen.getByText("Juan Perez")).toBeInTheDocument();
    expect(screen.getByText("juan@test.com")).toBeInTheDocument();
  });

  it("muestra badge 'pendiente' para referido pendiente", () => {
    mockUseSellers.mockReturnValue({ ...BASE_MOCK, vendedor: VENDEDOR, referidos: [REFERIDO_PENDIENTE] });
    render(<Sellers />);
    expect(screen.getByText("pendiente")).toBeInTheDocument();
  });

  it("muestra badge 'confirmado' para referido confirmado", () => {
    mockUseSellers.mockReturnValue({ ...BASE_MOCK, vendedor: VENDEDOR, referidos: [REFERIDO_CONFIRMADO] });
    render(<Sellers />);
    expect(screen.getByText("confirmado")).toBeInTheDocument();
  });

  it("muestra badge de suscripción 'autorizada' para referido con suscripción activa", () => {
    mockUseSellers.mockReturnValue({ ...BASE_MOCK, vendedor: VENDEDOR, referidos: [REFERIDO_CONFIRMADO] });
    render(<Sellers />);
    expect(screen.getByText("autorizada")).toBeInTheDocument();
  });

  it("muestra comisión sin tachado cuando no está pagada", () => {
    mockUseSellers.mockReturnValue({ ...BASE_MOCK, vendedor: VENDEDOR, referidos: [REFERIDO_CONFIRMADO] });
    render(<Sellers />);
    const span = screen.getByText(/ARS 7\.500/);
    expect(span).not.toHaveClass("line-through");
  });

  it("muestra comisión con tachado cuando comision_pagada=1", () => {
    const ref = { ...REFERIDO_CONFIRMADO, comision_pagada: 1 };
    mockUseSellers.mockReturnValue({ ...BASE_MOCK, vendedor: VENDEDOR, referidos: [ref] });
    render(<Sellers />);
    const span = screen.getByText(/ARS 7\.500/);
    expect(span).toHaveClass("line-through");
  });

  it("muestra '—' cuando el referido no tiene comisión asignada", () => {
    mockUseSellers.mockReturnValue({ ...BASE_MOCK, vendedor: VENDEDOR, referidos: [REFERIDO_PENDIENTE] });
    render(<Sellers />);
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Copiar link ──────────────────────────────────────────────────────────────

describe("Sellers — copiar link", () => {
  it("clic en Copiar llama clipboard.writeText con el link correcto", async () => {
    mockUseSellers.mockReturnValue({ ...BASE_MOCK, vendedor: VENDEDOR });
    render(<Sellers />);

    fireEvent.click(screen.getByText("Copiar"));

    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining("ANA123XX")
      )
    );
  });

  it("botón muestra 'Copiado' inmediatamente tras hacer clic", async () => {
    mockUseSellers.mockReturnValue({ ...BASE_MOCK, vendedor: VENDEDOR });
    render(<Sellers />);

    fireEvent.click(screen.getByText("Copiar"));

    await waitFor(() => expect(screen.getByText("Copiado")).toBeInTheDocument());
  });
});
