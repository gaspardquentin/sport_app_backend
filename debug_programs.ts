import { db } from './src/db/index.js';
import { programs } from './src/db/training.js';

async function checkPrograms() {
  const all = await db.select().from(programs);
  console.log('Programs in DB:', all.length);
  console.log(JSON.stringify(all, null, 2));
  process.exit(0);
}

checkPrograms().catch(console.error);
