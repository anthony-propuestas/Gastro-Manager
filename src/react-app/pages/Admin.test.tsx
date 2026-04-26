import { render, screen, fireEvent } from "@testing-library/react";
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
  limits: {},
  fetchUsage: vi.fn(),
  fetchLimits: vi.fn(),
  updateLimits: vi.fn(),
  users: [],
  fetchUsers: vi.fn(),
  promoteUser: vi.fn(),
  demoteUser: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

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

    // ir a página 2
    fireEvent.click(screen.getByText("Siguiente"));
    expect(screen.getByText("user50@test.com")).toBeInTheDocument();

    // filtrar → resetea a página 1
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

    // filtrar con término que sigue coincidiendo con todas las filas → aparece Limpiar
    const searchInput = screen.getByPlaceholderText("Buscar email...");
    fireEvent.change(searchInput, { target: { value: "user" } });

    // ir a página 2
    fireEvent.click(screen.getByText("Siguiente"));
    expect(screen.getByText("user50@test.com")).toBeInTheDocument();

    // limpiar → resetea a página 1
    fireEvent.click(screen.getByText("Limpiar"));

    expect(screen.getByText("user0@test.com")).toBeInTheDocument();
    expect(screen.queryByText("user50@test.com")).toBeNull();
  });
});
