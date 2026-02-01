import { db } from './src/db/index.js';
import { goals, userGoals } from './src/db/goals.js';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';

async function seed() {
  console.log('Seeding Goals...');

  // 0. Clean up
  console.log('Cleaning existing goals...');
  await db.delete(userGoals);
  await db.delete(goals);

  const goalsData = [
    { label: 'Weight Loss', code: 'weight_loss', exclusive: ['weight_gain'] },
    { label: 'Weight Gain', code: 'weight_gain', exclusive: ['weight_loss'] },
    { label: 'Build Muscle', code: 'build_muscle' },
    { label: 'Improve Cardio', code: 'improve_cardio' },
    { label: 'Focus Legs', code: 'focus_legs' },
    { label: 'Focus Upper Body', code: 'focus_upper_body' },
    { label: 'Flexibility', code: 'flexibility' },
    { label: 'Strength', code: 'strength' },
  ];

  // 1. Insert all goals first to get IDs
  const goalMap: Record<string, string> = {}; // code -> id

  for (const g of goalsData) {
    const id = uuidv4();
    // Check if exists to avoid dupes on re-run
    await db.insert(goals).values({
      id,
      label: g.label,
      code: g.code,
      description: `Focus on ${g.label}`,
    }).onConflictDoUpdate({
      target: goals.code,
      set: { label: g.label } // Update label just in case
    });
    
    // Fetch the ID back
    const [record] = await db.select().from(goals).where(eq(goals.code, g.code));
    if (record) {
      goalMap[g.code] = record.id;
      console.log(`Goal '${g.label}' ready (${record.id})`);
    }
  }

  // 2. Update exclusive relations
  for (const g of goalsData) {
    if (g.exclusive && g.exclusive.length > 0) {
      const exclusiveIds = g.exclusive.map(code => goalMap[code]).filter(Boolean);
      await db.update(goals)
        .set({ exclusiveWith: exclusiveIds })
        .where(eq(goals.code, g.code));
      console.log(`Updated exclusivity for '${g.label}'`);
    }
  }

  console.log('Goals Seeding Complete!');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
