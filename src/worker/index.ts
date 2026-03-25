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
} from "./validation";
// Removed GoogleGenAI SDK import - using direct fetch instead for Cloudflare Workers compatibility

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

type Variables = {
  user: UserPayload;
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

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Helper for standardized API responses
const apiResponse = <T>(data: T) => ({ success: true, data });
const apiError = (code: string, message: string) => ({ success: false, error: { code, message } });

// Helper to check if user is admin
async function isAdmin(email: string, db: D1Database, env: Env): Promise<boolean> {
  // Check if it's the initial admin
  if (email.toLowerCase() === env.INITIAL_ADMIN_EMAIL?.toLowerCase()) {
    return true;
  }
  
  // Check if in admin_emails table
  const result = await db
    .prepare("SELECT id FROM admin_emails WHERE LOWER(email) = LOWER(?)")
    .bind(email)
    .first();
  
  return !!result;
}

// Helper to log usage
async function logUsage(db: D1Database, userId: string, actionType: string, entityType: string): Promise<void> {
  try {
    const now = new Date().toISOString();
    await db
      .prepare("INSERT INTO usage_logs (user_id, action_type, entity_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
      .bind(userId, actionType, entityType, now, now)
      .run();
  } catch (error) {
    console.error("Error logging usage:", error);
  }
}

// ============================================
// Authentication Routes
// ============================================

// Get Google OAuth redirect URL
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

// Exchange code for session token
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

    // Exchange authorization code for access token
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
        { success: false, error: { code: "AUTH_ERROR", message: err.error_description ?? "Error al procesar la autenticación" } },
        500
      );
    }

    const { access_token } = await tokenRes.json() as { access_token: string };

    // Fetch Google user info
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

// Get current user
app.get("/api/users/me", authMiddleware, (c) => {
  return c.json({ success: true, data: c.get("user") });
});

