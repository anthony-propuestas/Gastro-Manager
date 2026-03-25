import { useState, useEffect } from "react";

export interface JobRole {
  id: number;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface JobRoleInput {
  name: string;
}

export function useJobRoles() {
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobRoles = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/job-roles");
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
    const response = await fetch("/api/job-roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error?.message || "Error al crear puesto");
    }

    await fetchJobRoles();
    return data.data;
  };

  const deleteJobRole = async (id: number): Promise<void> => {
    const response = await fetch(`/api/job-roles/${id}`, {
      method: "DELETE",
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error?.message || "Error al eliminar puesto");
    }

    await fetchJobRoles();
  };

  useEffect(() => {
    fetchJobRoles();
  }, []);

  return {
    jobRoles,
    isLoading,
    error,
    createJobRole,
    deleteJobRole,
    refetch: fetchJobRoles,
  };
}
