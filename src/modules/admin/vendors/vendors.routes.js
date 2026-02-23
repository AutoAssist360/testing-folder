import { Router } from "express";
import { prisma } from "../../../lib/prisma";
import { asyncWrapper } from "../../../utils/asyncWrapper";
import { AppError } from "../../../utils/AppError";
import { userAuth } from "../../../middleware/auth";
import { roleGuard } from "../../../middleware/roleGuard";
import { listVendorsQuery, listWarehousesQuery } from "../admin.schemas";
import { logAudit, paginate } from "../admin.helpers";

export const adminVendorsRouter = Router();

adminVendorsRouter.use(userAuth, roleGuard("admin"));

// ─── GET /admin/vendors ──────────────────────────────────────
adminVendorsRouter.get(
  "/",
  asyncWrapper(async (req, res) => {
    const q = listVendorsQuery.parse(req.query);
    const { skip, take } = paginate(q.page, q.limit);

    const where = { role: "vendor" , deleted_at: null };
    if (q.is_active !== undefined) where.is_active = q.is_active;
    if (q.search) {
      where.OR = [
        { full_name: { contains: q.search, mode: "insensitive" } },
        { email: { contains: q.search, mode: "insensitive" } },
      ];
    }

    const [vendors, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        select: {
          user_id: true,
          full_name: true,
          email: true,
          phone_number: true,
          is_active: true,
          created_at: true,
          _count: { select: { warehouses: true, orders: true } },
        },
        orderBy: { created_at: "desc" },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      vendors,
      pagination: {
        page: q.page,
        limit: q.limit,
        total,
        totalPages: Math.ceil(total / q.limit),
      },
    });
  })
);

// ─── GET /admin/vendors/:vendorId ────────────────────────────
adminVendorsRouter.get(
  "/:vendorId",
  asyncWrapper(async (req, res) => {
    const vendorId = req.params.vendorId ;

    const vendor = await prisma.user.findUnique({
      where: { user_id: vendorId },
      select: {
        user_id: true,
        full_name: true,
        email: true,
        phone_number: true,
        role: true,
        is_active: true,
        created_at: true,
        deleted_at: true,
        warehouses: {
          select: {
            warehouse_id: true,
            name: true,
            city: true,
            state: true,
            is_active: true,
          },
        },
        _count: { select: { warehouses: true, orders: true } },
      },
    });

    if (!vendor || vendor.deleted_at) throw new AppError("Vendor not found", 404);
    if (vendor.role !== "vendor") throw new AppError("User is not a vendor", 400);

    res.json({ vendor });
  })
);

// ─── PATCH /admin/vendors/:vendorId/suspend ──────────────────
adminVendorsRouter.patch(
  "/:vendorId/suspend",
  asyncWrapper(async (req, res) => {
    const vendorId = req.params.vendorId ;

    const vendor = await prisma.user.findUnique({
      where: { user_id: vendorId },
      select: { user_id: true, role: true, is_active: true, deleted_at: true },
    });

    if (!vendor || vendor.deleted_at) throw new AppError("Vendor not found", 404);
    if (vendor.role !== "vendor") throw new AppError("User is not a vendor", 400);
    if (!vendor.is_active) throw new AppError("Vendor is already suspended", 400);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { user_id: vendorId },
        data: { is_active: false },
      });
      // Deactivate all vendor warehouses
      await tx.warehouse.updateMany({
        where: { vendor_id: vendorId },
        data: { is_active: false },
      });

      await logAudit({
        entityType: "User",
        entityId: vendorId,
        action: "SUSPEND_VENDOR",
        performedBy: req.userId,
        oldValue: { is_active: true },
        newValue: { is_active: false },
        tx,
      });
    });

    res.json({ message: "Vendor suspended" });
  })
);

// ─── PATCH /admin/vendors/:vendorId/unsuspend ────────────────
adminVendorsRouter.patch(
  "/:vendorId/unsuspend",
  asyncWrapper(async (req, res) => {
    const vendorId = req.params.vendorId ;

    const vendor = await prisma.user.findUnique({
      where: { user_id: vendorId },
      select: { user_id: true, role: true, is_active: true, deleted_at: true },
    });

    if (!vendor || vendor.deleted_at) throw new AppError("Vendor not found", 404);
    if (vendor.role !== "vendor") throw new AppError("User is not a vendor", 400);
    if (vendor.is_active) throw new AppError("Vendor is not suspended", 400);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { user_id: vendorId },
        data: { is_active: true },
      });

      // Reactivate all vendor warehouses
      await tx.warehouse.updateMany({
        where: { vendor_id: vendorId },
        data: { is_active: true },
      });
    });

    await logAudit({
      entityType: "User",
      entityId: vendorId,
      action: "UNSUSPEND_VENDOR",
      performedBy: req.userId,
      oldValue: { is_active: false },
      newValue: { is_active: true },
    });

    res.json({ message: "Vendor unsuspended" });
  })
);

// ─── GET /admin/vendors/:vendorId/warehouses ─────────────────
adminVendorsRouter.get(
  "/:vendorId/warehouses",
  asyncWrapper(async (req, res) => {
    const vendorId = req.params.vendorId ;
    const q = listWarehousesQuery.parse(req.query);
    const { skip, take } = paginate(q.page, q.limit);

    const vendor = await prisma.user.findUnique({
      where: { user_id: vendorId },
      select: { role: true, deleted_at: true },
    });
    if (!vendor || vendor.deleted_at) throw new AppError("Vendor not found", 404);
    if (vendor.role !== "vendor") throw new AppError("User is not a vendor", 400);

    const where = { vendor_id: vendorId };
    if (q.is_active !== undefined) where.is_active = q.is_active;
    if (q.city) where.city = { contains: q.city, mode: "insensitive" };
    if (q.state) where.state = { contains: q.state, mode: "insensitive" };

    const [warehouses, total] = await Promise.all([
      prisma.warehouse.findMany({
        where,
        skip,
        take,
        include: {
          _count: { select: { inventories: true, orders: true } },
        },
        orderBy: { created_at: "desc" },
      }),
      prisma.warehouse.count({ where }),
    ]);

    res.json({
      warehouses,
      pagination: {
        page: q.page,
        limit: q.limit,
        total,
        totalPages: Math.ceil(total / q.limit),
      },
    });
  })
);
