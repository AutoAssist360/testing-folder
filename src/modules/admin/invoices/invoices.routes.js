import { Router } from "express";
import { prisma } from "../../../lib/prisma";
import { asyncWrapper } from "../../../utils/asyncWrapper";
import { AppError } from "../../../utils/AppError";
import { userAuth } from "../../../middleware/auth";
import { roleGuard } from "../../../middleware/roleGuard";
import { listInvoicesQuery } from "../admin.schemas";
import { logAudit, dateFilter, paginate } from "../admin.helpers";

export const adminInvoicesRouter = Router();

adminInvoicesRouter.use(userAuth, roleGuard("admin"));

// ─── GET /admin/invoices ─────────────────────────────────────
adminInvoicesRouter.get(
  "/",
  asyncWrapper(async (req, res) => {
    const q = listInvoicesQuery.parse(req.query);
    const { skip, take } = paginate(q.page, q.limit);

    const where = { deleted_at: null };
    if (q.payment_status) where.payment_status = q.payment_status;
    if (q.from || q.to) where.issued_at = dateFilter(q.from, q.to);

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take,
        include: {
          job: {
            select: {
              job_id: true,
              status: true,
              request: {
                select: { request_id: true, issue_type: true },
              },
              technician: {
                include: {
                  user: { select: { full_name: true } },
                },
              },
            },
          },
        },
        orderBy: { issued_at: "desc" },
      }),
      prisma.invoice.count({ where }),
    ]);

    res.json({
      invoices,
      pagination: {
        page: q.page,
        limit: q.limit,
        total,
        totalPages: Math.ceil(total / q.limit),
      },
    });
  })
);

// ─── GET /admin/invoices/:invoiceId ──────────────────────────
adminInvoicesRouter.get(
  "/:invoiceId",
  asyncWrapper(async (req, res) => {
    const invoiceId = req.params.invoiceId ;

    const invoice = await prisma.invoice.findUnique({
      where: { invoice_id: invoiceId },
      include: {
        items: true,
        job: {
          include: {
            request: {
              include: {
                user: { select: { user_id: true, full_name: true, email: true } },
              },
            },
            technician: {
              include: {
                user: { select: { full_name: true, email: true } },
              },
            },
          },
        },
      },
    });

    if (!invoice) throw new AppError("Invoice not found", 404);
    if (invoice.deleted_at)
      throw new AppError("Invoice has been deleted", 404);

    res.json({ invoice });
  })
);

// ─── PATCH /admin/invoices/:invoiceId/mark-paid ──────────────
adminInvoicesRouter.patch(
  "/:invoiceId/mark-paid",
  asyncWrapper(async (req, res) => {
    const invoiceId = req.params.invoiceId ;

    const invoice = await prisma.invoice.findUnique({
      where: { invoice_id: invoiceId },
      select: {
        invoice_id: true,
        payment_status: true,
        deleted_at: true,
        job_id: true,
      },
    });

    if (!invoice || invoice.deleted_at)
      throw new AppError("Invoice not found", 404);
    if (invoice.payment_status === "completed")
      throw new AppError("Invoice is already paid", 400);
    if (invoice.payment_status === "refunded")
      throw new AppError("Cannot mark a refunded invoice as paid", 400);

    const oldStatus = invoice.payment_status;

    await prisma.invoice.update({
      where: { invoice_id: invoiceId },
      data: {
        payment_status: "completed",
        paid_at: new Date(),
        payment_method: "admin_override",
      },
    });

    await logAudit({
      entityType: "Invoice",
      entityId: invoiceId,
      action: "MARK_INVOICE_PAID",
      performedBy: req.userId,
      oldValue: { payment_status: oldStatus },
      newValue: { payment_status: "completed" },
    });

    res.json({ message: "Invoice marked as paid" });
  })
);
