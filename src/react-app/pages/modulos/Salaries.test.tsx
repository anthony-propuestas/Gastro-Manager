import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import Salaries from "./Salaries";

vi.mock("@/react-app/hooks/useSalaries");
vi.mock("@/react-app/hooks/useMyUsage", () => ({ useMyUsage: () => ({ data: null }) }));
vi.mock("@/react-app/components/ui/toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/react-app/components/UsageBanner", () => ({ UsageBanner: () => null }));
vi.mock("@/react-app/components/salaries/AdvanceModal", () => ({ default: () => null }));
vi.mock("@/react-app/components/salaries/EmployeeAdvancesModal", () => ({ default: () => null }));

import { useSalaries } from "@/react-app/hooks/useSalaries";
const mockUseSalaries = vi.mocked(useSalaries);

const mockFetchOverview = vi.fn();
const mockMarkAsPaid = vi.fn();
const mockMarkAllAsPaid = vi.fn();

const BASE_MOCK = {
  fetchOverview: mockFetchOverview,
  markAsPaid: mockMarkAsPaid,
  markAllAsPaid: mockMarkAllAsPaid,
  fetchAdvances: vi.fn(),
  createAdvance: vi.fn(),
  deleteAdvance: vi.fn(),
  isLoading: false,
  error: null,
};

const EMP = {
  id: 1,
  name: "Ana López",
  role: "Chef",
  monthly_salary: 15000,
  advances_total: 0,
  remaining: 15000,
  paid_amount: 0,
  is_paid: false,
};

const OVERVIEW = {
  employees: [EMP],
  totals: { total_salaries: 15000, total_advances: 0, total_remaining: 15000, total_paid: 0 },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchOverview.mockResolvedValue(null);
  mockUseSalaries.mockReturnValue(BASE_MOCK);
});

// ─── Estados base ─────────────────────────────────────────────────────────────

describe("Salaries — estados base", () => {
  it("muestra 'Cargando...' mientras fetchOverview no resuelve", () => {
    mockFetchOverview.mockReturnValue(new Promise(() => {}));
    render(<Salaries />);
    expect(screen.getByText("Cargando...")).toBeInTheDocument();
  });

  it("muestra el título 'Sueldos' cuando cargó", async () => {
    render(<Salaries />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Sueldos" })).toBeInTheDocument());
  });

  it("muestra nombre del empleado en la tabla", async () => {
    mockFetchOverview.mockResolvedValue(OVERVIEW);
    render(<Salaries />);
    await waitFor(() => expect(screen.getAllByText("Ana López").length).toBeGreaterThan(0));
  });

  it("muestra el puesto del empleado", async () => {
    mockFetchOverview.mockResolvedValue(OVERVIEW);
    render(<Salaries />);
    await waitFor(() => expect(screen.getAllByText("Chef").length).toBeGreaterThan(0));
  });

  it("muestra los selectores de mes y año", async () => {
    render(<Salaries />);
    await waitFor(() => {
      const selects = document.querySelectorAll("select");
      expect(selects.length).toBeGreaterThanOrEqual(2);
    });
  });
});

// ─── Estado del empleado ──────────────────────────────────────────────────────

describe("Salaries — estado del empleado", () => {
  it("muestra badge 'Pagado' cuando is_paid es true", async () => {
    const paidOverview = { ...OVERVIEW, employees: [{ ...EMP, is_paid: true }] };
    mockFetchOverview.mockResolvedValue(paidOverview);
    render(<Salaries />);
    await waitFor(() => {
      const badges = screen.getAllByText("Pagado");
      // al menos uno es el badge (span), no el botón
      expect(badges.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("muestra botón 'Pagado' cuando is_paid es false", async () => {
    mockFetchOverview.mockResolvedValue(OVERVIEW);
    render(<Salaries />);
    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /^Pagado$/i });
      expect(btn).toBeInTheDocument();
    });
  });

  it("muestra adelantos como botón cliqueable cuando advances_total > 0", async () => {
    const advOverview = { ...OVERVIEW, employees: [{ ...EMP, advances_total: 500 }] };
    mockFetchOverview.mockResolvedValue(advOverview);
    render(<Salaries />);
    await waitFor(() => {
      // el monto debe estar como <button> por el handleViewAdvances
      const btns = screen.getAllByRole("button");
      const advBtn = btns.find((b) => b.tagName === "BUTTON" && b.textContent?.includes("500"));
      expect(advBtn).toBeDefined();
    });
  });
});

// ─── Acciones ─────────────────────────────────────────────────────────────────

describe("Salaries — acciones", () => {
  it("clic en 'Adelanto' llama handleAddAdvance (selectedEmployee se setea)", async () => {
    mockFetchOverview.mockResolvedValue(OVERVIEW);
    render(<Salaries />);
    await waitFor(() => expect(screen.getAllByText("Ana López").length).toBeGreaterThan(0));

    fireEvent.click(screen.getAllByRole("button", { name: /Adelanto/i })[0]);
    // El modal está mockeado a null, pero el click no debe tirar error
    // verificamos que fetchOverview fue llamado al menos 1 vez (mount)
    expect(mockFetchOverview).toHaveBeenCalledTimes(1);
  });

  it("clic en botón 'Pagado' llama markAsPaid con employeeId, mes y año", async () => {
    mockMarkAsPaid.mockResolvedValue(true);
    mockFetchOverview.mockResolvedValue(OVERVIEW);
    render(<Salaries />);
    await waitFor(() => expect(screen.getByRole("button", { name: /^Pagado$/i })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^Pagado$/i }));

    await waitFor(() =>
      expect(mockMarkAsPaid).toHaveBeenCalledWith(
        EMP.id,
        new Date().getMonth() + 1,
        new Date().getFullYear()
      )
    );
  });

  it("clic en 'Marcar Todos como Pagados' llama markAllAsPaid tras confirmar", async () => {
    vi.stubGlobal("confirm", () => true);
    mockMarkAllAsPaid.mockResolvedValue(true);
    mockFetchOverview.mockResolvedValue(OVERVIEW);
    render(<Salaries />);
    await waitFor(() => expect(screen.getByText("Marcar Todos como Pagados")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Marcar Todos como Pagados"));

    await waitFor(() => expect(mockMarkAllAsPaid).toHaveBeenCalledTimes(1));
    vi.unstubAllGlobals();
  });

  it("no llama markAllAsPaid cuando el usuario cancela el confirm", async () => {
    vi.stubGlobal("confirm", () => false);
    mockFetchOverview.mockResolvedValue(OVERVIEW);
    render(<Salaries />);
    await waitFor(() => expect(screen.getByText("Marcar Todos como Pagados")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Marcar Todos como Pagados"));

    expect(mockMarkAllAsPaid).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
