import { Router } from "express";
import { prisma } from "../../../lib/prisma";
import { asyncWrapper } from "../../../utils/asyncWrapper";
import { AppError } from "../../../utils/AppError";
import { userAuth } from "../../../middleware/auth";
import { roleGuard } from "../../../middleware/roleGuard";
import { validate } from "../../../middleware/validate";
import {
  updateJobStatusSchema,
  suggestPartsSchema,
  createInvoiceSchema,
} from "../technician.schemas";
import { Decimal } from "../../../../generated/prisma/internal/prismaNamespace";
import { paginate, paginationQuery } from "../../../utils/paginate";

export const techJobsRouter = Router();

techJobsRouter.use(userAuth, roleGuard("technician"));

/** Allowed job status transitions */
const ALLOWED_TRANSITIONS = {
  assigned: ["in_progress"],
  in_progress: ["completed"],
};

/** Helper: get technicianProfile or throw */
async function getTechProfile(userId) {
  const profile = await prisma.technicianProfile.findUnique({
    where: { user_id: userId },
  });
  if (!profile) throw new AppError("Technician profile not found", 404);
  return profile;
}

/** Helper: get job owned by this technician */
async function getOwnedJob(jobId, technicianId) {
  const job = await prisma.job.findUnique({ where: { job_id: jobId } });
  if (!job || job.deleted_at) throw new AppError("Job not found", 404);
  if (job.technician_id !== technicianId) {
    throw new AppError("Not authorized for this job", 403);
  }
  return job;
}

// ─── GET /tech/jobs ─────────────────────────────────────────────
techJobsRouter.get(
  "/",
  asyncWrapper(async (req, res) => {
    const profile = await getTechProfile(req.userId);

    const status = (req.query.status ) || undefined;
    const { page, limit } = paginationQuery.parse(req.query);
    const { skip, take } = paginate(page, limit);
    const where = {
      technician_id: profile.technician_id,
      deleted_at: null,
    };
    if (status) where.status = status;

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: {
          request: {
            select: {
              request_id: true,
              issue_description: true,
              issue_type: true,
              service_location_type: true,
              status: true,
            },
          },
          offer: {
            select: {
              repair_mode: true,
              estimated_cost: true,
              estimated_time: true,
            },
          },
          invoice: {
            select: { invoice_id: true, total: true, payment_status: true },
          },
        },
        orderBy: { started_at: "desc" },
        skip,
        take,
      }),
      prisma.job.count({ where }),
    ]);

    res.json({ jobs, total, page, limit });
  })
);

// ─── GET /tech/jobs/:jobId ──────────────────────────────────────
techJobsRouter.get(
  "/:jobId",
  asyncWrapper(async (req, res) => {
    const profile = await getTechProfile(req.userId);

    const jobId = req.params.jobId ;

    const job = await prisma.job.findUnique({
      where: { job_id: jobId },
      include: {
        request: {
          include: {
            vehicle: {
              include: {
                variant: { include: { model: { include: { company: true } } } },
              },
            },
            parts: { include: { part: true } },
            media: true,
          },
        },
        offer: true,
        invoice: { include: { items: true } },
      },
    });

    if (!job || job.deleted_at) throw new AppError("Job not found", 404);
    if (job.technician_id !== profile.technician_id) {
      throw new AppError("Not authorized for this job", 403);
    }

    res.json({ job });
  })
);

// ─── PATCH /tech/jobs/:jobId/status ─────────────────────────────
techJobsRouter.patch(
  "/:jobId/status",
  validate(updateJobStatusSchema),
  asyncWrapper(async (req, res) => {
    const profile = await getTechProfile(req.userId);
    const job = await getOwnedJob(req.params.jobId , profile.technician_id);

    const { status } = req.body;
    const allowed = ALLOWED_TRANSITIONS[job.status];
    if (!allowed || !allowed.includes(status)) {
      throw new AppError(
        `Cannot transition from '${job.status}' to '${status}'`,
        400
      );
    }

    const data = { status };
    if (status === "in_progress") data.started_at = new Date();
    if (status === "completed") data.completed_at = new Date();

    // Update job AND sync parent ServiceRequest status in a transaction
    const updated = await prisma.$transaction(async (tx) => {
      const updatedJob = await tx.job.update({
        where: { job_id: job.job_id },
        data,
      });

      // Sync ServiceRequest status
      const requestStatusMap = {
        in_progress: "in_progress",
        completed: "completed",
      };
      const newRequestStatus = requestStatusMap[status];
      if (newRequestStatus) {
        await tx.serviceRequest.update({
          where: { request_id: job.request_id },
          data: { status: newRequestStatus  },
        });
      }

      return updatedJob;
    });

    res.json({ message: "Job status updated", job: updated });
  })
);

