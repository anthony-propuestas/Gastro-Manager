/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hono, type MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { SignJWT, jwtVerify } from "jose";
import { Resend } from "resend";
import {
  validateData,
  createEmployeeSchema,
  updateEmployeeSchema,
  createJobRoleSchema,
  createTopicSchema,
  updateTopicSchema,
  createNoteSchema,
  updateNoteSchema,
  createEventSchema,
  updateEventSchema,
  createAdvanceSchema,
  markSalaryPaidSchema,
  createNegocioSchema,
  createCompraSchema,
  updateCompraSchema,
  createFacturaSchema,
  updateFacturaSchema,
} from "./validation";
import { USAGE_TOOLS, type UsageTool } from "./usageTools";

type Env = {
  DB: D1Database;
  R2_BUCKET: R2Bucket;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  JWT_SECRET: string;
  RESEND_API_KEY: string;
  INITIAL_ADMIN_EMAIL?: string;
  GEMINI_API_KEY?: string;
};

type UserPayload = { id: string; email: string; name: string; picture: string; role: string };
type NegocioPayload = { id: number; name: string; member_role: string };

type Variables = {
  user: UserPayload;
  negocio: NegocioPayload;
};

// ============================================
// JWT / Session helpers
// ============================================

const COOKIE_NAME = "session_token";

async function createSession(payload: UserPayload, secret: string): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(new TextEncoder().encode(secret));
}

async function verifySession(token: string, secret: string): Promise<UserPayload> {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
  return payload as unknown as UserPayload;
}

// ============================================
// Crypto helpers for invitation tokens
// ============================================

async function generateToken(): Promise<string> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ============================================
// Email verification helper
// ============================================

async function sendVerificationEmail(
  apiKey: string,
  toEmail: string,
  toName: string,
  verifyUrl: string
): Promise<void> {
  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: "Gastro Manager <no-reply@lahoja.org>",
    to: toEmail,
    subject: "Verificá tu cuenta en Gastro Manager",
    html: `
      <p>Hola ${toName},</p>
      <p>Hacé clic en el botón para verificar tu dirección de email:</p>
      <p>
        <a href="${verifyUrl}"
           style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">
          Verificar email
        </a>
      </p>
      <p>Este enlace expira en 24 horas.</p>
      <p>Si no creaste una cuenta, ignorá este mensaje.</p>
    `,
  });
}

// ============================================
// Middlewares
// ============================================

const authMiddleware: MiddlewareHandler<{ Bindings: Env; Variables: Variables }> = async (c, next) => {
  const token = getCookie(c, COOKIE_NAME);
  if (!token) {
    return c.json({ success: false, error: { code: "UNAUTHORIZED", message: "No autenticado" } }, 401);
  }
  try {
    const user = await verifySession(token, c.env.JWT_SECRET);
    // Always read role and email_verified from DB so admin changes take effect immediately (no stale JWT)
    const dbUser = await c.env.DB
      .prepare("SELECT role, email_verified FROM users WHERE id = ?")
      .bind(user.id)
      .first<{ role: string; email_verified: number }>();
    user.role = dbUser?.role ?? "usuario_basico";
    (user as any).email_verified = dbUser?.email_verified === 1;
    c.set("user", user);
    await next();
  } catch {
    return c.json({ success: false, error: { code: "INVALID_SESSION", message: "Sesión inválida o expirada" } }, 401);
  }
};

const negocioMiddleware: MiddlewareHandler<{ Bindings: Env; Variables: Variables }> = async (c, next) => {
  const negocioIdHeader = c.req.header("X-Negocio-ID");
  if (!negocioIdHeader || isNaN(Number(negocioIdHeader))) {
    return c.json({ success: false, error: { code: "NEGOCIO_REQUIRED", message: "Debes seleccionar un negocio" } }, 400);
  }
  const negocioId = Number(negocioIdHeader);
  const user = c.get("user");
  const member = await c.env.DB
    .prepare("SELECT negocio_id, negocio_role FROM negocio_members WHERE negocio_id = ? AND user_id = ?")
    .bind(negocioId, user.id)
    .first<{ negocio_id: number; negocio_role: string }>();
  if (!member) {
    return c.json({ success: false, error: { code: "NEGOCIO_ACCESS_DENIED", message: "No tienes acceso a este negocio" } }, 403);
  }
  // Fetch negocio name for context
  const negocio = await c.env.DB
    .prepare("SELECT id, name FROM negocios WHERE id = ?")
    .bind(negocioId)
    .first() as { id: number; name: string } | null;
  if (!negocio) {
    return c.json({ success: false, error: { code: "NEGOCIO_NOT_FOUND", message: "Negocio no encontrado" } }, 404);
  }
  c.set("negocio", { id: negocio.id, name: negocio.name, member_role: member.negocio_role });
  await next();
};

// Creates a middleware that enforces monthly usage quotas for usuario_basico.
// Uses atomic increment-then-check (Corrección 6) to avoid TOCTOU race conditions.
// mark-all-paid is NOT covered here — it handles N-count logic inside its own handler.
function createUsageLimitMiddleware(tool: UsageTool): MiddlewareHandler<{ Bindings: Env; Variables: Variables }> {
  return async (c, next) => {
    const user = c.get("user");
    const negocio = c.get("negocio");
    if (user.role === "usuario_inteligente") {
      const period = new Date().toISOString().slice(0, 7);
      const db = c.env.DB;
      try {
        await db
          .prepare(
            `INSERT INTO usage_counters (user_id, negocio_id, tool, period, count, updated_at)
             VALUES (?, ?, ?, ?, 1, datetime('now'))
             ON CONFLICT(user_id, negocio_id, tool, period)
             DO UPDATE SET count = count + 1, updated_at = datetime('now')`
          )
          .bind(user.id, negocio.id, tool, period)
          .run();
      } catch { /* silent — no bloquea la request */ }
      await next();
      return;
    }
    const period = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
    const db = c.env.DB;

    // Atomic increment con verificación de límite (solo usuario_basico)
    const result = await db
      .prepare(
        `INSERT INTO usage_counters (user_id, negocio_id, tool, period, count, updated_at)
         VALUES (?, ?, ?, ?, 1, datetime('now'))
         ON CONFLICT(user_id, negocio_id, tool, period)
         DO UPDATE SET count = count + 1, updated_at = datetime('now')
         RETURNING count`
      )
      .bind(user.id, negocio.id, tool, period)
      .first<{ count: number }>();

    const newCount = result?.count ?? 1;

    const limitRow = await db
      .prepare(`SELECT "limit" FROM usage_limits WHERE tool = ?`)
      .bind(tool)
      .first<{ limit: number }>();

    const limit = limitRow?.limit ?? Infinity;

    if (newCount > limit) {
      // Revert the increment before rejecting
      await db
        .prepare(
          `UPDATE usage_counters SET count = count - 1, updated_at = datetime('now')
           WHERE user_id = ? AND negocio_id = ? AND tool = ? AND period = ?`
        )
        .bind(user.id, negocio.id, tool, period)
        .run();

      return c.json(
        apiError("USAGE_LIMIT_EXCEEDED", `Límite mensual alcanzado (${limit}). Actualiza a Usuario Inteligente para continuar.`),
        429
      );
    }

    await next();
  };
}

// Blocks gerentes from accessing a module if the owner has restricted it.
// Must be used after negocioMiddleware (requires negocio.member_role).
function createModuleRestrictionMiddleware(moduleKey: 'calendario' | 'personal' | 'sueldos' | 'compras' | 'facturacion'): MiddlewareHandler<{ Bindings: Env; Variables: Variables }> {
  return async (c, next) => {
    const negocio = c.get("negocio");
    if (negocio.member_role !== 'owner') {
      const restriction = await c.env.DB
        .prepare("SELECT is_restricted FROM negocio_module_restrictions WHERE negocio_id = ? AND module_key = ?")
        .bind(negocio.id, moduleKey)
        .first<{ is_restricted: number }>();
      if (restriction?.is_restricted === 1) {
        return c.json(apiError("MODULE_RESTRICTED", "Este módulo está restringido por el owner"), 403);
      }
    }
    await next();
  };
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Helper for standardized API responses
const apiResponse = <T>(data: T) => ({ success: true, data });
const apiError = (code: string, message: string) => ({ success: false, error: { code, message } });

// Helper to check if user is admin
async function isAdmin(email: string, db: D1Database, env: Env): Promise<boolean> {
  if (email.toLowerCase() === env.INITIAL_ADMIN_EMAIL?.toLowerCase()) {
    return true;
  }
  const result = await db
    .prepare("SELECT id FROM admin_emails WHERE LOWER(email) = LOWER(?)")
    .bind(email)
    .first();
  return !!result;
}

// Helper to log usage (records both user and negocio)
async function logUsage(db: D1Database, userId: string, negocioId: number | null, actionType: string, entityType: string): Promise<void> {
  try {
    const now = new Date().toISOString();
    await db
      .prepare("INSERT INTO usage_logs (user_id, negocio_id, action_type, entity_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(userId, negocioId, actionType, entityType, now, now)
      .run();
  } catch (error) {
    console.error("Error logging usage:", error);
  }
}

// ============================================
// Authentication Routes
// ============================================

app.get("/api/oauth/google/redirect_url", (c) => {
  const origin = new URL(c.req.url).origin;
  const redirectUri = `${origin}/auth/callback`;
  const url =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(c.env.GOOGLE_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=openid%20email%20profile`;
  return c.json({ success: true, data: { redirect_url: url } });
});

app.post("/api/sessions", async (c) => {
  try {
    const body = await c.req.json();
    if (!body.code) {
      return c.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Código de autorización no proporcionado" } },
        400
      );
    }

    const origin = new URL(c.req.url).origin;
    const redirectUri = `${origin}/auth/callback`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: body.code,
        client_id: c.env.GOOGLE_CLIENT_ID,
        client_secret: c.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.json() as { error_description?: string };
      console.error("Google token exchange error:", err);
      return c.json(
        { success: false, error: { code: "AUTH_ERROR", message: "Error al procesar la autenticación" } },
        500
      );
    }

    const { access_token } = await tokenRes.json() as { access_token: string };

    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const googleUser = await userRes.json() as { id: string; email: string; name: string; picture: string };

    // Check if user exists and their verification status before UPSERT
    const existingUser = await c.env.DB
      .prepare("SELECT id, email_verified FROM users WHERE id = ?")
      .bind(googleUser.id)
      .first<{ id: string; email_verified: number }>();

    // UPSERT — email_verified is intentionally excluded from DO UPDATE to preserve it
    await c.env.DB
      .prepare(
        `INSERT INTO users (id, email, name, picture, role, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'usuario_basico', datetime('now'), datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
           email = excluded.email,
           name = excluded.name,
           picture = excluded.picture,
           updated_at = excluded.updated_at`
      )
      .bind(googleUser.id, googleUser.email, googleUser.name, googleUser.picture ?? "")
      .run();

    const isVerified = existingUser?.email_verified === 1;

    if (!isVerified) {
      // New or unverified user — send verification email, do not create session
      // Invalidate any previous unused tokens for this user
      await c.env.DB
        .prepare("UPDATE email_verification_tokens SET used_at = datetime('now') WHERE user_id = ? AND used_at IS NULL")
        .bind(googleUser.id)
        .run();

      const plainToken = await generateToken();
      const tokenHash = await hashToken(plainToken);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      await c.env.DB
        .prepare(
          `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
           VALUES (?, ?, ?)`
        )
        .bind(googleUser.id, tokenHash, expiresAt)
        .run();

      const origin = new URL(c.req.url).origin;
      const verifyUrl = `${origin}/verify-email?token=${plainToken}`;

      await sendVerificationEmail(c.env.RESEND_API_KEY, googleUser.email, googleUser.name, verifyUrl);

      return c.json(
        { success: false, error: { code: "PENDING_VERIFICATION", message: `Revisá tu email. Te enviamos un correo a ${googleUser.email}` } },
        200
      );
    }

    const dbUser = await c.env.DB
      .prepare("SELECT role FROM users WHERE id = ?")
      .bind(googleUser.id)
      .first<{ role: string }>();

    const jwt = await createSession(
      { id: googleUser.id, email: googleUser.email, name: googleUser.name, picture: googleUser.picture ?? "", role: dbUser?.role ?? "usuario_basico" },
      c.env.JWT_SECRET
    );

    c.header("Set-Cookie", `${COOKIE_NAME}=${jwt}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`);
    return c.json({ success: true }, 200);
  } catch (error) {
    console.error("Error exchanging code for session:", error);
    return c.json(
      { success: false, error: { code: "AUTH_ERROR", message: "Error al procesar la autenticación" } },
      500
    );
  }
});

app.get("/api/auth/verify-email", async (c) => {
  const token = c.req.query("token");
  if (!token) return c.redirect("/login?error=invalid_token");

  try {
    const tokenHash = await hashToken(token);

    const row = await c.env.DB
      .prepare(
        `SELECT evt.id, evt.user_id, evt.expires_at, evt.used_at,
                u.email, u.name, u.picture, u.role
         FROM email_verification_tokens evt
         JOIN users u ON u.id = evt.user_id
         WHERE evt.token_hash = ?`
      )
      .bind(tokenHash)
      .first<{ id: number; user_id: string; expires_at: string; used_at: string | null; email: string; name: string; picture: string; role: string }>();

    if (!row) return c.redirect("/login?error=invalid_token");
    if (row.used_at !== null) return c.redirect("/verify-email?error=token_used");
    if (new Date(row.expires_at) < new Date()) return c.redirect("/verify-email?error=token_expired");

    // Mark token as used and user as verified atomically
    await c.env.DB.batch([
      c.env.DB.prepare("UPDATE email_verification_tokens SET used_at = datetime('now') WHERE id = ?").bind(row.id),
      c.env.DB.prepare("UPDATE users SET email_verified = 1, updated_at = datetime('now') WHERE id = ?").bind(row.user_id),
    ]);

    const jwt = await createSession(
      { id: row.user_id, email: row.email, name: row.name, picture: row.picture, role: row.role },
      c.env.JWT_SECRET
    );

    c.header("Set-Cookie", `${COOKIE_NAME}=${jwt}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`);
    return c.json({ success: true }, 200);
  } catch (error) {
    console.error("Error verifying email:", error);
    return c.redirect("/login?error=invalid_token");
  }
});

app.get("/api/users/me", authMiddleware, (c) => {
  return c.json({ success: true, data: c.get("user") });
});

app.get("/api/logout", (c) => {
  c.header("Set-Cookie", `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
  return c.json({ success: true }, 200);
});

// ============================================
// Negocio Routes (Protected)
// ============================================

// Create negocio
app.post("/api/negocios", authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const db = c.env.DB;

    const validation = validateData(createNegocioSchema, body);
    if (!validation.success) {
      return c.json(apiError("VALIDATION_ERROR", validation.error || "Datos inválidos"), 400);
    }
    const validData = validation.data!;

    const user = c.get("user");
    const now = new Date().toISOString();
    const result = await db
      .prepare("INSERT INTO negocios (name, created_by, created_at, updated_at) VALUES (?, ?, ?, ?)")
      .bind(validData.name.trim(), user.id, now, now)
      .run();

    const negocioId = result.meta.last_row_id;

    // Add creator as first member with owner role
    await db
      .prepare(
        "INSERT INTO negocio_members (negocio_id, user_id, user_email, user_name, invited_by, joined_at, negocio_role) VALUES (?, ?, ?, ?, ?, ?, 'owner')"
      )
      .bind(negocioId, user.id, user.email, user.name, user.id, now)
      .run();

    const negocio = await db.prepare("SELECT * FROM negocios WHERE id = ?").bind(negocioId).first();
    return c.json(apiResponse(negocio), 201);
  } catch (error) {
    console.error("Error creating negocio:", error);
    return c.json(apiError("CREATE_ERROR", "No pudimos crear el negocio. Intenta de nuevo."), 500);
  }
});

// List negocios for current user
app.get("/api/negocios", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const db = c.env.DB;

    const negocios = await db
      .prepare(
        `SELECT n.*,
          (SELECT COUNT(*) FROM negocio_members WHERE negocio_id = n.id) as member_count,
          nm.negocio_role as my_role
         FROM negocios n
         JOIN negocio_members nm ON n.id = nm.negocio_id
         WHERE nm.user_id = ?
         ORDER BY n.created_at ASC`
      )
      .bind(user.id)
      .all();

    return c.json(apiResponse(negocios.results), 200);
  } catch (error) {
    console.error("Error fetching negocios:", error);
    return c.json(apiError("FETCH_ERROR", "Error al obtener negocios"), 500);
  }
});

