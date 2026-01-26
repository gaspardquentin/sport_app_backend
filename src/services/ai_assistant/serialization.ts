import { db } from '../../db/index.js';
import { programs, dayPlans, dayPlanWodBlocs, wodBlocs, wodBlocExercises, exercises } from '../../db/training.js';
import { eq, and, asc, inArray, between } from 'drizzle-orm';
import { ProgramJSON, DayJSON, WodBlocJSON, ExerciseJSON, WeekJSON } from './interfaces.js';

/**
 * Serializes a specific week of a program to a JSON structure.
 */
export async function serializeProgramWeek(programId: string, weekNumber: number): Promise<ProgramJSON> {
  const [programRecord] = await db.select().from(programs).where(eq(programs.id, programId));
  if (!programRecord) throw new Error(`Program ${programId} not found`);

  const startDay = (weekNumber - 1) * 7 + 1;
  const endDay = weekNumber * 7;

  const dayPlanRecords = await db.select()
    .from(dayPlans)
    .where(and(eq(dayPlans.programId, programId), between(dayPlans.dayNumber, startDay, endDay)))
    .orderBy(asc(dayPlans.dayNumber));

  if (dayPlanRecords.length === 0) {
    return {
      id: programId,
      title: programRecord.title,
      description: programRecord.description || undefined,
      weeks: [{ weekNumber, days: [] }]
    };
  }

  const dayPlanIds = dayPlanRecords.map(d => d.id);

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
      type: exercises.type
    })
      .from(wodBlocExercises)
      .innerJoin(exercises, eq(wodBlocExercises.exerciseId, exercises.id))
      .where(inArray(wodBlocExercises.wodBlocId, wodBlocIds));
  }

  const days: DayJSON[] = dayPlanRecords.map(dp => {
    const dayBlocs = blocs.filter(b => b.dayPlanId === dp.id);
    const wodBlocsJson: WodBlocJSON[] = dayBlocs.map(b => {
      const blocExercises = exercisesList.filter(e => e.wodBlocId === b.wodBlocId);
      return {
        id: b.wodBlocId,
        title: b.title,
        type: b.type,
        exercises: blocExercises.map(e => ({
          id: e.id,
          name: e.name,
          sets: e.sets,
          reps: e.reps || undefined,
          time: e.time || undefined,
          type: e.type || undefined
        }))
      };
    });

    return {
      dayNumber: dp.dayNumber,
      wodBlocs: wodBlocsJson
    };
  });

  return {
    id: programId,
    title: programRecord.title,
    description: programRecord.description || undefined,
    weeks: [{
      weekNumber,
      days
    }]
  };
}

/**
 * Converts a serialized ProgramJSON back to a format suitable for the UI.
 * Note: This does not persist to DB, it's a pure transformation.
 */
export function workoutFromJSON(json: ProgramJSON): any {
  // This mirrors the structure expected by the frontend's getWeeklyPlan response
  const week = json.weeks[0];
  if (!week) return { weekNumber: 1, days: [] };

  return {
    weekNumber: week.weekNumber,
    days: week.days.map(d => ({
      dayNumber: ((d.dayNumber - 1) % 7) + 1, // Normalized 1-7
      blocks: d.wodBlocs.map((b, index) => ({
        id: b.id,
        title: b.title,
        type: b.type,
        order: index + 1,
        exercises: b.exercises
      }))
    }))
  };
}
