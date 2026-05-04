export async function getOrCreateGeminiCache(
  db: D1Database,
  apiKey: string,
  userId: number | string,
  negocioId: number | string,
  contextText: string
): Promise<string | null> {
  const existing = await db
    .prepare("SELECT gemini_cache_name, gemini_cache_expires_at FROM chat_context_cache WHERE user_id = ? AND negocio_id = ?")
    .bind(userId, negocioId)
    .first<{ gemini_cache_name: string | null; gemini_cache_expires_at: number | null }>();

  if (
    existing?.gemini_cache_name &&
    existing.gemini_cache_expires_at &&
    Date.now() < existing.gemini_cache_expires_at
  ) {
    return existing.gemini_cache_name;
  }

  try {
    const ttlSeconds = 7200;
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/cachedContents", {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/gemini-2.5-flash",
        systemInstruction: { parts: [{ text: contextText }] },
        ttl: `${ttlSeconds}s`,
      }),
    });

    if (!res.ok) return null;

    const data = await res.json<{ name: string }>();
    const expiresAt = Date.now() + ttlSeconds * 1000;

    await db
      .prepare("UPDATE chat_context_cache SET gemini_cache_name = ?, gemini_cache_expires_at = ? WHERE user_id = ? AND negocio_id = ?")
      .bind(data.name, expiresAt, userId, negocioId)
      .run();

    return data.name;
  } catch {
    return null;
  }
}
