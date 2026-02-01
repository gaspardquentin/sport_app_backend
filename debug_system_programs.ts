import { db } from './src/db/index.js';
import { programs } from './src/db/training.js';
import { user } from './src/db/schema.js';
import { eq } from 'drizzle-orm';

const SYSTEM_ADMIN_ID = 'system_admin_001';

async function check() {
  const admin = await db.select().from(user).where(eq(user.id, SYSTEM_ADMIN_ID));
  console.log('Admin:', admin);

  const sysPrograms = await db.select().from(programs).where(eq(programs.creatorId, SYSTEM_ADMIN_ID));
  console.log('System Programs:', sysPrograms.map(p => ({ id: p.id, title: p.title })));
  
  process.exit(0);
}

check().catch(console.error);
