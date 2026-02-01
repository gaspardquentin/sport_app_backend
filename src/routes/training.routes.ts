import { Router } from "express";
import { getWeeklyPlan, enrollUser } from "../controllers/training.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export const trainingRoutes = Router();

trainingRoutes.get("/week", requireAuth, getWeeklyPlan);
trainingRoutes.post("/enroll", requireAuth, enrollUser);
