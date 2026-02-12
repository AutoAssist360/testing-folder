import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import { authRouter } from "./router/auth";
import { profileRouter } from "./router/profile";
import { vehicleRouter } from "./router/vehicles";
import { requestRouter } from "./router/requests";
import { offerRouter } from "./router/offers";
import { jobRouter } from "./router/jobs";
import { invoiceRouter } from "./router/invoices";
import { reviewRouter } from "./router/reviews";
import { messageRouter } from "./router/messages";
import { errorHandler } from "./Middelware/errorHandler";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// ─── Route mounting ──────────────────────────────────────────
app.use("/auth", authRouter);
app.use("/profile", profileRouter);
app.use("/vehicles", vehicleRouter);
app.use("/requests", requestRouter);
app.use("/", offerRouter);       // handles /requests/:id/offers & /offers/:id/accept|reject
app.use("/jobs", jobRouter);
app.use("/invoices", invoiceRouter);
app.use("/reviews", reviewRouter);
app.use("/", messageRouter);     // handles /requests/:id/messages

// ─── 404 handler ─────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// ─── Global error handler (must be last) ─────────────────────
app.use(errorHandler);

export default app;