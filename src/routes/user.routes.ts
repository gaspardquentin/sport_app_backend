import { Router } from 'express';
import { updateProfile, getProfile } from '../controllers/user.controller.js';
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.get('/me', requireAuth, getProfile);
router.put('/me', requireAuth, updateProfile);

export const userRoutes = router;
