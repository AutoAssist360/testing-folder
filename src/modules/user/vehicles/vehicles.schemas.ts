import { z } from "zod";

const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/i;
const registrationRegex = /^[A-Z0-9]{1,15}$/i;

export const addVehicleSchema = z.object({
  variant_id: z.number().int().positive("Variant ID must be positive"),
  registration_number: z
    .string()
    .regex(
      registrationRegex,
      "Invalid registration number (alphanumeric, max 15 chars)"
    ),
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
