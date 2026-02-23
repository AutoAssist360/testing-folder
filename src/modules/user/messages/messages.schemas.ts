import { z } from "zod";

export const sendMessageSchema = z.object({
  receiver_id: z.string().uuid("Invalid receiver ID"),
  message: z.string().min(1, "Message cannot be empty").max(5000, "Message must be at most 5000 characters"),
});
