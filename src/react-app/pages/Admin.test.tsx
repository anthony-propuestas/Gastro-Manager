import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import Admin from "./Admin";

vi.mock("@/react-app/hooks/useAdmin");
vi.mock("@/react-app/components/ui/toast", () => ({
  useToast: () => ({ showToast: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

import { useAdmin } from "@/react-app/hooks/useAdmin";

const mockUseAdmin = vi.mocked(useAdmin);

function makeRows(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    user_id: `user-${i}`,
    email: `user${i}@test.com`,
    role: "usuario_basico",
    negocio_id: 1,
    negocio_name: "Test Negocio",
    usage: {},
  }));
}

const BASE_MOCK = {
  isAdmin: true,
  loading: false,
  stats: null,
  emails: [],
  fetchStats: vi.fn(),
  fetchEmails: vi.fn(),
  addEmail: vi.fn(),
  deleteEmail: vi.fn(),
  usageData: null as { period: string; rows: ReturnType<typeof makeRows> } | null,
  limits: {} as Record<string, number>,
  fetchUsage: vi.fn(),
  fetchLimits: vi.fn(),
  updateLimits: vi.fn(),
  users: [] as { id: string; email: string; name: string; role: string; created_at: string }[],
  fetchUsers: vi.fn(),
  promoteUser: vi.fn(),
  demoteUser: vi.fn(),
  suscripciones: [],
  fetchSuscripciones: vi.fn(),
  fetchPagosUsuario: vi.fn(() => Promise.resolve([])),
  sellers: [],
  fetchSellers: vi.fn(),
  referidos: [],
  fetchReferidos: vi.fn(),
  markComisionPagada: vi.fn(() => Promise.resolve(true)),
  markReembolsoPagado: vi.fn(() => Promise.resolve(true)),
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Paginación de uso por usuario ────────────────────────────────────────────

describe("Paginación de uso por usuario", () => {
  it("no muestra controles de paginación con 50 filas o menos", () => {
    mockUseAdmin.mockReturnValue({
      ...BASE_MOCK,
      usageData: { period: "2026-04", rows: makeRows(50) },
    });

    render(<Admin />);

    expect(screen.queryByText("Siguiente")).toBeNull();
    expect(screen.queryByText("Anterior")).toBeNull();
  });

  it("muestra controles de paginación con más de 50 filas", () => {
    mockUseAdmin.mockReturnValue({
      ...BASE_MOCK,
      usageData: { period: "2026-04", rows: makeRows(55) },
    });

    render(<Admin />);

    expect(screen.getByText("Siguiente")).toBeInTheDocument();
    expect(screen.getByText("Anterior")).toBeInTheDocument();
  });

  it("el botón Anterior está deshabilitado en la primera página", () => {
    mockUseAdmin.mockReturnValue({
      ...BASE_MOCK,
      usageData: { period: "2026-04", rows: makeRows(55) },
    });

    render(<Admin />);

    expect(screen.getByText("Anterior")).toBeDisabled();
    expect(screen.getByText("Siguiente")).not.toBeDisabled();
  });

  it("el botón Siguiente está deshabilitado en la última página", () => {
    mockUseAdmin.mockReturnValue({
      ...BASE_MOCK,
      usageData: { period: "2026-04", rows: makeRows(55) },
    });

    render(<Admin />);

    fireEvent.click(screen.getByText("Siguiente"));

    expect(screen.getByText("Siguiente")).toBeDisabled();
    expect(screen.getByText("Anterior")).not.toBeDisabled();
  });

  it("muestra solo las primeras 50 filas en la página 1", () => {
    mockUseAdmin.mockReturnValue({
      ...BASE_MOCK,
      usageData: { period: "2026-04", rows: makeRows(55) },
    });

    render(<Admin />);

    expect(screen.getByText("user0@test.com")).toBeInTheDocument();
    expect(screen.getByText("user49@test.com")).toBeInTheDocument();
    expect(screen.queryByText("user50@test.com")).toBeNull();
  });

  it("muestra las filas de la segunda página al hacer clic en Siguiente", () => {
    mockUseAdmin.mockReturnValue({
      ...BASE_MOCK,
      usageData: { period: "2026-04", rows: makeRows(55) },
    });

    render(<Admin />);
    fireEvent.click(screen.getByText("Siguiente"));

    expect(screen.getByText("user50@test.com")).toBeInTheDocument();
    expect(screen.queryByText("user0@test.com")).toBeNull();
  });

  it("vuelve a la primera página al hacer clic en Anterior", () => {
    mockUseAdmin.mockReturnValue({
      ...BASE_MOCK,
      usageData: { period: "2026-04", rows: makeRows(55) },
    });

    render(<Admin />);
    fireEvent.click(screen.getByText("Siguiente"));
    fireEvent.click(screen.getByText("Anterior"));

    expect(screen.getByText("user0@test.com")).toBeInTheDocument();
    expect(screen.queryByText("user50@test.com")).toBeNull();
  });

  it("muestra la página correcta en el indicador", () => {
    mockUseAdmin.mockReturnValue({
      ...BASE_MOCK,
      usageData: { period: "2026-04", rows: makeRows(55) },
    });

    render(<Admin />);

    expect(screen.getByText(/Página 1 de 2/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("Siguiente"));

    expect(screen.getByText(/Página 2 de 2/)).toBeInTheDocument();
  });

  it("resetea a la página 1 al filtrar por email", () => {
    mockUseAdmin.mockReturnValue({
      ...BASE_MOCK,
      usageData: { period: "2026-04", rows: makeRows(55) },
    });

    render(<Admin />);

    fireEvent.click(screen.getByText("Siguiente"));
    expect(screen.getByText("user50@test.com")).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText("Buscar email...");
    fireEvent.change(searchInput, { target: { value: "user0" } });

    expect(screen.getByText("user0@test.com")).toBeInTheDocument();
    expect(screen.queryByText("user50@test.com")).toBeNull();
  });

  it("resetea a la página 1 al limpiar filtros", () => {
    mockUseAdmin.mockReturnValue({
      ...BASE_MOCK,
      usageData: { period: "2026-04", rows: makeRows(55) },
    });

    render(<Admin />);

    const searchInput = screen.getByPlaceholderText("Buscar email...");
    fireEvent.change(searchInput, { target: { value: "user" } });

    fireEvent.click(screen.getByText("Siguiente"));
    expect(screen.getByText("user50@test.com")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Limpiar"));

    expect(screen.getByText("user0@test.com")).toBeInTheDocument();
    expect(screen.queryByText("user50@test.com")).toBeNull();
  });
});

// ─── Uso del Sistema ──────────────────────────────────────────────────────────

describe("Uso del Sistema", () => {
  it("muestra spinner mientras fetchUsage está pendiente", async () => {
    mockUseAdmin.mockReturnValue({
      ...BASE_MOCK,
      fetchUsage: vi.fn(() => new Promise<void>(() => {})),
    });

    render(<Admin />);

    expect(await screen.findByText("Cargando datos de uso...")).toBeInTheDocument();
  });

  it("muestra mensaje de error cuando fetchUsage falla", async () => {
    mockUseAdmin.mockReturnValue({
      ...BASE_MOCK,
      fetchUsage: vi.fn(() => Promise.reject(new Error("network error"))),
    });

    render(<Admin />);

    expect(await screen.findByText("No se pudo cargar el uso del sistema.")).toBeInTheDocument();
  });

  it("muestra el botón Reintentar en estado de error", async () => {
    mockUseAdmin.mockReturnValue({
      ...BASE_MOCK,
      fetchUsage: vi.fn(() => Promise.reject(new Error("fail"))),
    });

    render(<Admin />);

    await screen.findByText("No se pudo cargar el uso del sistema.");
    expect(screen.getByText("Reintentar")).toBeInTheDocument();
  });

  it("el botón Reintentar vuelve a llamar a fetchUsage y fetchLimits", async () => {
    const fetchUsageMock = vi.fn(() => Promise.reject(new Error("fail")));
    const fetchLimitsMock = vi.fn();

    mockUseAdmin.mockReturnValue({
      ...BASE_MOCK,
      fetchUsage: fetchUsageMock,
      fetchLimits: fetchLimitsMock,
    });

    render(<Admin />);
    await screen.findByText("Reintentar");

    await act(async () => {
      fireEvent.click(screen.getByText("Reintentar"));
    });

    await waitFor(() => {
      expect(fetchUsageMock).toHaveBeenCalledTimes(2);
      expect(fetchLimitsMock).toHaveBeenCalledTimes(2);
    });
  });

  it("muestra mensaje cuando usageData es null tras la carga", async () => {
    mockUseAdmin.mockReturnValue({
      ...BASE_MOCK,
      usageData: null,
    });

    render(<Admin />);

    expect(await screen.findByText("Sin datos para este período.")).toBeInTheDocument();
  });

  it("muestra el período en la descripción de la tarjeta", async () => {
    mockUseAdmin.mockReturnValue({
      ...BASE_MOCK,
      usageData: { period: "2026-04", rows: [] },
    });

    render(<Admin />);

    expect(await screen.findByText(/2026-04/)).toBeInTheDocument();
  });

  it("muestra el número de usuarios básicos en la descripción", async () => {
    mockUseAdmin.mockReturnValue({
      ...BASE_MOCK,
      usageData: { period: "2026-04", rows: [] },
      users: [
        { id: "1", email: "a@t.com", name: "A", role: "usuario_basico", created_at: "" },
        { id: "2", email: "b@t.com", name: "B", role: "usuario_basico", created_at: "" },
      ],
    });

    render(<Admin />);

    expect(await screen.findByText(/2 usuarios básicos/)).toBeInTheDocument();
  });

  it("calcula usado y límite total correctamente para un usuario básico", async () => {
    mockUseAdmin.mockReturnValue({
      ...BASE_MOCK,
      usageData: {
        period: "2026-04",
        rows: [
          { user_id: "u1", email: "a@t.com", role: "usuario_basico", negocio_id: 1, negocio_name: "N", usage: { chat: 30 } },
        ],
      },
      limits: { chat: 100 },
      users: [{ id: "u1", email: "a@t.com", name: "A", role: "usuario_basico", created_at: "" }],
    });

    render(<Admin />);

    // basicUserCount=1, totalLimit=100, used=30, pct=30%
    expect(await screen.findByText("30")).toBeInTheDocument();
    expect(screen.getByText(/\/ 100/)).toBeInTheDocument();
    expect(screen.getByText("30%")).toBeInTheDocument();
  });

  it("el límite total se multiplica por el número de usuarios básicos", async () => {
    mockUseAdmin.mockReturnValue({
      ...BASE_MOCK,
      usageData: {
        period: "2026-04",
        rows: [
          { user_id: "u1", email: "a@t.com", role: "usuario_basico", negocio_id: 1, negocio_name: "N1", usage: { chat: 40 } },
          { user_id: "u2", email: "b@t.com", role: "usuario_basico", negocio_id: 2, negocio_name: "N2", usage: { chat: 20 } },
        ],
      },
      limits: { chat: 100 },
      users: [
        { id: "u1", email: "a@t.com", name: "A", role: "usuario_basico", created_at: "" },
        { id: "u2", email: "b@t.com", name: "B", role: "usuario_basico", created_at: "" },
      ],
    });

    render(<Admin />);

    // basicUserCount=2, totalLimit=200, used=60, pct=30%
    expect(await screen.findByText("60")).toBeInTheDocument();
    expect(screen.getByText(/\/ 200/)).toBeInTheDocument();
    expect(screen.getByText("30%")).toBeInTheDocument();
  });

  it("muestra el límite por usuario en el subtexto de cada herramienta", async () => {
    mockUseAdmin.mockReturnValue({
      ...BASE_MOCK,
      usageData: { period: "2026-04", rows: [] },
      limits: { employees: 75 },
    });

    render(<Admin />);

    expect(await screen.findByText("Límite: 75/usuario")).toBeInTheDocument();
  });

  it("muestra 0% cuando no hay límite configurado para una herramienta", async () => {
    mockUseAdmin.mockReturnValue({
      ...BASE_MOCK,
      usageData: {
        period: "2026-04",
        rows: [
          { user_id: "u1", email: "a@t.com", role: "usuario_basico", negocio_id: 1, negocio_name: "N", usage: { chat: 50 } },
        ],
      },
      limits: {},
    });

    render(<Admin />);

    // Con limits vacío, totalLimit=0 → pct=0 para todos
    const percentages = await screen.findAllByText("0%");
    expect(percentages.length).toBe(10);
  });

  it("no cuenta usuarios inteligentes en el denominador del límite", async () => {
    mockUseAdmin.mockReturnValue({
      ...BASE_MOCK,
      usageData: {
        period: "2026-04",
        rows: [
          { user_id: "u1", email: "a@t.com", role: "usuario_basico",     negocio_id: 1, negocio_name: "N", usage: { chat: 50 } },
          { user_id: "u2", email: "b@t.com", role: "usuario_inteligente", negocio_id: 1, negocio_name: "N", usage: { chat: 100 } },
        ],
      },
      limits: { chat: 100 },
      users: [
        { id: "u1", email: "a@t.com", name: "A", role: "usuario_basico", created_at: "" },
        { id: "u2", email: "b@t.com", name: "B", role: "usuario_inteligente", created_at: "" },
      ],
    });

    render(<Admin />);

    // basicUserCount=1 (solo básicos), totalLimit=100, used=150, pct=150
    // La barra se clampea a 100% pero el texto muestra 150%
    expect(await screen.findByText("150")).toBeInTheDocument();
    expect(screen.getByText(/\/ 100/)).toBeInTheDocument();
    expect(screen.getByText("150%")).toBeInTheDocument();
  });
});

// ─── Tarjeta de Usuarios Registrados ─────────────────────────────────────────

describe("Tarjeta de Usuarios Registrados", () => {
  it("muestra 0 cuando stats es null", () => {
    mockUseAdmin.mockReturnValue({ ...BASE_MOCK, stats: null });
    render(<Admin />);
    expect(screen.getByText("Usuarios Registrados")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("muestra el totalUsers que devuelve stats", () => {
    mockUseAdmin.mockReturnValue({
      ...BASE_MOCK,
      stats: { totalUsers: 42, usage: { employees: 0, salaries: 0, calendar: 0, job_roles: 0, topics: 0, notes: 0, chat: 0, compras: 0, facturacion: 0 } },
    });
    render(<Admin />);
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("no muestra las tarjetas antiguas eliminadas", () => {
    mockUseAdmin.mockReturnValue({ ...BASE_MOCK, stats: null });
    render(<Admin />);
    expect(screen.queryByText("Correos Registrados")).toBeNull();
    expect(screen.queryByText("Promedio Empleados")).toBeNull();
    expect(screen.queryByText("Promedio Eventos")).toBeNull();
  });
});

// ─── Programa de Referidos ────────────────────────────────────────────────────

const REFERIDO_BASE = {
  id: 1,
  vendedor_id: "v1",
  vendedor_name: "Ana Seller",
  vendedor_email: "ana@test.com",
  referido_user_id: "r1",
  referido_name: "Bob Buyer",
  referido_email: "bob@test.com",
  suscripcion_id: null as number | null,
  suscripcion_estado: null as string | null,
  estado: "pendiente",
  comision_monto: null as number | null,
  reembolso_monto: null as number | null,
  comision_pagada: 0,
  reembolso_pagado: 0,
  created_at: "2026-01-01T00:00:00Z",
  confirmed_at: null as string | null,
};

const REFERIDO_CONFIRMADO = {
  ...REFERIDO_BASE,
  id: 2,
  estado: "confirmado",
  suscripcion_id: 10,
  suscripcion_estado: "autorizada",
  comision_monto: 7500,
  reembolso_monto: 6000,
  confirmed_at: "2026-02-01T00:00:00Z",
};

const SELLER_BASE = {
  user_id: "v1",
  codigo: "ANA123XX",
  activo: 1,
  created_at: "2026-01-01",
  name: "Ana Vendedora",
  email: "ana@test.com",
  total_referidos: 5,
  confirmados: 3,
  comision_total: 22500,
  comision_pendiente: 7500,
};

describe("Admin — Programa de Referidos", () => {
  it("muestra el título 'Programa de Referidos'", () => {
    mockUseAdmin.mockReturnValue({ ...BASE_MOCK });
    render(<Admin />);
    expect(screen.getByText("Programa de Referidos")).toBeInTheDocument();
  });

  it("muestra los tabs 'Referidos' y 'Vendedores'", () => {
    mockUseAdmin.mockReturnValue({ ...BASE_MOCK });
    render(<Admin />);
    expect(screen.getByText("Referidos")).toBeInTheDocument();
    expect(screen.getByText("Vendedores")).toBeInTheDocument();
  });

  it("muestra mensaje vacío cuando no hay referidos en el tab por defecto", () => {
    mockUseAdmin.mockReturnValue({ ...BASE_MOCK, referidos: [] });
    render(<Admin />);
    expect(screen.getByText("No hay referidos registrados.")).toBeInTheDocument();
  });

  it("muestra el email del vendedor y del referido en las tarjetas", () => {
    mockUseAdmin.mockReturnValue({ ...BASE_MOCK, referidos: [REFERIDO_BASE] });
    render(<Admin />);
    expect(screen.getByText("ana@test.com")).toBeInTheDocument();
    expect(screen.getByText("bob@test.com")).toBeInTheDocument();
  });

  it("muestra badge 'pendiente' para referido pendiente", () => {
    mockUseAdmin.mockReturnValue({ ...BASE_MOCK, referidos: [REFERIDO_BASE] });
    render(<Admin />);
    expect(screen.getByText("pendiente")).toBeInTheDocument();
  });

  it("no muestra botones de comisión/reembolso para referido pendiente", () => {
    mockUseAdmin.mockReturnValue({ ...BASE_MOCK, referidos: [REFERIDO_BASE] });
    render(<Admin />);
    expect(screen.queryByText("Marcar pagada")).toBeNull();
    expect(screen.queryByText("Marcar procesado")).toBeNull();
  });

  it("muestra 'Marcar pagada' y 'Marcar procesado' para referido confirmado sin pagar", () => {
    mockUseAdmin.mockReturnValue({ ...BASE_MOCK, referidos: [REFERIDO_CONFIRMADO] });
    render(<Admin />);
    expect(screen.getByText("Marcar pagada")).toBeInTheDocument();
    expect(screen.getByText("Marcar procesado")).toBeInTheDocument();
  });

  it("clic en 'Marcar pagada' llama markComisionPagada con el id correcto", async () => {
    const markComisionPagada = vi.fn(() => Promise.resolve(true));
    mockUseAdmin.mockReturnValue({
      ...BASE_MOCK,
      markComisionPagada,
      referidos: [{ ...REFERIDO_CONFIRMADO, id: 42 }],
    });
    render(<Admin />);

    await act(async () => {
      fireEvent.click(screen.getByText("Marcar pagada"));
    });

    expect(markComisionPagada).toHaveBeenCalledWith(42);
  });

  it("clic en 'Marcar procesado' llama markReembolsoPagado con el id correcto", async () => {
    const markReembolsoPagado = vi.fn(() => Promise.resolve(true));
    mockUseAdmin.mockReturnValue({
      ...BASE_MOCK,
      markReembolsoPagado,
      referidos: [{ ...REFERIDO_CONFIRMADO, id: 99 }],
    });
    render(<Admin />);

    await act(async () => {
      fireEvent.click(screen.getByText("Marcar procesado"));
    });

    expect(markReembolsoPagado).toHaveBeenCalledWith(99);
  });

  it("muestra badge 'Pagada' y oculta botón cuando comision_pagada=1", () => {
    mockUseAdmin.mockReturnValue({
      ...BASE_MOCK,
      referidos: [{ ...REFERIDO_CONFIRMADO, comision_pagada: 1 }],
    });
    render(<Admin />);
    expect(screen.getByText("Pagada")).toBeInTheDocument();
    expect(screen.queryByText("Marcar pagada")).toBeNull();
  });

  it("muestra badge 'Procesado' y oculta botón cuando reembolso_pagado=1", () => {
    mockUseAdmin.mockReturnValue({
      ...BASE_MOCK,
      referidos: [{ ...REFERIDO_CONFIRMADO, reembolso_pagado: 1 }],
    });
    render(<Admin />);
    expect(screen.getByText("Procesado")).toBeInTheDocument();
    expect(screen.queryByText("Marcar procesado")).toBeNull();
  });

  it("cambiar al tab 'Vendedores' muestra mensaje vacío si no hay sellers", () => {
    mockUseAdmin.mockReturnValue({ ...BASE_MOCK, sellers: [] });
    render(<Admin />);
    fireEvent.click(screen.getByText("Vendedores"));
    expect(screen.getByText("No hay vendedores activos.")).toBeInTheDocument();
  });

  it("cambiar al tab 'Vendedores' muestra nombre, código y stats del seller", () => {
    mockUseAdmin.mockReturnValue({ ...BASE_MOCK, sellers: [SELLER_BASE] });
    render(<Admin />);
    fireEvent.click(screen.getByText("Vendedores"));
    expect(screen.getByText("Ana Vendedora")).toBeInTheDocument();
    expect(screen.getByText("ANA123XX")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("llama fetchSellers y fetchReferidos cuando isAdmin es true", () => {
    const fetchSellers = vi.fn();
    const fetchReferidos = vi.fn();
    mockUseAdmin.mockReturnValue({ ...BASE_MOCK, fetchSellers, fetchReferidos });
    render(<Admin />);
    expect(fetchSellers).toHaveBeenCalledTimes(1);
    expect(fetchReferidos).toHaveBeenCalledTimes(1);
  });
});
