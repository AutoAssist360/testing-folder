import jwt from "jsonwebtoken";
import { USER_SECRET, REFRESH_SECRET, RESET_SECRET } from "../../config";

export interface TokenPayload {
  userId: string;
  role: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, USER_SECRET, { expiresIn: "15m" });
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: "7d" });
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, USER_SECRET) as TokenPayload;
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, REFRESH_SECRET) as TokenPayload;
};

export const generateResetToken = (payload: { userId: string }): string => {
  return jwt.sign(payload, RESET_SECRET, { expiresIn: "15m" });
};

export const verifyResetToken = (token: string): { userId: string } => {
  return jwt.verify(token, RESET_SECRET) as { userId: string };
};
