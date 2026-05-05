import { USAGE_TOOLS, type UsageTool } from "./usageTools";

export const CHAT_CAP_INTELIGENTE = 3_000;

const CHAT_WARN_THRESHOLD = Math.floor(CHAT_CAP_INTELIGENTE * 0.8); // 2400

export async function incrementAndCheckInteligenteLimit(
  db: D1Database,
  userId: string,
  negocioId: number,
  tool: UsageTool,
  period: string
): Promise<{ blocked: boolean; warnAt80?: boolean }> {
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

  const count = result?.count ?? 1;

  if (tool === USAGE_TOOLS.CHAT && count > CHAT_CAP_INTELIGENTE) {
    await db
      .prepare(
        `UPDATE usage_counters SET count = count - 1, updated_at = datetime('now')
         WHERE user_id = ? AND negocio_id = ? AND tool = ? AND period = ?`
      )
      .bind(userId, negocioId, tool, period)
      .run();
    return { blocked: true };
  }

  // Exact crossing of 80% threshold → notify once per month
  if (tool === USAGE_TOOLS.CHAT && count === CHAT_WARN_THRESHOLD) {
    return { blocked: false, warnAt80: true };
  }

  return { blocked: false };
}
