import { Request, Response, NextFunction } from "express";
import { auth } from "../config/auth.js";
import { fromNodeHeaders } from "better-auth/node";
import { db } from "../db/index.js";
import { session as sessionSchema, user as userSchema } from "../db/schema.js";
import { eq } from "drizzle-orm";

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const headers = fromNodeHeaders(req.headers);
    
    // 1. Manual Token Extraction & DB Check
    const authHeader = req.headers.authorization;
    let manualToken = "";
    let validDbSession: any = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      manualToken = authHeader.split(" ")[1];
      
      try {
        const dbSessions = await db.select().from(sessionSchema).where(eq(sessionSchema.token, manualToken)).limit(1);
        if (dbSessions.length > 0) {
          const s = dbSessions[0];
          if (new Date() < s.expiresAt) {
             validDbSession = s;
          }
        }
      } catch (dbErr) {
        console.error("Direct DB check failed:", dbErr);
      }
    }

    // 2. Standard Better-Auth Check
    let session = await auth.api.getSession({
      headers: headers,
    });

    // 3. Fallback: If better-auth fails but we manually verified the token, use our data
    if (!session && validDbSession) {
        // Fetch user
        const users = await db.select().from(userSchema).where(eq(userSchema.id, validDbSession.userId)).limit(1);
        
        if (users.length > 0) {
            session = {
                session: validDbSession,
                user: users[0] as any
            };
        }
    }

    if (!session) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    // Attach user/session to request
    (req as any).user = session.user;
    (req as any).session = session.session;

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
