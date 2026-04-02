import { useState, useCallback } from "react";
import type { Negocio, NegocioMember, Invitation } from "../../shared/types";

export function useNegocios() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createNegocio = useCallback(async (name: string): Promise<Negocio | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/negocios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (data.success) return data.data as Negocio;
      setError(data.error?.message || "Error al crear el negocio");
      return null;
    } catch {
      setError("Sin conexión. Revisa tu internet.");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getNegocioDetail = useCallback(
    async (negocioId: number): Promise<(Negocio & { members: NegocioMember[] }) | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/negocios/${negocioId}`);
        const data = await res.json();
        if (data.success) return data.data;
        setError(data.error?.message || "Error al obtener el negocio");
        return null;
      } catch {
        setError("Sin conexión. Revisa tu internet.");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const generateInvitation = useCallback(
    async (negocioId: number): Promise<Invitation | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/negocios/${negocioId}/invitations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const data = await res.json();
        if (data.success) return data.data as Invitation;
        setError(data.error?.message || "Error al generar la invitación");
        return null;
      } catch {
        setError("Sin conexión. Revisa tu internet.");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const removeMember = useCallback(
    async (negocioId: number, userId: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/negocios/${negocioId}/members/${userId}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        });
        const data = await res.json();
        if (data.success) return true;
        setError(data.error?.message || "Error al remover miembro");
        return false;
      } catch {
        setError("Sin conexión. Revisa tu internet.");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const leaveNegocio = useCallback(async (negocioId: number): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/negocios/${negocioId}/leave`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.success) return true;
      setError(data.error?.message || "Error al salir del negocio");
      return false;
    } catch {
      setError("Sin conexión. Revisa tu internet.");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    error,
    createNegocio,
    getNegocioDetail,
    generateInvitation,
    removeMember,
    leaveNegocio,
  };
}