// Get negocio detail + members
app.get("/api/negocios/:id", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const negocioId = c.req.param("id");
    const db = c.env.DB;

    // Verify membership
    const member = await db
      .prepare("SELECT negocio_id FROM negocio_members WHERE negocio_id = ? AND user_id = ?")
      .bind(negocioId, user.id)
      .first();

    if (!member) {
      return c.json(apiError("NEGOCIO_ACCESS_DENIED", "No tienes acceso a este negocio"), 403);
    }

    const negocio = await db
      .prepare("SELECT * FROM negocios WHERE id = ?")
      .bind(negocioId)
      .first();

    if (!negocio) {
      return c.json(apiError("NEGOCIO_NOT_FOUND", "Negocio no encontrado"), 404);
    }

    const members = await db
      .prepare(
        "SELECT user_id, user_email, user_name, invited_by, joined_at, negocio_role FROM negocio_members WHERE negocio_id = ? ORDER BY joined_at ASC"
      )
      .bind(negocioId)
      .all();

    return c.json(apiResponse({ ...negocio, members: members.results }), 200);
  } catch (error) {
    console.error("Error fetching negocio:", error);
    return c.json(apiError("FETCH_ERROR", "Error al obtener el negocio"), 500);
  }
});

// Generate invitation link
app.post("/api/negocios/:id/invitations", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const negocioId = Number(c.req.param("id"));
    const db = c.env.DB;

    // Verify membership
    const member = await db
      .prepare("SELECT negocio_id FROM negocio_members WHERE negocio_id = ? AND user_id = ?")
      .bind(negocioId, user.id)
      .first();

    if (!member) {
      return c.json(apiError("NEGOCIO_ACCESS_DENIED", "No tienes acceso a este negocio"), 403);
    }

    // Enforce max 10 active invitations per negocio
    const now = new Date().toISOString();
    const activeCount = await db
      .prepare(
        "SELECT COUNT(*) as count FROM invitations WHERE negocio_id = ? AND used_at IS NULL AND expires_at > ?"
      )
      .bind(negocioId, now)
      .first() as { count: number } | null;

    if ((activeCount?.count ?? 0) >= 10) {
      return c.json(apiError("INVITATION_LIMIT", "Límite de invitaciones activas alcanzado. Espera que se usen o expiren las anteriores."), 429);
    }

    const token = await generateToken();
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    await db
      .prepare(
        "INSERT INTO invitations (negocio_id, token_hash, invited_by, expires_at, created_at) VALUES (?, ?, ?, ?, ?)"
      )
      .bind(negocioId, tokenHash, user.id, expiresAt, now)
      .run();

    const origin = new URL(c.req.url).origin;
    const inviteUrl = `${origin}/invite/${token}`;

    return c.json(apiResponse({ token, expires_at: expiresAt, invite_url: inviteUrl }), 201);
  } catch (error) {
    console.error("Error creating invitation:", error);
    return c.json(apiError("CREATE_ERROR", "No pudimos generar la invitación. Intenta de nuevo."), 500);
  }
});

// Preview invitation (public — no auth required)
app.get("/api/invitations/:token", async (c) => {
  try {
    const token = c.req.param("token");
    const db = c.env.DB;

    const tokenHash = await hashToken(token);
    const now = new Date().toISOString();

    const invitation = await db
      .prepare(
        `SELECT i.id, i.negocio_id, i.invited_by, i.expires_at,
          n.name as negocio_name,
          nm.user_name as invited_by_name
         FROM invitations i
         JOIN negocios n ON i.negocio_id = n.id
         LEFT JOIN negocio_members nm ON nm.negocio_id = i.negocio_id AND nm.user_id = i.invited_by
         WHERE i.token_hash = ? AND i.used_at IS NULL AND i.expires_at > ?`
      )
      .bind(tokenHash, now)
      .first() as any;

    if (!invitation) {
      // Same error for invalid, expired, or used tokens — no info leakage
      return c.json(apiError("INVITATION_NOT_FOUND", "Esta invitación no existe, ya fue usada o expiró."), 404);
    }

    return c.json(apiResponse({
      negocio_name: invitation.negocio_name,
      invited_by_name: invitation.invited_by_name || "Un miembro del equipo",
      expires_at: invitation.expires_at,
    }), 200);
  } catch (error) {
    console.error("Error fetching invitation:", error);
    return c.json(apiError("FETCH_ERROR", "Error al obtener la invitación"), 500);
  }
});

// Redeem invitation (requires auth)
app.post("/api/invitations/:token/redeem", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const token = c.req.param("token");
    const db = c.env.DB;

    const tokenHash = await hashToken(token);
    const now = new Date().toISOString();

    const invitation = await db
      .prepare(
        "SELECT id, negocio_id FROM invitations WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?"
      )
      .bind(tokenHash, now)
      .first() as { id: number; negocio_id: number } | null;

    if (!invitation) {
      return c.json(apiError("INVITATION_NOT_FOUND", "Esta invitación no existe, ya fue usada o expiró."), 404);
    }

    // Check if already a member
    const existing = await db
      .prepare("SELECT negocio_id FROM negocio_members WHERE negocio_id = ? AND user_id = ?")
      .bind(invitation.negocio_id, user.id)
      .first();

    if (existing) {
      return c.json(apiError("ALREADY_MEMBER", "Ya eres miembro de este negocio."), 409);
    }

    // Insert member
    await db
      .prepare(
        "INSERT INTO negocio_members (negocio_id, user_id, user_email, user_name, invited_by, joined_at) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .bind(invitation.negocio_id, user.id, user.email, user.name, invitation.id, now)
      .run();

    // Burn the token
    await db
      .prepare("UPDATE invitations SET used_at = ?, used_by = ? WHERE id = ?")
      .bind(now, user.id, invitation.id)
      .run();

    const negocio = await db
      .prepare("SELECT id, name FROM negocios WHERE id = ?")
      .bind(invitation.negocio_id)
      .first() as { id: number; name: string } | null;

    return c.json(apiResponse({ negocio_id: invitation.negocio_id, negocio_name: negocio?.name }), 200);
  } catch (error) {
    console.error("Error redeeming invitation:", error);
    return c.json(apiError("REDEEM_ERROR", "No pudimos procesar la invitación. Intenta de nuevo."), 500);
  }
});

// Remove a member (creator only)
app.delete("/api/negocios/:id/members/:userId", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const negocioId = c.req.param("id");
    const targetUserId = c.req.param("userId");
    const db = c.env.DB;

    // Verify caller is creator
    const negocio = await db
      .prepare("SELECT created_by FROM negocios WHERE id = ?")
      .bind(negocioId)
      .first() as { created_by: string } | null;

    if (!negocio) {
      return c.json(apiError("NEGOCIO_NOT_FOUND", "Negocio no encontrado"), 404);
    }

    if (negocio.created_by !== user.id) {
      return c.json(apiError("NEGOCIO_ACCESS_DENIED", "Solo el creador puede remover miembros"), 403);
    }

    if (targetUserId === user.id) {
      return c.json(apiError("CANNOT_REMOVE_SELF", "No puedes removerte a ti mismo como creador. Usa la opción de salir."), 400);
    }

    const member = await db
      .prepare("SELECT negocio_id FROM negocio_members WHERE negocio_id = ? AND user_id = ?")
      .bind(negocioId, targetUserId)
      .first();

    if (!member) {
      return c.json(apiError("NOT_FOUND", "Miembro no encontrado"), 404);
    }

    await db
      .prepare("DELETE FROM negocio_members WHERE negocio_id = ? AND user_id = ?")
      .bind(negocioId, targetUserId)
      .run();

    return c.json(apiResponse({ removed: true }), 200);
  } catch (error) {
    console.error("Error removing member:", error);
    return c.json(apiError("DELETE_ERROR", "Error al remover miembro"), 500);
  }
});

// Leave a negocio
app.delete("/api/negocios/:id/leave", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const negocioId = c.req.param("id");
    const db = c.env.DB;

    const negocio = await db
      .prepare("SELECT created_by FROM negocios WHERE id = ?")
      .bind(negocioId)
      .first() as { created_by: string } | null;

    if (!negocio) {
      return c.json(apiError("NEGOCIO_NOT_FOUND", "Negocio no encontrado"), 404);
    }

    // Verify membership
    const membership = await db
      .prepare("SELECT negocio_id FROM negocio_members WHERE negocio_id = ? AND user_id = ?")
      .bind(negocioId, user.id)
      .first();

    if (!membership) {
      return c.json(apiError("NEGOCIO_ACCESS_DENIED", "No eres miembro de este negocio"), 403);
    }

    // Creator cannot leave if there are other members
    if (negocio.created_by === user.id) {
      const memberCount = await db
        .prepare("SELECT COUNT(*) as count FROM negocio_members WHERE negocio_id = ?")
        .bind(negocioId)
        .first() as { count: number } | null;

      if ((memberCount?.count ?? 0) > 1) {
        return c.json(apiError("CREATOR_CANNOT_LEAVE", "Debes remover a todos los miembros antes de salir del negocio."), 400);
      }
    }

    // Last owner cannot leave if there are other members
    const memberRole = await db
      .prepare("SELECT negocio_role FROM negocio_members WHERE negocio_id = ? AND user_id = ?")
      .bind(negocioId, user.id)
      .first() as { negocio_role: string } | null;

    if (memberRole?.negocio_role === 'owner') {
      const ownerCount = await db
        .prepare("SELECT COUNT(*) as count FROM negocio_members WHERE negocio_id = ? AND negocio_role = 'owner'")
        .bind(negocioId)
        .first() as { count: number } | null;

      const totalCount = await db
        .prepare("SELECT COUNT(*) as count FROM negocio_members WHERE negocio_id = ?")
        .bind(negocioId)
        .first() as { count: number } | null;

      if ((ownerCount?.count ?? 0) <= 1 && (totalCount?.count ?? 0) > 1) {
        return c.json(apiError("LAST_OWNER_CANNOT_LEAVE", "Eres el único owner. Aprueba otro owner antes de salir."), 409);
      }
    }

    await db
      .prepare("DELETE FROM negocio_members WHERE negocio_id = ? AND user_id = ?")
      .bind(negocioId, user.id)
      .run();

    return c.json(apiResponse({ left: true }), 200);
  } catch (error) {
    console.error("Error leaving negocio:", error);
    return c.json(apiError("DELETE_ERROR", "Error al salir del negocio"), 500);
  }
});

// ============================================
// Owner role system
// ============================================

// Get current user's owner status in a negocio
app.get("/api/negocios/:id/my-owner-request", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const negocioId = Number(c.req.param("id"));
    const db = c.env.DB;

    const membership = await db
      .prepare("SELECT negocio_role FROM negocio_members WHERE negocio_id = ? AND user_id = ?")
      .bind(negocioId, user.id)
      .first<{ negocio_role: string }>();

    if (!membership) {
      return c.json(apiError("NEGOCIO_ACCESS_DENIED", "No eres miembro de este negocio"), 403);
    }

    if (membership.negocio_role === 'owner') {
      return c.json(apiResponse({ status: 'owner' }), 200);
    }

    const pendingRequest = await db
      .prepare("SELECT id FROM owner_requests WHERE negocio_id = ? AND user_id = ? AND status = 'pending'")
      .bind(negocioId, user.id)
      .first();

    return c.json(apiResponse({ status: pendingRequest ? 'pending' : 'none' }), 200);
  } catch (error) {
    console.error("Error fetching owner request status:", error);
    return c.json(apiError("FETCH_ERROR", "Error al obtener estado"), 500);
  }
});

// Request to become owner
app.post("/api/negocios/:id/request-owner", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const negocioId = Number(c.req.param("id"));
    const db = c.env.DB;

    const membership = await db
      .prepare("SELECT negocio_role FROM negocio_members WHERE negocio_id = ? AND user_id = ?")
      .bind(negocioId, user.id)
      .first<{ negocio_role: string }>();

    if (!membership) {
      return c.json(apiError("NEGOCIO_ACCESS_DENIED", "No eres miembro de este negocio"), 403);
    }

    if (membership.negocio_role === 'owner') {
      return c.json(apiError("ALREADY_OWNER", "Ya eres owner de este negocio"), 409);
    }

    const pendingRequest = await db
      .prepare("SELECT id FROM owner_requests WHERE negocio_id = ? AND user_id = ? AND status = 'pending'")
      .bind(negocioId, user.id)
      .first();

    if (pendingRequest) {
      return c.json(apiError("REQUEST_PENDING", "Ya tienes una solicitud pendiente"), 409);
    }

    const now = new Date().toISOString();

    // Delete any previous rejected request first to avoid UNIQUE(negocio_id, user_id, status) violation
    await db
      .prepare("DELETE FROM owner_requests WHERE negocio_id = ? AND user_id = ? AND status = 'rejected'")
      .bind(negocioId, user.id)
      .run();
    await db
      .prepare("INSERT INTO owner_requests (negocio_id, user_id, requested_at) VALUES (?, ?, ?)")
      .bind(negocioId, user.id, now)
      .run();

    return c.json(apiResponse({ status: 'pending' }), 200);
  } catch (error) {
    console.error("Error requesting owner:", error);
    return c.json(apiError("CREATE_ERROR", "Error al solicitar ser owner"), 500);
  }
});

