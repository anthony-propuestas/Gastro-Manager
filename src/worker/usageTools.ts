// Canonical tool names used in usage_counters and usage_limits tables.
// These strings are the source of truth — the middleware, DB seed, and admin panel
// must all use these constants to avoid silent mismatches.
//
// Design decisions (see docs/plan-usuarios-por-niveles.md):
//   - Limits are scoped per user+negocio (not global per user).
//   - mark-all-paid counts N uses (one per employee marked), not 1 per call.

export const USAGE_TOOLS = {
  EMPLOYEES:       "employees",        // POST /api/employees
  JOB_ROLES:       "job_roles",        // POST /api/job-roles
  TOPICS:          "topics",           // POST /api/employees/:id/topics
  NOTES:           "notes",            // POST /api/topics/:id/notes
  ADVANCES:        "advances",         // POST /api/employees/:id/advances
  SALARY_PAYMENTS: "salary_payments",  // POST /api/salary-payments/mark-paid
                                       // POST /api/salary-payments/mark-all-paid (N uses per employee)
  EVENTS:          "events",           // POST /api/events
  CHAT:            "chat",             // POST /api/chat
  COMPRAS:         "compras",          // POST /api/compras
} as const;

export type UsageTool = typeof USAGE_TOOLS[keyof typeof USAGE_TOOLS];
