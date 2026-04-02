import { useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

export interface Advance {
  id: number;
  negocio_id: number;
  user_id: string;
  employee_id: number;
  amount: number;
  period_month: number;
  period_year: number;
  advance_date: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdvanceInput {
  amount: number;
  period_month?: number;
  period_year?: number;
  advance_date?: string;
  description?: string;
}

export interface EmployeeSalary {
  id: number;
  name: string;
  role: string;
  monthly_salary: number;
  advances_total: number;
  remaining: number;
}

export interface SalaryOverview {
  employees: EmployeeSalary[];
  totals: {
    total_salaries: number;
    total_advances: number;
    total_remaining: number;
  };
  period: {
    month: number;
    year: number;
  };
}

export function useSalaries() {
  const { currentNegocio } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async (month?: number, year?: number): Promise<SalaryOverview | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (month) params.append("month", month.toString());
      if (year) params.append("year", year.toString());

      const response = await apiFetch(`/api/salaries/overview?${params}`, {}, currentNegocio?.id);
      const data = await response.json();

      if (data.success) {
        return data.data;
      } else {
        setError(data.error?.message || "Error al cargar resumen");
        return null;
      }
    } catch (err) {
      setError("Error de conexión");
      console.error("Error fetching salary overview:", err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [currentNegocio?.id]);

  const fetchAdvances = useCallback(async (employeeId: number, month?: number, year?: number): Promise<Advance[]> => {
    try {
      const params = new URLSearchParams();
      if (month) params.append("month", month.toString());
      if (year) params.append("year", year.toString());

      const response = await apiFetch(
        `/api/employees/${employeeId}/advances?${params}`,
        {},
        currentNegocio?.id
      );
      const data = await response.json();

      if (data.success) {
        return data.data || [];
      } else {
        throw new Error(data.error?.message || "Error al cargar adelantos");
      }
    } catch (err) {
      console.error("Error fetching advances:", err);
      throw err;
    }
  }, [currentNegocio?.id]);

  const createAdvance = async (employeeId: number, input: AdvanceInput): Promise<Advance | null> => {
    try {
      const response = await apiFetch(
        `/api/employees/${employeeId}/advances`,
        { method: "POST", body: JSON.stringify(input) },
        currentNegocio?.id
      );
      const data = await response.json();

      if (data.success) {
        return data.data;
      } else {
        throw new Error(data.error?.message || "Error al crear adelanto");
      }
    } catch (err) {
      console.error("Error creating advance:", err);
      throw err;
    }
  };

  const deleteAdvance = async (advanceId: number): Promise<boolean> => {
    try {
      const response = await apiFetch(
        `/api/advances/${advanceId}`,
        { method: "DELETE" },
        currentNegocio?.id
      );
      const data = await response.json();

      if (data.success) {
        return true;
      } else {
        throw new Error(data.error?.message || "Error al eliminar adelanto");
      }
    } catch (err) {
      console.error("Error deleting advance:", err);
      throw err;
    }
  };

  const markAsPaid = async (employeeId: number, month: number, year: number): Promise<boolean> => {
    try {
      const response = await apiFetch(
        "/api/salary-payments/mark-paid",
        {
          method: "POST",
          body: JSON.stringify({ employee_id: employeeId, period_month: month, period_year: year }),
        },
        currentNegocio?.id
      );
      const data = await response.json();

      if (data.success) {
        return true;
      } else {
        throw new Error(data.error?.message || "Error al marcar como pagado");
      }
    } catch (err) {
      console.error("Error marking as paid:", err);
      throw err;
    }
  };

  const markAllAsPaid = async (month: number, year: number): Promise<boolean> => {
    try {
      const response = await apiFetch(
        "/api/salary-payments/mark-all-paid",
        {
          method: "POST",
          body: JSON.stringify({ period_month: month, period_year: year }),
        },
        currentNegocio?.id
      );
      const data = await response.json();

      if (data.success) {
        return true;
      } else {
        throw new Error(data.error?.message || "Error al marcar todos como pagados");
      }
    } catch (err) {
      console.error("Error marking all as paid:", err);
      throw err;
    }
  };

  return {
    isLoading,
    error,
    fetchOverview,
    fetchAdvances,
    createAdvance,
    deleteAdvance,
    markAsPaid,
    markAllAsPaid,
  };
}
