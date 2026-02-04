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
  const newUser = await prisma.user.create({
    data:{
      email,
      password_hash: hashpassword,
      full_name: "",
      phone_number: "",
      role: "user"
    }
  });
  const token = jwt.sign(
    { userId: newUser.user_id },
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
  const hashpassword = await bcrypt.compare(password, user.password_hash);
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
  const userId = req.userId;
  const updatedUser = await prisma.user.update({
    where:{user_id:userId},
    data:{
      full_name,
      phone_number
    }
  });
  res.json({
    message: "Profile updated successfully",
    user: updatedUser
  });
})

userRouter.get("/me",userAuth,async(req,res)=>{
  const userId = req.userId;
  const user=await prisma.user.findUnique({
    where:{user_id:userId}
  });
  res.json({
    user
  })
});

userRouter.post("/vehicledetail",userAuth,async(req,res)=>{
  const {variant_id ,registration_number,vin_number }=req.body;
  const userId = req.userId;
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
  const userId = req.userId;
  const {
    issue_description,
    issue_type,
    breakdown_latitude,
    breakdown_longitude,
    service_location_type = "roadside",
    requires_towing = false
  } = req.body;
  
  const vehicle = await prisma.userVehicle.findFirst({
    where:{user_id:userId},
    select:{vehicle_id:true}
  });

  if (!vehicle) {
    return res.status(404).json({
      message: "No vehicle found for this user"
    });
  }

  const serviceRequest = await prisma.serviceRequest.create({
    data:{
      user_id: userId,
      vehicle_id: vehicle.vehicle_id,
      issue_description,
      issue_type, 
      breakdown_latitude,
      breakdown_longitude,
      service_location_type,
      requires_towing
    }
  });
  
  res.json({
    serviceRequest
  });   
});

export default userRouter;