// Logout
app.get("/api/logout", (c) => {
  c.header("Set-Cookie", `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
  return c.json({ success: true }, 200);
});

// ============================================
// Employee Routes (Protected)
// ============================================

// Get all employees for current user
app.get("/api/employees", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const db = c.env.DB;

    const employees = await db
      .prepare(
        `SELECT e.*, 
          (SELECT COUNT(*) FROM topics WHERE employee_id = e.id) as topics_count
         FROM employees e 
         WHERE e.user_id = ? 
         ORDER BY e.name ASC`
      )
      .bind(user.id)
      .all();

    await logUsage(db, user.id, "view", "employee");
    return c.json(apiResponse(employees.results), 200);
  } catch (error) {
    console.error("Error fetching employees:", error);
    return c.json(apiError("FETCH_ERROR", "Error al obtener empleados"), 500);
  }
});

// Get single employee
app.get("/api/employees/:id", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const employeeId = c.req.param("id");
    const db = c.env.DB;

    const employee = await db
      .prepare(
        `SELECT e.*, 
          (SELECT COUNT(*) FROM topics WHERE employee_id = e.id) as topics_count
         FROM employees e 
         WHERE e.id = ? AND e.user_id = ?`
      )
      .bind(employeeId, user.id)
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

// Create employee
app.post("/api/employees", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
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
        `INSERT INTO employees (user_id, name, role, phone, email, hire_date, is_active, monthly_salary, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
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

    await logUsage(db, user.id, "create", "employee");
    return c.json(apiResponse(newEmployee), 201);
  } catch (error) {
    console.error("Error creating employee:", error);
    return c.json(apiError("CREATE_ERROR", "Error al crear empleado"), 500);
  }
});

// Update employee
app.put("/api/employees/:id", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const employeeId = c.req.param("id");
    const body = await c.req.json();
    const db = c.env.DB;

    const validation = validateData(updateEmployeeSchema, body);
    if (!validation.success) {
      return c.json(apiError("VALIDATION_ERROR", validation.error || "Datos inválidos"), 400);
    }
    const validData = validation.data!;

    // Check ownership
    const existing = await db
      .prepare("SELECT id FROM employees WHERE id = ? AND user_id = ?")
      .bind(employeeId, user.id)
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
         WHERE id = ? AND user_id = ?`
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
        user.id
      )
      .run();

    const updated = await db
      .prepare("SELECT * FROM employees WHERE id = ?")
      .bind(employeeId)
      .first();

    await logUsage(db, user.id, "update", "employee");
    return c.json(apiResponse(updated), 200);
  } catch (error) {
    console.error("Error updating employee:", error);
    return c.json(apiError("UPDATE_ERROR", "Error al actualizar empleado"), 500);
  }
});

// Delete employee
app.delete("/api/employees/:id", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const employeeId = c.req.param("id");
    const db = c.env.DB;

    // Check ownership
    const existing = await db
      .prepare("SELECT id FROM employees WHERE id = ? AND user_id = ?")
      .bind(employeeId, user.id)
      .first();

    if (!existing) {
      return c.json(apiError("NOT_FOUND", "Empleado no encontrado"), 404);
    }

    // Delete related notes and topics first
    await db
      .prepare("DELETE FROM notes WHERE topic_id IN (SELECT id FROM topics WHERE employee_id = ?)")
      .bind(employeeId)
      .run();
    await db.prepare("DELETE FROM topics WHERE employee_id = ?").bind(employeeId).run();
    await db.prepare("DELETE FROM employees WHERE id = ?").bind(employeeId).run();

    await logUsage(db, user.id, "delete", "employee");
    return c.json(apiResponse({ deleted: true }), 200);
  } catch (error) {
    console.error("Error deleting employee:", error);
    return c.json(apiError("DELETE_ERROR", "Error al eliminar empleado"), 500);
  }
});

// ============================================
// Job Roles Routes (Protected)
// ============================================

// Get all job roles for user
app.get("/api/job-roles", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const db = c.env.DB;

    const roles = await db
      .prepare("SELECT * FROM job_roles WHERE user_id = ? ORDER BY name ASC")
      .bind(user.id)
      .all();

    return c.json(apiResponse(roles.results), 200);
  } catch (error) {
    console.error("Error fetching job roles:", error);
    return c.json(apiError("FETCH_ERROR", "Error al obtener puestos"), 500);
  }
});

// Create job role
app.post("/api/job-roles", authMiddleware, async (c) => {
  try {
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
      .prepare(
        "INSERT INTO job_roles (user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)"
      )
      .bind(user.id, validData.name.trim(), now, now)
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

// Delete job role
app.delete("/api/job-roles/:id", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const roleId = c.req.param("id");
    const db = c.env.DB;

    // Verify role belongs to user
    const role = await db
      .prepare("SELECT id FROM job_roles WHERE id = ? AND user_id = ?")
      .bind(roleId, user.id)
      .first();

    if (!role) {
      return c.json(apiError("NOT_FOUND", "Puesto no encontrado"), 404);
    }

    await db
      .prepare("DELETE FROM job_roles WHERE id = ?")
      .bind(roleId)
      .run();

    return c.json(apiResponse({ id: roleId }), 200);
  } catch (error) {
    console.error("Error deleting job role:", error);
    return c.json(apiError("DELETE_ERROR", "Error al eliminar puesto"), 500);
  }
});

// ============================================
// Topic Routes (Protected)
// ============================================

// Get all topics for an employee
app.get("/api/employees/:employeeId/topics", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const employeeId = c.req.param("employeeId");
    const db = c.env.DB;

    // Verify employee belongs to user
    const employee = await db
      .prepare("SELECT id FROM employees WHERE id = ? AND user_id = ?")
      .bind(employeeId, user.id)
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

// Create topic for an employee
app.post("/api/employees/:employeeId/topics", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const employeeId = c.req.param("employeeId");
    const body = await c.req.json();
    const db = c.env.DB;

    // Verify employee belongs to user
    const employee = await db
      .prepare("SELECT id FROM employees WHERE id = ? AND user_id = ?")
      .bind(employeeId, user.id)
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

// Update topic
app.put("/api/topics/:id", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const topicId = c.req.param("id");
    const body = await c.req.json();
    const db = c.env.DB;

    // Verify topic belongs to user's employee
    const topic = await db
      .prepare(
        `SELECT t.id FROM topics t 
         JOIN employees e ON t.employee_id = e.id 
         WHERE t.id = ? AND e.user_id = ?`
      )
      .bind(topicId, user.id)
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
    
    // Build update query dynamically based on provided fields
    const updates: string[] = ["updated_at = ?"];
    const values: (string | number | null)[] = [now];
    
    if (validData.title !== undefined) {
      updates.push("title = ?");
      values.push(validData.title);
    }
    if (validData.is_open !== undefined) {
      updates.push("is_open = ?");
      values.push(validData.is_open ? 1 : 0);
    }
    if (validData.due_date !== undefined) {
      updates.push("due_date = ?");
      values.push(validData.due_date || null);
    }
    if (validData.due_time !== undefined) {
      updates.push("due_time = ?");
      values.push(validData.due_time || null);
    }
    
    values.push(topicId);
    
    await db
      .prepare(`UPDATE topics SET ${updates.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();

    const updated = await db
      .prepare("SELECT * FROM topics WHERE id = ?")
      .bind(topicId)
      .first();

    return c.json(apiResponse(updated), 200);
  } catch (error) {
    console.error("Error updating topic:", error);
    return c.json(apiError("UPDATE_ERROR", "Error al actualizar tema"), 500);
  }
});

