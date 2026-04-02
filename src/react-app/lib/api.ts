/**
 * Centralized fetch helper that automatically injects the X-Negocio-ID header.
 * All hooks should use this instead of calling fetch() directly for API requests
 * that require a negocio context.
 */
export function apiFetch(
  url: string,
  options: RequestInit = {},
  negocioId?: number | null
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (negocioId) {
    headers["X-Negocio-ID"] = String(negocioId);
  }

  return fetch(url, { ...options, headers });
}
