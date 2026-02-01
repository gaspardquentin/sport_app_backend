import { db } from './src/db/index.js';
import { goals } from './src/db/goals.js';

async function checkGoals() {
  const allGoals = await db.select().from(goals);
  console.log('Goals in DB:', allGoals.length);
  console.log(JSON.stringify(allGoals, null, 2));
  process.exit(0);
}

checkGoals().catch(console.error);
