import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import EmployeeModal from "./EmployeeModal";
import type { Employee } from "@/react-app/hooks/useEmployees";

vi.mock("@/react-app/hooks/useJobRoles", () => ({
  useJobRoles: () => ({ jobRoles: [] }),
}));

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSave: vi.fn().mockResolvedValue(undefined),
};

const inactiveEmployee: Employee = {
  id: 1,
  negocio_id: 1,
  user_id: "user-1",
  name: "Carlos Pérez",
  role: "Mesero/a",
  phone: null,
  email: null,
  hire_date: null,
  is_active: 0,
  monthly_salary: 5000,
  ausencia_desde: "2026-04-01",
  informo: 1,
  cuando_informo: "2026-04-02",
  sueldo_pendiente: 2500,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2026-04-01T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EmployeeModal — exit info fields", () => {
  it("does not show exit fields when employee is active (default)", () => {
    render(<EmployeeModal {...defaultProps} />);

    expect(screen.queryByLabelText(/desde cuándo no se presenta/i)).toBeNull();
    expect(screen.queryByLabelText(/informó su salida/i)).toBeNull();
    expect(screen.queryByLabelText(/cuándo informó/i)).toBeNull();
    expect(screen.queryByLabelText(/cuánto falta de su sueldo/i)).toBeNull();
  });

  it("shows exit fields when is_active checkbox is unchecked", () => {
    render(<EmployeeModal {...defaultProps} />);

    fireEvent.click(screen.getByLabelText(/empleado activo/i));

    expect(screen.getByLabelText(/desde cuándo no se presenta/i)).toBeDefined();
    expect(screen.getByLabelText(/informó su salida/i)).toBeDefined();
    expect(screen.getByLabelText(/cuánto falta de su sueldo/i)).toBeDefined();
  });

  it("hides cuando_informo when informo is unchecked", () => {
    render(<EmployeeModal {...defaultProps} />);

    fireEvent.click(screen.getByLabelText(/empleado activo/i));

    expect(screen.queryByLabelText(/cuándo informó/i)).toBeNull();
  });

  it("shows cuando_informo when informo is checked", () => {
    render(<EmployeeModal {...defaultProps} />);

    fireEvent.click(screen.getByLabelText(/empleado activo/i));
    fireEvent.click(screen.getByLabelText(/informó su salida/i));

    expect(screen.getByLabelText(/cuándo informó/i)).toBeDefined();
  });

  it("hides exit fields again when is_active is re-checked", () => {
    render(<EmployeeModal {...defaultProps} />);

    const activeCheckbox = screen.getByLabelText(/empleado activo/i);
    fireEvent.click(activeCheckbox);
    fireEvent.click(activeCheckbox);

    expect(screen.queryByLabelText(/desde cuándo no se presenta/i)).toBeNull();
  });

  it("pre-fills exit fields when editing an inactive employee", () => {
    render(<EmployeeModal {...defaultProps} employee={inactiveEmployee} />);

    expect((screen.getByLabelText(/desde cuándo no se presenta/i) as HTMLInputElement).value).toBe("2026-04-01");
    expect((screen.getByLabelText(/informó su salida/i) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText(/cuándo informó/i) as HTMLInputElement).value).toBe("2026-04-02");
    expect((screen.getByLabelText(/cuánto falta de su sueldo/i) as HTMLInputElement).value).toBe("2500");
  });

  it("clears cuando_informo when informo is unchecked after being checked", () => {
    render(<EmployeeModal {...defaultProps} employee={inactiveEmployee} />);

    const informoCheckbox = screen.getByLabelText(/informó su salida/i) as HTMLInputElement;
    fireEvent.click(informoCheckbox);

    expect(screen.queryByLabelText(/cuándo informó/i)).toBeNull();
  });
});
