export const USAGE_LIMIT_EVENT = "gastro:usage-limit-exceeded";

export interface UsageLimitEventDetail {
  endpoint: string;
  moduleLabel: string;
  message: string;
  limit: number | null;
  occurredAt: number;
}

interface UsageLimitErrorPayload {
  error?: {
    code?: string;
    message?: string;
  };
}

function getPathname(url: string): string {
  try {
    return new URL(url, window.location.origin).pathname;
  } catch {
    return url.split("?")[0] ?? url;
  }
}

function getModuleLabelFromPath(pathname: string): string {
  if (pathname === "/api/chat") return "Chat IA";
  if (pathname === "/api/job-roles") return "Puestos";
  if (pathname.startsWith("/api/employees/") && pathname.endsWith("/topics")) return "Temas";
  if (pathname.startsWith("/api/topics/") && pathname.endsWith("/notes")) return "Notas";
  if (pathname === "/api/events") return "Eventos";
  if (pathname.startsWith("/api/employees/") && pathname.endsWith("/advances")) return "Anticipos";
  if (pathname === "/api/salary-payments/mark-paid" || pathname === "/api/salary-payments/mark-all-paid") {
    return "Pagos de sueldo";
  }
  if (pathname.startsWith("/api/compras")) return "Compras";
  if (pathname.startsWith("/api/facturacion")) return "Facturación";
  if (pathname === "/api/employees") return "Empleados";
  return "esta herramienta";
}

function getLimitFromMessage(message: string | undefined): number | null {
  if (!message) return null;
  const match = message.match(/\((\d+)\)/);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function notifyUsageLimitExceeded(response: Response, url: string): Promise<void> {
  if (typeof window === "undefined" || response.status !== 429) return;

  try {
    const data = (await response.clone().json()) as UsageLimitErrorPayload;
    if (data.error?.code !== "USAGE_LIMIT_EXCEEDED") return;

    const pathname = getPathname(url);
    const message = data.error.message ?? "Llegaste al límite mensual de uso.";

    const detail: UsageLimitEventDetail = {
      endpoint: pathname,
      moduleLabel: getModuleLabelFromPath(pathname),
      message,
      limit: getLimitFromMessage(message),
      occurredAt: Date.now(),
    };

    window.dispatchEvent(new CustomEvent<UsageLimitEventDetail>(USAGE_LIMIT_EVENT, { detail }));
  } catch {
    // Ignore invalid payloads. Existing screens will still handle the original error.
  }
}