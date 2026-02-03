import { Router, Request, Response } from 'express';
import { AIAssistantManager } from '../services/ai_assistant/manager.js';
import { deterministicLogic } from '../services/ai_assistant/deterministic_logic.js';
import { db } from '../db/index.js';
import { athleteInjuries, programPersonalizations } from '../db/ai_assistant.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();
const aiManager = new AIAssistantManager(deterministicLogic);

/**
 * Adapt program for injury
 */
router.post('/adapt-injury', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const { injury } = req.body;
    if (!injury || !injury.description) {
      return res.status(400).json({ message: "Missing injury details" });
    }

    const adaptedProgram = await aiManager.adaptForInjury(user.id, injury);
    res.status(200).json(adaptedProgram);
  } catch (error: any) {
    console.error("Error in /adapt-injury:", error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * Get active injuries
 */
router.get('/active-injuries', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const injuries = await aiManager.getActiveInjuries(user.id);
    res.status(200).json(injuries);
  } catch (error: any) {
    console.error("Error in /active-injuries:", error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * Cancel injury and revert to original program
 */
router.post('/cancel-injury', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const { injuryId } = req.body;
    if (!injuryId) return res.status(400).json({ message: "Missing injuryId" });

    const updatedProgram = await aiManager.cancelInjury(user.id, injuryId);

    res.status(200).json({ message: "Injury cancelled and program updated", program: updatedProgram });
  } catch (error: any) {
    console.error("Error in /cancel-injury:", error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * Reschedule missed workout
 */
router.post('/reschedule', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const { missedWorkoutId, constraints } = req.body;
    
    const rescheduledProgram = await aiManager.rescheduleWorkout(user.id, missedWorkoutId, constraints || { maxDurationMinutes: 60 });
    res.status(200).json(rescheduledProgram);
  } catch (error: any) {
    console.error("Error in /reschedule:", error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * Recommend default program
 */
router.post('/recommend-program', async (req: Request, res: Response) => {
  try {
    const { profile } = req.body;
    if (!profile) return res.status(400).json({ message: "Missing profile" });

    const programId = await aiManager.recommendProgram(profile);
    res.status(200).json({ programId });
  } catch (error: any) {
    console.error("Error in /recommend-program:", error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