// List pending owner requests (owner only)
app.get("/api/negocios/:id/owner-requests", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const negocioId = Number(c.req.param("id"));
    const db = c.env.DB;

    const membership = await db
      .prepare("SELECT negocio_role FROM negocio_members WHERE negocio_id = ? AND user_id = ?")
      .bind(negocioId, user.id)
      .first<{ negocio_role: string }>();

    if (!membership || membership.negocio_role !== 'owner') {
      return c.json(apiError("NEGOCIO_ACCESS_DENIED", "Solo los owners pueden ver las solicitudes"), 403);
    }

    const requests = await db
      .prepare(
        `SELECT or2.id, or2.negocio_id, or2.user_id, or2.status, or2.requested_at,
                nm.user_name, nm.user_email
         FROM owner_requests or2
         JOIN negocio_members nm ON nm.negocio_id = or2.negocio_id AND nm.user_id = or2.user_id
         WHERE or2.negocio_id = ? AND or2.status = 'pending'
         ORDER BY or2.requested_at ASC`
      )
      .bind(negocioId)
      .all();

    return c.json(apiResponse(requests.results), 200);
  } catch (error) {
    console.error("Error fetching owner requests:", error);
    return c.json(apiError("FETCH_ERROR", "Error al obtener solicitudes"), 500);
  }
});

// Approve owner request (owner only)
app.post("/api/negocios/:id/owner-requests/:requestId/approve", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const negocioId = Number(c.req.param("id"));
    const requestId = Number(c.req.param("requestId"));
    const db = c.env.DB;

    const membership = await db
      .prepare("SELECT negocio_role FROM negocio_members WHERE negocio_id = ? AND user_id = ?")
      .bind(negocioId, user.id)
      .first<{ negocio_role: string }>();

    if (!membership || membership.negocio_role !== 'owner') {
      return c.json(apiError("NEGOCIO_ACCESS_DENIED", "Solo los owners pueden aprobar solicitudes"), 403);
    }

    const request = await db
      .prepare("SELECT user_id, status FROM owner_requests WHERE id = ? AND negocio_id = ?")
      .bind(requestId, negocioId)
      .first<{ user_id: string; status: string }>();

    if (!request) {
      return c.json(apiError("NOT_FOUND", "Solicitud no encontrada"), 404);
    }

    if (request.status !== 'pending') {
      return c.json(apiError("REQUEST_NOT_PENDING", "La solicitud ya fue procesada"), 409);
    }

    const now = new Date().toISOString();
    await db.batch([
      db.prepare("UPDATE negocio_members SET negocio_role = 'owner' WHERE negocio_id = ? AND user_id = ?")
        .bind(negocioId, request.user_id),
      db.prepare("UPDATE owner_requests SET status = 'approved', resolved_at = ?, resolved_by = ? WHERE id = ?")
        .bind(now, user.id, requestId),
    ]);

    return c.json(apiResponse({ approved: true }), 200);
  } catch (error) {
    console.error("Error approving owner request:", error);
    return c.json(apiError("UPDATE_ERROR", "Error al aprobar la solicitud"), 500);
  }
});

// Reject owner request (owner only)
app.post("/api/negocios/:id/owner-requests/:requestId/reject", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const negocioId = Number(c.req.param("id"));
    const requestId = Number(c.req.param("requestId"));
    const db = c.env.DB;

    const membership = await db
      .prepare("SELECT negocio_role FROM negocio_members WHERE negocio_id = ? AND user_id = ?")
      .bind(negocioId, user.id)
      .first<{ negocio_role: string }>();

    if (!membership || membership.negocio_role !== 'owner') {
      return c.json(apiError("NEGOCIO_ACCESS_DENIED", "Solo los owners pueden rechazar solicitudes"), 403);
    }

    const request = await db
      .prepare("SELECT status FROM owner_requests WHERE id = ? AND negocio_id = ?")
      .bind(requestId, negocioId)
      .first<{ status: string }>();

    if (!request) {
      return c.json(apiError("NOT_FOUND", "Solicitud no encontrada"), 404);
    }

    if (request.status !== 'pending') {
      return c.json(apiError("REQUEST_NOT_PENDING", "La solicitud ya fue procesada"), 409);
    }

    const now = new Date().toISOString();
    await db
      .prepare("UPDATE owner_requests SET status = 'rejected', resolved_at = ?, resolved_by = ? WHERE id = ?")
      .bind(now, user.id, requestId)
      .run();

    return c.json(apiResponse({ rejected: true }), 200);
  } catch (error) {
    console.error("Error rejecting owner request:", error);
    return c.json(apiError("UPDATE_ERROR", "Error al rechazar la solicitud"), 500);
  }
});

// Get module restrictions for a negocio
app.get("/api/negocios/:id/module-restrictions", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const negocioId = Number(c.req.param("id"));
    const db = c.env.DB;

    const membership = await db
      .prepare("SELECT negocio_id FROM negocio_members WHERE negocio_id = ? AND user_id = ?")
      .bind(negocioId, user.id)
      .first();

    if (!membership) {
      return c.json(apiError("NEGOCIO_ACCESS_DENIED", "No tienes acceso a este negocio"), 403);
    }

    const rows = await db
      .prepare("SELECT module_key, is_restricted FROM negocio_module_restrictions WHERE negocio_id = ?")
      .bind(negocioId)
      .all<{ module_key: string; is_restricted: number }>();

    const data: Record<string, boolean> = {
      calendario: false,
      personal: false,
      sueldos: false,
      compras: false,
      facturacion: false,
    };

    for (const row of rows.results) {
      data[row.module_key] = row.is_restricted === 1;
    }

    return c.json(apiResponse(data), 200);
  } catch (error) {
    console.error("Error fetching module restrictions:", error);
    return c.json(apiError("FETCH_ERROR", "Error al obtener restricciones"), 500);
  }
});

// Update module restriction (owner only)
app.put("/api/negocios/:id/module-restrictions", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const negocioId = Number(c.req.param("id"));
    const db = c.env.DB;

    const membership = await db
      .prepare("SELECT negocio_role FROM negocio_members WHERE negocio_id = ? AND user_id = ?")
      .bind(negocioId, user.id)
      .first<{ negocio_role: string }>();

    if (!membership || membership.negocio_role !== 'owner') {
      return c.json(apiError("NEGOCIO_ACCESS_DENIED", "Solo los owners pueden cambiar restricciones"), 403);
    }

    const body = await c.req.json() as { module_key?: string; is_restricted?: boolean };
    const VALID_KEYS = ['calendario', 'personal', 'sueldos', 'compras', 'facturacion'];

    if (!body.module_key || !VALID_KEYS.includes(body.module_key) || typeof body.is_restricted !== 'boolean') {
      return c.json(apiError("VALIDATION_ERROR", "module_key y is_restricted son requeridos"), 400);
    }

    const now = new Date().toISOString();
    await db
      .prepare(
        `INSERT INTO negocio_module_restrictions (negocio_id, module_key, is_restricted, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(negocio_id, module_key) DO UPDATE SET
           is_restricted = excluded.is_restricted,
           updated_at    = excluded.updated_at`
      )
      .bind(negocioId, body.module_key, body.is_restricted ? 1 : 0, now)
      .run();

    return c.json(apiResponse({ module_key: body.module_key, is_restricted: body.is_restricted }), 200);
  } catch (error) {
    console.error("Error updating module restriction:", error);
    return c.json(apiError("UPDATE_ERROR", "Error al actualizar restricción"), 500);
  }
});

// ============================================
// Módulos de usuario (Protected, no negocio)
// ============================================

const VALID_MODULE_KEYS = ["calendario", "personal", "sueldos", "compras", "facturacion"] as const;
type ModuleKey = (typeof VALID_MODULE_KEYS)[number];

app.get("/api/modules/prefs", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const db = c.env.DB;

    const rows = await db
      .prepare("SELECT module_key, is_active FROM user_module_prefs WHERE user_id = ?")
      .bind(user.id)
      .all<{ module_key: string; is_active: number }>();

    const data: Record<string, boolean> = {
      calendario: true,
      personal: true,
      sueldos: true,
      compras: true,
      facturacion: true,
    };

    for (const row of rows.results) {
      if (VALID_MODULE_KEYS.includes(row.module_key as ModuleKey)) {
        data[row.module_key] = row.is_active === 1;
      }
    }

    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching module prefs:", error);
    return c.json(apiError("FETCH_ERROR", "Error al obtener preferencias de módulos"), 500);
  }
});

app.put("/api/modules/prefs", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const db = c.env.DB;
    const body = await c.req.json<{ module_key: string; is_active: boolean }>();

    if (!VALID_MODULE_KEYS.includes(body.module_key as ModuleKey)) {
      return c.json(apiError("INVALID_MODULE", "Módulo no válido"), 400);
    }
    if (typeof body.is_active !== "boolean") {
      return c.json(apiError("INVALID_VALUE", "is_active debe ser boolean"), 400);
    }

    await db
      .prepare(
        `INSERT INTO user_module_prefs (user_id, module_key, is_active, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(user_id, module_key) DO UPDATE SET
           is_active  = excluded.is_active,
           updated_at = excluded.updated_at`
      )
      .bind(user.id, body.module_key, body.is_active ? 1 : 0)
      .run();

    return c.json({ success: true, data: { module_key: body.module_key, is_active: body.is_active } });
  } catch (error) {
    console.error("Error updating module prefs:", error);
    return c.json(apiError("UPDATE_ERROR", "Error al actualizar preferencias de módulos"), 500);
  }
});

// ============================================
// Employee Routes (Protected + Negocio)
// ============================================

app.get("/api/employees", authMiddleware, negocioMiddleware, createModuleRestrictionMiddleware('personal'), async (c) => {
  try {
    const user = c.get("user");
    const negocio = c.get("negocio");
    const db = c.env.DB;

    const employees = await db
      .prepare(
        `SELECT e.*,
          (SELECT COUNT(*) FROM topics WHERE employee_id = e.id) as topics_count
         FROM employees e
         WHERE e.negocio_id = ?
         ORDER BY e.name ASC`
      )
      .bind(negocio.id)
      .all();

    await logUsage(db, user.id, negocio.id, "view", "employee");
    return c.json(apiResponse(employees.results), 200);
  } catch (error) {
    console.error("Error fetching employees:", error);
    return c.json(apiError("FETCH_ERROR", "Error al obtener empleados"), 500);
  }
});

app.get("/api/employees/:id", authMiddleware, negocioMiddleware, createModuleRestrictionMiddleware('personal'), async (c) => {
  try {
    const negocio = c.get("negocio");
    const employeeId = c.req.param("id");
    const db = c.env.DB;

    const employee = await db
      .prepare(
        `SELECT e.*,
          (SELECT COUNT(*) FROM topics WHERE employee_id = e.id) as topics_count
         FROM employees e
         WHERE e.id = ? AND e.negocio_id = ?`
      )
      .bind(employeeId, negocio.id)
      .first();

    if (!employee) {
      return c.json(apiError("NOT_FOUND", "Empleado no encontrado"), 404);
    }

    return c.json(apiResponse(employee), 200);
  } catch (error) {
    console.error("Error fetching employee:", error);
    return c.json(apiError("FETCH_ERROR", "Error al obtener empleado"), 500);
  }
});

