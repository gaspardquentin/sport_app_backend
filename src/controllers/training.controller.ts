import { Request, Response } from 'express';
import { db } from '../db/index.js';
import { enrollments, dayPlans, dayPlanWodBlocs, wodBlocs, wodBlocExercises, exercises } from '../db/training.js';
import { programPersonalizations } from '../db/ai_assistant.js';
import { workoutFromJSON } from '../services/ai_assistant/serialization.js';
import { eq, and, between, inArray, asc, desc } from 'drizzle-orm';

export const getWeeklyPlan = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    // 1. Get Enrollments (All active)
    const activeEnrollments = await db.select()
      .from(enrollments)
      .where(eq(enrollments.userId, user.id));

    if (activeEnrollments.length === 0) {
      res.status(404).json({ message: "No active enrollment found" });
      return;
    }

    // 2. Check for active Personalization (AI Adaptation / Rescheduling)
    // We check the first enrollment's current week for personalizations
    const firstEnrollment = activeEnrollments[0];
    const currentWeek = Math.ceil(firstEnrollment.currentDay / 7);
    
    const [personalization] = await db.select()
      .from(programPersonalizations)
      .where(and(
        eq(programPersonalizations.userId, user.id),
        eq(programPersonalizations.weekNumber, currentWeek)
      ))
      .orderBy(desc(programPersonalizations.createdAt))
      .limit(1);

    if (personalization) {
      // If we have a personalization, we return it using the special serialization logic
      const uiFormat = workoutFromJSON(personalization.data as any);
      res.status(200).json(uiFormat);
      return;
    }

    // 3. Fallback to standard DB query if no personalization exists
    // We will collect ALL days from ALL programs that match the current "Week" of that program
    let allDays: any[] = [];

    // Helper to process each enrollment
    for (const enrollment of activeEnrollments) {
        const currentDay = enrollment.currentDay;
        const currentWeek = Math.ceil(currentDay / 7);
        const startDay = (currentWeek - 1) * 7 + 1;
        const endDay = currentWeek * 7;

        const programDays = await db.select()
          .from(dayPlans)
          .where(
            and(
              eq(dayPlans.programId, enrollment.programId),
              between(dayPlans.dayNumber, startDay, endDay)
            )
          )
          .orderBy(asc(dayPlans.dayNumber));
        
        // Add program metadata to days if needed, but for now just merging content
        // We need to normalize dayNumber to 1-7 (Day of Week) to merge them
        const daysWithNormalizedIndex = programDays.map(d => ({
            ...d,
            normalizedDayIndex: ((d.dayNumber - 1) % 7) + 1
        }));

        allDays = [...allDays, ...daysWithNormalizedIndex];
    }

    if (allDays.length === 0) {
       // Just return empty week 1
       res.status(200).json({ weekNumber: 1, days: [] });
       return;
    }

    const dayPlanIds = allDays.map(d => d.id);

    // 3. Get Wod Blocs for these days
    const blocs = await db.select({
      dayPlanId: dayPlanWodBlocs.dayPlanId,
      wodBlocId: wodBlocs.id,
      title: wodBlocs.title,
      type: wodBlocs.type,
      order: dayPlanWodBlocs.order
    })
      .from(dayPlanWodBlocs)
      .innerJoin(wodBlocs, eq(dayPlanWodBlocs.wodBlocId, wodBlocs.id))
      .where(inArray(dayPlanWodBlocs.dayPlanId, dayPlanIds))
      .orderBy(asc(dayPlanWodBlocs.order));

    const wodBlocIds = blocs.map(b => b.wodBlocId);
    
    // 4. Get Exercises for these blocs
    let exercisesList: any[] = [];
    if (wodBlocIds.length > 0) {
      exercisesList = await db.select({
        wodBlocId: wodBlocExercises.wodBlocId,
        id: exercises.id,
        name: exercises.name,
        sets: exercises.sets,
        reps: exercises.reps,
        time: exercises.time,
        type: exercises.type
      })
        .from(wodBlocExercises)
        .innerJoin(exercises, eq(wodBlocExercises.exerciseId, exercises.id))
        .where(inArray(wodBlocExercises.wodBlocId, wodBlocIds));
    }

    // 5. Structure the response - Merged by Normalized Day Index (1-7)
    // We create a map of 1..7 days
    const mergedDays = [];
    for (let i = 1; i <= 7; i++) {
        // Find all day plans for this index (e.g. Day 1 of Program A and Day 1 of Program B)
        const relevantDays = allDays.filter(d => d.normalizedDayIndex === i);
        
        if (relevantDays.length === 0) continue;

        // Collect all blocks from these days
        let dayBlocks: any[] = [];
        
        relevantDays.forEach(day => {
            const dayBlocs = blocs.filter(b => b.dayPlanId === day.id);
            const structuredBlocs = dayBlocs.map(bloc => {
                const blocExercises = exercisesList.filter(e => e.wodBlocId === bloc.wodBlocId);
                return {
                    id: bloc.wodBlocId,
                    title: bloc.title,
                    type: bloc.type,
                    order: bloc.order, // Note: Order might conflict between programs, UI handles list
                    exercises: blocExercises.map(e => ({
                        id: e.id,
                        name: e.name,
                        sets: e.sets,
                        reps: e.reps,
                        time: e.time,
                        type: e.type
                    }))
                };
            });
            dayBlocks = [...dayBlocks, ...structuredBlocs];
        });

        // Use the ID of the first found day plan as a reference ID (or generate a virtual one)
        // Using the first one allows existing UI to have a valid ID.
        mergedDays.push({
            id: relevantDays[0].id, 
            dayNumber: i, // Return 1-7 index
            blocks: dayBlocks
        });
    }

    // Use max week number from enrollments just for info
    const maxWeek = activeEnrollments.reduce((max, e) => Math.max(max, Math.ceil(e.currentDay / 7)), 1);

    res.status(200).json({
      weekNumber: maxWeek,
      days: mergedDays
    });

  } catch (error) {
    console.error("Error in getWeeklyPlan:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
