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

    const mergedDaysMap: Map<number, any[]> = new Map();
    for (let i = 1; i <= 7; i++) mergedDaysMap.set(i, []);

    const enrollmentsToFetchStandard: typeof activeEnrollments = [];

    // 2. Process Enrollments: Check for Personalization vs Standard
    for (const enrollment of activeEnrollments) {
        const currentWeek = Math.ceil(enrollment.currentDay / 7);

        // Check for specific personalization for THIS program
        const [personalization] = await db.select()
            .from(programPersonalizations)
            .where(and(
                eq(programPersonalizations.userId, user.id),
                eq(programPersonalizations.originalProgramId, enrollment.programId),
                eq(programPersonalizations.weekNumber, currentWeek)
            ))
            .orderBy(desc(programPersonalizations.createdAt))
            .limit(1);

        if (personalization) {
            // Use Personalized Data
            const uiFormat = workoutFromJSON(personalization.data as any);
            // Merge into map
            if (uiFormat.days) {
                for (const day of uiFormat.days) {
                     const dayNum = day.dayNumber; // 1-7
                     if (mergedDaysMap.has(dayNum)) {
                         const currentBlocks = mergedDaysMap.get(dayNum)!;
                         // Add blocks from this program
                         if (day.blocks) {
                            mergedDaysMap.set(dayNum, [...currentBlocks, ...day.blocks]);
                         }
                     }
                }
            }
        } else {
            // Mark for standard fetch
            enrollmentsToFetchStandard.push(enrollment);
        }
    }

    // 3. Fetch Standard Data for remaining enrollments
    if (enrollmentsToFetchStandard.length > 0) {
        let allDays: any[] = [];
        for (const enrollment of enrollmentsToFetchStandard) {
            const currentWeek = Math.ceil(enrollment.currentDay / 7);
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
            
            const daysWithNormalizedIndex = programDays.map(d => ({
                ...d,
                normalizedDayIndex: ((d.dayNumber - 1) % 7) + 1
            }));
            allDays = [...allDays, ...daysWithNormalizedIndex];
        }

        if (allDays.length > 0) {
            const dayPlanIds = allDays.map(d => d.id);
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

            const wodBlocIds = [...new Set(blocs.map(b => b.wodBlocId))];
            
            let exercisesList: any[] = [];
            if (wodBlocIds.length > 0) {
                exercisesList = await db.select({
                    wodBlocId: wodBlocExercises.wodBlocId,
                    id: exercises.id,
                    name: exercises.name,
                    sets: exercises.sets,
                    reps: exercises.reps,
                    time: exercises.time,
                    type: exercises.type,
                    muscleGroup: exercises.muscleGroup
                })
                .from(wodBlocExercises)
                .innerJoin(exercises, eq(wodBlocExercises.exerciseId, exercises.id))
                .where(inArray(wodBlocExercises.wodBlocId, wodBlocIds));
            }

            // Merge standard data into map
            for (let i = 1; i <= 7; i++) {
                const relevantDays = allDays.filter(d => d.normalizedDayIndex === i);
                if (relevantDays.length === 0) continue;

                const currentBlocks = mergedDaysMap.get(i)!;
                let newBlocks: any[] = [];

                relevantDays.forEach(day => {
                    const dayBlocs = blocs.filter(b => b.dayPlanId === day.id);
                    const structuredBlocs = dayBlocs.map(bloc => {
                        const blocExercises = exercisesList.filter(e => e.wodBlocId === bloc.wodBlocId);
                        return {
                            id: bloc.wodBlocId,
                            title: bloc.title,
                            type: bloc.type,
                            order: bloc.order,
                            exercises: blocExercises.map(e => ({
                                id: e.id,
                                name: e.name,
                                sets: e.sets,
                                reps: e.reps,
                                time: e.time,
                                type: e.type,
                                muscleGroup: e.muscleGroup
                            }))
                        };
                    });
                    newBlocks = [...newBlocks, ...structuredBlocs];
                });
                
                mergedDaysMap.set(i, [...currentBlocks, ...newBlocks]);
            }
        }
    }

    // 4. Final Response Structure
    const mergedDays = [];
    for (let i = 1; i <= 7; i++) {
        const blocks = mergedDaysMap.get(i)!;
        if (blocks.length > 0) {
             mergedDays.push({
                 id: `day-${i}`, // Virtual ID
                 dayNumber: i,
                 blocks: blocks
             });
        }
    }

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

export const enrollUser = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const { programId } = req.body;
    if (!programId) return res.status(400).json({ message: "Missing programId" });

    // Check if already enrolled in this program
    const existing = await db.select().from(enrollments)
      .where(and(eq(enrollments.userId, user.id), eq(enrollments.programId, programId)));
    
    if (existing.length > 0) {
      return res.status(200).json({ message: "Already enrolled" });
    }

    await db.insert(enrollments).values({
      userId: user.id,
      programId: programId,
      currentDay: 1,
    });

    res.status(201).json({ message: "Enrolled successfully" });
  } catch (error) {
    console.error("Error enrolling user:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