// ─── POST /tech/jobs/:jobId/suggest-parts ───────────────────────
techJobsRouter.post(
  "/:jobId/suggest-parts",
  validate(suggestPartsSchema),
  asyncWrapper(async (req, res) => {
    const profile = await getTechProfile(req.userId);
    const job = await getOwnedJob(req.params.jobId , profile.technician_id);

    if (job.status !== "in_progress") {
      throw new AppError("Parts can only be suggested for in-progress jobs", 400);
    }

    const { parts } = req.body;

    // Validate all parts exist
    const partIds = parts.map((p) => p.part_id);
    const existingParts = await prisma.carPart.findMany({
      where: { part_id: { in: partIds } },
    });
    if (existingParts.length !== partIds.length) {
      throw new AppError("One or more part IDs are invalid", 400);
    }

    // Add parts to the service request (skip duplicates)
    const created = await prisma.serviceRequestPart.createMany({
      data: parts.map((p) => ({
        request_id: job.request_id,
        part_id: p.part_id,
        quantity: p.quantity,
      })),
      skipDuplicates: true,
    });

    res.status(201).json({
      message: "Parts suggested",
      count: created.count,
    });
  })
);

// ─── POST /tech/jobs/:jobId/complete ────────────────────────────
techJobsRouter.post(
  "/:jobId/complete",
  asyncWrapper(async (req, res) => {
    const profile = await getTechProfile(req.userId);
    const job = await getOwnedJob(req.params.jobId , profile.technician_id);

    if (job.status !== "in_progress") {
      throw new AppError("Only in-progress jobs can be completed", 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedJob = await tx.job.update({
        where: { job_id: job.job_id },
        data: { status: "completed", completed_at: new Date() },
      });

      await tx.serviceRequest.update({
        where: { request_id: job.request_id },
        data: { status: "completed" },
      });

      return updatedJob;
    });

    res.json({ message: "Job completed", job: updated });
  })
);

// ─── POST /tech/jobs/:jobId/invoice ─────────────────────────────
techJobsRouter.post(
  "/:jobId/invoice",
  validate(createInvoiceSchema),
  asyncWrapper(async (req, res) => {
    const profile = await getTechProfile(req.userId);
    const job = await getOwnedJob(req.params.jobId , profile.technician_id);

    if (job.status !== "completed") {
      throw new AppError("Invoice can only be created for completed jobs", 400);
    }

    // Check if invoice already exists
    const existing = await prisma.invoice.findUnique({
      where: { job_id: job.job_id },
    });
    if (existing) {
      throw new AppError("Invoice has already been created for this job", 409);
    }

    const { items, tax_rate } = req.body;

    // Calculate totals using Decimal to avoid floating-point errors
    const invoiceItems = items.map(
      (item




) => {
        const unitPrice = new Decimal(item.unit_price);
        const totalPrice = unitPrice.times(item.quantity);
        return {
          item_type: item.item_type,
          description: item.description,
          quantity: item.quantity,
          unit_price: unitPrice,
          total_price: totalPrice,
        };
      }
    );

    const subtotal = invoiceItems.reduce(
      (sum, item) =>
        sum.plus(item.total_price),
      new Decimal(0)
    );
    const tax = subtotal.times(tax_rate).div(100);
    const total = subtotal.plus(tax);

    const invoice = await prisma.invoice.create({
      data: {
        job_id: job.job_id,
        subtotal,
        tax,
        total,
        payment_status: "pending",
        items: {
          create: invoiceItems.map(
            (item





) => ({
              item_type: item.item_type,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total_price: item.total_price,
            })
          ),
        },
      },
      include: { items: true },
    });

    res.status(201).json({ message: "Invoice created", invoice });
  })
);
