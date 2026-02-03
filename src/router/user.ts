import "dotenv/config";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

import {Router} from "express"
import { prisma } from "../lib/prisma";
import { userAuth } from "../Middelware/userMiddelware";
import { USER_SECRET } from "../../config";
export const userRouter=Router();

userRouter.post("/signup", async (req, res) => {
  const {email,password}=req.body;
  const user=await prisma.user.findUnique({
    where:{
      email:email
    }
  });
  if(user){
    res.json({
      message:"user already exists"
    });
    return;
  }
  // in future turn it to 10
  const hashpassword=await bcrypt.hash(password,3);
       await prisma.user.create({
       data:{
        email,
        password:hashpassword
       }
  });
  const token = jwt.sign(
    { userId: user.user_id },
    USER_SECRET as string
  );
  res.cookie("authcookie", token, {
    httpOnly: true,
  });
  res.json({
    message:"user created successfully",
  })
});

userRouter.post("/signin", async (req, res) => {
  const {email,password}=req.body;
  const user=await prisma.user.findUnique({
    where:{email}
  });
  if(!user){
    res.json({
      message:"user does not exist"
    });
    return;
  }
  const hashpassword=bcrypt.compare(password,user.password)
  if(!hashpassword){
    res.json({
      message:"incorrect password"
    });
    return;
  }
  const token=jwt.sign({userId:user.user_id},USER_SECRET as string)
  res.cookie("authcookie", token, {
    httpOnly: true,
  });
  res.json({
    message:"user signed in successfully"
  })
});

userRouter.post("/signout",(req,res)=>{
  res.clearCookie("authcookie");
  res.json({
    message:"user signed out successfully"
})
});

userRouter.post("/me",userAuth,async(req,res)=>{
  const {full_name,phone_number}=req.body;
  const userId=req.body.userId;
 await prisma.user.update({
  where:{user_id:userId},
  data:{
    full_name,
    phone_number
  }
 })
})

userRouter.get("/me",userAuth,async(req,res)=>{
  const userId=req.body.userId;
  const user=await prisma.user.findUnique({
    where:{user_id:userId}
  });
  res.json({
    user
  })
});

userRouter.post("/vehicledetail",userAuth,async(req,res)=>{
  const {variant_id ,registration_number,vin_number }=req.body;
    const userId=req.body.userId;
    const vehicle_detail=await prisma.userVehicle.create({
      data:{
        user_id:userId,
        variant_id,
        registration_number,
        vin_number
      }
    })
    res.json({
      detail:vehicle_detail
    })
})
userRouter.post("/issue",userAuth,async(req,res)=>{
     const userId=req.body.userId;
     const {issue_description ,issue_type,breakdown_latitude,breakdown_longitude }=req.body
      const vehicle_id=await prisma.userVehicle.findFirst({
        where:{user_id:userId},
        select:{vehicle_id:true}
})
       const issue=await prisma.userIssue.create({
        data:{
          user_id:userId,
          vehicle_id:vehicle_id?.vehicle_id as number,
          issue_description,
          issue_type, 
          breakdown_latitude,
          breakdown_longitude
        }
       })
       res.json({
        issue
       })   
});

export default userRouter;
