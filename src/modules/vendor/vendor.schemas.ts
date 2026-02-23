import { z } from "zod";

const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const phoneRegex = /^\d{10}$/;

// ─── Shared ──────────────────────────────────────────────────

export const paginationQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const dateRangeQuery = z.object({
  from: z.string().datetime({ message: "Invalid from date" }).optional(),
  to: z.string().datetime({ message: "Invalid to date" }).optional(),
});

// ─── Auth ────────────────────────────────────────────────────

export const vendorSignupSchema = z.object({
  email: z.string().regex(emailRegex, "Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  full_name: z.string().min(1, "Full name is required"),
  phone_number: z
    .string()
    .regex(phoneRegex, "Phone number must be exactly 10 digits"),
});

export const vendorSigninSchema = z.object({
  email: z.string().regex(emailRegex, "Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

// ─── Warehouses ──────────────────────────────────────────────

export const createWarehouseSchema = z.object({
  name: z.string().min(1, "Warehouse name is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  postal_code: z.string().min(1, "Postal code is required"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  phone: z.string().optional(),
});

export const updateWarehouseSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  postal_code: z.string().min(1).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  phone: z.string().optional(),
  is_active: z.boolean().optional(),
});

export const listWarehousesQuery = paginationQuery.extend({
  is_active: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

// ─── Inventory ───────────────────────────────────────────────

export const addInventorySchema = z.object({
  part_id: z.number().int().positive("Part ID must be a positive integer"),
  quantity_available: z.number().int().min(0, "Stock cannot be negative"),
  unit_cost: z.number().positive("Unit cost must be positive"),
  reorder_level: z.number().int().min(0).default(0),
});

export const updateInventorySchema = z.object({
  quantity_available: z.number().int().min(0, "Stock cannot be negative").optional(),
  unit_cost: z.number().positive("Unit cost must be positive").optional(),
  reorder_level: z.number().int().min(0).optional(),
});

export const bulkInventorySchema = z.object({
  items: z
    .array(
      z.object({
        part_id: z.number().int().positive("Part ID must be a positive integer"),
        quantity_available: z.number().int().min(0, "Stock cannot be negative"),
        unit_cost: z.number().positive("Unit cost must be positive"),
        reorder_level: z.number().int().min(0).default(0),
      })
    )
    .min(1, "At least one item is required")
    .refine(
      (items) => {
        const ids = items.map((i) => i.part_id);
        return new Set(ids).size === ids.length;
      },
      { message: "Duplicate part_id values are not allowed" }
    ),
});

export const listInventoryQuery = paginationQuery.extend({
  low_stock: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

// ─── Reservations ────────────────────────────────────────────

export const listReservationsQuery = paginationQuery.extend({
  status: z
    .enum(["active", "expired", "converted", "cancelled"])
    .optional(),
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

export const returnOrderSchema = z.object({
  reason: z.string().min(1, "Return reason is required"),
});

// ─── Fulfillment ─────────────────────────────────────────────

export const updateFulfillmentStatusSchema = z.object({
  status: z.enum([
    "pending",
    "processing",
    "shipped",
    "in_transit",
    "delivered",
    "failed",
  ]),
  tracking_number: z.string().optional(),
  carrier: z.string().optional(),
  estimated_delivery: z.string().datetime().optional(),
  notes: z.string().optional(),
});

// ─── Analytics ───────────────────────────────────────────────

export const analyticsQuery = paginationQuery
  .omit({ page: true, limit: true })
  .extend({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  });

export const lowStockQuery = paginationQuery.extend({
  threshold: z.coerce.number().int().min(0).optional(),
});
