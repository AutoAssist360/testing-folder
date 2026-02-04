import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import { userRouter } from "./router/user";
const app = express();

app.use(cors());

app.use(express.json());
app.use(cookieParser());

app.use("/user",userRouter);



export default app;