import { z } from "zod";

export const createRequestSchema = z.object({
  vehicle_id: z.string().uuid("Invalid vehicle ID"),
  issue_description: z.string().min(1, "Issue description is required").max(3000, "Description must be at most 3000 characters"),
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
  service_location_type: z
    .enum(["roadside", "home", "office"])
    .default("roadside"),
  requires_towing: z.boolean().default(false),
});