// Delete topic
app.delete("/api/topics/:id", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const topicId = c.req.param("id");
    const db = c.env.DB;

    // Verify topic belongs to user's employee
    const topic = await db
      .prepare(
        `SELECT t.id FROM topics t 
         JOIN employees e ON t.employee_id = e.id 
         WHERE t.id = ? AND e.user_id = ?`
      )
      .bind(topicId, user.id)
      .first();

    if (!topic) {
      return c.json(apiError("NOT_FOUND", "Tema no encontrado"), 404);
    }

    // Delete related notes first
    await db.prepare("DELETE FROM notes WHERE topic_id = ?").bind(topicId).run();
    await db.prepare("DELETE FROM topics WHERE id = ?").bind(topicId).run();

    return c.json(apiResponse({ deleted: true }), 200);
  } catch (error) {
    console.error("Error deleting topic:", error);
    return c.json(apiError("DELETE_ERROR", "Error al eliminar tema"), 500);
  }
});

// ============================================
// Note Routes (Protected)
// ============================================

// Get all notes for a topic
app.get("/api/topics/:topicId/notes", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const topicId = c.req.param("topicId");
    const db = c.env.DB;

    // Verify topic belongs to user's employee
    const topic = await db
      .prepare(
        `SELECT t.id FROM topics t 
         JOIN employees e ON t.employee_id = e.id 
         WHERE t.id = ? AND e.user_id = ?`
      )
      .bind(topicId, user.id)
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

// Create note for a topic
app.post("/api/topics/:topicId/notes", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const topicId = c.req.param("topicId");
    const body = await c.req.json();
    const db = c.env.DB;

    // Verify topic belongs to user's employee
    const topic = await db
      .prepare(
        `SELECT t.id FROM topics t 
         JOIN employees e ON t.employee_id = e.id 
         WHERE t.id = ? AND e.user_id = ?`
      )
      .bind(topicId, user.id)
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
      .prepare(
        `INSERT INTO notes (topic_id, content, created_at, updated_at)
         VALUES (?, ?, ?, ?)`
      )
      .bind(topicId, validData.content, now, now)
      .run();

    // Update topic's updated_at
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

// Update note
app.put("/api/notes/:id", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const noteId = c.req.param("id");
    const body = await c.req.json();
    const db = c.env.DB;

    // Verify note belongs to user's employee
    const note = await db
      .prepare(
        `SELECT n.id FROM notes n 
         JOIN topics t ON n.topic_id = t.id 
         JOIN employees e ON t.employee_id = e.id 
         WHERE n.id = ? AND e.user_id = ?`
      )
      .bind(noteId, user.id)
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

    const updated = await db
      .prepare("SELECT * FROM notes WHERE id = ?")
      .bind(noteId)
      .first();

    return c.json(apiResponse(updated), 200);
  } catch (error) {
    console.error("Error updating note:", error);
    return c.json(apiError("UPDATE_ERROR", "Error al actualizar nota"), 500);
  }
});

