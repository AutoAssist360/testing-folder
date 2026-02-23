export const DATABASE_URL = process.env.DATABASE_URL;

export const USER_SECRET = process.env.USER_SECRET as string;

export const REFRESH_SECRET = process.env.REFRESH_SECRET || (USER_SECRET + "_refresh");

export const RESET_SECRET = process.env.RESET_SECRET || (USER_SECRET + "_reset");

export const PORT = process.env.PORT || 3000;

export const IS_PRODUCTION = process.env.NODE_ENV === "production";