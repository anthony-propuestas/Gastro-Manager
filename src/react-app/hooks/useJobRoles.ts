import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

interface JobRole {
  id: number;
  negocio_id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

interface JobRoleInput {
  name: string;
}

export function useJobRoles() {
  const { currentNegocio } = useAuth();
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobRoles = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiFetch("/api/job-roles", {}, currentNegocio?.id);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || "Error al cargar puestos");
      }

      setJobRoles(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar puestos");
    } finally {
      setIsLoading(false);
    }
  };

  const createJobRole = async (input: JobRoleInput): Promise<JobRole> => {
    const response = await apiFetch(
      "/api/job-roles",
      { method: "POST", body: JSON.stringify(input) },
      currentNegocio?.id
    );
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error?.message || "Error al crear puesto");
    }

    await fetchJobRoles();
    return data.data;
  };

  const deleteJobRole = async (id: number): Promise<void> => {
    const response = await apiFetch(
      `/api/job-roles/${id}`,
      { method: "DELETE" },
      currentNegocio?.id
    );
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error?.message || "Error al eliminar puesto");
    }

    await fetchJobRoles();
  };

  useEffect(() => {
    fetchJobRoles();
  }, [currentNegocio?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    jobRoles,
    isLoading,
    error,
    createJobRole,
    deleteJobRole,
    refetch: fetchJobRoles,
  };
}