app.post("/api/employees", authMiddleware, negocioMiddleware, createModuleRestrictionMiddleware('personal'), createUsageLimitMiddleware(USAGE_TOOLS.EMPLOYEES), async (c) => {
  try {
    const user = c.get("user");
    const negocio = c.get("negocio");
    const body = await c.req.json();
    const db = c.env.DB;

    const validation = validateData(createEmployeeSchema, body);
    if (!validation.success) {
      return c.json(apiError("VALIDATION_ERROR", validation.error || "Datos inválidos"), 400);
    }
    const validData = validation.data!;

    const now = new Date().toISOString();
    const result = await db
      .prepare(
        `INSERT INTO employees (negocio_id, user_id, name, role, phone, email, hire_date, is_active, monthly_salary, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        negocio.id,
        user.id,
        validData.name,
        validData.role,
        validData.phone || null,
        validData.email || null,
        validData.hire_date || null,
        validData.is_active !== undefined ? (validData.is_active ? 1 : 0) : 1,
        validData.monthly_salary || 0,
        now,
        now
      )
      .run();

    const newEmployee = await db
      .prepare("SELECT * FROM employees WHERE id = ?")
      .bind(result.meta.last_row_id)
      .first();

    await logUsage(db, user.id, negocio.id, "create", "employee");
    return c.json(apiResponse(newEmployee), 201);
  } catch (error) {
    console.error("Error creating employee:", error);
    return c.json(apiError("CREATE_ERROR", "Error al crear empleado"), 500);
  }
});

app.put("/api/employees/:id", authMiddleware, negocioMiddleware, createModuleRestrictionMiddleware('personal'), async (c) => {
  try {
    const user = c.get("user");
    const negocio = c.get("negocio");
    const employeeId = c.req.param("id");
    const body = await c.req.json();
    const db = c.env.DB;

    const validation = validateData(updateEmployeeSchema, body);
    if (!validation.success) {
      return c.json(apiError("VALIDATION_ERROR", validation.error || "Datos inválidos"), 400);
    }
    const validData = validation.data!;

    const existing = await db
      .prepare("SELECT id FROM employees WHERE id = ? AND negocio_id = ?")
      .bind(employeeId, negocio.id)
      .first();

    if (!existing) {
      return c.json(apiError("NOT_FOUND", "Empleado no encontrado"), 404);
    }

    const now = new Date().toISOString();
    await db
      .prepare(
        `UPDATE employees SET
          name = COALESCE(?, name),
          role = COALESCE(?, role),
          phone = ?,
          email = ?,
          hire_date = ?,
          is_active = COALESCE(?, is_active),
          monthly_salary = COALESCE(?, monthly_salary),
          updated_at = ?
         WHERE id = ? AND negocio_id = ?`
      )
      .bind(
        validData.name || null,
        validData.role || null,
        validData.phone || null,
        validData.email || null,
        validData.hire_date || null,
        validData.is_active !== undefined ? (validData.is_active ? 1 : 0) : null,
        validData.monthly_salary !== undefined ? validData.monthly_salary : null,
        now,
        employeeId,
        negocio.id
      )
      .run();

    const updated = await db
      .prepare("SELECT * FROM employees WHERE id = ?")
      .bind(employeeId)
      .first();

    await logUsage(db, user.id, negocio.id, "update", "employee");
    return c.json(apiResponse(updated), 200);
  } catch (error) {
    console.error("Error updating employee:", error);
    return c.json(apiError("UPDATE_ERROR", "Error al actualizar empleado"), 500);
  }
});

app.delete("/api/employees/:id", authMiddleware, negocioMiddleware, createModuleRestrictionMiddleware('personal'), async (c) => {
  try {
    const user = c.get("user");
    const negocio = c.get("negocio");
    const employeeId = c.req.param("id");
    const db = c.env.DB;

    const existing = await db
      .prepare("SELECT id FROM employees WHERE id = ? AND negocio_id = ?")
      .bind(employeeId, negocio.id)
      .first();

    if (!existing) {
      return c.json(apiError("NOT_FOUND", "Empleado no encontrado"), 404);
    }

    await db
      .prepare("DELETE FROM notes WHERE topic_id IN (SELECT id FROM topics WHERE employee_id = ?)")
      .bind(employeeId)
      .run();
    await db.prepare("DELETE FROM topics WHERE employee_id = ?").bind(employeeId).run();
    await db.prepare("DELETE FROM employees WHERE id = ?").bind(employeeId).run();

    await logUsage(db, user.id, negocio.id, "delete", "employee");
    return c.json(apiResponse({ deleted: true }), 200);
  } catch (error) {
    console.error("Error deleting employee:", error);
    return c.json(apiError("DELETE_ERROR", "Error al eliminar empleado"), 500);
  }
});

// ============================================
// Job Roles Routes (Protected + Negocio)
// ============================================

app.get("/api/job-roles", authMiddleware, negocioMiddleware, createModuleRestrictionMiddleware('personal'), async (c) => {
  try {
    const negocio = c.get("negocio");
    const db = c.env.DB;

    const roles = await db
      .prepare("SELECT * FROM job_roles WHERE negocio_id = ? ORDER BY name ASC")
      .bind(negocio.id)
      .all();

    return c.json(apiResponse(roles.results), 200);
  } catch (error) {
    console.error("Error fetching job roles:", error);
    return c.json(apiError("FETCH_ERROR", "Error al obtener puestos"), 500);
  }
});

app.post("/api/job-roles", authMiddleware, negocioMiddleware, createModuleRestrictionMiddleware('personal'), createUsageLimitMiddleware(USAGE_TOOLS.JOB_ROLES), async (c) => {
  try {
    const negocio = c.get("negocio");
    const user = c.get("user");
    const body = await c.req.json();
    const db = c.env.DB;

    const validation = validateData(createJobRoleSchema, body);
    if (!validation.success) {
      return c.json(apiError("VALIDATION_ERROR", validation.error || "Datos inválidos"), 400);
    }
    const validData = validation.data!;

    const now = new Date().toISOString();
    const result = await db
      .prepare("INSERT INTO job_roles (negocio_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)")
      .bind(negocio.id, validData.name.trim(), now, now)
      .run();

    const newRole = await db
      .prepare("SELECT * FROM job_roles WHERE id = ?")
      .bind(result.meta.last_row_id)
      .first();

    await logUsage(db, user.id, negocio.id, "create", "job_role");
    return c.json(apiResponse(newRole), 201);
  } catch (error) {
    console.error("Error creating job role:", error);
    return c.json(apiError("CREATE_ERROR", "Error al crear puesto"), 500);
  }
});

app.delete("/api/job-roles/:id", authMiddleware, negocioMiddleware, createModuleRestrictionMiddleware('personal'), async (c) => {
  try {
    const negocio = c.get("negocio");
    const roleId = c.req.param("id");
    const db = c.env.DB;

    const role = await db
      .prepare("SELECT id FROM job_roles WHERE id = ? AND negocio_id = ?")
      .bind(roleId, negocio.id)
      .first();

    if (!role) {
      return c.json(apiError("NOT_FOUND", "Puesto no encontrado"), 404);
    }

    await db.prepare("DELETE FROM job_roles WHERE id = ?").bind(roleId).run();

    return c.json(apiResponse({ id: roleId }), 200);
  } catch (error) {
    console.error("Error deleting job role:", error);
    return c.json(apiError("DELETE_ERROR", "Error al eliminar puesto"), 500);
  }
});

// ============================================
// Topic Routes (Protected + Negocio)
// ============================================

app.get("/api/employees/:employeeId/topics", authMiddleware, negocioMiddleware, createModuleRestrictionMiddleware('personal'), async (c) => {
  try {
    const negocio = c.get("negocio");
    const employeeId = c.req.param("employeeId");
    const db = c.env.DB;

    const employee = await db
      .prepare("SELECT id FROM employees WHERE id = ? AND negocio_id = ?")
      .bind(employeeId, negocio.id)
      .first();

    if (!employee) {
      return c.json(apiError("NOT_FOUND", "Empleado no encontrado"), 404);
    }

    const topics = await db
      .prepare(
        `SELECT t.*,
          (SELECT COUNT(*) FROM notes WHERE topic_id = t.id) as notes_count,
          (SELECT MAX(created_at) FROM notes WHERE topic_id = t.id) as last_note_at
         FROM topics t
         WHERE t.employee_id = ?
         ORDER BY t.is_open DESC, t.updated_at DESC`
      )
      .bind(employeeId)
      .all();

    return c.json(apiResponse(topics.results), 200);
  } catch (error) {
    console.error("Error fetching topics:", error);
    return c.json(apiError("FETCH_ERROR", "Error al obtener temas"), 500);
  }
});

app.post("/api/employees/:employeeId/topics", authMiddleware, negocioMiddleware, createModuleRestrictionMiddleware('personal'), createUsageLimitMiddleware(USAGE_TOOLS.TOPICS), async (c) => {
  try {
    const negocio = c.get("negocio");
    const user = c.get("user");
    const employeeId = c.req.param("employeeId");
    const body = await c.req.json();
    const db = c.env.DB;

    const employee = await db
      .prepare("SELECT id FROM employees WHERE id = ? AND negocio_id = ?")
      .bind(employeeId, negocio.id)
      .first();

    if (!employee) {
      return c.json(apiError("NOT_FOUND", "Empleado no encontrado"), 404);
    }

    const validation = validateData(createTopicSchema, body);
    if (!validation.success) {
      return c.json(apiError("VALIDATION_ERROR", validation.error || "Datos inválidos"), 400);
    }
    const validData = validation.data!;

    const now = new Date().toISOString();
    const result = await db
      .prepare(
        `INSERT INTO topics (employee_id, title, is_open, due_date, due_time, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(employeeId, validData.title, 1, validData.due_date || null, validData.due_time || null, now, now)
      .run();

    const newTopic = await db
      .prepare("SELECT * FROM topics WHERE id = ?")
      .bind(result.meta.last_row_id)
      .first();

    await logUsage(db, user.id, negocio.id, "create", "topic");
    return c.json(apiResponse(newTopic), 201);
  } catch (error) {
    console.error("Error creating topic:", error);
    return c.json(apiError("CREATE_ERROR", "Error al crear tema"), 500);
  }
});

app.put("/api/topics/:id", authMiddleware, negocioMiddleware, createModuleRestrictionMiddleware('personal'), async (c) => {
  try {
    const negocio = c.get("negocio");
    const topicId = c.req.param("id");
    const body = await c.req.json();
    const db = c.env.DB;

    const topic = await db
      .prepare(
        `SELECT t.id FROM topics t
         JOIN employees e ON t.employee_id = e.id
         WHERE t.id = ? AND e.negocio_id = ?`
      )
      .bind(topicId, negocio.id)
      .first();

    if (!topic) {
      return c.json(apiError("NOT_FOUND", "Tema no encontrado"), 404);
    }

    const validation = validateData(updateTopicSchema, body);
    if (!validation.success) {
      return c.json(apiError("VALIDATION_ERROR", validation.error || "Datos inválidos"), 400);
    }
    const validData = validation.data!;

    const now = new Date().toISOString();
    const updates: string[] = ["updated_at = ?"];
    const values: (string | number | null)[] = [now];

    if (validData.title !== undefined) { updates.push("title = ?"); values.push(validData.title); }
    if (validData.is_open !== undefined) { updates.push("is_open = ?"); values.push(validData.is_open ? 1 : 0); }
    if (validData.due_date !== undefined) { updates.push("due_date = ?"); values.push(validData.due_date || null); }
    if (validData.due_time !== undefined) { updates.push("due_time = ?"); values.push(validData.due_time || null); }

    values.push(topicId);

    await db
      .prepare(`UPDATE topics SET ${updates.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();

    const updated = await db.prepare("SELECT * FROM topics WHERE id = ?").bind(topicId).first();

    return c.json(apiResponse(updated), 200);
  } catch (error) {
    console.error("Error updating topic:", error);
    return c.json(apiError("UPDATE_ERROR", "Error al actualizar tema"), 500);
  }
});

app.delete("/api/topics/:id", authMiddleware, negocioMiddleware, createModuleRestrictionMiddleware('personal'), async (c) => {
  try {
    const negocio = c.get("negocio");
    const topicId = c.req.param("id");
    const db = c.env.DB;

    const topic = await db
      .prepare(
        `SELECT t.id FROM topics t
         JOIN employees e ON t.employee_id = e.id
         WHERE t.id = ? AND e.negocio_id = ?`
      )
      .bind(topicId, negocio.id)
      .first();

    if (!topic) {
      return c.json(apiError("NOT_FOUND", "Tema no encontrado"), 404);
    }

    await db.prepare("DELETE FROM notes WHERE topic_id = ?").bind(topicId).run();
    await db.prepare("DELETE FROM topics WHERE id = ?").bind(topicId).run();

    return c.json(apiResponse({ deleted: true }), 200);
  } catch (error) {
    console.error("Error deleting topic:", error);
    return c.json(apiError("DELETE_ERROR", "Error al eliminar tema"), 500);
  }
});

// ============================================
// Note Routes (Protected + Negocio)
// ============================================

app.get("/api/topics/:topicId/notes", authMiddleware, negocioMiddleware, createModuleRestrictionMiddleware('personal'), async (c) => {
  try {
    const negocio = c.get("negocio");
    const topicId = c.req.param("topicId");
    const db = c.env.DB;

    const topic = await db
      .prepare(
        `SELECT t.id FROM topics t
         JOIN employees e ON t.employee_id = e.id
         WHERE t.id = ? AND e.negocio_id = ?`
      )
      .bind(topicId, negocio.id)
      .first();

    if (!topic) {
      return c.json(apiError("NOT_FOUND", "Tema no encontrado"), 404);
    }

    const notes = await db
      .prepare("SELECT * FROM notes WHERE topic_id = ? ORDER BY created_at DESC")
      .bind(topicId)
      .all();

    return c.json(apiResponse(notes.results), 200);
  } catch (error) {
    console.error("Error fetching notes:", error);
    return c.json(apiError("FETCH_ERROR", "Error al obtener notas"), 500);
  }
});

app.post("/api/topics/:topicId/notes", authMiddleware, negocioMiddleware, createModuleRestrictionMiddleware('personal'), createUsageLimitMiddleware(USAGE_TOOLS.NOTES), async (c) => {
  try {
    const negocio = c.get("negocio");
    const user = c.get("user");
    const topicId = c.req.param("topicId");
    const body = await c.req.json();
    const db = c.env.DB;

    const topic = await db
      .prepare(
        `SELECT t.id FROM topics t
         JOIN employees e ON t.employee_id = e.id
         WHERE t.id = ? AND e.negocio_id = ?`
      )
      .bind(topicId, negocio.id)
      .first();

    if (!topic) {
      return c.json(apiError("NOT_FOUND", "Tema no encontrado"), 404);
    }

    const validation = validateData(createNoteSchema, body);
    if (!validation.success) {
      return c.json(apiError("VALIDATION_ERROR", validation.error || "Datos inválidos"), 400);
    }
    const validData = validation.data!;

    const now = new Date().toISOString();
    const result = await db
      .prepare("INSERT INTO notes (topic_id, content, created_at, updated_at) VALUES (?, ?, ?, ?)")
      .bind(topicId, validData.content, now, now)
      .run();

    await db
      .prepare("UPDATE topics SET updated_at = ? WHERE id = ?")
      .bind(now, topicId)
      .run();

    const newNote = await db
      .prepare("SELECT * FROM notes WHERE id = ?")
      .bind(result.meta.last_row_id)
      .first();

    await logUsage(db, user.id, negocio.id, "create", "note");
    return c.json(apiResponse(newNote), 201);
  } catch (error) {
    console.error("Error creating note:", error);
    return c.json(apiError("CREATE_ERROR", "Error al crear nota"), 500);
  }
});

app.put("/api/notes/:id", authMiddleware, negocioMiddleware, createModuleRestrictionMiddleware('personal'), async (c) => {
  try {
    const negocio = c.get("negocio");
    const noteId = c.req.param("id");
    const body = await c.req.json();
    const db = c.env.DB;

    const note = await db
      .prepare(
        `SELECT n.id FROM notes n
         JOIN topics t ON n.topic_id = t.id
         JOIN employees e ON t.employee_id = e.id
         WHERE n.id = ? AND e.negocio_id = ?`
      )
      .bind(noteId, negocio.id)
      .first();

    if (!note) {
      return c.json(apiError("NOT_FOUND", "Nota no encontrada"), 404);
    }

    const validation = validateData(updateNoteSchema, body);
    if (!validation.success) {
      return c.json(apiError("VALIDATION_ERROR", validation.error || "Datos inválidos"), 400);
    }
    const validData = validation.data!;

    const now = new Date().toISOString();
    await db
      .prepare("UPDATE notes SET content = ?, updated_at = ? WHERE id = ?")
      .bind(validData.content, now, noteId)
      .run();

    const updated = await db.prepare("SELECT * FROM notes WHERE id = ?").bind(noteId).first();

    return c.json(apiResponse(updated), 200);
  } catch (error) {
    console.error("Error updating note:", error);
    return c.json(apiError("UPDATE_ERROR", "Error al actualizar nota"), 500);
  }
});

app.delete("/api/notes/:id", authMiddleware, negocioMiddleware, createModuleRestrictionMiddleware('personal'), async (c) => {
  try {
    const negocio = c.get("negocio");
    const noteId = c.req.param("id");
    const db = c.env.DB;

    const note = await db
      .prepare(
        `SELECT n.id FROM notes n
         JOIN topics t ON n.topic_id = t.id
         JOIN employees e ON t.employee_id = e.id
         WHERE n.id = ? AND e.negocio_id = ?`
      )
      .bind(noteId, negocio.id)
      .first();

    if (!note) {
      return c.json(apiError("NOT_FOUND", "Nota no encontrada"), 404);
    }

    await db.prepare("DELETE FROM notes WHERE id = ?").bind(noteId).run();

    return c.json(apiResponse({ deleted: true }), 200);
  } catch (error) {
    console.error("Error deleting note:", error);
    return c.json(apiError("DELETE_ERROR", "Error al eliminar nota"), 500);
  }
});

// ============================================
// Topic Deadlines for Calendar (Protected + Negocio)
// ============================================

app.get("/api/topics/deadlines", authMiddleware, negocioMiddleware, createModuleRestrictionMiddleware('personal'), async (c) => {
  try {
    const negocio = c.get("negocio");
    const db = c.env.DB;
    const { month, year } = c.req.query();

    let query = `
      SELECT t.*, e.name as employee_name, e.id as employee_id
      FROM topics t
      JOIN employees e ON t.employee_id = e.id
      WHERE e.negocio_id = ? AND t.due_date IS NOT NULL
    `;
    const params: (string | number)[] = [negocio.id];

    if (month && year) {
      const startDate = `${year}-${month.padStart(2, "0")}-01`;
      const endDate = `${year}-${month.padStart(2, "0")}-31`;
      query += " AND t.due_date >= ? AND t.due_date <= ?";
      params.push(startDate, endDate);
    }

    query += " ORDER BY t.due_date ASC, t.due_time ASC";

    const topics = await db.prepare(query).bind(...params).all();
    return c.json(apiResponse(topics.results), 200);
  } catch (error) {
    console.error("Error fetching topic deadlines:", error);
    return c.json(apiError("FETCH_ERROR", "Error al obtener fechas límite"), 500);
  }
});

// ============================================
// Event Routes (Protected + Negocio)
// ============================================

app.get("/api/events", authMiddleware, negocioMiddleware, createModuleRestrictionMiddleware('calendario'), async (c) => {
  try {
    const negocio = c.get("negocio");
    const db = c.env.DB;
    const { month, year } = c.req.query();

    let query = "SELECT * FROM events WHERE negocio_id = ?";
    const params: (string | number)[] = [negocio.id];

    if (month && year) {
      const startDate = `${year}-${month.padStart(2, "0")}-01`;
      const endDate = `${year}-${month.padStart(2, "0")}-31`;
      query += " AND event_date >= ? AND event_date <= ?";
      params.push(startDate, endDate);
    }

    query += " ORDER BY event_date ASC, start_time ASC";

    const events = await db.prepare(query).bind(...params).all();
    return c.json(apiResponse(events.results), 200);
  } catch (error) {
    console.error("Error fetching events:", error);
    return c.json(apiError("FETCH_ERROR", "Error al obtener eventos"), 500);
  }
});

app.get("/api/events/:id", authMiddleware, negocioMiddleware, createModuleRestrictionMiddleware('calendario'), async (c) => {
  try {
    const negocio = c.get("negocio");
    const eventId = c.req.param("id");
    const db = c.env.DB;

    const event = await db
      .prepare("SELECT * FROM events WHERE id = ? AND negocio_id = ?")
      .bind(eventId, negocio.id)
      .first();

    if (!event) {
      return c.json(apiError("NOT_FOUND", "Evento no encontrado"), 404);
    }

    return c.json(apiResponse(event), 200);
  } catch (error) {
    console.error("Error fetching event:", error);
    return c.json(apiError("FETCH_ERROR", "Error al obtener evento"), 500);
  }
});

app.post("/api/events", authMiddleware, negocioMiddleware, createModuleRestrictionMiddleware('calendario'), createUsageLimitMiddleware(USAGE_TOOLS.EVENTS), async (c) => {
  try {
    const user = c.get("user");
    const negocio = c.get("negocio");
    const body = await c.req.json();
    const db = c.env.DB;

    const validation = validateData(createEventSchema, body);
    if (!validation.success) {
      return c.json(apiError("VALIDATION_ERROR", validation.error || "Datos inválidos"), 400);
    }
    const validData = validation.data!;

    const now = new Date().toISOString();
    const result = await db
      .prepare(
        `INSERT INTO events (negocio_id, user_id, title, description, event_date, start_time, end_time, event_type, location, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        negocio.id,
        user.id,
        validData.title,
        validData.description || null,
        validData.event_date,
        validData.start_time || null,
        validData.end_time || null,
        validData.event_type || "general",
        validData.location || null,
        now,
        now
      )
      .run();

    const newEvent = await db
      .prepare("SELECT * FROM events WHERE id = ?")
      .bind(result.meta.last_row_id)
      .first();

    await logUsage(db, user.id, negocio.id, "create", "event");
    return c.json(apiResponse(newEvent), 201);
  } catch (error) {
    console.error("Error creating event:", error);
    return c.json(apiError("CREATE_ERROR", "Error al crear evento"), 500);
  }
});

app.put("/api/events/:id", authMiddleware, negocioMiddleware, createModuleRestrictionMiddleware('calendario'), async (c) => {
  try {
    const user = c.get("user");
    const negocio = c.get("negocio");
    const eventId = c.req.param("id");
    const body = await c.req.json();
    const db = c.env.DB;

    const existing = await db
      .prepare("SELECT id FROM events WHERE id = ? AND negocio_id = ?")
      .bind(eventId, negocio.id)
      .first();

    if (!existing) {
      return c.json(apiError("NOT_FOUND", "Evento no encontrado"), 404);
    }

    const validation = validateData(updateEventSchema, body);
    if (!validation.success) {
      return c.json(apiError("VALIDATION_ERROR", validation.error || "Datos inválidos"), 400);
    }
    const validData = validation.data!;

    const now = new Date().toISOString();
    await db
      .prepare(
        `UPDATE events SET
          title = COALESCE(?, title),
          description = ?,
          event_date = COALESCE(?, event_date),
          start_time = ?,
          end_time = ?,
          event_type = COALESCE(?, event_type),
          location = ?,
          updated_at = ?
         WHERE id = ? AND negocio_id = ?`
      )
      .bind(
        validData.title || null,
        validData.description || null,
        validData.event_date || null,
        validData.start_time || null,
        validData.end_time || null,
        validData.event_type || null,
        validData.location || null,
        now,
        eventId,
        negocio.id
      )
      .run();

    const updated = await db.prepare("SELECT * FROM events WHERE id = ?").bind(eventId).first();

    await logUsage(db, user.id, negocio.id, "update", "event");
    return c.json(apiResponse(updated), 200);
  } catch (error) {
    console.error("Error updating event:", error);
    return c.json(apiError("UPDATE_ERROR", "Error al actualizar evento"), 500);
  }
});

app.delete("/api/events/:id", authMiddleware, negocioMiddleware, createModuleRestrictionMiddleware('calendario'), async (c) => {
  try {
    const user = c.get("user");
    const negocio = c.get("negocio");
    const eventId = c.req.param("id");
    const db = c.env.DB;

    const existing = await db
      .prepare("SELECT id FROM events WHERE id = ? AND negocio_id = ?")
      .bind(eventId, negocio.id)
      .first();

    if (!existing) {
      return c.json(apiError("NOT_FOUND", "Evento no encontrado"), 404);
    }

    await db.prepare("DELETE FROM events WHERE id = ?").bind(eventId).run();

    await logUsage(db, user.id, negocio.id, "delete", "event");
    return c.json(apiResponse({ deleted: true }), 200);
  } catch (error) {
    console.error("Error deleting event:", error);
    return c.json(apiError("DELETE_ERROR", "Error al eliminar evento"), 500);
  }
});

// ============================================
// Salary & Advances Routes (Protected + Negocio)
// ============================================

app.get("/api/salaries/overview", authMiddleware, negocioMiddleware, createModuleRestrictionMiddleware('sueldos'), async (c) => {
  try {
    const negocio = c.get("negocio");
    const db = c.env.DB;
    const { month, year } = c.req.query();

    const now = new Date();
    const currentMonth = month ? parseInt(month) : now.getMonth() + 1;
    const currentYear = year ? parseInt(year) : now.getFullYear();

    const employees = await db
      .prepare(
        `SELECT e.id, e.name, e.role, e.monthly_salary,
          (SELECT COALESCE(SUM(amount), 0) FROM advances
           WHERE employee_id = e.id AND period_month = ? AND period_year = ?) as advances_total
         FROM employees e
         WHERE e.negocio_id = ? AND e.is_active = 1
         ORDER BY e.monthly_salary DESC`
      )
      .bind(currentMonth, currentYear, negocio.id)
      .all();

    const totals = { total_salaries: 0, total_advances: 0, total_remaining: 0 };

    const employeesWithCalculations = employees.results.map((emp: any) => {
      const salary = emp.monthly_salary || 0;
      const advances = emp.advances_total || 0;
      const remaining = salary - advances;
      totals.total_salaries += salary;
      totals.total_advances += advances;
      totals.total_remaining += remaining;
      return { ...emp, remaining };
    });

    return c.json(
      apiResponse({
        employees: employeesWithCalculations,
        totals,
        period: { month: currentMonth, year: currentYear },
      }),
      200
    );
  } catch (error) {
    console.error("Error fetching salary overview:", error);
    return c.json(apiError("FETCH_ERROR", "Error al obtener resumen de sueldos"), 500);
  }
});

app.get("/api/employees/:employeeId/advances", authMiddleware, negocioMiddleware, createModuleRestrictionMiddleware('sueldos'), async (c) => {
  try {
    const negocio = c.get("negocio");
    const employeeId = c.req.param("employeeId");
    const db = c.env.DB;
    const { month, year } = c.req.query();

    const employee = await db
      .prepare("SELECT id FROM employees WHERE id = ? AND negocio_id = ?")
      .bind(employeeId, negocio.id)
      .first();

    if (!employee) {
      return c.json(apiError("NOT_FOUND", "Empleado no encontrado"), 404);
    }

    let query = "SELECT * FROM advances WHERE employee_id = ?";
    const params: (string | number)[] = [employeeId];

    if (month && year) {
      query += " AND period_month = ? AND period_year = ?";
      params.push(parseInt(month), parseInt(year));
    }

    query += " ORDER BY advance_date DESC, created_at DESC";

    const advances = await db.prepare(query).bind(...params).all();
    return c.json(apiResponse(advances.results), 200);
  } catch (error) {
    console.error("Error fetching advances:", error);
    return c.json(apiError("FETCH_ERROR", "Error al obtener adelantos"), 500);
  }
});

app.post("/api/employees/:employeeId/advances", authMiddleware, negocioMiddleware, createModuleRestrictionMiddleware('sueldos'), createUsageLimitMiddleware(USAGE_TOOLS.ADVANCES), async (c) => {
  try {
    const user = c.get("user");
    const negocio = c.get("negocio");
    const employeeId = c.req.param("employeeId");
    const body = await c.req.json();
    const db = c.env.DB;

    const employee = await db
      .prepare("SELECT id, monthly_salary FROM employees WHERE id = ? AND negocio_id = ?")
      .bind(employeeId, negocio.id)
      .first();

    if (!employee) {
      return c.json(apiError("NOT_FOUND", "Empleado no encontrado"), 404);
    }

    const validation = validateData(createAdvanceSchema, body);
    if (!validation.success) {
      return c.json(apiError("VALIDATION_ERROR", validation.error || "Datos inválidos"), 400);
    }
    const validData = validation.data!;

    const now = new Date();
    const periodMonth = validData.period_month || now.getMonth() + 1;
    const periodYear = validData.period_year || now.getFullYear();
    const advanceDate = validData.advance_date || now.toISOString().split("T")[0];
    const timestamp = now.toISOString();

    const result = await db
      .prepare(
        `INSERT INTO advances (negocio_id, user_id, employee_id, amount, period_month, period_year, advance_date, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        negocio.id,
        user.id,
        employeeId,
        validData.amount,
        periodMonth,
        periodYear,
        advanceDate,
        validData.description || null,
        timestamp,
        timestamp
      )
      .run();

    const newAdvance = await db
      .prepare("SELECT * FROM advances WHERE id = ?")
      .bind(result.meta.last_row_id)
      .first();

    await logUsage(db, user.id, negocio.id, "create", "advance");
    return c.json(apiResponse(newAdvance), 201);
  } catch (error) {
    console.error("Error creating advance:", error);
    return c.json(apiError("CREATE_ERROR", "Error al crear adelanto"), 500);
  }
});

app.delete("/api/advances/:id", authMiddleware, negocioMiddleware, createModuleRestrictionMiddleware('sueldos'), async (c) => {
  try {
    const user = c.get("user");
    const negocio = c.get("negocio");
    const advanceId = c.req.param("id");
    const db = c.env.DB;

    const advance = await db
      .prepare("SELECT id FROM advances WHERE id = ? AND negocio_id = ?")
      .bind(advanceId, negocio.id)
      .first();

    if (!advance) {
      return c.json(apiError("NOT_FOUND", "Adelanto no encontrado"), 404);
    }

    await db.prepare("DELETE FROM advances WHERE id = ?").bind(advanceId).run();

    await logUsage(db, user.id, negocio.id, "delete", "advance");
    return c.json(apiResponse({ deleted: true }), 200);
  } catch (error) {
    console.error("Error deleting advance:", error);
    return c.json(apiError("DELETE_ERROR", "Error al eliminar adelanto"), 500);
  }
});

app.get("/api/salary-payments", authMiddleware, negocioMiddleware, createModuleRestrictionMiddleware('sueldos'), async (c) => {
  try {
    const negocio = c.get("negocio");
    const db = c.env.DB;
    const { month, year } = c.req.query();

    let query = `
      SELECT sp.*, e.name as employee_name
      FROM salary_payments sp
      JOIN employees e ON sp.employee_id = e.id
      WHERE sp.negocio_id = ?
    `;
    const params: (string | number)[] = [negocio.id];

    if (month && year) {
      query += " AND sp.period_month = ? AND sp.period_year = ?";
      params.push(parseInt(month), parseInt(year));
    }

    query += " ORDER BY sp.period_year DESC, sp.period_month DESC, e.name ASC";

    const payments = await db.prepare(query).bind(...params).all();
    return c.json(apiResponse(payments.results), 200);
  } catch (error) {
    console.error("Error fetching salary payments:", error);
    return c.json(apiError("FETCH_ERROR", "Error al obtener registros de pago"), 500);
  }
});

app.post("/api/salary-payments/mark-paid", authMiddleware, negocioMiddleware, createModuleRestrictionMiddleware('sueldos'), createUsageLimitMiddleware(USAGE_TOOLS.SALARY_PAYMENTS), async (c) => {
  try {
    const user = c.get("user");
    const negocio = c.get("negocio");
    const body = await c.req.json();
    const db = c.env.DB;

    if (!body.employee_id || !body.period_month || !body.period_year) {
      return c.json(apiError("VALIDATION_ERROR", "Datos incompletos"), 400);
    }

    const employee = await db
      .prepare("SELECT id, monthly_salary FROM employees WHERE id = ? AND negocio_id = ?")
      .bind(body.employee_id, negocio.id)
      .first();

    if (!employee) {
      return c.json(apiError("NOT_FOUND", "Empleado no encontrado"), 404);
    }

    const validation = validateData(markSalaryPaidSchema, { paid_date: body.paid_date });
    if (!validation.success) {
      return c.json(apiError("VALIDATION_ERROR", validation.error || "Datos inválidos"), 400);
    }

    const advancesResult = await db
      .prepare(
        "SELECT COALESCE(SUM(amount), 0) as total FROM advances WHERE employee_id = ? AND period_month = ? AND period_year = ?"
      )
      .bind(body.employee_id, body.period_month, body.period_year)
      .first();

    const advancesTotal = (advancesResult as any)?.total || 0;
    const salaryAmount = (employee as any).monthly_salary || 0;
    const netAmount = salaryAmount - advancesTotal;
    const now = new Date().toISOString();
    const paidDate = now.split("T")[0];

    const existing = await db
      .prepare(
        "SELECT id FROM salary_payments WHERE employee_id = ? AND period_month = ? AND period_year = ?"
      )
      .bind(body.employee_id, body.period_month, body.period_year)
      .first();

    if (existing) {
      await db
        .prepare("UPDATE salary_payments SET is_paid = 1, paid_date = ?, updated_at = ? WHERE id = ?")
        .bind(paidDate, now, (existing as any).id)
        .run();
    } else {
      await db
        .prepare(
          `INSERT INTO salary_payments
           (negocio_id, user_id, employee_id, period_month, period_year, salary_amount, advances_total, net_amount, is_paid, paid_date, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`
        )
        .bind(
          negocio.id,
          user.id,
          body.employee_id,
          body.period_month,
          body.period_year,
          salaryAmount,
          advancesTotal,
          netAmount,
          paidDate,
          now,
          now
        )
        .run();
    }

    await logUsage(db, user.id, negocio.id, "payment", "salary");
    return c.json(apiResponse({ success: true }), 200);
  } catch (error) {
    console.error("Error marking salary as paid:", error);
    return c.json(apiError("UPDATE_ERROR", "Error al marcar como pagado"), 500);
  }
});

app.post("/api/salary-payments/mark-all-paid", authMiddleware, negocioMiddleware, createModuleRestrictionMiddleware('sueldos'), async (c) => {
  try {
    const user = c.get("user");
    const negocio = c.get("negocio");
    const body = await c.req.json();
    const db = c.env.DB;

    if (!body.period_month || !body.period_year) {
      return c.json(apiError("VALIDATION_ERROR", "Período requerido"), 400);
    }

    const validation = validateData(markSalaryPaidSchema, { paid_date: body.paid_date });
    if (!validation.success) {
      return c.json(apiError("VALIDATION_ERROR", validation.error || "Datos inválidos"), 400);
    }

    const employees = await db
      .prepare("SELECT id, monthly_salary FROM employees WHERE negocio_id = ? AND is_active = 1")
      .bind(negocio.id)
      .all();

    // N-count quota check for usuario_basico (Corrección 4 + Corrección 6)
    // Each employee marked counts as 1 salary_payments use.
    if (user.role !== "usuario_inteligente" && employees.results.length > 0) {
      const n = employees.results.length;
      const period = new Date().toISOString().slice(0, 7);

      const limitRow = await db
        .prepare(`SELECT "limit" FROM usage_limits WHERE tool = ?`)
        .bind(USAGE_TOOLS.SALARY_PAYMENTS)
        .first<{ limit: number }>();

      const limit = limitRow?.limit ?? Infinity;

      // Atomic increment-then-revert (same pattern as createUsageLimitMiddleware, N-count variant)
      const counterResult = await db
        .prepare(
          `INSERT INTO usage_counters (user_id, negocio_id, tool, period, count, updated_at)
           VALUES (?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT(user_id, negocio_id, tool, period)
           DO UPDATE SET count = count + ?, updated_at = datetime('now')
           RETURNING count`
        )
        .bind(user.id, negocio.id, USAGE_TOOLS.SALARY_PAYMENTS, period, n, n)
        .first<{ count: number }>();

      const newCount = counterResult?.count ?? n;

      if (newCount > limit) {
        await db
          .prepare(
            `UPDATE usage_counters SET count = count - ?, updated_at = datetime('now')
             WHERE user_id = ? AND negocio_id = ? AND tool = ? AND period = ?`
          )
          .bind(n, user.id, negocio.id, USAGE_TOOLS.SALARY_PAYMENTS, period)
          .run();
        return c.json(
          apiError("USAGE_LIMIT_EXCEEDED", `Límite mensual alcanzado (${limit}). Actualiza a Usuario Inteligente para continuar.`),
          429
        );
      }
    }

    const now = new Date().toISOString();
    const paidDate = now.split("T")[0];

    for (const emp of employees.results) {
      const employee = emp as any;

      const advancesResult = await db
        .prepare(
          "SELECT COALESCE(SUM(amount), 0) as total FROM advances WHERE employee_id = ? AND period_month = ? AND period_year = ?"
        )
        .bind(employee.id, body.period_month, body.period_year)
        .first();

      const advancesTotal = (advancesResult as any)?.total || 0;
      const salaryAmount = employee.monthly_salary || 0;
      const netAmount = salaryAmount - advancesTotal;

      const existing = await db
        .prepare(
          "SELECT id FROM salary_payments WHERE employee_id = ? AND period_month = ? AND period_year = ?"
        )
        .bind(employee.id, body.period_month, body.period_year)
        .first();

      if (existing) {
        await db
          .prepare("UPDATE salary_payments SET is_paid = 1, paid_date = ?, updated_at = ? WHERE id = ?")
          .bind(paidDate, now, (existing as any).id)
          .run();
      } else {
        await db
          .prepare(
            `INSERT INTO salary_payments
             (negocio_id, user_id, employee_id, period_month, period_year, salary_amount, advances_total, net_amount, is_paid, paid_date, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`
          )
          .bind(
            negocio.id,
            user.id,
            employee.id,
            body.period_month,
            body.period_year,
            salaryAmount,
            advancesTotal,
            netAmount,
            paidDate,
            now,
            now
          )
          .run();
      }
    }

    await logUsage(db, user.id, negocio.id, "payment", "salary");
    return c.json(apiResponse({ success: true, count: employees.results.length }), 200);
  } catch (error) {
    console.error("Error marking all salaries as paid:", error);
    return c.json(apiError("UPDATE_ERROR", "Error al marcar sueldos como pagados"), 500);
  }
});

// ============================================
// Admin Routes (Protected)
// ============================================

app.get("/api/admin/check", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const db = c.env.DB;
    const adminStatus = await isAdmin(user.email, db, c.env);
    return c.json(apiResponse({ isAdmin: adminStatus }), 200);
  } catch (error) {
    console.error("Error checking admin status:", error);
    return c.json(apiError("CHECK_ERROR", "Error al verificar estado de administrador"), 500);
  }
});

app.get("/api/admin/stats", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const db = c.env.DB;

    const adminStatus = await isAdmin(user.email, db, c.env);
    if (!adminStatus) {
      return c.json(apiError("UNAUTHORIZED", "No tienes permisos de administrador"), 403);
    }

    const usersResult = await db
      .prepare("SELECT COUNT(*) as count FROM negocio_members")
      .first() as any;
    const totalUsers = usersResult?.count || 0;

    const negociosResult = await db
      .prepare("SELECT COUNT(*) as count FROM negocios")
      .first() as any;
    const totalNegocios = negociosResult?.count || 0;

    const avgEmployeesResult = await db
      .prepare(`
        SELECT AVG(emp_count) as avg_count
        FROM (
          SELECT negocio_id, COUNT(*) as emp_count
          FROM employees
          GROUP BY negocio_id
        )
      `)
      .first() as any;
    const avgEmployees = Math.round(avgEmployeesResult?.avg_count || 0);

    const avgEventsResult = await db
      .prepare(`
        SELECT AVG(event_count) as avg_count
        FROM (
          SELECT negocio_id, COUNT(*) as event_count
          FROM events
          GROUP BY negocio_id
        )
      `)
      .first() as any;
    const avgEvents = Math.round(avgEventsResult?.avg_count || 0);

    const employeeActions = await db
      .prepare("SELECT COUNT(*) as count FROM usage_logs WHERE entity_type = 'employee'")
      .first() as any;

    const salaryActions = await db
      .prepare("SELECT COUNT(*) as count FROM usage_logs WHERE entity_type IN ('salary', 'advance')")
      .first() as any;

    const calendarActions = await db
      .prepare("SELECT COUNT(*) as count FROM usage_logs WHERE entity_type = 'event'")
      .first() as any;

    const jobRoleActions = await db
      .prepare("SELECT COUNT(*) as count FROM usage_logs WHERE entity_type = 'job_role'")
      .first() as any;

    const topicActions = await db
      .prepare("SELECT COUNT(*) as count FROM usage_logs WHERE entity_type = 'topic'")
      .first() as any;

    const noteActions = await db
      .prepare("SELECT COUNT(*) as count FROM usage_logs WHERE entity_type = 'note'")
      .first() as any;

    const chatActions = await db
      .prepare("SELECT COUNT(*) as count FROM usage_logs WHERE entity_type = 'chat'")
      .first() as any;

    const comprasActions = await db
      .prepare("SELECT COUNT(*) as count FROM usage_logs WHERE entity_type IN ('compras', 'compras_summary')")
      .first() as any;

    const facturacionActions = await db
      .prepare("SELECT COUNT(*) as count FROM usage_logs WHERE entity_type = 'factura'")
      .first() as any;

    const usage = {
      employees: employeeActions?.count || 0,
      salaries: salaryActions?.count || 0,
      calendar: calendarActions?.count || 0,
      job_roles: jobRoleActions?.count || 0,
      topics: topicActions?.count || 0,
      notes: noteActions?.count || 0,
      chat: chatActions?.count || 0,
      compras: comprasActions?.count || 0,
      facturacion: facturacionActions?.count || 0,
    };

    return c.json(apiResponse({ totalUsers, totalNegocios, avgEmployees, avgEvents, usage }), 200);
  } catch (error) {
    console.error("Error getting admin stats:", error);
    return c.json(apiError("STATS_ERROR", "Error al obtener estadísticas"), 500);
  }
});

app.get("/api/admin/emails", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const db = c.env.DB;

    const adminStatus = await isAdmin(user.email, db, c.env);
    if (!adminStatus) {
      return c.json(apiError("UNAUTHORIZED", "No tienes permisos de administrador"), 403);
    }

    const emails = await db
      .prepare("SELECT id, email, added_by, created_at FROM admin_emails ORDER BY created_at DESC")
      .all();

    const allEmails = [
      { id: 0, email: c.env.INITIAL_ADMIN_EMAIL, added_by: "Sistema", created_at: new Date(0).toISOString(), is_initial: true },
      ...emails.results.map((e: any) => ({ ...e, is_initial: false })),
    ];

    return c.json(apiResponse(allEmails), 200);
  } catch (error) {
    console.error("Error getting admin emails:", error);
    return c.json(apiError("GET_ERROR", "Error al obtener correos de administradores"), 500);
  }
});

app.post("/api/admin/emails", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const db = c.env.DB;
    const body = await c.req.json();

    const adminStatus = await isAdmin(user.email, db, c.env);
    if (!adminStatus) {
      return c.json(apiError("UNAUTHORIZED", "No tienes permisos de administrador"), 403);
    }

    if (!body.email) {
      return c.json(apiError("VALIDATION_ERROR", "Correo electrónico requerido"), 400);
    }

    const now = new Date().toISOString();

    const existing = await db
      .prepare("SELECT id FROM admin_emails WHERE LOWER(email) = LOWER(?)")
      .bind(body.email)
      .first();

    if (existing) {
      return c.json(apiError("DUPLICATE_ERROR", "Este correo ya es administrador"), 400);
    }

    const result = await db
      .prepare("INSERT INTO admin_emails (email, added_by, created_at, updated_at) VALUES (?, ?, ?, ?)")
      .bind(body.email, user.email, now, now)
      .run();

    return c.json(apiResponse({ id: result.meta.last_row_id, email: body.email }), 201);
  } catch (error) {
    console.error("Error adding admin email:", error);
    return c.json(apiError("CREATE_ERROR", "Error al agregar administrador"), 500);
  }
});

app.delete("/api/admin/emails/:id", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const db = c.env.DB;
    const id = c.req.param("id");

    const adminStatus = await isAdmin(user.email, db, c.env);
    if (!adminStatus) {
      return c.json(apiError("UNAUTHORIZED", "No tienes permisos de administrador"), 403);
    }

    await db.prepare("DELETE FROM admin_emails WHERE id = ?").bind(id).run();

    return c.json(apiResponse({ success: true }), 200);
  } catch (error) {
    console.error("Error deleting admin email:", error);
    return c.json(apiError("DELETE_ERROR", "Error al eliminar administrador"), 500);
  }
});

// ============================================
// Admin — Usage & Limits
// ============================================

app.get("/api/admin/usage", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.env.DB;
  if (!await isAdmin(user.email, db, c.env)) {
    return c.json(apiError("UNAUTHORIZED", "No tienes permisos de administrador"), 403);
  }
  const period = new Date().toISOString().slice(0, 7);

  const usersResult = await db.prepare(
    "SELECT id, email, role FROM users ORDER BY email"
  ).all<{ id: string; email: string; role: string }>();

  const countsResult = await db.prepare(
    "SELECT user_id, negocio_id, tool, SUM(count) as count FROM usage_counters WHERE period = ? GROUP BY user_id, negocio_id, tool"
  ).bind(period).all<{ user_id: string; negocio_id: number; tool: string; count: number }>();

  const negociosResult = await db.prepare(
    "SELECT id, name FROM negocios"
  ).all<{ id: number; name: string }>();

  const userMap = new Map(usersResult.results.map(u => [u.id, u]));
  const negocioNameMap = new Map(negociosResult.results.map(n => [n.id, n.name]));

  // Map: "userId:negocioId" → { tool → count }
  const usageMap = new Map<string, Record<string, number>>();
  for (const row of countsResult.results) {
    const key = `${row.user_id}:${row.negocio_id}`;
    if (!usageMap.has(key)) usageMap.set(key, {});
    usageMap.get(key)![row.tool] = row.count;
  }

  // One row per (user, negocio) pair that has any activity
  const rows = [...usageMap.keys()].map(key => {
    const [userId, negocioIdStr] = key.split(":");
    const negocioId = parseInt(negocioIdStr);
    const u = userMap.get(userId);
    return {
      user_id: userId,
      email: u?.email ?? userId,
      role: u?.role ?? "usuario_basico",
      negocio_id: negocioId,
      negocio_name: negocioNameMap.get(negocioId) ?? `Negocio ${negocioId}`,
      usage: usageMap.get(key) ?? {},
    };
  }).sort((a, b) => a.email.localeCompare(b.email) || a.negocio_name.localeCompare(b.negocio_name));

  return c.json(apiResponse({ period, rows }), 200);
});

app.get("/api/admin/usage-limits", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.env.DB;
  if (!await isAdmin(user.email, db, c.env)) {
    return c.json(apiError("UNAUTHORIZED", "No tienes permisos de administrador"), 403);
  }
  const rows = await db.prepare(
    `SELECT tool, "limit" FROM usage_limits ORDER BY tool`
  ).all<{ tool: string; limit: number }>();
  const limits: Record<string, number> = {};
  for (const r of rows.results) limits[r.tool] = r.limit;
  return c.json(apiResponse(limits), 200);
});

app.put("/api/admin/usage-limits", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.env.DB;
  if (!await isAdmin(user.email, db, c.env)) {
    return c.json(apiError("UNAUTHORIZED", "No tienes permisos de administrador"), 403);
  }
  const body = await c.req.json<Record<string, number>>();
  const validTools = ["employees","job_roles","topics","notes","advances","salary_payments","events","chat","compras","facturacion"];
  const entries = Object.entries(body).filter(([tool, val]) =>
    validTools.includes(tool) && typeof val === "number" && val >= 0
  );
  if (entries.length === 0) {
    return c.json(apiError("VALIDATION_ERROR", "No hay herramientas válidas para actualizar"), 400);
  }
  const stmts = entries.map(([tool, limit]) =>
    db.prepare(
      `INSERT INTO usage_limits (tool, "limit") VALUES (?, ?)
       ON CONFLICT(tool) DO UPDATE SET "limit" = excluded."limit"`
    ).bind(tool, limit)
  );
  await db.batch(stmts);
  return c.json(apiResponse({ updated: entries.length }), 200);
});

// ============================================
// Admin — User role management (Paso 5)
// ============================================

app.get("/api/admin/users", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.env.DB;
  if (!await isAdmin(user.email, db, c.env)) {
    return c.json(apiError("UNAUTHORIZED", "No tienes permisos de administrador"), 403);
  }
  const rows = await db.prepare(
    "SELECT id, email, name, role, created_at FROM users ORDER BY email"
  ).all<{ id: string; email: string; name: string; role: string; created_at: string }>();
  return c.json(apiResponse(rows.results), 200);
});

app.post("/api/admin/users/:userId/promote", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.env.DB;
  if (!await isAdmin(user.email, db, c.env)) {
    return c.json(apiError("UNAUTHORIZED", "No tienes permisos de administrador"), 403);
  }
  const targetId = c.req.param("userId");
  const target = await db.prepare("SELECT id, email FROM users WHERE id = ?")
    .bind(targetId).first<{ id: string; email: string }>();
  if (!target) {
    return c.json(apiError("NOT_FOUND", "Usuario no encontrado"), 404);
  }
  await db.prepare("UPDATE users SET role = 'usuario_inteligente', updated_at = datetime('now') WHERE id = ?")
    .bind(targetId).run();
  return c.json(apiResponse({ id: targetId, role: "usuario_inteligente" }), 200);
});

app.post("/api/admin/users/:userId/demote", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.env.DB;
  if (!await isAdmin(user.email, db, c.env)) {
    return c.json(apiError("UNAUTHORIZED", "No tienes permisos de administrador"), 403);
  }
  const targetId = c.req.param("userId");
  // Corrección 8 — prevent self-demotion
  if (targetId === user.id) {
    return c.json(apiError("FORBIDDEN", "No puedes cambiar tu propio rol desde el panel admin"), 403);
  }
  const target = await db.prepare("SELECT id, email FROM users WHERE id = ?")
    .bind(targetId).first<{ id: string; email: string }>();
  if (!target) {
    return c.json(apiError("NOT_FOUND", "Usuario no encontrado"), 404);
  }
  await db.prepare("UPDATE users SET role = 'usuario_basico', updated_at = datetime('now') WHERE id = ?")
    .bind(targetId).run();
  return c.json(apiResponse({ id: targetId, role: "usuario_basico" }), 200);
});

// ============================================
// Usage — Current user quota (Corrección 7)
// ============================================

app.get("/api/usage/me", authMiddleware, negocioMiddleware, async (c) => {
  const user = c.get("user");
  const negocio = c.get("negocio");
  const period = new Date().toISOString().slice(0, 7);
  const db = c.env.DB;

  const rows = await db.prepare(`
    SELECT ul.tool, COALESCE(uc.count, 0) as count, ul."limit"
    FROM usage_limits ul
    LEFT JOIN usage_counters uc
      ON ul.tool = uc.tool
      AND uc.user_id = ?
      AND uc.negocio_id = ?
      AND uc.period = ?
    ORDER BY ul.tool
  `).bind(user.id, negocio.id, period).all<{ tool: string; count: number; limit: number }>();

  const isIntelligente = user.role === "usuario_inteligente";
  const usage: Record<string, { count: number; limit: number | null }> = {};
  for (const row of rows.results) {
    usage[row.tool] = { count: row.count, limit: isIntelligente ? null : row.limit };
  }

  return c.json(apiResponse({ period, role: user.role, usage }), 200);
});

// ============================================
// Chatbot Routes (Protected + Negocio)
// ============================================

app.post("/api/chat", authMiddleware, negocioMiddleware, createUsageLimitMiddleware(USAGE_TOOLS.CHAT), async (c) => {
  try {
    const negocio = c.get("negocio");
    const user = c.get("user");
    const db = c.env.DB;
    const body = await c.req.json();
    const { message } = body;

    if (!message || typeof message !== "string") {
      return c.json(apiError("VALIDATION_ERROR", "Mensaje es requerido"), 400);
    }

    if (!c.env.GEMINI_API_KEY) {
      return c.json(apiError("CONFIG_ERROR", "API key de Gemini no configurada"), 500);
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const employeesResult = await db
      .prepare("SELECT * FROM employees WHERE negocio_id = ?")
      .bind(negocio.id)
      .all();
    const employees = employeesResult.results || [];

    const eventsResult = await db
      .prepare(
        `SELECT * FROM events
         WHERE negocio_id = ?
         AND strftime('%m', event_date) = ?
         AND strftime('%Y', event_date) = ?`
      )
      .bind(negocio.id, currentMonth.toString().padStart(2, "0"), currentYear.toString())
      .all();
    const events = eventsResult.results || [];

    const topicsResult = await db
      .prepare(
        `SELECT t.*, e.name as employee_name
         FROM topics t
         JOIN employees e ON t.employee_id = e.id
         WHERE e.negocio_id = ? AND t.is_open = 1`
      )
      .bind(negocio.id)
      .all();
    const topics = topicsResult.results || [];

    const advancesResult = await db
      .prepare(
        `SELECT a.*, e.name as employee_name
         FROM advances a
         JOIN employees e ON a.employee_id = e.id
         WHERE a.negocio_id = ? AND a.period_month = ? AND a.period_year = ?`
      )
      .bind(negocio.id, currentMonth, currentYear)
      .all();
    const advances = advancesResult.results || [];

    const salaryPaymentsResult = await db
      .prepare(
        `SELECT sp.*, e.name as employee_name
         FROM salary_payments sp
         JOIN employees e ON sp.employee_id = e.id
         WHERE sp.negocio_id = ? AND sp.period_month = ? AND sp.period_year = ?`
      )
      .bind(negocio.id, currentMonth, currentYear)
      .all();
    const salaryPayments = salaryPaymentsResult.results || [];

    const context = `
Eres un asistente virtual para Gastro Manager, un sistema de gestión de restaurantes.
Estás respondiendo en el contexto del negocio: "${negocio.name}".

EMPLEADOS (${employees.length} total):
${employees.map((emp: any) => `- ${emp.name} (${emp.role}), Estado: ${emp.is_active ? "Activo" : "Inactivo"}, Salario mensual: $${emp.monthly_salary || 0}`).join("\n")}

EVENTOS DEL MES ACTUAL (${events.length} total):
${events.length > 0 ? events.map((evt: any) => `- ${evt.title} el ${evt.event_date} ${evt.start_time ? `a las ${evt.start_time}` : ""}`).join("\n") : "No hay eventos este mes"}

TEMAS ABIERTOS (${topics.length} total):
${topics.length > 0 ? topics.map((topic: any) => `- ${topic.title} (Empleado: ${topic.employee_name})${topic.due_date ? `, Vence: ${topic.due_date}` : ""}`).join("\n") : "No hay temas abiertos"}

ADELANTOS DEL MES (${advances.length} total):
${advances.length > 0 ? advances.map((adv: any) => `- $${adv.amount} para ${adv.employee_name}`).join("\n") : "No hay adelantos este mes"}

PAGOS DE SUELDOS DEL MES (${salaryPayments.length} total):
${salaryPayments.length > 0 ? salaryPayments.map((sp: any) => `- ${sp.employee_name}: Salario $${sp.salary_amount}, Neto $${sp.net_amount}, ${sp.is_paid ? "PAGADO" : "PENDIENTE"}`).join("\n") : "No hay registros de pago este mes"}

ESTADÍSTICAS:
- Total empleados: ${employees.length}
- Empleados activos: ${employees.filter((e: any) => e.is_active).length}
- Total adelantos del mes: $${advances.reduce((sum: number, a: any) => sum + (a.amount || 0), 0)}

Responde de manera concisa en español sobre los datos de este negocio.
`;

    const apiKey = c.env.GEMINI_API_KEY;
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    let geminiResponse;
    try {
      geminiResponse = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${context}\n\nUsuario pregunta: ${message}` }] }],
          generationConfig: { temperature: 1.0, maxOutputTokens: 500 },
        }),
      });
    } catch (fetchError: any) {
      console.error("Fetch failed:", fetchError);
      return c.json(apiError("NETWORK_ERROR", "Error de conexión con el asistente. Por favor intenta de nuevo."), 500);
    }

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini API error:", geminiResponse.status, errorText);
      let userMessage = "El asistente no está disponible en este momento. Intenta más tarde.";
      if (geminiResponse.status === 400) userMessage = "Error en la solicitud al asistente (modelo no válido o parámetros incorrectos).";
      if (geminiResponse.status === 401 || geminiResponse.status === 403) userMessage = "API key de Gemini inválida o sin permisos.";
      if (geminiResponse.status === 404) userMessage = "Modelo de IA no encontrado. Contacta al administrador.";
      if (geminiResponse.status === 429) userMessage = "Límite de la API de Gemini alcanzado. Intenta más tarde.";
      return c.json(apiError("GEMINI_API_ERROR", userMessage), 500);
    }

    let geminiData: any;
    try {
      geminiData = await geminiResponse.json();
    } catch {
      return c.json(apiError("PARSE_ERROR", "Error al procesar la respuesta del asistente"), 500);
    }

    const reply = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "Lo siento, no pude generar una respuesta.";

    await logUsage(db, user.id, negocio.id, "create", "chat");
    return c.json(apiResponse({ reply }), 200);
  } catch (error: any) {
    console.error("Unexpected error in chat endpoint:", error.message);
    return c.json(apiError("CHAT_ERROR", "Error inesperado en el asistente. Intenta de nuevo."), 500);
  }
});

