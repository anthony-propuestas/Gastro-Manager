/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hono, type MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { SignJWT, jwtVerify } from "jose";
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
} from "./validation";

type Env = {
  DB: D1Database;
  R2_BUCKET: R2Bucket;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  JWT_SECRET: string;
  INITIAL_ADMIN_EMAIL?: string;
  GEMINI_API_KEY?: string;
};

type UserPayload = { id: string; email: string; name: string; picture: string };
type NegocioPayload = { id: number; name: string };

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
// Middlewares
// ============================================

const authMiddleware: MiddlewareHandler<{ Bindings: Env; Variables: Variables }> = async (c, next) => {
  const token = getCookie(c, COOKIE_NAME);
  if (!token) {
    return c.json({ success: false, error: { code: "UNAUTHORIZED", message: "No autenticado" } }, 401);
  }
  try {
    const user = await verifySession(token, c.env.JWT_SECRET);
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
    .prepare("SELECT negocio_id FROM negocio_members WHERE negocio_id = ? AND user_id = ?")
    .bind(negocioId, user.id)
    .first();
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
  c.set("negocio", { id: negocio.id, name: negocio.name });
  await next();
};

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

    const jwt = await createSession(
      { id: googleUser.id, email: googleUser.email, name: googleUser.name, picture: googleUser.picture ?? "" },
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

    // Add creator as first member
    await db
      .prepare(
        "INSERT INTO negocio_members (negocio_id, user_id, user_email, user_name, invited_by, joined_at) VALUES (?, ?, ?, ?, ?, ?)"
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
          (SELECT COUNT(*) FROM negocio_members WHERE negocio_id = n.id) as member_count
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
        "SELECT user_id, user_email, user_name, invited_by, joined_at FROM negocio_members WHERE negocio_id = ? ORDER BY joined_at ASC"
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
// Employee Routes (Protected + Negocio)
// ============================================

app.get("/api/employees", authMiddleware, negocioMiddleware, async (c) => {
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

app.get("/api/employees/:id", authMiddleware, negocioMiddleware, async (c) => {
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

app.post("/api/employees", authMiddleware, negocioMiddleware, async (c) => {
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

app.put("/api/employees/:id", authMiddleware, negocioMiddleware, async (c) => {
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

app.delete("/api/employees/:id", authMiddleware, negocioMiddleware, async (c) => {
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

app.get("/api/job-roles", authMiddleware, negocioMiddleware, async (c) => {
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

app.post("/api/job-roles", authMiddleware, negocioMiddleware, async (c) => {
  try {
    const negocio = c.get("negocio");
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

    return c.json(apiResponse(newRole), 201);
  } catch (error) {
    console.error("Error creating job role:", error);
    return c.json(apiError("CREATE_ERROR", "Error al crear puesto"), 500);
  }
});

app.delete("/api/job-roles/:id", authMiddleware, negocioMiddleware, async (c) => {
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

app.get("/api/employees/:employeeId/topics", authMiddleware, negocioMiddleware, async (c) => {
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

app.post("/api/employees/:employeeId/topics", authMiddleware, negocioMiddleware, async (c) => {
  try {
    const negocio = c.get("negocio");
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

    return c.json(apiResponse(newTopic), 201);
  } catch (error) {
    console.error("Error creating topic:", error);
    return c.json(apiError("CREATE_ERROR", "Error al crear tema"), 500);
  }
});

app.put("/api/topics/:id", authMiddleware, negocioMiddleware, async (c) => {
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

app.delete("/api/topics/:id", authMiddleware, negocioMiddleware, async (c) => {
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

app.get("/api/topics/:topicId/notes", authMiddleware, negocioMiddleware, async (c) => {
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

app.post("/api/topics/:topicId/notes", authMiddleware, negocioMiddleware, async (c) => {
  try {
    const negocio = c.get("negocio");
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

    return c.json(apiResponse(newNote), 201);
  } catch (error) {
    console.error("Error creating note:", error);
    return c.json(apiError("CREATE_ERROR", "Error al crear nota"), 500);
  }
});

app.put("/api/notes/:id", authMiddleware, negocioMiddleware, async (c) => {
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

app.delete("/api/notes/:id", authMiddleware, negocioMiddleware, async (c) => {
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

app.get("/api/topics/deadlines", authMiddleware, negocioMiddleware, async (c) => {
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

app.get("/api/events", authMiddleware, negocioMiddleware, async (c) => {
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

app.get("/api/events/:id", authMiddleware, negocioMiddleware, async (c) => {
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

app.post("/api/events", authMiddleware, negocioMiddleware, async (c) => {
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

app.put("/api/events/:id", authMiddleware, negocioMiddleware, async (c) => {
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

app.delete("/api/events/:id", authMiddleware, negocioMiddleware, async (c) => {
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

app.get("/api/salaries/overview", authMiddleware, negocioMiddleware, async (c) => {
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

app.get("/api/employees/:employeeId/advances", authMiddleware, negocioMiddleware, async (c) => {
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

app.post("/api/employees/:employeeId/advances", authMiddleware, negocioMiddleware, async (c) => {
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

app.delete("/api/advances/:id", authMiddleware, negocioMiddleware, async (c) => {
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

app.get("/api/salary-payments", authMiddleware, negocioMiddleware, async (c) => {
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

app.post("/api/salary-payments/mark-paid", authMiddleware, negocioMiddleware, async (c) => {
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

app.post("/api/salary-payments/mark-all-paid", authMiddleware, negocioMiddleware, async (c) => {
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

    const usage = {
      employees: employeeActions?.count || 0,
      salaries: salaryActions?.count || 0,
      calendar: calendarActions?.count || 0,
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
// Chatbot Routes (Protected + Negocio)
// ============================================

app.post("/api/chat", authMiddleware, negocioMiddleware, async (c) => {
  try {
    const negocio = c.get("negocio");
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
      return c.json(apiError("GEMINI_API_ERROR", "El asistente no está disponible en este momento. Intenta más tarde."), 500);
    }

    let geminiData: any;
    try {
      geminiData = await geminiResponse.json();
    } catch {
      return c.json(apiError("PARSE_ERROR", "Error al procesar la respuesta del asistente"), 500);
    }

    const reply = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "Lo siento, no pude generar una respuesta.";

    return c.json(apiResponse({ reply }), 200);
  } catch (error: any) {
    console.error("Unexpected error in chat endpoint:", error.message);
    return c.json(apiError("CHAT_ERROR", "Error inesperado en el asistente. Intenta de nuevo."), 500);
  }
});

export default app;
