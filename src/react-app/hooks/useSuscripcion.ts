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
        const err = data.error as { code?: string; message?: string; mp_status?: number | null; mp_detail?: string | null } | undefined;
        const code = err?.code ?? "ERROR";
        if (res.status === 502) {
          let msg: string;
          switch (code) {
            case "MP_NETWORK_ERROR":
              msg = "No se pudo conectar con Mercado Pago. Verificá tu conexión a internet.";
              break;
            case "MP_AUTH_ERROR":
              msg = "Credenciales de Mercado Pago inválidas. Contactá al soporte.";
              break;
            case "MP_VALIDATION_ERROR":
              msg = err?.mp_detail
                ? `Mercado Pago rechazó la solicitud: ${err.mp_detail}`
                : "Solicitud rechazada por Mercado Pago. Revisá la configuración.";
              break;
            case "MP_SERVER_ERROR":
              msg = "Mercado Pago está experimentando problemas. Intentá más tarde.";
              break;
            case "MP_NO_INIT_POINT":
              msg = "Mercado Pago no generó el enlace de pago. Intentá de nuevo.";
              break;
            default:
              msg = err?.mp_detail
                ? `Error de Mercado Pago: ${err.mp_detail}`
                : "Mercado Pago no respondió correctamente. Intentá de nuevo.";
          }
          setError(`${msg} (${code}${err?.mp_status ? ` — ${err.mp_status}` : ""})`);
        } else {
          setError(err?.message ?? "Error al crear suscripción");
        }
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
