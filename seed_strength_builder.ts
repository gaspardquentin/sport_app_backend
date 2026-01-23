
import { db } from './src/db/index.js';
import { 
  programs, dayPlans, wodBlocs, exercises, 
  dayPlanWodBlocs, wodBlocExercises, enrollments, exerciseType 
} from './src/db/training.js';
import { user } from './src/db/schema.js';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';

async function seed() {
  console.log('Seeding Strength Builder Program...');

  // 1. Get User (Enroll the specific user)
  const targetEmail = 'gaspard.quentin1905+t7@gmail.com';
  const users = await db.select().from(user).where(eq(user.email, targetEmail)).limit(1);
  if (users.length === 0) {
    console.error(`User with email ${targetEmail} not found. Please sign up first.`);
    process.exit(1);
  }
  const targetUser = users[0];
  console.log(`Enrolling user: ${targetUser.email} (${targetUser.id})`);

  // 2. Create Program
  const programId = uuidv4();
  await db.insert(programs).values({
    id: programId,
    title: 'Strength Builder',
    description: 'A comprehensive strength and conditioning program.'
  });
  console.log('Created Program: Strength Builder');

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

  // Helper to create WOD Bloc
  const createBloc = async (dayPlanId: string, title: string, type: string, order: number, exerciseList: any[]) => {
    const blocId = uuidv4();
    await db.insert(wodBlocs).values({
      id: blocId,
      title,
      type: type as any
    });

    await db.insert(dayPlanWodBlocs).values({
      dayPlanId,
      wodBlocId: blocId,
      order
    });

    for (const exData of exerciseList) {
      const exId = await createExercise(exData.name, exData.type || type, exData.sets, exData.reps, exData.time);
      await db.insert(wodBlocExercises).values({
        wodBlocId: blocId,
        exerciseId: exId
      });
    }
  };

  // Define Days
  const daysData = [
    {
      dayNum: 1, // Wednesday
      blocs: [
        { title: "Warmup Run", type: "cardio", exercises: [{ name: "5km Run", sets: 1, time: "25 minutes" }] },
        { title: "Gymnastics", type: "skill", exercises: [{ name: "Handstand Practice", sets: 5, time: "30 seconds" }] }
      ]
    },
    {
      dayNum: 2, // Thursday
      blocs: [
        { 
          title: "Heavy Lifting", type: "strengh", 
          exercises: [
            { name: "Deadlift", sets: 5, reps: 5 },
            { name: "Overhead Press", sets: 4, reps: 8 }
          ] 
        }
      ]
    },
    {
      dayNum: 3, // Friday
      blocs: [
        { title: "Leg Day", type: "strengh", exercises: [{ name: "Back Squat", sets: 5, reps: 5 }] },
        { title: "Metcon", type: "cardio", exercises: [{ name: "Rowing Intervals (500m)", sets: 10 }] }
      ]
    },
    {
      dayNum: 4, // Saturday
      blocs: [
        { title: "Advanced Skills", type: "skill", exercises: [{ name: "Muscle-up Progression", sets: 5, reps: 3 }] }
      ]
    },
    {
      dayNum: 5, // Sunday
      blocs: [
        { 
          title: "Upper Body", type: "strengh", 
          exercises: [
            { name: "Bench Press", sets: 5, reps: 5 },
            { name: "Bent Over Row", sets: 4, reps: 10 }
          ]
        },
        { title: "Recovery", type: "flexibility", exercises: [{ name: "Yoga Flow", sets: 1, time: "20 minutes" }] }
      ]
    },
    {
      dayNum: 6, // Monday
      blocs: [
        { title: "HIIT", type: "cardio", exercises: [{ name: "Interval Run (400m)", sets: 8 }] },
        { 
          title: "Bodyweight Strength", type: "strengh", 
          exercises: [
            { name: "Weighted Pull-ups", sets: 5, reps: 5 },
            { name: "Dips", sets: 4, reps: 12 }
          ]
        }
      ]
    },
    {
      dayNum: 7, // Tuesday
      blocs: [
        { title: "Mobility", type: "flexibility", exercises: [{ name: "Full Body Stretch", sets: 1, time: "30 minutes" }] }
      ]
    }
  ];

  // 3. Create Days and Blocs
  for (const day of daysData) {
    const dayPlanId = uuidv4();
    await db.insert(dayPlans).values({
      id: dayPlanId,
      programId: programId,
      dayNumber: day.dayNum
    });

    let order = 1;
    for (const bloc of day.blocs) {
      await createBloc(dayPlanId, bloc.title, bloc.type, order++, bloc.exercises);
    }
    console.log(`Created Day ${day.dayNum} with ${day.blocs.length} blocks.`);
  }

  // 4. Enroll User
  // Check if already enrolled to avoid PK violation?
  const existingEnrollment = await db.select().from(enrollments)
    .where(eq(enrollments.userId, targetUser.id));

  if (existingEnrollment.length > 0) {
      console.log("User already has an enrollment. Updating to new program.");
      // Just update the programId
      // Actually, PK is userId + programId. 
      // If we want to replace "active" enrollment, we might need to delete old ones if logic implies single active.
      // But let's just delete all enrollments for this user for cleanliness.
      await db.delete(enrollments).where(eq(enrollments.userId, targetUser.id));
  }

  await db.insert(enrollments).values({
    userId: targetUser.id,
    programId: programId,
    currentDay: 1
  });
  console.log('Enrolled user in Strength Builder.');

  console.log('Seeding Complete!');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
