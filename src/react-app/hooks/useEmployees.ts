import { useState, useEffect, useCallback } from "react";

export interface Employee {
  id: number;
  user_id: string;
  name: string;
  role: string;
  phone: string | null;
  email: string | null;
  hire_date: string | null;
  is_active: number;
  monthly_salary?: number;
  topics_count?: number;
  created_at: string;
  updated_at: string;
}

export interface EmployeeInput {
  name: string;
  role: string;
  phone?: string;
  email?: string;
  hire_date?: string;
  is_active?: boolean;
  monthly_salary?: number;
}

export function useEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmployees = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/employees");
      const data = await response.json();
      
      if (data.success) {
        setEmployees(data.data || []);
      } else {
        setError(data.error?.message || "Error al cargar empleados");
      }
    } catch (err) {
      setError("Error de conexión");
      console.error("Error fetching employees:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const createEmployee = async (input: EmployeeInput): Promise<Employee | null> => {
    try {
      const response = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      
      if (data.success) {
        await fetchEmployees();
        return data.data;
      } else {
        throw new Error(data.error?.message || "Error al crear empleado");
      }
    } catch (err) {
      console.error("Error creating employee:", err);
      throw err;
    }
  };

  const updateEmployee = async (id: number, input: Partial<EmployeeInput>): Promise<Employee | null> => {
    try {
      const response = await fetch(`/api/employees/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      
      if (data.success) {
        await fetchEmployees();
        return data.data;
      } else {
        throw new Error(data.error?.message || "Error al actualizar empleado");
      }
    } catch (err) {
      console.error("Error updating employee:", err);
      throw err;
    }
  };

  const deleteEmployee = async (id: number): Promise<boolean> => {
    try {
      const response = await fetch(`/api/employees/${id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      
      if (data.success) {
        await fetchEmployees();
        return true;
      } else {
        throw new Error(data.error?.message || "Error al eliminar empleado");
      }
    } catch (err) {
      console.error("Error deleting employee:", err);
      throw err;
    }
  };

  return {
    employees,
    isLoading,
    error,
    refetch: fetchEmployees,
    createEmployee,
    updateEmployee,
    deleteEmployee,
  };
}
