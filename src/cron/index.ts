interface Env {
  DB: D1Database;
  R2_BUCKET: R2Bucket;
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    const expired = await env.DB
      .prepare(
        "SELECT id, comprobante_key FROM compras WHERE expires_at <= datetime('now') AND comprobante_key IS NOT NULL"
      )
      .all();
    for (const row of expired.results as { id: number; comprobante_key: string }[]) {
      await env.R2_BUCKET.delete(row.comprobante_key);
      await env.DB.prepare("UPDATE compras SET comprobante_key = NULL WHERE id = ?").bind(row.id).run();
    }
  },
};
