import { z } from "zod";

export const payInvoiceSchema = z.object({
  payment_method: z.string().min(1, "Payment method is required"),
  transaction_id: z.string().min(1, "Transaction ID is required"),
});
