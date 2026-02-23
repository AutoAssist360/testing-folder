import { Router } from "express";
import { prisma } from "../../../lib/prisma";
import { userAuth } from "../../../middleware/auth";
import { roleGuard } from "../../../middleware/roleGuard";
import { asyncWrapper } from "../../../utils/asyncWrapper";
import { AppError } from "../../../utils/AppError";
import { validate } from "../../../middleware/validate";
import { payInvoiceSchema } from "./invoices.schemas";

export const invoiceRouter = Router();

invoiceRouter.use(userAuth, roleGuard("user", "admin"));

// ─── GET /invoices/:invoiceId ────────────────────────────────
invoiceRouter.get(
  "/:invoiceId",
  asyncWrapper(async (req, res) => {
    const invoiceId = req.params.invoiceId as string;

    const invoice = await prisma.invoice.findUnique({
      where: { invoice_id: invoiceId },
      include: {
        items: true,
        job: {
          include: {
            request: {
              select: {
                request_id: true,
                user_id: true,
                issue_description: true,
              },
            },
            technician: {
              include: {
                user: { select: { full_name: true } },
              },
            },
          },
        },
      },
    });

    if (!invoice || invoice.deleted_at) {
      throw new AppError("Invoice not found", 404);
    }

    // Ownership validation via job → request → user_id
    const ownerUserId = invoice.job?.request?.user_id;
    if (!ownerUserId || ownerUserId !== req.userId) {
      throw new AppError("You do not have access to this invoice", 403);
    }

    res.json({ invoice });
  })
);

// ─── POST /invoices/:invoiceId/pay ───────────────────────────
// NOTE: This endpoint is for SERVICE invoices only (linked to a Job).
// Order payments use POST /orders/:orderId/pay instead.
invoiceRouter.post(
  "/:invoiceId/pay",
  validate(payInvoiceSchema),
  asyncWrapper(async (req, res) => {
    const invoiceId = req.params.invoiceId as string;
    const { payment_method, transaction_id } = req.body;

    const invoice = await prisma.invoice.findUnique({
      where: { invoice_id: invoiceId },
      include: {
        job: {
          include: {
            request: { select: { user_id: true } },
          },
        },
      },
    });

    if (!invoice || invoice.deleted_at) {
      throw new AppError("Invoice not found", 404);
    }

    // Ownership validation
    const payOwnerUserId = invoice.job?.request?.user_id;
    if (!payOwnerUserId || payOwnerUserId !== req.userId) {
      throw new AppError("You do not have access to this invoice", 403);
    }

    if (invoice.payment_status === "completed") {
      throw new AppError("Invoice has already been paid", 400);
    }

    if (invoice.payment_status === "refunded") {
      throw new AppError("Cannot pay a refunded invoice", 400);
    }

    // Check duplicate transaction_id
    if (transaction_id) {
      const existingTx = await prisma.invoice.findFirst({
        where: { transaction_id },
      });
      if (existingTx) {
        throw new AppError("Transaction ID already used", 409);
      }
    }

    const updatedInvoice = await prisma.invoice.update({
      where: { invoice_id: invoiceId },
      data: {
        payment_status: "completed",
        payment_method,
        transaction_id,
        paid_at: new Date(),
      },
      include: { items: true },
    });

    res.json({
      message: "Payment successful",
      invoice: updatedInvoice,
    });
  })
);
