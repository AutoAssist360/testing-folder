import { z } from "zod";

const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const phoneRegex = /^\d{10}$/;

// ─── Auth ────────────────────────────────────────────────────────

export const techSignupSchema = z.object({
  email: z.string().regex(emailRegex, "Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  full_name: z.string().min(1, "Full name is required"),
  phone_number: z
    .string()
    .regex(phoneRegex, "Phone number must be exactly 10 digits"),
  business_name: z.string().optional(),
  technician_type: z.enum(["individual", "garage"]),
  location: z.string().min(1, "Location is required"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  service_radius: z.number().int().positive("Service radius must be positive"),
});

export const techSigninSchema = z.object({
  email: z.string().regex(emailRegex, "Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

// ─── Profile ─────────────────────────────────────────────────────

export const updateProfileSchema = z
  .object({
    business_name: z.string().min(1).max(200).optional(),
    location: z.string().min(1).max(500).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    service_radius: z.number().int().positive().optional(),
    technician_type: z.enum(["individual", "garage"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const addCertificationSchema = z.object({
  certification: z.string().min(1, "Certification name is required").max(300),
  issued_by: z.string().min(1, "Issuing authority is required").max(300),
  issue_date: z.string().datetime({ message: "Invalid date format" }),
  expiry_date: z.string().datetime({ message: "Invalid date format" }).optional(),
});

// ─── Availability ────────────────────────────────────────────────

export const updateAvailabilitySchema = z.object({
  is_online: z.boolean(),
});

// ─── Offers ──────────────────────────────────────────────────────

export const createOfferSchema = z.object({
  request_id: z.string().uuid("Invalid request ID"),
  repair_mode: z.enum(["onsite", "tow_to_garage"]),
  estimated_cost: z.number().positive("Estimated cost must be positive"),
  estimated_time: z.number().int().positive("Estimated time must be positive"),
  message: z.string().max(2000, "Message must be at most 2000 characters").optional(),
});

// ─── Jobs ────────────────────────────────────────────────────────

export const updateJobStatusSchema = z.object({
  status: z.enum(["in_progress", "completed"]),
});

export const suggestPartsSchema = z.object({
  parts: z.array(
    z.object({
      part_id: z.number().int().positive(),
      quantity: z.number().int().positive("Quantity must be positive"),
    })
  ).min(1, "At least one part is required"),
});

export const createInvoiceSchema = z.object({
  items: z.array(
    z.object({
      item_type: z.enum(["labor", "part", "towing", "diagnostic", "other"]),
      description: z.string().min(1, "Description is required").max(500),
      quantity: z.number().int().positive("Quantity must be positive"),
      unit_price: z.number().positive("Unit price must be positive"),
    })
  ).min(1, "At least one item is required"),
  tax_rate: z.number().min(0).max(100).default(0),
});

// ─── Location ────────────────────────────────────────────────────

export const updateLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

// ─── Messages ────────────────────────────────────────────────────

export const sendMessageSchema = z.object({
  receiver_id: z.string().uuid("Invalid receiver ID"),
  message: z.string().min(1, "Message cannot be empty").max(5000, "Message must be at most 5000 characters"),
});
