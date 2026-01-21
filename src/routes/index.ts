import { Router } from "express";
import { authRoutes } from "./auth.routes.js";
import { trainingRoutes } from "./training.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/training", trainingRoutes);

export default router;
