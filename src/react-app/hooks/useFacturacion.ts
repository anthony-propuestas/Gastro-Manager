import { useState, useCallback } from "react";
import { useAuth } from "@/react-app/context/AuthContext";
import { apiFetch } from "@/react-app/lib/api";

export type MetodoPago =
  | "efectivo"
  | "tarjeta_credito"
  | "tarjeta_debito"
  | "transferencia"
  | "mercado_pago"
  | "mixto"
  | "otros";

export type Turno = "mañana" | "tarde";

export const METODOS_PAGO: { value: MetodoPago; label: string }[] = [
  { value: "efectivo",        label: "Efectivo" },
  { value: "tarjeta_credito", label: "Tarjeta de crédito" },
  { value: "tarjeta_debito",  label: "Tarjeta de débito" },
  { value: "transferencia",   label: "Transferencia bancaria" },
  { value: "mercado_pago",    label: "Mercado Pago" },
  { value: "otros",           label: "Otros" },
];

export interface PagoDetalle {
  metodo_pago: MetodoPago;
  monto: number;
}

export interface Factura {
  id: number;
  negocio_id: number;
  user_id: string;
  fecha: string;
  monto_total: number;
  metodo_pago: MetodoPago | null;
  concepto: string | null;
  numero_comprobante: string | null;
  notas: string | null;
  turno: Turno | null;
  pagos_detalle: string | null; // JSON string de PagoDetalle[]
  created_at: string;
  updated_at: string;
}

export interface FacturaInput {
  fecha: string;
  monto_total: number;
  metodo_pago?: MetodoPago | null;
  concepto?: string | null;
  numero_comprobante?: string | null;
  notas?: string | null;
  turno?: Turno | null;
  pagos_detalle?: string | null;
}

interface FacturaDailySummary {
  fecha: string;
  total_dia: number;
  cantidad: number;
}

/** Parsea pagos_detalle desde string JSON. Retorna array vacío si falla. */
export function parsePagosDetalle(raw: string | null): PagoDetalle[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as PagoDetalle[];
  } catch {
    return [];
  }
}

export function useFacturacion() {
  const { currentNegocio } = useAuth();
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [summary, setSummary] = useState<FacturaDailySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFacturas = useCallback(async (month: number, year: number) => {
    if (!currentNegocio?.id) return;
    try {
      setIsLoading(true);
      setError(null);
      const res = await apiFetch(`/api/facturacion?month=${month}&year=${year}`, {}, currentNegocio.id);
      const json = await res.json();
      if (json.success) {
        setFacturas(json.data ?? []);
      } else {
        setError(json.error?.message ?? "Error al cargar facturas");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setIsLoading(false);
    }
  }, [currentNegocio?.id]);

  const fetchSummary = useCallback(async (month: number, year: number) => {
    if (!currentNegocio?.id) return;
    try {
      const res = await apiFetch(`/api/facturacion/summary?month=${month}&year=${year}`, {}, currentNegocio.id);
      const json = await res.json();
      if (json.success) {
        setSummary(json.data ?? []);
      }
    } catch {
      // silent — summary is secondary
    }
  }, [currentNegocio?.id]);

  const createFactura = useCallback(async (input: FacturaInput): Promise<boolean> => {
    if (!currentNegocio?.id) return false;
    try {
      const res = await apiFetch("/api/facturacion", {
        method: "POST",
        body: JSON.stringify(input),
      }, currentNegocio.id);
      const json = await res.json();
      return json.success === true;
    } catch {
      return false;
    }
  }, [currentNegocio?.id]);

  const updateFactura = useCallback(async (id: number, input: Partial<FacturaInput>): Promise<boolean> => {
    if (!currentNegocio?.id) return false;
    try {
      const res = await apiFetch(`/api/facturacion/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }, currentNegocio.id);
      const json = await res.json();
      return json.success === true;
    } catch {
      return false;
    }
  }, [currentNegocio?.id]);

  const deleteFactura = useCallback(async (id: number): Promise<boolean> => {
    if (!currentNegocio?.id) return false;
    try {
      const res = await apiFetch(`/api/facturacion/${id}`, {
        method: "DELETE",
      }, currentNegocio.id);
      const json = await res.json();
      return json.success === true;
    } catch {
      return false;
    }
  }, [currentNegocio?.id]);

  return {
    facturas,
    summary,
    isLoading,
    error,
    fetchFacturas,
    fetchSummary,
    createFactura,
    updateFactura,
    deleteFactura,
  };
}
