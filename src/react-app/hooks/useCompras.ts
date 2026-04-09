import { useState, useCallback } from "react";
import { useAuth } from "@/react-app/context/AuthContext";
import { apiFetch } from "@/react-app/lib/api";

export interface Compra {
  id: number;
  negocio_id: number;
  user_id: string;
  fecha: string;
  monto: number;
  item: string;
  tipo: "producto" | "servicio";
  categoria: string;
  comprador_id: number | null;
  comprador_name: string | null;
  descripcion: string | null;
  comprobante_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompraInput {
  fecha: string;
  monto: number;
  item: string;
  tipo: "producto" | "servicio";
  categoria: string;
  comprador_id?: number | null;
  descripcion?: string | null;
  comprobante_key?: string | null;
}

interface DailySummary {
  fecha: string;
  total_dia: number;
  total_productos: number;
  total_servicios: number;
  cantidad: number;
}

export const COMPRAS_CATEGORIAS = [
  { value: "carnes", label: "Carnes" },
  { value: "verduras", label: "Verduras" },
  { value: "bebidas", label: "Bebidas" },
  { value: "limpieza", label: "Limpieza" },
  { value: "descartables", label: "Descartables" },
  { value: "servicios", label: "Servicios" },
  { value: "mantenimiento", label: "Mantenimiento" },
  { value: "alquiler", label: "Alquiler" },
  { value: "otros", label: "Otros" },
] as const;

export function useCompras() {
  const { currentNegocio } = useAuth();
  const [compras, setCompras] = useState<Compra[]>([]);
  const [summary, setSummary] = useState<DailySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCompras = useCallback(async (month: number, year: number) => {
    if (!currentNegocio?.id) return;
    try {
      setIsLoading(true);
      setError(null);
      const res = await apiFetch(`/api/compras?month=${month}&year=${year}`, {}, currentNegocio.id);
      const json = await res.json();
      if (json.success) {
        setCompras(json.data ?? []);
      } else {
        setError(json.error?.message ?? "Error al cargar compras");
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
      const res = await apiFetch(`/api/compras/summary?month=${month}&year=${year}`, {}, currentNegocio.id);
      const json = await res.json();
      if (json.success) {
        setSummary(json.data ?? []);
      }
    } catch {
      // silent — summary is secondary
    }
  }, [currentNegocio?.id]);

  const createCompra = useCallback(async (input: CompraInput): Promise<boolean> => {
    if (!currentNegocio?.id) return false;
    try {
      const res = await apiFetch("/api/compras", {
        method: "POST",
        body: JSON.stringify(input),
      }, currentNegocio.id);
      const json = await res.json();
      return json.success === true;
    } catch {
      return false;
    }
  }, [currentNegocio?.id]);

  const updateCompra = useCallback(async (id: number, input: Partial<CompraInput>): Promise<boolean> => {
    if (!currentNegocio?.id) return false;
    try {
      const res = await apiFetch(`/api/compras/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }, currentNegocio.id);
      const json = await res.json();
      return json.success === true;
    } catch {
      return false;
    }
  }, [currentNegocio?.id]);

  const deleteCompra = useCallback(async (id: number): Promise<boolean> => {
    if (!currentNegocio?.id) return false;
    try {
      const res = await apiFetch(`/api/compras/${id}`, {
        method: "DELETE",
      }, currentNegocio.id);
      const json = await res.json();
      return json.success === true;
    } catch {
      return false;
    }
  }, [currentNegocio?.id]);

  const uploadComprobante = useCallback(async (file: File): Promise<string | null> => {
    if (!currentNegocio?.id) return null;
    try {
      const fd = new FormData();
      fd.append("file", file);
      // Use raw fetch — apiFetch sets Content-Type: application/json which breaks multipart
      const res = await fetch("/api/compras/upload", {
        method: "POST",
        headers: { "X-Negocio-ID": String(currentNegocio.id) },
        body: fd,
      });
      const json = await res.json();
      if (json.success) return json.data.key;
      return null;
    } catch {
      return null;
    }
  }, [currentNegocio?.id]);

  const getComprobanteUrl = useCallback((key: string) => {
    return `/api/compras/files/${key}`;
  }, []);

  return {
    compras,
    summary,
    isLoading,
    error,
    fetchCompras,
    fetchSummary,
    createCompra,
    updateCompra,
    deleteCompra,
    uploadComprobante,
    getComprobanteUrl,
  };
}
