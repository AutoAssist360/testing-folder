import { z } from "zod";

const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const phoneRegex = /^\d{10}$/;

export const signupSchema = z.object({
  email: z.string().regex(emailRegex, "Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  full_name: z.string().min(1, "Full name is required").optional().default(""),
  phone_number: z
    .string()
    .regex(phoneRegex, "Phone number must be exactly 10 digits")
    .optional()
    .default(""),
});

export const signinSchema = z.object({
  email: z.string().regex(emailRegex, "Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().regex(emailRegex, "Invalid email format"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  new_password: z.string().min(8, "Password must be at least 8 characters"),
});

export const changePasswordSchema = z.object({
  current_password: z.string().min(1, "Current password is required"),
  new_password: z.string().min(8, "New password must be at least 8 characters"),
});
