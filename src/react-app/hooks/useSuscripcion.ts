import { useState, useEffect, useCallback } from "react";

export interface SuscripcionData {
  id: number;
  user_id: string;
  mp_preapproval_id: string | null;
  estado: string;
  fecha_inicio: string | null;
  proximo_cobro: string | null;
  ultimo_pago_ok: string | null;
  grace_deadline: string | null;
  grace_days_left: number | null;
  monto: number;
  moneda: string;
  payer_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface PagoSuscripcion {
  id: number;
  suscripcion_id: number;
  mp_payment_id: string | null;
  estado_pago: string;
  monto: number | null;
  moneda: string;
  fecha_pago: string | null;
  razon_rechazo: string | null;
  created_at: string;
}

export function useSuscripcion() {
  const [suscripcion, setSuscripcion] = useState<SuscripcionData | null>(null);
  const [pagos, setPagos] = useState<PagoSuscripcion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEstado = useCallback(async () => {
    try {
      const res = await fetch("/api/suscripciones/estado");
      const data = await res.json();
      setSuscripcion(data.data ?? null);
    } catch {
      setError("Error al cargar el estado de la suscripción");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchEstado(); }, [fetchEstado]);

  const crear = useCallback(async (): Promise<string | null> => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/suscripciones/crear", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Error al crear suscripción");
        return null;
      }
      await fetchEstado();
      return data.data?.init_point ?? null;
    } catch {
      setError("Error de red al crear suscripción");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [fetchEstado]);

  const cancelar = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/suscripciones/cancelar", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message ?? "Error al cancelar");
        return false;
      }
      await fetchEstado();
      return true;
    } catch {
      setError("Error de red al cancelar suscripción");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [fetchEstado]);

  const fetchPagos = useCallback(async () => {
    try {
      const res = await fetch("/api/suscripciones/pagos");
      if (res.ok) {
        const data = await res.json();
        setPagos(data.data ?? []);
      }
    } catch {
      // No bloquea la UI
    }
  }, []);

  return { suscripcion, pagos, isLoading, error, crear, cancelar, refresh: fetchEstado, fetchPagos };
}
