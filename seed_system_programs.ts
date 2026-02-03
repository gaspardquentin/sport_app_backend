import { db } from './src/db/index.js';
import { programs, dayPlans, wodBlocs, exercises, dayPlanWodBlocs, wodBlocExercises, defaultPrograms } from './src/db/training.js';
import { user } from './src/db/schema.js';
import { goals } from './src/db/goals.js';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';

const SYSTEM_ADMIN_ID = 'system_admin_001';

async function seed() {
  console.log('Seeding System Default Programs...');

  // 0. Fetch Goal IDs
  const allGoals = await db.select().from(goals);
  const goalMap = new Map(allGoals.map(g => [g.code, g.id]));

  const getGoalId = (code: string) => {
      const id = goalMap.get(code);
      if (!id) throw new Error(`Goal code ${code} not found in DB`);
      return id;
  };

  // 1. Ensure System Admin User (Keep it for creatorId constraint)
  const [sysUser] = await db.select().from(user).where(eq(user.id, SYSTEM_ADMIN_ID));
  if (!sysUser) {
    console.log('Creating System Admin User...');
    await db.insert(user).values({
      id: SYSTEM_ADMIN_ID,
      name: 'System Admin',
      email: 'admin@sportapp.com',
      emailVerified: true,
      role: 'coach',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Helper to create exercise
  const createExercise = async (name: string, type: string, sets: number, reps?: number, time?: string) => {
    const id = uuidv4();
    await db.insert(exercises).values({
      id,
      name,
      type: type as any,
      sets,
      reps: reps || null,
      time: time || null
    });
    return id;
  };

  // Helper to create Program
  const createProgram = async (title: string, description: string, daysData: any[], goalCode: string) => {
    const existing = await db.select().from(programs).where(eq(programs.creatorId, SYSTEM_ADMIN_ID));
    const duplicate = existing.find(p => p.title === title);
    
    let programId = duplicate?.id;

    if (duplicate) {
        console.log(`Program '${title}' already exists.`);
    } else {
        programId = uuidv4();
        await db.insert(programs).values({
            id: programId,
            title,
            description,
            creatorId: SYSTEM_ADMIN_ID
        });
        console.log(`Created Program: ${title}`);

        // Create Content
        for (const day of daysData) {
            const dayPlanId = uuidv4();
            await db.insert(dayPlans).values({
                id: dayPlanId,
                programId: programId!,
                dayNumber: day.dayNum
            });

            let order = 1;
            for (const bloc of day.blocs) {
                const blocId = uuidv4();
                await db.insert(wodBlocs).values({
                    id: blocId,
                    title: bloc.title,
                    type: bloc.type as any
                });

                await db.insert(dayPlanWodBlocs).values({
                    dayPlanId,
                    wodBlocId: blocId,
                    order: order++
                });

                for (const exData of bloc.exercises) {
                    const exId = await createExercise(exData.name, exData.type || bloc.type, exData.sets, exData.reps, exData.time);
                    await db.insert(wodBlocExercises).values({
                        wodBlocId: blocId,
                        exerciseId: exId
                    });
                }
            }
        }
    }

    // Link to default_programs
    // Check if link exists
    const defaults = await db.select().from(defaultPrograms).where(eq(defaultPrograms.programId, programId!));
    if (defaults.length === 0) {
        await db.insert(defaultPrograms).values({
            id: uuidv4(),
            programId: programId!,
            goalId: getGoalId(goalCode),
            // We can leave 'goal' enum null as we migrated logic
        });
        console.log(`Linked '${title}' to default_programs with goal '${goalCode}'`);
    } else {
        // Update goalId if missing
        if (!defaults[0].goalId) {
             await db.update(defaultPrograms)
                .set({ goalId: getGoalId(goalCode) })
                .where(eq(defaultPrograms.id, defaults[0].id));
             console.log(`Updated '${title}' goal link.`);
        }
    }
  };

  // --- DEFINING PROGRAMS ---

  // 1. Weight Loss / Cardio
  await createProgram(
    "Fat Burner Max",
    "High intensity interval training focused on weight loss and cardio improvement.",
    [
        {
            dayNum: 1, // Mon
            blocs: [
                { title: "Morning Run", type: "cardio", exercises: [{ name: "5km Jog", sets: 1, time: "30 mins" }] },
                { title: "HIIT Circuit", type: "cardio", exercises: [{ name: "Burpees", sets: 4, reps: 15 }, { name: "Jump Squats", sets: 4, reps: 20 }] }
            ]
        },
        {
            dayNum: 3, // Wed
            blocs: [
                { title: "Rowing Intervals", type: "cardio", exercises: [{ name: "500m Row Sprint", sets: 6, time: "2 mins" }] }
            ]
        },
        {
            dayNum: 5, // Fri
            blocs: [
                { title: "Metcon", type: "cardio", exercises: [{ name: "Box Jumps", sets: 5, reps: 15 }, { name: "Kettlebell Swings", sets: 5, reps: 20 }] }
            ]
        }
    ],
    'weight_loss' // Goal Code
  );

  // 2. Muscle Builder
  await createProgram(
    "Hypertrophy Elite",
    "Focus on building muscle mass and strength.",
    [
        {
            dayNum: 1, // Mon: Chest/Tri
            blocs: [
                { title: "Chest Heavy", type: "strengh", exercises: [{ name: "Bench Press", sets: 5, reps: 5 }, { name: "Incline Dumbbell Press", sets: 4, reps: 10 }] },
                { title: "Triceps Isolation", type: "strengh", exercises: [{ name: "Tricep Pushdown", sets: 3, reps: 15 }] }
            ]
        },
        {
            dayNum: 2, // Tue: Back/Bi
            blocs: [
                { title: "Back Width", type: "strengh", exercises: [{ name: "Pull Ups", sets: 4, reps: 8 }, { name: "Lat Pulldown", sets: 4, reps: 12 }] }
            ]
        },
        {
            dayNum: 4, // Thu: Legs
            blocs: [
                { title: "Leg Destruction", type: "strengh", exercises: [{ name: "Squat", sets: 5, reps: 5 }, { name: "Leg Press", sets: 4, reps: 12 }] }
            ]
        },
        {
            dayNum: 5, // Fri: Shoulders
            blocs: [
                { title: "Boulder Shoulders", type: "strengh", exercises: [{ name: "Overhead Press", sets: 5, reps: 5 }, { name: "Lateral Raises", sets: 4, reps: 15 }] }
            ]
        }
    ],
    'build_muscle' // Goal Code
  );

  // 3. General Fitness
  await createProgram(
    "Total Fitness",
    "A balanced mix of cardio, strength, and flexibility.",
    [
        {
            dayNum: 1,
            blocs: [
                { title: "Full Body Strength", type: "strengh", exercises: [{ name: "Pushups", sets: 3, reps: 15 }, { name: "Air Squats", sets: 3, reps: 20 }] }
            ]
        },
        {
            dayNum: 3,
            blocs: [
                { title: "Steady Cardio", type: "cardio", exercises: [{ name: "Cycling", sets: 1, time: "45 mins" }] }
            ]
        },
        {
            dayNum: 5,
            blocs: [
                { title: "Mobility Flow", type: "flexibility", exercises: [{ name: "Yoga Routine", sets: 1, time: "30 mins" }] }
            ]
        }
    ],
    'strength' // Goal Code (or improve_cardio? Let's say strength for now)
  );

  console.log('System Programs Seeded.');
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});