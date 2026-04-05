import { useState, useCallback } from "react";
import type { OwnerRequest, NegocioModuleRestrictions } from "@/shared/types";

const DEFAULT_RESTRICTIONS: NegocioModuleRestrictions = {
  calendario: false,
  personal: false,
  sueldos: false,
};

export function useOwnerPanel(negocioId: number) {
  const [requests, setRequests] = useState<OwnerRequest[]>([]);
  const [restrictions, setRestrictions] = useState<NegocioModuleRestrictions>(DEFAULT_RESTRICTIONS);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [loadingRestrictions, setLoadingRestrictions] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoadingRequests(true);
    setError(null);
    try {
      const res = await fetch(`/api/negocios/${negocioId}/owner-requests`);
      const json = await res.json();
      if (json.success) {
        setRequests(json.data);
      } else {
        setError("No se pudieron cargar las solicitudes.");
      }
    } catch {
      setError("Error de red al cargar solicitudes.");
    } finally {
      setLoadingRequests(false);
    }
  }, [negocioId]);

  const fetchRestrictions = useCallback(async () => {
    setLoadingRestrictions(true);
    try {
      const res = await fetch(`/api/negocios/${negocioId}/module-restrictions`);
      const json = await res.json();
      if (json.success && typeof json.data === 'object') {
        setRestrictions({ ...DEFAULT_RESTRICTIONS, ...json.data });
      }
    } catch {
      console.error("Error loading restrictions");
    } finally {
      setLoadingRestrictions(false);
    }
  }, [negocioId]);

  const approveRequest = useCallback(async (requestId: number) => {
    setActionLoading(requestId);
    setError(null);
    try {
      const res = await fetch(`/api/negocios/${negocioId}/owner-requests/${requestId}/approve`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
        return true;
      } else {
        setError("No se pudo aprobar la solicitud.");
        return false;
      }
    } catch {
      setError("Error de red al aprobar.");
      return false;
    } finally {
      setActionLoading(null);
    }
  }, [negocioId]);

  const rejectRequest = useCallback(async (requestId: number) => {
    setActionLoading(requestId);
    setError(null);
    try {
      const res = await fetch(`/api/negocios/${negocioId}/owner-requests/${requestId}/reject`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
        return true;
      } else {
        setError("No se pudo rechazar la solicitud.");
        return false;
      }
    } catch {
      setError("Error de red al rechazar.");
      return false;
    } finally {
      setActionLoading(null);
    }
  }, [negocioId]);

  const toggleRestriction = useCallback(async (moduleKey: keyof NegocioModuleRestrictions) => {
    const newValue = !restrictions[moduleKey];
    // Optimistic update
    setRestrictions((prev) => ({ ...prev, [moduleKey]: newValue }));
    try {
      const res = await fetch(`/api/negocios/${negocioId}/module-restrictions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module_key: moduleKey, is_restricted: newValue }),
      });
      const json = await res.json();
      if (!json.success) throw new Error("API error");
    } catch {
      // Revert on error
      setRestrictions((prev) => ({ ...prev, [moduleKey]: !newValue }));
      setError("Error al actualizar restricción.");
    }
  }, [negocioId, restrictions]);

  return {
    requests,
    restrictions,
    loadingRequests,
    loadingRestrictions,
    actionLoading,
    error,
    fetchRequests,
    fetchRestrictions,
    approveRequest,
    rejectRequest,
    toggleRestriction,
  };
}
