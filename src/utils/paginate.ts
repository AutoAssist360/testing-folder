import { z } from "zod";

export function paginate(page: number, limit: number) {
  return { skip: (page - 1) * limit, take: limit };
}

export const paginationQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
