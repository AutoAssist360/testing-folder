import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

// ─── User module routers ─────────────────────────────────────
import { authRouter } from "./modules/user/auth/auth.routes";
import { profileRouter } from "./modules/user/profile/profile.routes";
import { vehicleRouter } from "./modules/user/vehicles/vehicles.routes";
import { requestRouter } from "./modules/user/requests/requests.routes";
import { offerRouter } from "./modules/user/offers/offers.routes";
import { jobRouter } from "./modules/user/jobs/jobs.routes";
import { invoiceRouter } from "./modules/user/invoices/invoices.routes";
import { orderRouter } from "./modules/user/orders/orders.routes";
import { reviewRouter } from "./modules/user/reviews/reviews.routes";
import { messageRouter } from "./modules/user/messages/messages.routes";

// ─── Technician module routers ───────────────────────────────
import { techAuthRouter } from "./modules/technician/auth/auth.routes";
import { techProfileRouter } from "./modules/technician/profile/profile.routes";
import { techAvailabilityRouter } from "./modules/technician/availability/availability.routes";
import { techAssignmentsRouter } from "./modules/technician/assignments/assignments.routes";
import { techOffersRouter } from "./modules/technician/offers/offers.routes";
import { techJobsRouter } from "./modules/technician/jobs/jobs.routes";
import { techEarningsRouter } from "./modules/technician/earnings/earnings.routes";
import { techMessagesRouter } from "./modules/technician/messages/messages.routes";
import { techLocationRouter } from "./modules/technician/location/location.routes";

// ─── Admin module routers ────────────────────────────────────
import { adminAuthRouter } from "./modules/admin/auth/auth.routes";
import { adminDashboardRouter } from "./modules/admin/dashboard/dashboard.routes";
import { adminUsersRouter } from "./modules/admin/users/users.routes";
import { adminTechniciansRouter } from "./modules/admin/technicians/technicians.routes";
import { adminVendorsRouter } from "./modules/admin/vendors/vendors.routes";
import { adminWarehousesRouter } from "./modules/admin/warehouses/warehouses.routes";
import { adminRequestsRouter } from "./modules/admin/requests/requests.routes";
import { adminJobsRouter } from "./modules/admin/jobs/jobs.routes";
import { adminOrdersRouter } from "./modules/admin/orders/orders.routes";
import { adminInvoicesRouter } from "./modules/admin/invoices/invoices.routes";
import { adminAnalyticsRouter } from "./modules/admin/analytics/analytics.routes";
import { adminAuditLogsRouter } from "./modules/admin/auditLogs/auditLogs.routes";

// ─── Vendor module routers ───────────────────────────────────
import { vendorAuthRouter } from "./modules/vendor/auth/auth.routes";
import { vendorWarehousesRouter } from "./modules/vendor/warehouses/warehouses.routes";
import { vendorInventoryRouter } from "./modules/vendor/inventory/inventory.routes";
import { vendorReservationsRouter } from "./modules/vendor/reservations/reservations.routes";
import { vendorOrdersRouter } from "./modules/vendor/orders/orders.routes";
import { vendorFulfillmentRouter } from "./modules/vendor/fulfillment/fulfillment.routes";
import { vendorAnalyticsRouter } from "./modules/vendor/analytics/analytics.routes";

import { errorHandler } from "./middleware/errorHandler";
import { authLimiter } from "./middleware/rateLimiter";
import { validateUUIDParams } from "./middleware/validateParams";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(validateUUIDParams);

// ─── Route mounting ──────────────────────────────────────────
app.use("/auth", authLimiter, authRouter);
app.use("/profile", profileRouter);
app.use("/vehicles", vehicleRouter);
app.use("/requests", requestRouter);
app.use("/", offerRouter);       // handles /requests/:id/offers & /offers/:id/accept|reject
app.use("/jobs", jobRouter);
app.use("/invoices", invoiceRouter);
app.use("/orders", orderRouter);
app.use("/reviews", reviewRouter);
app.use("/", messageRouter);     // handles /requests/:id/messages

// ─── Technician routes ───────────────────────────────────────
app.use("/tech/auth", authLimiter, techAuthRouter);
app.use("/tech/profile", techProfileRouter);
app.use("/tech/availability", techAvailabilityRouter);
app.use("/tech/assignments", techAssignmentsRouter);
app.use("/tech/offers", techOffersRouter);
app.use("/tech/jobs", techJobsRouter);
app.use("/tech/earnings", techEarningsRouter);
app.use("/tech/requests", techMessagesRouter);
app.use("/tech/location", techLocationRouter);

// ─── Admin routes ────────────────────────────────────────────
app.use("/admin/auth", authLimiter, adminAuthRouter);
app.use("/admin/dashboard", adminDashboardRouter);
app.use("/admin/users", adminUsersRouter);
app.use("/admin/technicians", adminTechniciansRouter);
app.use("/admin/vendors", adminVendorsRouter);
app.use("/admin/warehouses", adminWarehousesRouter);
app.use("/admin/requests", adminRequestsRouter);
app.use("/admin/jobs", adminJobsRouter);
app.use("/admin/orders", adminOrdersRouter);
app.use("/admin/invoices", adminInvoicesRouter);
app.use("/admin/analytics", adminAnalyticsRouter);
app.use("/admin/audit-logs", adminAuditLogsRouter);

// ─── Vendor routes ───────────────────────────────────────────
app.use("/vendor/auth", authLimiter, vendorAuthRouter);
app.use("/vendor/warehouses", vendorWarehousesRouter);
app.use("/vendor", vendorInventoryRouter);       // handles /vendor/warehouses/:id/inventory & /vendor/inventory/:id
app.use("/vendor", vendorReservationsRouter);     // handles /vendor/warehouses/:id/reservations & /vendor/reservations/:id
app.use("/vendor/orders", vendorOrdersRouter);
app.use("/vendor", vendorFulfillmentRouter);      // handles /vendor/orders/:id/fulfillment & /vendor/fulfillment/:id/status
app.use("/vendor/analytics", vendorAnalyticsRouter);
app.use("/vendor", vendorAnalyticsRouter);        // handles /vendor/warehouses/:id/low-stock

// ─── 404 handler ─────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// ─── Global error handler (must be last) ─────────────────────
app.use(errorHandler);

export default app;