import { Router } from "express";
import { prisma } from "../../../lib/prisma";
import { asyncWrapper } from "../../../utils/asyncWrapper";
import { AppError } from "../../../utils/AppError";
import { userAuth } from "../../../middleware/auth";
import { roleGuard } from "../../../middleware/roleGuard";
import { listTechniciansQuery, listJobsQuery } from "../admin.schemas";
import { logAudit, paginate, dateFilter } from "../admin.helpers";

export const adminTechniciansRouter = Router();

adminTechniciansRouter.use(userAuth, roleGuard("admin"));

// ─── GET /admin/technicians ──────────────────────────────────
adminTechniciansRouter.get(
  "/",
  asyncWrapper(async (req, res) => {
    const q = listTechniciansQuery.parse(req.query);
    const { skip, take } = paginate(q.page, q.limit);

    const where: any = {};
    if (q.is_verified !== undefined) where.is_verified = q.is_verified;
    if (q.is_online !== undefined) where.is_online = q.is_online;
    if (q.technician_type) where.technician_type = q.technician_type;
    if (q.search) {
      where.OR = [
        { business_name: { contains: q.search, mode: "insensitive" } },
        { location: { contains: q.search, mode: "insensitive" } },
        { user: { full_name: { contains: q.search, mode: "insensitive" } } },
      ];
    }

    const [technicians, total] = await Promise.all([
      prisma.technicianProfile.findMany({
        where,
        skip,
        take,
        include: {
          user: {
            select: {
              user_id: true,
              full_name: true,
              email: true,
              phone_number: true,
              is_active: true,
            },
          },
        },
        orderBy: { user: { created_at: "desc" } },
      }),
      prisma.technicianProfile.count({ where }),
    ]);

    res.json({
      technicians,
      pagination: {
        page: q.page,
        limit: q.limit,
        total,
        totalPages: Math.ceil(total / q.limit),
      },
    });
  })
);

// ─── GET /admin/technicians/:techId ──────────────────────────
adminTechniciansRouter.get(
  "/:techId",
  asyncWrapper(async (req, res) => {
    const techId = req.params.techId as string;

    const profile = await prisma.technicianProfile.findUnique({
      where: { technician_id: techId },
      include: {
        user: {
          select: {
            user_id: true,
            full_name: true,
            email: true,
            phone_number: true,
            is_active: true,
            created_at: true,
            deleted_at: true,
          },
        },
        certifications: true,
        carSupports: { include: { company: true, variant: true } },
        partSkills: { include: { part: true } },
        resources: true,
        _count: { select: { offers: true, jobs: true } },
      },
    });

    if (!profile) throw new AppError("Technician not found", 404);
    if (profile.user.deleted_at)
      throw new AppError("Technician account has been deleted", 404);

    res.json({ technician: profile });
  })
);

// ─── PATCH /admin/technicians/:techId/verify ─────────────────
adminTechniciansRouter.patch(
  "/:techId/verify",
  asyncWrapper(async (req, res) => {
    const techId = req.params.techId as string;

    const profile = await prisma.technicianProfile.findUnique({
      where: { technician_id: techId },
      include: { user: { select: { deleted_at: true } } },
    });

    if (!profile) throw new AppError("Technician not found", 404);
    if (profile.user.deleted_at)
      throw new AppError("Technician account has been deleted", 404);
    if (profile.is_verified)
      throw new AppError("Technician is already verified", 400);

    await prisma.technicianProfile.update({
      where: { technician_id: techId },
      data: { is_verified: true },
    });

    await logAudit({
      entityType: "TechnicianProfile",
      entityId: techId,
      action: "VERIFY_TECHNICIAN",
      performedBy: req.userId,
      oldValue: { is_verified: false },
      newValue: { is_verified: true },
    });

    res.json({ message: "Technician verified" });
  })
);

// ─── PATCH /admin/technicians/:techId/suspend ────────────────
adminTechniciansRouter.patch(
  "/:techId/suspend",
  asyncWrapper(async (req, res) => {
    const techId = req.params.techId as string;

    const profile = await prisma.technicianProfile.findUnique({
      where: { technician_id: techId },
      include: { user: { select: { user_id: true, is_active: true, deleted_at: true } } },
    });

    if (!profile) throw new AppError("Technician not found", 404);
    if (profile.user.deleted_at)
      throw new AppError("Technician account has been deleted", 404);
    if (!profile.user.is_active)
      throw new AppError("Technician is already suspended", 400);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { user_id: profile.user_id },
        data: { is_active: false },
      });
      await tx.technicianProfile.update({
        where: { technician_id: techId },
        data: { is_online: false, is_verified: false },
      });

      await logAudit({
        entityType: "TechnicianProfile",
        entityId: techId,
        action: "SUSPEND_TECHNICIAN",
        performedBy: req.userId,
        oldValue: { is_active: true },
        newValue: { is_active: false, is_online: false, is_verified: false },
        tx,
      });
    });

    res.json({ message: "Technician suspended" });
  })
);

// ─── PATCH /admin/technicians/:techId/unsuspend ──────────────
adminTechniciansRouter.patch(
  "/:techId/unsuspend",
  asyncWrapper(async (req, res) => {
    const techId = req.params.techId as string;

    const profile = await prisma.technicianProfile.findUnique({
      where: { technician_id: techId },
      include: { user: { select: { user_id: true, is_active: true, deleted_at: true } } },
    });

    if (!profile) throw new AppError("Technician not found", 404);
    if (profile.user.deleted_at)
      throw new AppError("Technician account has been deleted", 404);
    if (profile.user.is_active)
      throw new AppError("Technician is not suspended", 400);

    await prisma.user.update({
      where: { user_id: profile.user_id },
      data: { is_active: true },
    });

    await logAudit({
      entityType: "TechnicianProfile",
      entityId: techId,
      action: "UNSUSPEND_TECHNICIAN",
      performedBy: req.userId,
      oldValue: { is_active: false },
      newValue: { is_active: true },
    });

    res.json({ message: "Technician unsuspended" });
  })
);

// ─── GET /admin/technicians/:techId/jobs ─────────────────────
adminTechniciansRouter.get(
  "/:techId/jobs",
  asyncWrapper(async (req, res) => {
    const techId = req.params.techId as string;
    const q = listJobsQuery.parse(req.query);
    const { skip, take } = paginate(q.page, q.limit);

    const profile = await prisma.technicianProfile.findUnique({
      where: { technician_id: techId },
    });
    if (!profile) throw new AppError("Technician not found", 404);

    const where: any = { technician_id: techId, deleted_at: null };
    if (q.status) where.status = q.status;
    if (q.from || q.to) where.started_at = dateFilter(q.from, q.to);

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        skip,
        take,
        include: {
          request: {
            select: {
              request_id: true,
              issue_type: true,
              status: true,
            },
          },
          invoice: {
            select: { invoice_id: true, total: true, payment_status: true },
          },
        },
        orderBy: { started_at: "desc" },
      }),
      prisma.job.count({ where }),
    ]);

    res.json({
      jobs,
      pagination: {
        page: q.page,
        limit: q.limit,
        total,
        totalPages: Math.ceil(total / q.limit),
      },
    });
  })
);
