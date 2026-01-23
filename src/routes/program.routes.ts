import { Router } from "express";
import { getCoachPrograms, getProgramById, createProgram, updateProgram, deleteProgram } from "../controllers/program.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export const programRoutes = Router();

programRoutes.get("/", requireAuth, getCoachPrograms);
programRoutes.get("/:id", requireAuth, getProgramById);
programRoutes.post("/", requireAuth, createProgram);
programRoutes.put("/:id", requireAuth, updateProgram);
programRoutes.delete("/:id", requireAuth, deleteProgram);
