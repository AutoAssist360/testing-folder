import { z } from "zod";

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Shared ──────────────────────────────────────────────────

export const uuidParam = z
  .string()
  .regex(uuidRegex, "Invalid UUID format");

export const paginationQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const dateRangeQuery = z.object({
  from: z.string().datetime({ message: "Invalid from date" }).optional(),
  to: z.string().datetime({ message: "Invalid to date" }).optional(),
});

// ─── Auth ────────────────────────────────────────────────────

export const adminSigninSchema = z.object({
  email: z
    .string()
    .regex(
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      "Invalid email format"
    ),
  password: z.string().min(1, "Password is required"),
});

// ─── Users ───────────────────────────────────────────────────

export const listUsersQuery = paginationQuery.extend({
  role: z.enum(["admin", "user", "technician", "vendor"]).optional(),
  is_active: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  search: z.string().optional(),
});

// ─── Technicians ─────────────────────────────────────────────

export const listTechniciansQuery = paginationQuery.extend({
  is_verified: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  is_online: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  technician_type: z.enum(["individual", "garage"]).optional(),
  search: z.string().optional(),
});

// ─── Vendors ─────────────────────────────────────────────────

export const listVendorsQuery = paginationQuery.extend({
  is_active: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  search: z.string().optional(),
});

// ─── Warehouses ──────────────────────────────────────────────

export const listWarehousesQuery = paginationQuery.extend({
  is_active: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  city: z.string().optional(),
  state: z.string().optional(),
});

// ─── Requests ────────────────────────────────────────────────

export const listRequestsQuery = paginationQuery.extend({
  status: z
    .enum([
      "created",
      "pending_offers",
      "offer_accepted",
      "in_progress",
      "completed",
      "cancelled",
    ])
    .optional(),
  issue_type: z
    .enum([
      "mechanical_failure",
      "electrical_issue",
      "tire_related",
      "battery_issue",
      "engine_problem",
      "brake_issue",
      "other",
    ])
    .optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const forceAssignSchema = z.object({
  technician_id: uuidParam,
  repair_mode: z.enum(["onsite", "tow_to_garage"]),
  estimated_cost: z.number().positive("Estimated cost must be positive"),
  estimated_time: z.number().int().positive("Estimated time must be positive"),
});

// ─── Jobs ────────────────────────────────────────────────────

export const listJobsQuery = paginationQuery.extend({
  status: z.enum(["assigned", "in_progress", "completed", "verified"]).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

// ─── Orders ──────────────────────────────────────────────────

export const listOrdersQuery = paginationQuery.extend({
  order_status: z
    .enum(["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"])
    .optional(),
  payment_status: z
    .enum(["pending", "completed", "failed", "refunded"])
    .optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const refundOrderSchema = z.object({
  reason: z.string().min(1, "Refund reason is required"),
});

// ─── Invoices ────────────────────────────────────────────────

export const listInvoicesQuery = paginationQuery.extend({
  payment_status: z
    .enum(["pending", "completed", "failed", "refunded"])
    .optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

// ─── Audit Logs ──────────────────────────────────────────────

export const listAuditLogsQuery = paginationQuery.extend({
  entity_type: z.string().optional(),
  action: z.string().optional(),
  performed_by: uuidParam.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

// ─── Analytics ───────────────────────────────────────────────

export const analyticsQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  granularity: z.enum(["day", "week", "month"]).default("month"),
});
