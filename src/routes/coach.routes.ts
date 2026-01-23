import { Router } from "express";
import { getCoachAthletes, searchAvailableAthletes, addAthlete, removeAthlete, assignProgram, unassignProgram } from "../controllers/coach.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export const coachRoutes = Router();

coachRoutes.get("/athletes", requireAuth, getCoachAthletes);
coachRoutes.get("/search", requireAuth, searchAvailableAthletes);
coachRoutes.post("/athletes/:athleteId", requireAuth, addAthlete);
coachRoutes.delete("/athletes/:athleteId", requireAuth, removeAthlete);
coachRoutes.post("/assign", requireAuth, assignProgram);
coachRoutes.post("/unassign", requireAuth, unassignProgram);