// ============================================
// Compras (Purchases/Expenses) Routes
// ============================================

// GET /api/compras — list purchases for a month
app.get("/api/compras",
  authMiddleware,
  negocioMiddleware,
  createModuleRestrictionMiddleware('compras'),
  async (c) => {
    const negocio = c.get("negocio");
    const user = c.get("user");
    const db = c.env.DB;
    const month = c.req.query("month") || String(new Date().getMonth() + 1);
    const year = c.req.query("year") || String(new Date().getFullYear());
    const period = `${year}-${month.padStart(2, '0')}`;
    try {
      const rows = await db
        .prepare(`SELECT c.*, e.name as comprador_name
                  FROM compras c
                  LEFT JOIN employees e ON c.comprador_id = e.id
                  WHERE c.negocio_id = ? AND strftime('%Y-%m', c.fecha) = ?
                  ORDER BY c.fecha DESC, c.created_at DESC`)
        .bind(negocio.id, period)
        .all();
      await logUsage(db, user.id, negocio.id, "view", "compras");
      return c.json(apiResponse(rows.results));
    } catch (error) {
      console.error("Error fetching compras:", error);
      return c.json(apiError("FETCH_ERROR", "Error al obtener compras"), 500);
    }
  }
);

// GET /api/compras/summary — daily totals for calendar grid
app.get("/api/compras/summary",
  authMiddleware,
  negocioMiddleware,
  createModuleRestrictionMiddleware('compras'),
  async (c) => {
    const negocio = c.get("negocio");
    const user = c.get("user");
    const db = c.env.DB;
    const month = c.req.query("month") || String(new Date().getMonth() + 1);
    const year = c.req.query("year") || String(new Date().getFullYear());
    const period = `${year}-${month.padStart(2, '0')}`;
    try {
      const rows = await db
        .prepare(`SELECT fecha, SUM(monto) as total_dia,
                    SUM(CASE WHEN tipo = 'producto' THEN monto ELSE 0 END) as total_productos,
                    SUM(CASE WHEN tipo = 'servicio' THEN monto ELSE 0 END) as total_servicios,
                    COUNT(*) as cantidad
                  FROM compras
                  WHERE negocio_id = ? AND strftime('%Y-%m', fecha) = ?
                  GROUP BY fecha
                  ORDER BY fecha`)
        .bind(negocio.id, period)
        .all();
      await logUsage(db, user.id, negocio.id, "view", "compras_summary");
      return c.json(apiResponse(rows.results));
    } catch (error) {
      console.error("Error fetching compras summary:", error);
      return c.json(apiError("FETCH_ERROR", "Error al obtener resumen"), 500);
    }
  }
);

