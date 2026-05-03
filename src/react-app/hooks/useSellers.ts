import { useState, useEffect, useCallback } from "react";

export interface Vendedor {
  user_id: string;
  codigo: string;
  activo: number;
  created_at: string;
}

export interface Referido {
  id: number;
  vendedor_id: string;
  referido_user_id: string;
  suscripcion_id: number | null;
  estado: string;
  comision_monto: number | null;
  reembolso_monto: number | null;
  comision_pagada: number;
  reembolso_pagado: number;
  created_at: string;
  confirmed_at: string | null;
  referido_name: string;
  referido_email: string;
  suscripcion_estado: string | null;
}

export interface SellerStats {
  total_referidos: number;
  confirmados: number;
  comision_total: number;
  comision_pendiente: number;
}

export function useSellers() {
  const [vendedor, setVendedor] = useState<Vendedor | null>(null);
  const [referidos, setReferidos] = useState<Referido[]>([]);
  const [stats, setStats] = useState<SellerStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMe = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch("/api/sellers/me");
      const data = await res.json();
      if (data.success && data.data) {
        setVendedor(data.data.vendedor);
        setReferidos(data.data.referidos ?? []);
        setStats(data.data.stats ?? null);
      } else {
        setVendedor(null);
        setReferidos([]);
        setStats(null);
      }
    } catch {
      setError("Error al cargar datos de vendedor");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchMe(); }, [fetchMe]);

  const activate = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/sellers/activate", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        await fetchMe();
        return true;
      }
      setError(data.error?.message ?? "Error al activar");
      return false;
    } catch {
      setError("Error de red al activar");
      return false;
    }
  }, [fetchMe]);

  return { vendedor, referidos, stats, isLoading, error, activate, refresh: fetchMe };
}
