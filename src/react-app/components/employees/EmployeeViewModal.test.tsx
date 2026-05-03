import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import EmployeeViewModal from "./EmployeeViewModal";
import type { Employee } from "@/react-app/hooks/useEmployees";

const activeEmployee: Employee = {
  id: 1,
  negocio_id: 1,
  user_id: "user-1",
  name: "María García",
  role: "Mesero/a",
  phone: "+52 555 123 4567",
  email: "maria@ejemplo.com",
  hire_date: "2024-03-15",
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
  ...activeEmployee,
  id: 2,
  name: "Carlos Pérez",
  is_active: 0,
  ausencia_desde: "2026-04-01",
  informo: 1,
  cuando_informo: "2026-04-02",
  sueldo_pendiente: 2500,
};

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onEdit: vi.fn(),
  employee: activeEmployee,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EmployeeViewModal — visibilidad", () => {
  it("no renderiza cuando isOpen es false", () => {
    render(<EmployeeViewModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText("María García")).toBeNull();
  });

  it("no renderiza cuando employee es null", () => {
    render(<EmployeeViewModal {...defaultProps} employee={null} />);
    expect(screen.queryByText("María García")).toBeNull();
  });

  it("renderiza cuando isOpen es true y hay empleado", () => {
    render(<EmployeeViewModal {...defaultProps} />);
    expect(screen.getByText("María García")).toBeDefined();
  });
});

describe("EmployeeViewModal — datos del empleado activo", () => {
  it("muestra nombre y puesto", () => {
    render(<EmployeeViewModal {...defaultProps} />);
    expect(screen.getByText("María García")).toBeDefined();
    expect(screen.getAllByText("Mesero/a").length).toBeGreaterThan(0);
  });

  it("muestra las iniciales en el avatar", () => {
    render(<EmployeeViewModal {...defaultProps} />);
    expect(screen.getByText("MG")).toBeDefined();
  });

  it("muestra teléfono y email", () => {
    render(<EmployeeViewModal {...defaultProps} />);
    expect(screen.getByText("+52 555 123 4567")).toBeDefined();
    expect(screen.getByText("maria@ejemplo.com")).toBeDefined();
  });

  it("muestra el sueldo mensual formateado", () => {
    render(<EmployeeViewModal {...defaultProps} />);
    expect(screen.getByText(/8,000|8\.000/)).toBeDefined();
  });

  it("muestra badge Activo para empleado activo", () => {
    render(<EmployeeViewModal {...defaultProps} />);
    expect(screen.getByText("Activo")).toBeDefined();
  });

  it("no muestra la sección de baja para empleado activo", () => {
    render(<EmployeeViewModal {...defaultProps} />);
    expect(screen.queryByText(/información de baja/i)).toBeNull();
    expect(screen.queryByText(/sueldo pendiente/i)).toBeNull();
  });
});

describe("EmployeeViewModal — datos del empleado inactivo", () => {
  it("muestra badge Inactivo", () => {
    render(<EmployeeViewModal {...defaultProps} employee={inactiveEmployee} />);
    expect(screen.getByText("Inactivo")).toBeDefined();
  });

  it("muestra la sección de información de baja", () => {
    render(<EmployeeViewModal {...defaultProps} employee={inactiveEmployee} />);
    expect(screen.getByText(/información de baja/i)).toBeDefined();
  });

  it("muestra ausencia_desde", () => {
    render(<EmployeeViewModal {...defaultProps} employee={inactiveEmployee} />);
    expect(screen.getByText(/ausente desde/i)).toBeDefined();
  });

  it("muestra sueldo_pendiente formateado", () => {
    render(<EmployeeViewModal {...defaultProps} employee={inactiveEmployee} />);
    expect(screen.getByText(/sueldo pendiente/i)).toBeDefined();
    expect(screen.getByText(/2,500|2\.500/)).toBeDefined();
  });

  it("muestra si informó su salida", () => {
    render(<EmployeeViewModal {...defaultProps} employee={inactiveEmployee} />);
    expect(screen.getByText(/informó su salida/i)).toBeDefined();
  });

  it("no muestra sección de baja cuando todos los campos están vacíos", () => {
    const noExtraInfo: Employee = {
      ...activeEmployee,
      is_active: 0,
      ausencia_desde: null,
      informo: 0,
      sueldo_pendiente: 0,
    };
    render(<EmployeeViewModal {...defaultProps} employee={noExtraInfo} />);
    expect(screen.queryByText(/información de baja/i)).toBeNull();
  });
});

describe("EmployeeViewModal — acciones", () => {
  it("llama onEdit con el empleado al hacer clic en Editar", () => {
    render(<EmployeeViewModal {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /editar/i }));
    expect(defaultProps.onEdit).toHaveBeenCalledOnce();
    expect(defaultProps.onEdit).toHaveBeenCalledWith(activeEmployee);
  });

  it("llama onClose al hacer clic en Cerrar", () => {
    render(<EmployeeViewModal {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /cerrar/i }));
    expect(defaultProps.onClose).toHaveBeenCalledOnce();
  });

  it("llama onClose al hacer clic en el backdrop", () => {
    const { container } = render(<EmployeeViewModal {...defaultProps} />);
    const backdrop = container.querySelector(".absolute.inset-0.bg-black\\/50");
    expect(backdrop).toBeDefined();
    fireEvent.click(backdrop!);
    expect(defaultProps.onClose).toHaveBeenCalledOnce();
  });

  it("no llama onEdit al hacer clic en Cerrar", () => {
    render(<EmployeeViewModal {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /cerrar/i }));
    expect(defaultProps.onEdit).not.toHaveBeenCalled();
  });
});