// POST /api/compras — create a purchase
app.post("/api/compras",
  authMiddleware,
  negocioMiddleware,
  createModuleRestrictionMiddleware('compras'),
  createUsageLimitMiddleware(USAGE_TOOLS.COMPRAS),
  async (c) => {
    const user = c.get("user");
    const negocio = c.get("negocio");
    const db = c.env.DB;
    try {
      const body = await c.req.json();
      const validation = validateData(createCompraSchema, body);
      if (!validation.success) {
        return c.json(apiError("VALIDATION_ERROR", validation.error || "Datos inválidos"), 400);
      }
      const d = validation.data!;
      const now = new Date().toISOString();
      const result = await db
        .prepare(`INSERT INTO compras (negocio_id, user_id, fecha, monto, item, tipo, categoria, comprador_id, descripcion, comprobante_key, created_at, updated_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`)
        .bind(negocio.id, user.id, d.fecha, d.monto, d.item, d.tipo, d.categoria, d.comprador_id ?? null, d.descripcion ?? null, d.comprobante_key ?? null, now, now)
        .first();
      await logUsage(db, user.id, negocio.id, "create", "compras");
      return c.json(apiResponse(result), 201);
    } catch (error) {
      console.error("Error creating compra:", error);
      return c.json(apiError("CREATE_ERROR", "Error al crear compra"), 500);
    }
  }
);