// Delete note
app.delete("/api/notes/:id", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const noteId = c.req.param("id");
    const db = c.env.DB;

    // Verify note belongs to user's employee
    const note = await db
      .prepare(
        `SELECT n.id FROM notes n 
         JOIN topics t ON n.topic_id = t.id 
         JOIN employees e ON t.employee_id = e.id 
         WHERE n.id = ? AND e.user_id = ?`
      )
      .bind(noteId, user.id)
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
// Topic Deadlines for Calendar (Protected)
// ============================================

// Get all topics with deadlines for a month (for calendar view)
app.get("/api/topics/deadlines", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const db = c.env.DB;
    const { month, year } = c.req.query();

    let query = `
      SELECT t.*, e.name as employee_name, e.id as employee_id
      FROM topics t 
      JOIN employees e ON t.employee_id = e.id 
      WHERE e.user_id = ? AND t.due_date IS NOT NULL
    `;
    const params: (string | number)[] = [user.id];

    if (month && year) {
      const startDate = `${year}-${month.padStart(2, '0')}-01`;
      const endDate = `${year}-${month.padStart(2, '0')}-31`;
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
// Event Routes (Protected)
// ============================================

// Get all events for current user
app.get("/api/events", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const db = c.env.DB;
    const { month, year } = c.req.query();

    let query = "SELECT * FROM events WHERE user_id = ?";
    const params: (string | number)[] = [user.id];

    if (month && year) {
      // Filter by month/year
      const startDate = `${year}-${month.padStart(2, '0')}-01`;
      const endDate = `${year}-${month.padStart(2, '0')}-31`;
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

// Get single event
app.get("/api/events/:id", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const eventId = c.req.param("id");
    const db = c.env.DB;

    const event = await db
      .prepare("SELECT * FROM events WHERE id = ? AND user_id = ?")
      .bind(eventId, user.id)
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

// Create event
app.post("/api/events", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
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
        `INSERT INTO events (user_id, title, description, event_date, start_time, end_time, event_type, location, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
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

    await logUsage(db, user.id, "create", "event");
    return c.json(apiResponse(newEvent), 201);
  } catch (error) {
    console.error("Error creating event:", error);
    return c.json(apiError("CREATE_ERROR", "Error al crear evento"), 500);
  }
});

// Update event
app.put("/api/events/:id", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const eventId = c.req.param("id");
    const body = await c.req.json();
    const db = c.env.DB;

    const existing = await db
      .prepare("SELECT id FROM events WHERE id = ? AND user_id = ?")
      .bind(eventId, user.id)
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
         WHERE id = ? AND user_id = ?`
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
        user.id
      )
      .run();

    const updated = await db
      .prepare("SELECT * FROM events WHERE id = ?")
      .bind(eventId)
      .first();

    await logUsage(db, user.id, "update", "event");
    return c.json(apiResponse(updated), 200);
  } catch (error) {
    console.error("Error updating event:", error);
    return c.json(apiError("UPDATE_ERROR", "Error al actualizar evento"), 500);
  }
});

// Delete event
app.delete("/api/events/:id", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const eventId = c.req.param("id");
    const db = c.env.DB;

    const existing = await db
      .prepare("SELECT id FROM events WHERE id = ? AND user_id = ?")
      .bind(eventId, user.id)
      .first();

    if (!existing) {
      return c.json(apiError("NOT_FOUND", "Evento no encontrado"), 404);
    }

    await db.prepare("DELETE FROM events WHERE id = ?").bind(eventId).run();

    await logUsage(db, user.id, "delete", "event");
    return c.json(apiResponse({ deleted: true }), 200);
  } catch (error) {
    console.error("Error deleting event:", error);
    return c.json(apiError("DELETE_ERROR", "Error al eliminar evento"), 500);
  }
});

// ============================================
// Salary & Advances Routes (Protected)
// ============================================

// Get salary overview for current period
app.get("/api/salaries/overview", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const db = c.env.DB;
    const { month, year } = c.req.query();

    const now = new Date();
    const currentMonth = month ? parseInt(month) : now.getMonth() + 1;
    const currentYear = year ? parseInt(year) : now.getFullYear();

    // Get all active employees with their salary data
    const employees = await db
      .prepare(
        `SELECT e.id, e.name, e.role, e.monthly_salary,
          (SELECT COALESCE(SUM(amount), 0) FROM advances 
           WHERE employee_id = e.id AND period_month = ? AND period_year = ?) as advances_total
         FROM employees e
         WHERE e.user_id = ? AND e.is_active = 1
         ORDER BY e.monthly_salary DESC`
      )
      .bind(currentMonth, currentYear, user.id)
      .all();

    // Calculate totals
    const totals = {
      total_salaries: 0,
      total_advances: 0,
      total_remaining: 0,
    };

    const employeesWithCalculations = employees.results.map((emp: any) => {
      const salary = emp.monthly_salary || 0;
      const advances = emp.advances_total || 0;
      const remaining = salary - advances;

      totals.total_salaries += salary;
      totals.total_advances += advances;
      totals.total_remaining += remaining;

      return {
        ...emp,
        remaining: remaining,
      };
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

// Get advances for an employee in a period
app.get("/api/employees/:employeeId/advances", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const employeeId = c.req.param("employeeId");
    const db = c.env.DB;
    const { month, year } = c.req.query();

    // Verify employee belongs to user
    const employee = await db
      .prepare("SELECT id FROM employees WHERE id = ? AND user_id = ?")
      .bind(employeeId, user.id)
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

// Create advance for an employee
app.post("/api/employees/:employeeId/advances", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const employeeId = c.req.param("employeeId");
    const body = await c.req.json();
    const db = c.env.DB;

    // Verify employee belongs to user
    const employee = await db
      .prepare("SELECT id, monthly_salary FROM employees WHERE id = ? AND user_id = ?")
      .bind(employeeId, user.id)
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
    const advanceDate = validData.advance_date || now.toISOString().split('T')[0];
    const timestamp = now.toISOString();

    const result = await db
      .prepare(
        `INSERT INTO advances (user_id, employee_id, amount, period_month, period_year, advance_date, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
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

    await logUsage(db, user.id, "create", "advance");
    return c.json(apiResponse(newAdvance), 201);
  } catch (error) {
    console.error("Error creating advance:", error);
    return c.json(apiError("CREATE_ERROR", "Error al crear adelanto"), 500);
  }
});

// Delete advance
app.delete("/api/advances/:id", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const advanceId = c.req.param("id");
    const db = c.env.DB;

    const advance = await db
      .prepare("SELECT id FROM advances WHERE id = ? AND user_id = ?")
      .bind(advanceId, user.id)
      .first();

    if (!advance) {
      return c.json(apiError("NOT_FOUND", "Adelanto no encontrado"), 404);
    }

    await db.prepare("DELETE FROM advances WHERE id = ?").bind(advanceId).run();
    
    await logUsage(db, user.id, "delete", "advance");
    return c.json(apiResponse({ deleted: true }), 200);
  } catch (error) {
    console.error("Error deleting advance:", error);
    return c.json(apiError("DELETE_ERROR", "Error al eliminar adelanto"), 500);
  }
});

// Get salary payment records
app.get("/api/salary-payments", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const db = c.env.DB;
    const { month, year } = c.req.query();

    let query = `
      SELECT sp.*, e.name as employee_name
      FROM salary_payments sp
      JOIN employees e ON sp.employee_id = e.id
      WHERE sp.user_id = ?
    `;
    const params: (string | number)[] = [user.id];

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

// Mark salary as paid (individual)
app.post("/api/salary-payments/mark-paid", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();
    const db = c.env.DB;

    if (!body.employee_id || !body.period_month || !body.period_year) {
      return c.json(apiError("VALIDATION_ERROR", "Datos incompletos"), 400);
    }

    // Verify employee belongs to user
    const employee = await db
      .prepare("SELECT id, monthly_salary FROM employees WHERE id = ? AND user_id = ?")
      .bind(body.employee_id, user.id)
      .first();

    if (!employee) {
      return c.json(apiError("NOT_FOUND", "Empleado no encontrado"), 404);
    }

    const validation = validateData(markSalaryPaidSchema, { paid_date: body.paid_date });
    if (!validation.success) {
      return c.json(apiError("VALIDATION_ERROR", validation.error || "Datos inválidos"), 400);
    }

    // Get total advances for period
    const advancesResult = await db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) as total
         FROM advances
         WHERE employee_id = ? AND period_month = ? AND period_year = ?`
      )
      .bind(body.employee_id, body.period_month, body.period_year)
      .first();

    const advancesTotal = (advancesResult as any)?.total || 0;
    const salaryAmount = (employee as any).monthly_salary || 0;
    const netAmount = salaryAmount - advancesTotal;
    const now = new Date().toISOString();
    const paidDate = now.split('T')[0];

    // Check if record exists
    const existing = await db
      .prepare(
        `SELECT id FROM salary_payments 
         WHERE employee_id = ? AND period_month = ? AND period_year = ?`
      )
      .bind(body.employee_id, body.period_month, body.period_year)
      .first();

    if (existing) {
      // Update existing
      await db
        .prepare(
          `UPDATE salary_payments 
           SET is_paid = 1, paid_date = ?, updated_at = ?
           WHERE id = ?`
        )
        .bind(paidDate, now, (existing as any).id)
        .run();
    } else {
      // Create new
      await db
        .prepare(
          `INSERT INTO salary_payments 
           (user_id, employee_id, period_month, period_year, salary_amount, advances_total, net_amount, is_paid, paid_date, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`
        )
        .bind(
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

    await logUsage(db, user.id, "payment", "salary");
    return c.json(apiResponse({ success: true }), 200);
  } catch (error) {
    console.error("Error marking salary as paid:", error);
    return c.json(apiError("UPDATE_ERROR", "Error al marcar como pagado"), 500);
  }
});

// Mark all salaries as paid for a period
app.post("/api/salary-payments/mark-all-paid", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();
    const db = c.env.DB;

    if (!body.period_month || !body.period_year) {
      return c.json(apiError("VALIDATION_ERROR", "Período requerido"), 400);
    }

    const validation = validateData(markSalaryPaidSchema, { paid_date: body.paid_date });
    if (!validation.success) {
      return c.json(apiError("VALIDATION_ERROR", validation.error || "Datos inválidos"), 400);
    }

    // Get all active employees
    const employees = await db
      .prepare("SELECT id, monthly_salary FROM employees WHERE user_id = ? AND is_active = 1")
      .bind(user.id)
      .all();

    const now = new Date().toISOString();
    const paidDate = now.split('T')[0];

    for (const emp of employees.results) {
      const employee = emp as any;
      
      // Get advances for this employee in this period
      const advancesResult = await db
        .prepare(
          `SELECT COALESCE(SUM(amount), 0) as total
           FROM advances
           WHERE employee_id = ? AND period_month = ? AND period_year = ?`
        )
        .bind(employee.id, body.period_month, body.period_year)
        .first();

      const advancesTotal = (advancesResult as any)?.total || 0;
      const salaryAmount = employee.monthly_salary || 0;
      const netAmount = salaryAmount - advancesTotal;

      // Check if record exists
      const existing = await db
        .prepare(
          `SELECT id FROM salary_payments 
           WHERE employee_id = ? AND period_month = ? AND period_year = ?`
        )
        .bind(employee.id, body.period_month, body.period_year)
        .first();

      if (existing) {
        await db
          .prepare(
            `UPDATE salary_payments 
             SET is_paid = 1, paid_date = ?, updated_at = ?
             WHERE id = ?`
          )
          .bind(paidDate, now, (existing as any).id)
          .run();
      } else {
        await db
          .prepare(
            `INSERT INTO salary_payments 
             (user_id, employee_id, period_month, period_year, salary_amount, advances_total, net_amount, is_paid, paid_date, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`
          )
          .bind(
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

    await logUsage(db, user.id, "payment", "salary");
    return c.json(apiResponse({ success: true, count: employees.results.length }), 200);
  } catch (error) {
    console.error("Error marking all salaries as paid:", error);
    return c.json(apiError("UPDATE_ERROR", "Error al marcar sueldos como pagados"), 500);
  }
});

// ============================================
// Admin Routes (Protected)
// ============================================

// Check if current user is admin
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

// Get admin statistics
app.get("/api/admin/stats", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const db = c.env.DB;
    
    // Verify user is admin
    const adminStatus = await isAdmin(user.email, db, c.env);
    if (!adminStatus) {
      return c.json(apiError("UNAUTHORIZED", "No tienes permisos de administrador"), 403);
    }
    
    // Get total unique users
    const usersResult = await db
      .prepare("SELECT COUNT(DISTINCT user_id) as count FROM employees")
      .first() as any;
    const totalUsers = usersResult?.count || 0;
    
    // Get all unique user emails (from employees table user_id field - we'll need to track this better)
    // For now, count distinct user_ids
    const registeredEmails = totalUsers;
    
    // Get average employees per user
    const avgEmployeesResult = await db
      .prepare(`
        SELECT AVG(emp_count) as avg_count
        FROM (
          SELECT user_id, COUNT(*) as emp_count
          FROM employees
          GROUP BY user_id
        )
      `)
      .first() as any;
    const avgEmployees = Math.round(avgEmployeesResult?.avg_count || 0);
    
    // Get average events per user
    const avgEventsResult = await db
      .prepare(`
        SELECT AVG(event_count) as avg_count
        FROM (
          SELECT user_id, COUNT(*) as event_count
          FROM events
          GROUP BY user_id
        )
      `)
      .first() as any;
    const avgEvents = Math.round(avgEventsResult?.avg_count || 0);
    
    // Get usage statistics
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
    
    return c.json(apiResponse({
      totalUsers,
      registeredEmails,
      avgEmployees,
      avgEvents,
      usage,
    }), 200);
  } catch (error) {
    console.error("Error getting admin stats:", error);
    return c.json(apiError("STATS_ERROR", "Error al obtener estadísticas"), 500);
  }
});

// Get all admin emails
app.get("/api/admin/emails", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const db = c.env.DB;
    
    // Verify user is admin
    const adminStatus = await isAdmin(user.email, db, c.env);
    if (!adminStatus) {
      return c.json(apiError("UNAUTHORIZED", "No tienes permisos de administrador"), 403);
    }
    
    const emails = await db
      .prepare("SELECT id, email, added_by, created_at FROM admin_emails ORDER BY created_at DESC")
      .all();
    
    // Add the initial admin email to the list
    const allEmails = [
      {
        id: 0,
        email: c.env.INITIAL_ADMIN_EMAIL,
        added_by: "Sistema",
        created_at: new Date(0).toISOString(),
        is_initial: true,
      },
      ...emails.results.map((e: any) => ({ ...e, is_initial: false })),
    ];
    
    return c.json(apiResponse(allEmails), 200);
  } catch (error) {
    console.error("Error getting admin emails:", error);
    return c.json(apiError("GET_ERROR", "Error al obtener correos de administradores"), 500);
  }
});

// Add admin email
app.post("/api/admin/emails", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const db = c.env.DB;
    const body = await c.req.json();
    
    // Verify user is admin
    const adminStatus = await isAdmin(user.email, db, c.env);
    if (!adminStatus) {
      return c.json(apiError("UNAUTHORIZED", "No tienes permisos de administrador"), 403);
    }
    
    if (!body.email) {
      return c.json(apiError("VALIDATION_ERROR", "Correo electrónico requerido"), 400);
    }
    
    const now = new Date().toISOString();
    
    // Check if email already exists
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

// Delete admin email
app.delete("/api/admin/emails/:id", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const db = c.env.DB;
    const id = c.req.param("id");
    
    // Verify user is admin
    const adminStatus = await isAdmin(user.email, db, c.env);
    if (!adminStatus) {
      return c.json(apiError("UNAUTHORIZED", "No tienes permisos de administrador"), 403);
    }
    
    await db
      .prepare("DELETE FROM admin_emails WHERE id = ?")
      .bind(id)
      .run();
    
    return c.json(apiResponse({ success: true }), 200);
  } catch (error) {
    console.error("Error deleting admin email:", error);
    return c.json(apiError("DELETE_ERROR", "Error al eliminar administrador"), 500);
  }
});

// ============================================
// Chatbot Routes
// ============================================

// Chat with Gemini AI about user's data
app.post("/api/chat", authMiddleware, async (c) => {
  try {
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

    // Fetch user's data to provide context to Gemini
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Get employees
    const employeesResult = await db
      .prepare("SELECT * FROM employees WHERE user_id = ?")
      .bind(user.id)
      .all();
    const employees = employeesResult.results || [];

    // Get events for current month
    const eventsResult = await db
      .prepare(`
        SELECT * FROM events 
        WHERE user_id = ? 
        AND strftime('%m', event_date) = ? 
        AND strftime('%Y', event_date) = ?
      `)
      .bind(user.id, currentMonth.toString().padStart(2, "0"), currentYear.toString())
      .all();
    const events = eventsResult.results || [];

    // Get open topics with deadlines
    const topicsResult = await db
      .prepare(`
        SELECT t.*, e.name as employee_name
        FROM topics t
        JOIN employees e ON t.employee_id = e.id
        WHERE e.user_id = ? AND t.is_open = 1
      `)
      .bind(user.id)
      .all();
    const topics = topicsResult.results || [];

    // Get advances for current period
    const advancesResult = await db
      .prepare(`
        SELECT a.*, e.name as employee_name
        FROM advances a
        JOIN employees e ON a.employee_id = e.id
        WHERE a.user_id = ? AND a.period_month = ? AND a.period_year = ?
      `)
      .bind(user.id, currentMonth, currentYear)
      .all();
    const advances = advancesResult.results || [];

    // Get salary payments for current period
    const salaryPaymentsResult = await db
      .prepare(`
        SELECT sp.*, e.name as employee_name
        FROM salary_payments sp
        JOIN employees e ON sp.employee_id = e.id
        WHERE sp.user_id = ? AND sp.period_month = ? AND sp.period_year = ?
      `)
      .bind(user.id, currentMonth, currentYear)
      .all();
    const salaryPayments = salaryPaymentsResult.results || [];

    // Build context for Gemini
    const context = `
Eres un asistente virtual para Gastro Manager, un sistema de gestión de restaurantes. 
Tienes acceso a los siguientes datos de la cuenta del usuario:

EMPLEADOS (${employees.length} total):
${employees.map((emp: any) => `- ${emp.name} (${emp.role}), Estado: ${emp.is_active ? "Activo" : "Inactivo"}, Salario mensual: $${emp.monthly_salary || 0}, Fecha contratación: ${emp.hire_date || "No especificada"}`).join("\n")}

EVENTOS DEL MES ACTUAL (${events.length} total):
${events.length > 0 ? events.map((evt: any) => `- ${evt.title} el ${evt.event_date} ${evt.start_time ? `a las ${evt.start_time}` : ""} (${evt.event_type || "General"})`).join("\n") : "No hay eventos este mes"}

TEMAS ABIERTOS (${topics.length} total):
${topics.length > 0 ? topics.map((topic: any) => `- ${topic.title} (Empleado: ${topic.employee_name})${topic.due_date ? `, Vence: ${topic.due_date}` : ""}`).join("\n") : "No hay temas abiertos"}

ADELANTOS DEL MES (${advances.length} total):
${advances.length > 0 ? advances.map((adv: any) => `- $${adv.amount} para ${adv.employee_name} el ${adv.advance_date}${adv.description ? ` (${adv.description})` : ""}`).join("\n") : "No hay adelantos este mes"}

PAGOS DE SUELDOS DEL MES (${salaryPayments.length} total):
${salaryPayments.length > 0 ? salaryPayments.map((sp: any) => `- ${sp.employee_name}: Salario $${sp.salary_amount}, Adelantos $${sp.advances_total}, Neto $${sp.net_amount}, ${sp.is_paid ? "PAGADO" : "PENDIENTE"}`).join("\n") : "No hay registros de pago este mes"}

ESTADÍSTICAS GENERALES:
- Total empleados: ${employees.length}
- Empleados activos: ${employees.filter((e: any) => e.is_active).length}
- Empleados inactivos: ${employees.filter((e: any) => !e.is_active).length}
- Total adelantos del mes: $${advances.reduce((sum: number, a: any) => sum + (a.amount || 0), 0)}
- Total sueldos del mes: $${salaryPayments.reduce((sum: number, sp: any) => sum + (sp.salary_amount || 0), 0)}

Responde de manera concisa y útil las preguntas del usuario sobre estos datos.
Si el usuario pregunta algo que no está en los datos, indícale amablemente que solo puedes responder sobre la información de su cuenta.
Usa un tono profesional pero amigable. Responde SIEMPRE en español.
`;

    // Call Gemini API using REST (Cloudflare Workers compatible)
    const apiKey = c.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY no configurada");
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    let geminiResponse;
    let geminiData: any;
    
    try {
      geminiResponse = await fetch(geminiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${context}\n\nUsuario pregunta: ${message}`
            }]
          }],
          generationConfig: {
            temperature: 1.0,
            maxOutputTokens: 500,
          }
        })
      });
    } catch (fetchError: any) {
      console.error("Fetch failed:", fetchError);
      return c.json(apiError("NETWORK_ERROR", "Error de conexión con Gemini API. Por favor intenta de nuevo."), 500);
    }

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini API error response:", {
        status: geminiResponse.status,
        statusText: geminiResponse.statusText,
        body: errorText
      });
      
      // Parse error message from Gemini
      try {
        const errorData = JSON.parse(errorText);
        const errorMessage = errorData?.error?.message || "Error desconocido de Gemini API";
        return c.json(apiError("GEMINI_API_ERROR", `Gemini API: ${errorMessage}`), 500);
      } catch {
        return c.json(apiError("GEMINI_API_ERROR", `Error ${geminiResponse.status}: ${errorText.substring(0, 100)}`), 500);
      }
    }

    try {
      geminiData = await geminiResponse.json();
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", parseError);
      return c.json(apiError("PARSE_ERROR", "Error al procesar la respuesta de Gemini"), 500);
    }

    const reply = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "Lo siento, no pude generar una respuesta.";

    return c.json(apiResponse({ reply }), 200);
  } catch (error: any) {
    console.error("Unexpected error in chat endpoint:", {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return c.json(apiError("CHAT_ERROR", `Error inesperado: ${error.message}`), 500);
  }
});

export default app;
