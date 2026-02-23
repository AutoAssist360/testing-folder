import { z } from "zod";

const phoneRegex = /^\d{10}$/;

export const updateProfileSchema = z.object({
  full_name: z.string().min(1).optional(),
  phone_number: z
    .string()
    .regex(phoneRegex, "Phone number must be exactly 10 digits")
    .optional(),
});
