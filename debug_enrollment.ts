import { db } from './src/db/index.js';
import { user as userSchema } from './src/db/schema.js';
import { enrollments, programs } from './src/db/training.js';
import { eq } from 'drizzle-orm';

async function main() {
  console.log("--- Users ---");
  const users = await db.select().from(userSchema);
  console.log(users.map(u => ({ id: u.id, name: u.name, coachId: u.coachId })));

  console.log("\n--- Programs ---");
  const allPrograms = await db.select().from(programs);
  console.log(allPrograms.map(p => ({ id: p.id, title: p.title })));

  console.log("\n--- Enrollments ---");
  const allEnrollments = await db.select().from(enrollments);
  console.log(allEnrollments);

  console.log("\n--- Simulating getCoachAthletes ---");
  // Pick the first coach found or assume a specific one if known, 
  // but let's just run the query for ALL users to see if ANY have mapped programs.
  
  const athletesWithProgram = await Promise.all(users.map(async (athlete) => {
      const assignedEnrollments = await db.select({
          programTitle: programs.title,
          programId: programs.id
      })
      .from(enrollments)
      .innerJoin(programs, eq(enrollments.programId, programs.id))
      .where(eq(enrollments.userId, athlete.id));

      return {
          athleteName: athlete.name,
          assignedPrograms: assignedEnrollments.map(e => ({ id: e.programId, name: e.programTitle }))
      };
  }));

  console.log(JSON.stringify(athletesWithProgram, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
