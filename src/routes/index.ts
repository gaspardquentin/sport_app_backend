import { Router } from "express";
import { authRoutes } from "./auth.routes.js";
import { trainingRoutes } from "./training.routes.js";
import { programRoutes } from "./program.routes.js";
import { coachRoutes } from "./coach.routes.js";
import aiAssistantRoutes from "./ai_assistant.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/training", trainingRoutes);
router.use("/programs", programRoutes);
router.use("/coach", coachRoutes);
router.use("/ai", aiAssistantRoutes);

export default router;
