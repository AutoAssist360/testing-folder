import { Router } from "express";
import { prisma } from "../lib/prisma";
import { userAuth } from "../Middelware/userMiddelware";
import { asyncWrapper } from "../utils/asyncWrapper";
import { AppError } from "../utils/AppError";
import { validate } from "../Middelware/validate";
import { addVehicleSchema, updateVehicleSchema } from "../validations/schemas";

export const vehicleRouter = Router();

// All vehicle routes require authentication
vehicleRouter.use(userAuth);

// ─── POST /vehicles ──────────────────────────────────────────
vehicleRouter.post(
  "/",
  validate(addVehicleSchema),
  asyncWrapper(async (req, res) => {
    const { variant_id, registration_number, vin_number } = req.body;

    // Check variant exists
    const variant = await prisma.carVariant.findUnique({
      where: { variant_id },
    });
    if (!variant) {
      throw new AppError("Car variant not found", 404);
    }

    // Check for duplicate registration / VIN
    const duplicate = await prisma.userVehicle.findFirst({
      where: {
        OR: [{ registration_number }, { vin_number }],
      },
    });
    if (duplicate) {
      throw new AppError("Vehicle with this registration number or VIN already exists", 409);
    }

    const vehicle = await prisma.userVehicle.create({
      data: {
        user_id: req.userId,
        variant_id,
        registration_number,
        vin_number,
      },
      include: {
        variant: {
          include: { model: { include: { company: true } } },
        },
      },
    });

    res.status(201).json({
      message: "Vehicle added successfully",
      vehicle,
    });
  })
);

// ─── GET /vehicles ───────────────────────────────────────────
vehicleRouter.get(
  "/",
  asyncWrapper(async (req, res) => {
    const vehicles = await prisma.userVehicle.findMany({
      where: { user_id: req.userId },
      include: {
        variant: {
          include: { model: { include: { company: true } } },
        },
      },
    });

    res.json({ vehicles });
  })
);

// ─── PUT /vehicles/:vehicleId ────────────────────────────────
vehicleRouter.put(
  "/:vehicleId",
  validate(updateVehicleSchema),
  asyncWrapper(async (req, res) => {
    const vehicleId = req.params.vehicleId as string;

    // Verify ownership
    const vehicle = await prisma.userVehicle.findUnique({
      where: { vehicle_id: vehicleId },
    });

    if (!vehicle) {
      throw new AppError("Vehicle not found", 404);
    }

    if (vehicle.user_id !== req.userId) {
      throw new AppError("You do not have access to this vehicle", 403);
    }

    const { variant_id, registration_number, vin_number } = req.body;

    // Check uniqueness if updating reg/vin
    if (registration_number || vin_number) {
      const duplicate = await prisma.userVehicle.findFirst({
        where: {
          vehicle_id: { not: vehicleId },
          OR: [
            ...(registration_number ? [{ registration_number }] : []),
            ...(vin_number ? [{ vin_number }] : []),
          ],
        },
      });
      if (duplicate) {
        throw new AppError("Vehicle with this registration number or VIN already exists", 409);
      }
    }

    const updated = await prisma.userVehicle.update({
      where: { vehicle_id: vehicleId },
      data: {
        ...(variant_id !== undefined && { variant_id }),
        ...(registration_number !== undefined && { registration_number }),
        ...(vin_number !== undefined && { vin_number }),
      },
      include: {
        variant: {
          include: { model: { include: { company: true } } },
        },
      },
    });

    res.json({
      message: "Vehicle updated successfully",
      vehicle: updated,
    });
  })
);

// ─── DELETE /vehicles/:vehicleId ─────────────────────────────
vehicleRouter.delete(
  "/:vehicleId",
  asyncWrapper(async (req, res) => {
    const vehicleId = req.params.vehicleId as string;

    const vehicle = await prisma.userVehicle.findUnique({
      where: { vehicle_id: vehicleId },
    });

    if (!vehicle) {
      throw new AppError("Vehicle not found", 404);
    }

    if (vehicle.user_id !== req.userId) {
      throw new AppError("You do not have access to this vehicle", 403);
    }

    await prisma.userVehicle.delete({
      where: { vehicle_id: vehicleId },
    });

    res.json({ message: "Vehicle deleted successfully" });
  })
);
