import { z } from "zod";

const orderItemSchema = z.object({
  part_id: z.number().int().positive("Part ID must be positive"),
  quantity: z.number().int().positive("Quantity must be a positive integer"),
});

export const createOrderSchema = z.object({
  warehouse_id: z.string().uuid("Invalid warehouse ID"),
  request_id: z.string().uuid("Invalid request ID").optional(),
  items: z
    .array(orderItemSchema)
    .min(1, "Order must contain at least one item"),
  notes: z.string().optional(),
});

export const payOrderSchema = z.object({
  payment_method: z.string().min(1, "Payment method is required"),
  transaction_id: z.string().min(1, "Transaction ID is required"),
});

export const reservePartSchema = z.object({
  inventory_id: z.string().uuid("Invalid inventory ID"),
  quantity: z.number().int().positive("Quantity must be a positive integer"),
  request_id: z.string().uuid("Invalid request ID").optional(),
  ttl_minutes: z
    .number()
    .int()
    .min(1)
    .max(1440, "TTL cannot exceed 24 hours (1440 minutes)")
    .default(30),
});
