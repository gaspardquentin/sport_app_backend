import { Router } from 'express';
import { updateProfile, getProfile, searchUsers, getMyCoaches, removeCoach } from '../controllers/user.controller.js';
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.get('/search', requireAuth, searchUsers);
router.get('/me/coaches', requireAuth, getMyCoaches);
router.delete('/me/coaches/:coachId', requireAuth, removeCoach);
router.get('/me', requireAuth, getProfile);
router.put('/me', requireAuth, updateProfile);

export const userRoutes = router;
