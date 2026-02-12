import { Response, CookieOptions } from "express";
import { IS_PRODUCTION } from "../../config";

const accessCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: "strict",
  maxAge: 15 * 60 * 1000, // 15 minutes
};

const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: "/auth/refresh",
};

export const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string
) => {
  res.cookie("accessToken", accessToken, accessCookieOptions);
  res.cookie("refreshToken", refreshToken, {
    ...refreshCookieOptions,
    path: "/", // also accessible for /auth/refresh
  });
};

export const clearAuthCookies = (res: Response) => {
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  // also clear legacy cookie
  res.clearCookie("authcookie");
};
