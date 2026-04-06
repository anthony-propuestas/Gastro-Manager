import { useEffect, useState } from "react";
import { useAuth } from "@/react-app/context/AuthContext";
import { apiFetch } from "@/react-app/lib/api";

export interface ToolUsage {
  count: number;
  limit: number | null; // null = usuario_inteligente (sin límite)
}

interface MyUsageData {
  period: string;
  role: string;
  usage: Record<string, ToolUsage>;
}

export function useMyUsage() {
  const { currentNegocio } = useAuth();
  const negocioId = currentNegocio?.id;
  const [data, setData] = useState<MyUsageData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!negocioId) {
      setData(null);
      return;
    }

    setIsLoading(true);
    apiFetch("/api/usage/me", {}, negocioId)
      .then(r => r.json())
      .then(d => { if (d.success) setData(d.data); })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [negocioId]);

  return { data, isLoading };
}
