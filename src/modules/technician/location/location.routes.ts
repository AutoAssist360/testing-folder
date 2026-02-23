import { Router } from "express";
import { prisma } from "../../../lib/prisma";
import { asyncWrapper } from "../../../utils/asyncWrapper";
import { AppError } from "../../../utils/AppError";
import { userAuth } from "../../../middleware/auth";
import { roleGuard } from "../../../middleware/roleGuard";
import { validate } from "../../../middleware/validate";
import { updateLocationSchema } from "../technician.schemas";

export const techLocationRouter = Router();

techLocationRouter.use(userAuth, roleGuard("technician"));

// ─── POST /tech/location ────────────────────────────────────────
techLocationRouter.post(
  "/",
  validate(updateLocationSchema),
  asyncWrapper(async (req, res) => {
    const { latitude, longitude } = req.body;

    const profile = await prisma.technicianProfile.findUnique({
      where: { user_id: req.userId },
    });
    if (!profile) throw new AppError("Technician profile not found", 404);

    const updated = await prisma.technicianProfile.update({
      where: { technician_id: profile.technician_id },
      data: { latitude, longitude },
      select: { technician_id: true, latitude: true, longitude: true },
    });

    res.json({ message: "Location updated", location: updated });
  })
);