// PUT /api/compras/:id — update a purchase
app.put("/api/compras/:id",
  authMiddleware,
  negocioMiddleware,
  createModuleRestrictionMiddleware('compras'),
  createUsageLimitMiddleware(USAGE_TOOLS.COMPRAS),
  async (c) => {
    const user = c.get("user");
    const negocio = c.get("negocio");
    const db = c.env.DB;
    const id = parseInt(c.req.param("id"));
    if (isNaN(id)) return c.json(apiError("VALIDATION_ERROR", "ID inválido"), 400);
    try {
      const existing = await db
        .prepare("SELECT * FROM compras WHERE id = ? AND negocio_id = ?")
        .bind(id, negocio.id)
        .first();
      if (!existing) return c.json(apiError("NOT_FOUND", "Compra no encontrada"), 404);

      const body = await c.req.json();
      const validation = validateData(updateCompraSchema, body);
      if (!validation.success) {
        return c.json(apiError("VALIDATION_ERROR", validation.error || "Datos inválidos"), 400);
      }
      const d = validation.data!;
      const now = new Date().toISOString();
      const result = await db
        .prepare(`UPDATE compras SET
                    fecha = COALESCE(?, fecha),
                    monto = COALESCE(?, monto),
                    item = COALESCE(?, item),
                    tipo = COALESCE(?, tipo),
                    categoria = COALESCE(?, categoria),
                    comprador_id = COALESCE(?, comprador_id),
                    descripcion = COALESCE(?, descripcion),
                    comprobante_key = COALESCE(?, comprobante_key),
                    updated_at = ?
                  WHERE id = ? AND negocio_id = ? RETURNING *`)
        .bind(d.fecha ?? null, d.monto ?? null, d.item ?? null, d.tipo ?? null, d.categoria ?? null, d.comprador_id ?? null, d.descripcion ?? null, d.comprobante_key ?? null, now, id, negocio.id)
        .first();
      await logUsage(db, user.id, negocio.id, "update", "compras");
      return c.json(apiResponse(result));
    } catch (error) {
      console.error("Error updating compra:", error);
      return c.json(apiError("UPDATE_ERROR", "Error al actualizar compra"), 500);
    }
  }
);

