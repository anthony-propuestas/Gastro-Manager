import { useEffect, useState } from "react";
import { useAuth } from "@/react-app/context/AuthContext";

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
  const [data, setData] = useState<MyUsageData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!currentNegocio) return;
    setIsLoading(true);
    fetch("/api/usage/me", {
      headers: { "X-Negocio-ID": String(currentNegocio.id) },
    })
      .then(r => r.json())
      .then(d => { if (d.success) setData(d.data); })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [currentNegocio?.id]);

  return { data, isLoading };
}
