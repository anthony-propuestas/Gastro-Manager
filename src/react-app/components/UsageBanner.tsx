import type { ToolUsage } from "@/react-app/hooks/useMyUsage";
import { AlertCircle } from "lucide-react";

interface UsageBannerProps {
  label: string;
  usage: ToolUsage | undefined;
}

export function UsageBanner({ label, usage }: UsageBannerProps) {
  if (!usage || usage.limit === null) return null;
  const { count, limit } = usage;
  if (count < limit * 0.8) return null;

  const reached = count >= limit;
  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm mb-4 ${
      reached
        ? "bg-red-50 border border-red-200 text-red-700"
        : "bg-amber-50 border border-amber-200 text-amber-700"
    }`}>
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span>
        {reached
          ? `Límite mensual alcanzado para ${label} (${count}/${limit}). Actualiza a Usuario Inteligente para continuar.`
          : `Acercándote al límite mensual de ${label}: ${count}/${limit} usos.`}
      </span>
    </div>
  );
}
