import { Router, Request, Response } from 'express';
import { AIAssistantManager } from '../services/ai_assistant/manager.js';
import { deterministicLogic } from '../services/ai_assistant/deterministic_logic.js';
import { db } from '../db/index.js';
import { athleteInjuries, programPersonalizations } from '../db/ai_assistant.js';
import { eq, and } from 'drizzle-orm';

const router = Router();
const aiManager = new AIAssistantManager(deterministicLogic);

/**
 * Adapt program for injury
 */
router.post('/adapt-injury', async (req: Request, res: Response) => {
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
 * Cancel injury and revert to original program
 */
router.post('/cancel-injury', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    // 1. Mark all active injuries as resolved
    await db.update(athleteInjuries)
      .set({ isActive: false, resolvedAt: new Date() })
      .where(and(eq(athleteInjuries.userId, user.id), eq(athleteInjuries.isActive, true)));

    // 2. Remove personalizations of type 'injury_adaptation' for the current week
    // Note: In a more complex app, we might want to archive them instead.
    await db.delete(programPersonalizations)
      .where(and(
        eq(programPersonalizations.userId, user.id),
        eq(programPersonalizations.personalizationType, 'injury_adaptation')
      ));

    res.status(200).json({ message: "Injury cancelled and program reverted" });
  } catch (error: any) {
    console.error("Error in /cancel-injury:", error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * Reschedule missed workout
 */
router.post('/reschedule', async (req: Request, res: Response) => {
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
