import { db } from '../db/index.js';
import { enrollments, programs } from '../db/training.js';
import { coachAthletes, user } from '../db/schema.js';
import { userGoals } from '../db/goals.js';
import { eq, and, inArray } from 'drizzle-orm';
import { AIAssistantManager } from './ai_assistant/manager.js';
import { deterministicLogic } from './ai_assistant/deterministic_logic.js';

/**
 * Handles cleanup when a coach-athlete relationship ends:
 * 1. Removes enrollments for programs created by the departing coach
 * 2. If the athlete has no remaining coaches, re-assigns a default program
 */
export async function handleCoachDisconnect(athleteId: string, coachId: string): Promise<void> {
    // 1. Find programs created by this coach that the athlete is enrolled in
    const coachProgramEnrollments = await db
        .select({ programId: enrollments.programId })
        .from(enrollments)
        .innerJoin(programs, eq(enrollments.programId, programs.id))
        .where(and(
            eq(enrollments.userId, athleteId),
            eq(programs.creatorId, coachId)
        ));

    // 2. Remove those enrollments
    if (coachProgramEnrollments.length > 0) {
        await db.delete(enrollments).where(
            and(
                eq(enrollments.userId, athleteId),
                inArray(enrollments.programId, coachProgramEnrollments.map(e => e.programId))
            )
        );
    }

    // 3. Check if athlete has any remaining coaches
    const remainingCoaches = await db.select()
        .from(coachAthletes)
        .where(eq(coachAthletes.athleteId, athleteId));

    if (remainingCoaches.length > 0) return;

    // 4. No coaches left — re-assign a default program
    const [athlete] = await db.select().from(user).where(eq(user.id, athleteId));
    const athleteGoals = await db.select({ goalId: userGoals.goalId })
        .from(userGoals)
        .where(eq(userGoals.userId, athleteId));

    const aiManager = new AIAssistantManager(deterministicLogic);
    const programId = await aiManager.recommendProgram({
        goals: athleteGoals.map(g => g.goalId),
        age: athlete?.age ?? 25,
        gender: (athlete?.gender as 'male' | 'female' | 'other') ?? 'other',
        availabilityPerWeek: 3,
    });

    await db.insert(enrollments).values({
        userId: athleteId,
        programId: programId,
        currentDay: 1,
    });
}