// DELETE /api/compras/:id — delete a purchase
app.delete("/api/compras/:id",
  authMiddleware,
  negocioMiddleware,
  createModuleRestrictionMiddleware('compras'),
  async (c) => {
    const user = c.get("user");
    const negocio = c.get("negocio");
    const db = c.env.DB;
    const id = parseInt(c.req.param("id"));
    if (isNaN(id)) return c.json(apiError("VALIDATION_ERROR", "ID inválido"), 400);
    try {
      const existing = await db
        .prepare("SELECT * FROM compras WHERE id = ? AND negocio_id = ?")
        .bind(id, negocio.id)
        .first<{ comprobante_key: string | null }>();
      if (!existing) return c.json(apiError("NOT_FOUND", "Compra no encontrada"), 404);

      // Delete R2 file if exists
      if (existing.comprobante_key) {
        try { await c.env.R2_BUCKET.delete(existing.comprobante_key); } catch { /* ignore */ }
      }

      await db.prepare("DELETE FROM compras WHERE id = ? AND negocio_id = ?").bind(id, negocio.id).run();
      await logUsage(db, user.id, negocio.id, "delete", "compras");
      return c.json(apiResponse({ deleted: true }));
    } catch (error) {
      console.error("Error deleting compra:", error);
      return c.json(apiError("DELETE_ERROR", "Error al eliminar compra"), 500);
    }
  }
);

// POST /api/compras/upload — upload receipt image to R2
app.post("/api/compras/upload",
  authMiddleware,
  negocioMiddleware,
  createModuleRestrictionMiddleware('compras'),
  async (c) => {
    const negocio = c.get("negocio");
    try {
      const formData = await c.req.formData();
      const file = formData.get("file") as File | null;
      if (!file) return c.json(apiError("VALIDATION_ERROR", "No se envió archivo"), 400);

      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic"];
      if (!allowedTypes.includes(file.type)) {
        return c.json(apiError("VALIDATION_ERROR", "Tipo de archivo no permitido. Solo imágenes (JPEG, PNG, WebP, HEIC)"), 400);
      }
      if (file.size > 5 * 1024 * 1024) {
        return c.json(apiError("VALIDATION_ERROR", "Archivo muy grande (máximo 5MB)"), 400);
      }

      const ext = file.name.split(".").pop() || "jpg";
      const key = `compras/${negocio.id}/${crypto.randomUUID()}.${ext}`;
      await c.env.R2_BUCKET.put(key, file.stream(), {
        httpMetadata: { contentType: file.type },
      });

      return c.json(apiResponse({ key }), 201);
    } catch (error) {
      console.error("Error uploading comprobante:", error);
      return c.json(apiError("UPLOAD_ERROR", "Error al subir archivo"), 500);
    }
  }
);

// GET /api/compras/files/* — serve receipt image from R2
app.get("/api/compras/files/*",
  authMiddleware,
  negocioMiddleware,
  async (c) => {
    const negocio = c.get("negocio");
    const key = c.req.path.replace("/api/compras/files/", "");

    if (!key.startsWith(`compras/${negocio.id}/`)) {
      return c.json(apiError("FORBIDDEN", "No autorizado"), 403);
    }

    try {
      const object = await c.env.R2_BUCKET.get(key);
      if (!object) return c.json(apiError("NOT_FOUND", "Archivo no encontrado"), 404);

      const headers = new Headers();
      headers.set("Content-Type", object.httpMetadata?.contentType || "application/octet-stream");
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
      return new Response(object.body, { headers });
    } catch (error) {
      console.error("Error serving comprobante:", error);
      return c.json(apiError("FETCH_ERROR", "Error al obtener archivo"), 500);
    }
  }
);

// ============================================
// Facturación Routes
// ============================================

// GET /api/facturacion — list sales for a month
app.get("/api/facturacion",
  authMiddleware,
  negocioMiddleware,
  createModuleRestrictionMiddleware('facturacion'),
  async (c) => {
    const user = c.get("user");
    const negocio = c.get("negocio");
    const db = c.env.DB;
    const month = Number(c.req.query("month") || new Date().getMonth() + 1);
    const year = Number(c.req.query("year") || new Date().getFullYear());
    try {
      const monthStr = String(month).padStart(2, "0");
      const rows = await db
        .prepare(
          `SELECT * FROM facturas
           WHERE negocio_id = ?
             AND strftime('%m', fecha) = ?
             AND strftime('%Y', fecha) = ?
           ORDER BY fecha DESC, created_at DESC`
        )
        .bind(negocio.id, monthStr, String(year))
        .all();
      await logUsage(db, user.id, negocio.id, "view", "factura");
      return c.json(apiResponse(rows.results));
    } catch (error) {
      console.error("Error fetching facturas:", error);
      return c.json(apiError("FETCH_ERROR", "Error al obtener facturas"), 500);
    }
  }
);

// GET /api/facturacion/summary — daily totals for calendar grid
app.get("/api/facturacion/summary",
  authMiddleware,
  negocioMiddleware,
  createModuleRestrictionMiddleware('facturacion'),
  async (c) => {
    const negocio = c.get("negocio");
    const db = c.env.DB;
    const month = Number(c.req.query("month") || new Date().getMonth() + 1);
    const year = Number(c.req.query("year") || new Date().getFullYear());
    try {
      const monthStr = String(month).padStart(2, "0");
      const rows = await db
        .prepare(
          `SELECT
             fecha,
             SUM(monto_total) AS total_dia,
             COUNT(*) AS cantidad
           FROM facturas
           WHERE negocio_id = ?
             AND strftime('%m', fecha) = ?
             AND strftime('%Y', fecha) = ?
           GROUP BY fecha
           ORDER BY fecha ASC`
        )
        .bind(negocio.id, monthStr, String(year))
        .all();
      return c.json(apiResponse(rows.results));
    } catch (error) {
      console.error("Error fetching facturacion summary:", error);
      return c.json(apiError("FETCH_ERROR", "Error al obtener resumen"), 500);
    }
  }
);

// POST /api/facturacion — create a sale
app.post("/api/facturacion",
  authMiddleware,
  negocioMiddleware,
  createModuleRestrictionMiddleware('facturacion'),
  createUsageLimitMiddleware(USAGE_TOOLS.FACTURACION),
  async (c) => {
    const user = c.get("user");
    const negocio = c.get("negocio");
    const db = c.env.DB;
    try {
      const body = await c.req.json();
      const validation = validateData(createFacturaSchema, body);
      if (!validation.success) {
        return c.json(apiError("VALIDATION_ERROR", validation.error || "Datos inválidos"), 400);
      }
      const d = validation.data!;
      const now = new Date().toISOString();
      // Determine metodo_pago from pagos_detalle if present
      let metodoPago = d.metodo_pago ?? null;
      if (d.pagos_detalle) {
        try {
          const pagos: { metodo_pago: string; monto: number }[] = JSON.parse(d.pagos_detalle);
          metodoPago = pagos.length === 1 ? pagos[0].metodo_pago as typeof metodoPago : "mixto";
        } catch {
          // keep provided metodo_pago
        }
      }
      const result = await db
        .prepare(
          `INSERT INTO facturas (negocio_id, user_id, fecha, monto_total, metodo_pago, concepto, numero_comprobante, notas, turno, pagos_detalle, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
        )
        .bind(negocio.id, user.id, d.fecha, d.monto_total, metodoPago, d.concepto ?? null, d.numero_comprobante ?? null, d.notas ?? null, d.turno ?? null, d.pagos_detalle ?? null, now, now)
        .first();
      await logUsage(db, user.id, negocio.id, "create", "factura");
      return c.json(apiResponse(result), 201);
    } catch (error) {
      console.error("Error creating factura:", error);
      return c.json(apiError("CREATE_ERROR", "Error al crear factura"), 500);
    }
  }
);

// PUT /api/facturacion/:id — update a sale
app.put("/api/facturacion/:id",
  authMiddleware,
  negocioMiddleware,
  createModuleRestrictionMiddleware('facturacion'),
  createUsageLimitMiddleware(USAGE_TOOLS.FACTURACION),
  async (c) => {
    const user = c.get("user");
    const negocio = c.get("negocio");
    const db = c.env.DB;
    const id = Number(c.req.param("id"));
    try {
      const existing = await db
        .prepare("SELECT id FROM facturas WHERE id = ? AND negocio_id = ?")
        .bind(id, negocio.id)
        .first();
      if (!existing) {
        return c.json(apiError("NOT_FOUND", "Factura no encontrada"), 404);
      }
      const body = await c.req.json();
      const validation = validateData(updateFacturaSchema, body);
      if (!validation.success) {
        return c.json(apiError("VALIDATION_ERROR", validation.error || "Datos inválidos"), 400);
      }
      const d = validation.data!;
      const now = new Date().toISOString();
      const fields: string[] = [];
      const values: unknown[] = [];
      if (d.fecha !== undefined)              { fields.push("fecha = ?");              values.push(d.fecha); }
      if (d.monto_total !== undefined)        { fields.push("monto_total = ?");        values.push(d.monto_total); }
      if (d.pagos_detalle !== undefined) {
        // Recalculate metodo_pago from pagos_detalle
        let metodoPago = d.metodo_pago ?? null;
        if (d.pagos_detalle) {
          try {
            const pagos: { metodo_pago: string; monto: number }[] = JSON.parse(d.pagos_detalle);
            metodoPago = pagos.length === 1 ? pagos[0].metodo_pago as typeof metodoPago : "mixto";
          } catch {
            // keep provided metodo_pago
          }
        }
        fields.push("metodo_pago = ?");
        values.push(metodoPago);
        fields.push("pagos_detalle = ?");
        values.push(d.pagos_detalle ?? null);
      } else if (d.metodo_pago !== undefined) {
        fields.push("metodo_pago = ?");
        values.push(d.metodo_pago ?? null);
      }
      if (d.concepto !== undefined)           { fields.push("concepto = ?");           values.push(d.concepto ?? null); }
      if (d.numero_comprobante !== undefined) { fields.push("numero_comprobante = ?"); values.push(d.numero_comprobante ?? null); }
      if (d.notas !== undefined)              { fields.push("notas = ?");              values.push(d.notas ?? null); }
      if (d.turno !== undefined)              { fields.push("turno = ?");              values.push(d.turno ?? null); }
      fields.push("updated_at = ?");
      values.push(now);
      values.push(id);
      values.push(negocio.id);
      const result = await db
        .prepare(`UPDATE facturas SET ${fields.join(", ")} WHERE id = ? AND negocio_id = ? RETURNING *`)
        .bind(...values)
        .first();
      await logUsage(db, user.id, negocio.id, "update", "factura");
      return c.json(apiResponse(result));
    } catch (error) {
      console.error("Error updating factura:", error);
      return c.json(apiError("UPDATE_ERROR", "Error al actualizar factura"), 500);
    }
  }
);

// DELETE /api/facturacion/:id — delete a sale
app.delete("/api/facturacion/:id",
  authMiddleware,
  negocioMiddleware,
  createModuleRestrictionMiddleware('facturacion'),
  createUsageLimitMiddleware(USAGE_TOOLS.FACTURACION),
  async (c) => {
    const user = c.get("user");
    const negocio = c.get("negocio");
    const db = c.env.DB;
    const id = Number(c.req.param("id"));
    try {
      const existing = await db
        .prepare("SELECT id FROM facturas WHERE id = ? AND negocio_id = ?")
        .bind(id, negocio.id)
        .first();
      if (!existing) {
        return c.json(apiError("NOT_FOUND", "Factura no encontrada"), 404);
      }
      await db
        .prepare("DELETE FROM facturas WHERE id = ? AND negocio_id = ?")
        .bind(id, negocio.id)
        .run();
      await logUsage(db, user.id, negocio.id, "delete", "factura");
      return c.json(apiResponse({ deleted: true }));
    } catch (error) {
      console.error("Error deleting factura:", error);
      return c.json(apiError("DELETE_ERROR", "Error al eliminar factura"), 500);
    }
  }
);

export default app;
