import { Request, Response } from 'express';
import { db } from '../db/index.js';
import { enrollments, dayPlans, dayPlanWodBlocs, wodBlocs, wodBlocExercises, exercises } from '../db/training.js';
import { eq, and, between, inArray, asc } from 'drizzle-orm';

export const getWeeklyPlan = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    // 1. Get Enrollment
    const enrollment = await db.select()
      .from(enrollments)
      .where(eq(enrollments.userId, user.id))
      .limit(1)
      .then(rows => rows[0]);

    if (!enrollment) {
      res.status(404).json({ message: "No active enrollment found" });
      return;
    }

    const currentDay = enrollment.currentDay;
    const currentWeek = Math.ceil(currentDay / 7);
    const startDay = (currentWeek - 1) * 7 + 1;
    const endDay = currentWeek * 7;

    // 2. Get Day Plans for the week
    const days = await db.select()
      .from(dayPlans)
      .where(
        and(
          eq(dayPlans.programId, enrollment.programId),
          between(dayPlans.dayNumber, startDay, endDay)
        )
      )
      .orderBy(asc(dayPlans.dayNumber));

    if (days.length === 0) {
       res.status(200).json({ weekNumber: currentWeek, days: [] });
       return;
    }

    const dayPlanIds = days.map(d => d.id);

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

    // 5. Structure the response
    const structuredDays = days.map(day => {
      const dayBlocs = blocs.filter(b => b.dayPlanId === day.id);
      
      const structuredBlocs = dayBlocs.map(bloc => {
        const blocExercises = exercisesList.filter(e => e.wodBlocId === bloc.wodBlocId);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { wodBlocId, ...exerciseData } = blocExercises[0] || {}; // Cleaning up? No, need to map all
        
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
            type: e.type
          }))
        };
      });

      return {
        id: day.id,
        dayNumber: day.dayNumber,
        blocks: structuredBlocs
      };
    });

    res.status(200).json({
      weekNumber: currentWeek,
      days: structuredDays
    });

  } catch (error) {
    console.error("Error in getWeeklyPlan:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
