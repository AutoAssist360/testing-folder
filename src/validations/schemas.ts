import { z } from "zod";

// ─── Regex patterns ─────────────────────────────────────────────
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const phoneRegex = /^\d{10}$/;
const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/i; // 17 alphanumeric, excluding I, O, Q
const registrationRegex = /^[A-Z0-9]{1,15}$/i;

// ─── AUTH ────────────────────────────────────────────────────────

export const signupSchema = z.object({
  email: z.string().regex(emailRegex, "Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  full_name: z.string().min(1, "Full name is required").optional().default(""),
  phone_number: z
    .string()
    .regex(phoneRegex, "Phone number must be exactly 10 digits")
    .optional()
    .default(""),
});

export const signinSchema = z.object({
  email: z.string().regex(emailRegex, "Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

// ─── PROFILE ─────────────────────────────────────────────────────

export const updateProfileSchema = z.object({
  full_name: z.string().min(1).optional(),
  phone_number: z
    .string()
    .regex(phoneRegex, "Phone number must be exactly 10 digits")
    .optional(),
});

// ─── VEHICLES ────────────────────────────────────────────────────

export const addVehicleSchema = z.object({
  variant_id: z.number().int().positive("Variant ID must be positive"),
  registration_number: z
    .string()
    .regex(registrationRegex, "Invalid registration number (alphanumeric, max 15 chars)"),
  vin_number: z
    .string()
    .regex(vinRegex, "VIN must be exactly 17 alphanumeric characters"),
});

export const updateVehicleSchema = z.object({
  variant_id: z.number().int().positive().optional(),
  registration_number: z
    .string()
    .regex(registrationRegex, "Invalid registration number")
    .optional(),
  vin_number: z
    .string()
    .regex(vinRegex, "VIN must be exactly 17 alphanumeric characters")
    .optional(),
});

// ─── SERVICE REQUESTS ────────────────────────────────────────────

export const createRequestSchema = z.object({
  vehicle_id: z.string().uuid("Invalid vehicle ID"),
  issue_description: z.string().min(1, "Issue description is required"),
  issue_type: z.enum([
    "mechanical_failure",
    "electrical_issue",
    "tire_related",
    "battery_issue",
    "engine_problem",
    "brake_issue",
    "other",
  ]),
  breakdown_latitude: z.number().optional(),
  breakdown_longitude: z.number().optional(),
  service_location_type: z.enum(["roadside", "home", "office"]).default("roadside"),
  requires_towing: z.boolean().default(false),
});

// ─── INVOICES ────────────────────────────────────────────────────

export const payInvoiceSchema = z.object({
  payment_method: z.string().min(1, "Payment method is required"),
  transaction_id: z.string().min(1, "Transaction ID is required"),
});

// ─── REVIEWS ─────────────────────────────────────────────────────

export const createReviewSchema = z.object({
  job_id: z.string().uuid("Invalid job ID"),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});

// ─── MESSAGES ────────────────────────────────────────────────────

export const sendMessageSchema = z.object({
  receiver_id: z.string().uuid("Invalid receiver ID"),
  message: z.string().min(1, "Message cannot be empty"),
});
