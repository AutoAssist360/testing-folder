import jwt from "jsonwebtoken";
import { USER_SECRET, REFRESH_SECRET, RESET_SECRET } from "../../config";






export const generateAccessToken = (payload) => {
  return jwt.sign(payload, USER_SECRET, { expiresIn: "15m" });
};

export const generateRefreshToken = (payload) => {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: "7d" });
};

export const verifyAccessToken = (token) => {
  return jwt.verify(token, USER_SECRET) ;
};

export const verifyRefreshToken = (token) => {
  return jwt.verify(token, REFRESH_SECRET) ;
};

export const generateResetToken = (payload) => {
  return jwt.sign(payload, RESET_SECRET, { expiresIn: "15m" });
};

export const verifyResetToken = (token) => {
  return jwt.verify(token, RESET_SECRET) ;
};
