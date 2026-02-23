import { Router } from "express";
import { prisma } from "../../../lib/prisma";
import { asyncWrapper } from "../../../utils/asyncWrapper";
import { AppError } from "../../../utils/AppError";
import { userAuth } from "../../../middleware/auth";
import { roleGuard } from "../../../middleware/roleGuard";
import { listUsersQuery } from "../admin.schemas";
import { logAudit, dateFilter, paginate } from "../admin.helpers";

export const adminUsersRouter = Router();

adminUsersRouter.use(userAuth, roleGuard("admin"));

// ─── GET /admin/users ────────────────────────────────────────
adminUsersRouter.get(
  "/",
  asyncWrapper(async (req, res) => {
    const q = listUsersQuery.parse(req.query);
    const { skip, take } = paginate(q.page, q.limit);

    const where = { deleted_at: null };
    if (q.role) where.role = q.role;
    if (q.is_active !== undefined) where.is_active = q.is_active;
    if (q.from || q.to) where.created_at = dateFilter(q.from, q.to);
    if (q.search) {
      where.OR = [
        { full_name: { contains: q.search, mode: "insensitive" } },
        { email: { contains: q.search, mode: "insensitive" } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        select: {
          user_id: true,
          full_name: true,
          email: true,
          phone_number: true,
          role: true,
          is_active: true,
          created_at: true,
        },
        orderBy: { created_at: "desc" },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users,
      pagination: {
        page: q.page,
        limit: q.limit,
        total,
        totalPages: Math.ceil(total / q.limit),
      },
    });
  })
);

// ─── GET /admin/users/:userId ────────────────────────────────
adminUsersRouter.get(
  "/:userId",
  asyncWrapper(async (req, res) => {
    const userId = req.params.userId ;

    const user = await prisma.user.findUnique({
      where: { user_id: userId },
      select: {
        user_id: true,
        full_name: true,
        email: true,
        phone_number: true,
        role: true,
        is_active: true,
        created_at: true,
        deleted_at: true,
        vehicles: { select: { vehicle_id: true, registration_number: true } },
        technicianProfile: {
          select: {
            technician_id: true,
            business_name: true,
            technician_type: true,
            is_verified: true,
            is_online: true,
            rating: true,
            total_reviews: true,
          },
        },
        _count: {
          select: {
            serviceRequests: true,
            reviews: true,
            orders: true,
            warehouses: true,
          },
        },
      },
    });

    if (!user) throw new AppError("User not found", 404);
    if (user.deleted_at) throw new AppError("User has been deleted", 404);

    res.json({ user });
  })
);

// ─── PATCH /admin/users/:userId/block ────────────────────────
adminUsersRouter.patch(
  "/:userId/block",
  asyncWrapper(async (req, res) => {
    const userId = req.params.userId ;

    const user = await prisma.user.findUnique({
      where: { user_id: userId },
      select: { user_id: true, role: true, is_active: true, deleted_at: true },
    });

    if (!user || user.deleted_at) throw new AppError("User not found", 404);
    if (user.role === "admin") throw new AppError("Cannot block an admin account", 403);
    if (!user.is_active) throw new AppError("User is already blocked", 400);

    await prisma.user.update({
      where: { user_id: userId },
      data: { is_active: false },
    });

    await logAudit({
      entityType: "User",
      entityId: userId,
      action: "BLOCK_USER",
      performedBy: req.userId,
      oldValue: { is_active: true },
      newValue: { is_active: false },
    });

    res.json({ message: "User blocked" });
  })
);

// ─── PATCH /admin/users/:userId/unblock ──────────────────────
adminUsersRouter.patch(
  "/:userId/unblock",
  asyncWrapper(async (req, res) => {
    const userId = req.params.userId ;

    const user = await prisma.user.findUnique({
      where: { user_id: userId },
      select: { user_id: true, is_active: true, deleted_at: true },
    });

    if (!user || user.deleted_at) throw new AppError("User not found", 404);
    if (user.is_active) throw new AppError("User is already active", 400);

    await prisma.user.update({
      where: { user_id: userId },
      data: { is_active: true },
    });

    await logAudit({
      entityType: "User",
      entityId: userId,
      action: "UNBLOCK_USER",
      performedBy: req.userId,
      oldValue: { is_active: false },
      newValue: { is_active: true },
    });

    res.json({ message: "User unblocked" });
  })
);

// ─── DELETE /admin/users/:userId ─────────────────────────────
adminUsersRouter.delete(
  "/:userId",
  asyncWrapper(async (req, res) => {
    const userId = req.params.userId ;

    const user = await prisma.user.findUnique({
      where: { user_id: userId },
      select: { user_id: true, role: true, deleted_at: true },
    });

    if (!user || user.deleted_at) throw new AppError("User not found", 404);
    if (user.role === "admin") throw new AppError("Cannot delete an admin account", 403);
    if (userId === req.userId) throw new AppError("Cannot delete your own account", 403);

    await prisma.user.update({
      where: { user_id: userId },
      data: { deleted_at: new Date(), is_active: false },
    });

    await logAudit({
      entityType: "User",
      entityId: userId,
      action: "DELETE_USER",
      performedBy: req.userId,
    });

    res.json({ message: "User deleted" });
  })
);
