
import { db } from './src/db/index.js';
import { session } from './src/db/schema.js';
import { eq } from 'drizzle-orm';

async function checkSession() {
  const tokenToFind = "QVldFJ1Q6926hLVoxtKYt2Xq0xP6fEwx";
  console.log(`Checking for token: ${tokenToFind}`);

  try {
    const foundSession = await db.select().from(session).where(eq(session.token, tokenToFind));
    
    console.log("Search result:", foundSession);

    if (foundSession.length > 0) {
        console.log("Session found details:");
        console.log("Expires At:", foundSession[0].expiresAt);
        console.log("Current Time:", new Date());
        console.log("Is Expired:", new Date() > foundSession[0].expiresAt);
    } else {
        console.log("Session NOT found matching exact token string.");
        
        // List all sessions to see what they look like
        const allSessions = await db.select().from(session).limit(5);
        console.log("First 5 sessions in DB:", allSessions);
    }

  } catch (error) {
    console.error("Database error:", error);
  }
  process.exit(0);
}

checkSession();
