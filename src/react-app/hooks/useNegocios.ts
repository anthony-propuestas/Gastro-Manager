import { useState, useCallback } from "react";
import { apiFetch } from "@/react-app/lib/api";
import type { Negocio, NegocioMember, Invitation } from "@/shared/types";

export function useNegocios() {
  const [operationLoading, setOperationLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const startOp = (key: string) => setOperationLoading((prev) => ({ ...prev, [key]: true }));
  const endOp = (key: string) => setOperationLoading((prev) => ({ ...prev, [key]: false }));

  const isLoading = Object.values(operationLoading).some(Boolean);

  const createNegocio = useCallback(async (name: string): Promise<Negocio | null> => {
    startOp("create");
    setError(null);
    try {
      const res = await apiFetch("/api/negocios", {
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
      endOp("create");
    }
  }, []);

  const getNegocioDetail = useCallback(
    async (negocioId: number): Promise<(Negocio & { members: NegocioMember[] }) | null> => {
      startOp("detail");
      setError(null);
      try {
        const res = await apiFetch(`/api/negocios/${negocioId}`, {}, negocioId);
        const data = await res.json();
        if (data.success) return data.data;
        setError(data.error?.message || "Error al obtener el negocio");
        return null;
      } catch {
        setError("Sin conexión. Revisa tu internet.");
        return null;
      } finally {
        endOp("detail");
      }
    },
    []
  );

  const generateInvitation = useCallback(
    async (negocioId: number): Promise<Invitation | null> => {
      startOp("invite");
      setError(null);
      try {
        const res = await apiFetch(`/api/negocios/${negocioId}/invitations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }, negocioId);
        const data = await res.json();
        if (data.success) return data.data as Invitation;
        setError(data.error?.message || "Error al generar la invitación");
        return null;
      } catch {
        setError("Sin conexión. Revisa tu internet.");
        return null;
      } finally {
        endOp("invite");
      }
    },
    []
  );

  const removeMember = useCallback(
    async (negocioId: number, userId: string): Promise<boolean> => {
      startOp("remove");
      setError(null);
      try {
        const res = await apiFetch(`/api/negocios/${negocioId}/members/${userId}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        }, negocioId);
        const data = await res.json();
        if (data.success) return true;
        setError(data.error?.message || "Error al remover miembro");
        return false;
      } catch {
        setError("Sin conexión. Revisa tu internet.");
        return false;
      } finally {
        endOp("remove");
      }
    },
    []
  );

  const leaveNegocio = useCallback(async (negocioId: number): Promise<boolean> => {
    startOp("leave");
    setError(null);
    try {
      const res = await apiFetch(`/api/negocios/${negocioId}/leave`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      }, negocioId);
      const data = await res.json();
      if (data.success) return true;
      setError(data.error?.message || "Error al salir del negocio");
      return false;
    } catch {
      setError("Sin conexión. Revisa tu internet.");
      return false;
    } finally {
      endOp("leave");
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
