import express from "express";
import cors from "cors";
import { prisma } from "./lib/prisma";

const app = express();

app.use(cors());

app.use(express.json());

app.get("/users", async (req, res) => {
  const users = await prisma.user.findMany();
  res.json(users);
});

app.post("/posts", async (req, res) => {
  const posts = await prisma.user.create({
    data:{
      name:"tejas diwane",
      password:"tejas123",
    }
  });
  res.json(posts);
});


export default app;