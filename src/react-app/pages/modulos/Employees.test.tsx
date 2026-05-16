import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import Employees from "./Employees";
import type { Employee } from "@/react-app/hooks/useEmployees";

// ── Fixtures ────────────────────────────────────────────────────────────────

const activeEmployee: Employee = {
  id: 1,
  negocio_id: 1,
  user_id: "u1",
  name: "María García",
  role: "Mesero/a",
  phone: null,
  email: null,
  hire_date: "2024-01-01",
  is_active: 1,
  monthly_salary: 8000,
  topics_count: 0,
  ausencia_desde: null,
  informo: 0,
  cuando_informo: null,
  sueldo_pendiente: 0,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

const inactiveEmployee: Employee = {
  id: 2,
  negocio_id: 1,
  user_id: "u1",
  name: "Carlos Pérez",
  role: "Cocinero",
  phone: null,
  email: null,
  hire_date: "2023-06-01",
  is_active: 0,
  monthly_salary: 6000,
  topics_count: 0,
  ausencia_desde: "2026-04-01",
  informo: 0,
  cuando_informo: null,
  sueldo_pendiente: 1500,
  created_at: "2023-01-01T00:00:00Z",
  updated_at: "2026-04-01T00:00:00Z",
};

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockUpdateEmployee = vi.fn().mockResolvedValue(activeEmployee);

vi.mock("@/react-app/hooks/useEmployees", () => ({
  useEmployees: () => ({
    employees: [activeEmployee, inactiveEmployee],
    isLoading: false,
    error: null,
    createEmployee: vi.fn(),
    updateEmployee: mockUpdateEmployee,
    deleteEmployee: vi.fn(),
  }),
}));

vi.mock("@/react-app/hooks/useMyUsage", () => ({
  useMyUsage: () => ({ data: null }),
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock("@/react-app/components/ui/toast", () => ({
  useToast: () => ({ success: mockToastSuccess, error: mockToastError }),
}));

vi.mock("@/react-app/components/UsageBanner", () => ({
  UsageBanner: () => null,
}));

vi.mock("@/react-app/components/employees/EmployeeModal", () => ({
  default: ({ isOpen, employee }: { isOpen: boolean; employee?: Employee | null }) =>
    isOpen ? (
      <div data-testid="edit-modal">
        {employee && <span data-testid="edit-modal-name">{employee.name}</span>}
      </div>
    ) : null,
}));

vi.mock("@/react-app/components/employees/JobRolesModal", () => ({
  default: () => null,
}));

vi.mock("@/react-app/components/employees/EmployeeDetailModal", () => ({
  default: () => null,
}));

// EmployeeViewModal stub visible para poder verificar que se abre
vi.mock("@/react-app/components/employees/EmployeeViewModal", () => ({
  default: ({ isOpen, employee, onClose, onEdit }: {
    isOpen: boolean;
    employee: Employee | null;
    onClose: () => void;
    onEdit: (e: Employee) => void;
  }) =>
    isOpen && employee ? (
      <div data-testid="view-modal">
        <span data-testid="view-modal-name">{employee.name}</span>
        <button onClick={onClose}>Cerrar vista</button>
        <button onClick={() => onEdit(employee)}>Editar desde vista</button>
      </div>
    ) : null,
}));

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests: clic en tarjeta → modal de vista ──────────────────────────────────

describe("Employees — clic en tarjeta abre vista", () => {
  it("el modal de vista no está visible al inicio", () => {
    render(<Employees />);
    expect(screen.queryByTestId("view-modal")).toBeNull();
  });

  it("hacer clic en la tarjeta abre el modal de vista con ese empleado", () => {
    render(<Employees />);
    fireEvent.click(screen.getByText("María García"));
    expect(screen.getByTestId("view-modal")).toBeDefined();
    expect(screen.getByTestId("view-modal-name").textContent).toBe("María García");
  });

  it("el modal de vista muestra al empleado correcto al hacer clic en distintas tarjetas", () => {
    render(<Employees />);

    fireEvent.click(screen.getByText("Carlos Pérez"));
    expect(screen.getByTestId("view-modal-name").textContent).toBe("Carlos Pérez");
  });

  it("cerrar el modal de vista lo oculta", () => {
    render(<Employees />);
    fireEvent.click(screen.getByText("María García"));
    fireEvent.click(screen.getByRole("button", { name: /cerrar vista/i }));
    expect(screen.queryByTestId("view-modal")).toBeNull();
  });
});

// ── Tests: botones de estado en tarjeta ──────────────────────────────────────

describe("Employees — control segmentado de estado en tarjetas", () => {
  it("cada tarjeta tiene los botones Empleado activo y Empleado inactivo", () => {
    render(<Employees />);
    const activeButtons = screen.getAllByRole("button", { name: /empleado activo/i });
    const inactiveButtons = screen.getAllByRole("button", { name: /empleado inactivo/i });
    expect(activeButtons.length).toBe(2);
    expect(inactiveButtons.length).toBe(2);
  });

  it("clic en 'Empleado inactivo' abre el modal de edición pre-configurado como inactivo", () => {
    render(<Employees />);
    const inactiveButtons = screen.getAllByRole("button", { name: /empleado inactivo/i });
    fireEvent.click(inactiveButtons[0]); // tarjeta de María García (activa)

    expect(screen.getByTestId("edit-modal")).toBeDefined();
    expect(screen.getByTestId("edit-modal-name").textContent).toBe("María García");
  });

  it("clic en 'Empleado activo' en tarjeta inactiva llama updateEmployee con is_active: true", async () => {
    render(<Employees />);

    // Toma el segundo par (tarjeta de Carlos Pérez, inactivo)
    const activeButtons = screen.getAllByRole("button", { name: /empleado activo/i });
    fireEvent.click(activeButtons[1]);

    await waitFor(() => {
      expect(mockUpdateEmployee).toHaveBeenCalledWith(
        inactiveEmployee.id,
        expect.objectContaining({ is_active: true })
      );
    });
  });

  it("clic en botón de estado NO abre el modal de vista", () => {
    render(<Employees />);
    const inactiveButtons = screen.getAllByRole("button", { name: /empleado inactivo/i });
    fireEvent.click(inactiveButtons[0]);
    expect(screen.queryByTestId("view-modal")).toBeNull();
  });

  it("muestra toast de éxito al cambiar estado a activo", async () => {
    render(<Employees />);
    const activeButtons = screen.getAllByRole("button", { name: /empleado activo/i });
    fireEvent.click(activeButtons[1]);

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Empleado marcado como activo");
    });
  });

});
