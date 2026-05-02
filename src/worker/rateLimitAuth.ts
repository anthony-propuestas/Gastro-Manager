export async function checkRateLimit(
  ip: string,
  endpoint: string,
  db: D1Database,
  maxAttempts = 10,
  windowMinutes = 15
): Promise<boolean> {
  const ipHash = await crypto.subtle
    .digest("SHA-256", new TextEncoder().encode(ip))
    .then((b) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join(""));
  const windowStart = new Date(
    Math.floor(Date.now() / (windowMinutes * 60_000)) * windowMinutes * 60_000
  ).toISOString();
  const result = await db
    .prepare(
      `INSERT INTO rate_limit_auth (ip_hash, endpoint, window_start, count)
       VALUES (?, ?, ?, 1)
       ON CONFLICT(ip_hash, endpoint, window_start) DO UPDATE SET count = count + 1
       RETURNING count`
    )
    .bind(ipHash, endpoint, windowStart)
    .first<{ count: number }>();
  return (result?.count ?? 0) <= maxAttempts;
}
