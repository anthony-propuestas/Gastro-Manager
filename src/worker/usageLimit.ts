import { USAGE_TOOLS, type UsageTool } from "./usageTools";

export const CHAT_CAP_INTELIGENTE = 3_000;

export async function incrementAndCheckInteligenteLimit(
  db: D1Database,
  userId: string,
  negocioId: number,
  tool: UsageTool,
  period: string
): Promise<{ blocked: boolean }> {
  const result = await db
    .prepare(
      `INSERT INTO usage_counters (user_id, negocio_id, tool, period, count, updated_at)
       VALUES (?, ?, ?, ?, 1, datetime('now'))
       ON CONFLICT(user_id, negocio_id, tool, period)
       DO UPDATE SET count = count + 1, updated_at = datetime('now')
       RETURNING count`
    )
    .bind(userId, negocioId, tool, period)
    .first<{ count: number }>();

  if (tool === USAGE_TOOLS.CHAT && (result?.count ?? 1) > CHAT_CAP_INTELIGENTE) {
    await db
      .prepare(
        `UPDATE usage_counters SET count = count - 1, updated_at = datetime('now')
         WHERE user_id = ? AND negocio_id = ? AND tool = ? AND period = ?`
      )
      .bind(userId, negocioId, tool, period)
      .run();
    return { blocked: true };
  }
  return { blocked: false };
}
