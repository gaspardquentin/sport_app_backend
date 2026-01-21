import { Router } from "express";
import { getWeeklyPlan } from "../controllers/training.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export const trainingRoutes = Router();

trainingRoutes.get("/week", requireAuth, getWeeklyPlan);
