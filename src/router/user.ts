/**
 * Legacy user router — kept for backward compatibility.
 * All routes have been migrated to their respective routers:
 *   - /auth   → auth.ts
 *   - /profile → profile.ts
 *   - /vehicles → vehicles.ts
 *   - /requests → requests.ts
 *   - /offers → offers.ts
 *   - /jobs → jobs.ts
 *   - /invoices → invoices.ts
 *   - /reviews → reviews.ts
 *   - /messages → messages.ts
 */

export { authRouter as userRouter } from "./auth";
