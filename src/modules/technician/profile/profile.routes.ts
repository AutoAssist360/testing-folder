import { Router } from "express";
import { prisma } from "../../../lib/prisma";
import { asyncWrapper } from "../../../utils/asyncWrapper";
import { AppError } from "../../../utils/AppError";
import { userAuth } from "../../../middleware/auth";
import { roleGuard } from "../../../middleware/roleGuard";
import { validate } from "../../../middleware/validate";
import { updateProfileSchema, addCertificationSchema } from "../technician.schemas";

export const techProfileRouter = Router();

techProfileRouter.use(userAuth, roleGuard("technician"));

/** Helper: get technicianProfile or throw */
async function getTechProfile(userId: string) {
  const profile = await prisma.technicianProfile.findUnique({
    where: { user_id: userId },
  });
  if (!profile) throw new AppError("Technician profile not found", 404);
  return profile;
}

// ─── GET /tech/profile ──────────────────────────────────────────
techProfileRouter.get(
  "/",
  asyncWrapper(async (req, res) => {
    const profile = await prisma.technicianProfile.findUnique({
      where: { user_id: req.userId },
      include: {
        user: {
          select: {
            user_id: true,
            full_name: true,
            email: true,
            phone_number: true,
            role: true,
            created_at: true,
          },
        },
        carSupports: {
          include: { company: true, variant: true },
        },
        partSkills: {
          include: { part: true },
        },
        certifications: true,
        resources: true,
      },
    });

    if (!profile) throw new AppError("Technician profile not found", 404);

    res.json({ profile });
  })
);

// ─── PUT /tech/profile ──────────────────────────────────────────
techProfileRouter.put(
  "/",
  validate(updateProfileSchema),
  asyncWrapper(async (req, res) => {
    await getTechProfile(req.userId);

    const updated = await prisma.technicianProfile.update({
      where: { user_id: req.userId },
      data: req.body,
    });

    res.json({ message: "Profile updated", profile: updated });
  })
);

// ─── POST /tech/profile/certifications ──────────────────────────
techProfileRouter.post(
  "/certifications",
  validate(addCertificationSchema),
  asyncWrapper(async (req, res) => {
    const profile = await getTechProfile(req.userId);

    const cert = await prisma.technicianCertification.create({
      data: {
        technician_id: profile.technician_id,
        certification: req.body.certification,
        issued_by: req.body.issued_by,
        issue_date: new Date(req.body.issue_date),
        expiry_date: req.body.expiry_date
          ? new Date(req.body.expiry_date)
          : null,
      },
    });

    res.status(201).json({ message: "Certification added", certification: cert });
  })
);

// ─── DELETE /tech/profile/certifications/:certId ────────────────
techProfileRouter.delete(
  "/certifications/:certId",
  asyncWrapper(async (req, res) => {
    const profile = await getTechProfile(req.userId);

    const certId = req.params.certId as string;

    const cert = await prisma.technicianCertification.findUnique({
      where: { certification_id: certId },
    });

    if (!cert) throw new AppError("Certification not found", 404);
    if (cert.technician_id !== profile.technician_id) {
      throw new AppError("Not authorized to delete this certification", 403);
    }

    await prisma.technicianCertification.delete({
      where: { certification_id: certId },
    });

    res.json({ message: "Certification deleted" });
  })
);
