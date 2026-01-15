import { Router } from 'express';
import { toNodeHandler } from "better-auth/node";
import { auth } from "../config/auth";

const router = Router();

router.all("/*", toNodeHandler(auth));

export const authRoutes = router;