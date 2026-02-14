import { Request, Response } from 'express';
import { db } from '../db/index.js';
import { user } from '../db/schema.js';
import { userGoals } from '../db/goals.js';
import { programs, enrollments } from '../db/training.js';
import { coachAthletes } from '../db/schema.js';
import { eq, like, and, inArray, ilike } from 'drizzle-orm';
import { handleCoachDisconnect } from '../services/enrollment.service.js';

export const getMyCoaches = async (req: Request, res: Response) => {
  try {
    const sessionUser = (req as any).user;
    if (!sessionUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Fetch coaches from the join table
    const coaches = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
      })
      .from(coachAthletes)
      .innerJoin(user, eq(coachAthletes.coachId, user.id))
      .where(eq(coachAthletes.athleteId, sessionUser.id));

    // For each coach, find programs they created that the user is enrolled in
    const coachesWithPrograms = await Promise.all(coaches.map(async (coach) => {
      // 1. Get all program IDs created by this coach
      const coachProgramIds = await db
          .select({ id: programs.id })
          .from(programs)
          .where(eq(programs.creatorId, coach.id))
          .then(rows => rows.map(r => r.id));

      if (coachProgramIds.length === 0) {
        return { ...coach, assignedPrograms: [] };
      }

      // 2. Check which of these the user is enrolled in
      const activeEnrollments = await db
          .select({
              id: programs.id,
              title: programs.title
          })
          .from(enrollments)
          .innerJoin(programs, eq(enrollments.programId, programs.id))
          .where(and(
              eq(enrollments.userId, sessionUser.id),
              inArray(enrollments.programId, coachProgramIds)
          ));

      return {
        ...coach,
        assignedPrograms: activeEnrollments.map(e => ({ id: e.id, name: e.title }))
      };
    }));

    res.json(coachesWithPrograms);
  } catch (error) {
    console.error("Error fetching my coaches:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const removeCoach = async (req: Request, res: Response) => {
  try {
    const sessionUser = (req as any).user;
    if (!sessionUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const { coachId } = req.params;

    await db.delete(coachAthletes)
        .where(and(eq(coachAthletes.athleteId, sessionUser.id), eq(coachAthletes.coachId, coachId)));

    // Cleanup legacy field if needed
    const currentUser = await db.select().from(user).where(eq(user.id, sessionUser.id)).then(r => r[0]);
    if (currentUser && currentUser.coachId === coachId) {
        await db.update(user).set({ coachId: null }).where(eq(user.id, sessionUser.id));
    }

    // Remove coach's programs and re-assign default if no coaches left
    await handleCoachDisconnect(sessionUser.id, coachId);

    res.json({ message: "Coach removed successfully" });
  } catch (error) {
    console.error("Error removing coach:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const searchUsers = async (req: Request, res: Response) => {
  try {
    const { query, role } = req.query;

    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: "Search query is required" });
      return;
    }

    const conditions = [ilike(user.name, `%${query}%`)];
    
    if (role && (role === 'coach' || role === 'athlete')) {
      conditions.push(eq(user.role, role));
    }
    
    // Only return users who allow invites if searching for potential connections
    conditions.push(eq(user.allowInvites, true));

    const results = await db
      .select({
        id: user.id,
        name: user.name,
        role: user.role,
        image: user.image,
      })
      .from(user)
      .where(and(...conditions))
      .limit(20);

    res.json(results);
  } catch (error) {
    console.error("Error searching users:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
// ... (updateProfile implementation remains mostly same, but should probably return assignedPrograms too if we want consistency)
// Ideally updateProfile logic should just return the same structure or call getProfile logic.
// For now, let's just fix getProfile which is critical for the loop.
  try {
    const sessionUser = (req as any).user;
    if (!sessionUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { name, age, gender, availabilityPerWeek, goals: goalIds } = req.body;

    await db.update(user)
      .set({
        name,
        age,
        gender,
        availabilityPerWeek,
      })
      .where(eq(user.id, sessionUser.id));

    if (Array.isArray(goalIds)) {
      await db.delete(userGoals).where(eq(userGoals.userId, sessionUser.id));
      if (goalIds.length > 0) {
        await db.insert(userGoals).values(
          goalIds.map((gid: string) => ({
            userId: sessionUser.id,
            goalId: gid
          }))
        );
      }
    }

    // Reuse getProfile logic or fetch manually
    return await getProfile(req, res); // Delegate to getProfile to ensure consistent response

  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getProfile = async (req: Request, res: Response) => {
    try {
        const sessionUser = (req as any).user;
        if (!sessionUser) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        console.log(`getProfile: Fetching user ${sessionUser.id}`);
        const [userData] = await db.select().from(user).where(eq(user.id, sessionUser.id));
        if (!userData) {
            console.log(`getProfile: User ${sessionUser.id} not found in DB`);
            return res.status(404).json({message: "User not found"});
        }

        let activeGoals = await db.select({
            id: userGoals.goalId
        }).from(userGoals).where(eq(userGoals.userId, sessionUser.id));

        console.log(`getProfile: Found ${activeGoals.length} active goals in userGoals table.`);

        if (activeGoals.length === 0 && userData.goals && Array.isArray(userData.goals) && userData.goals.length > 0) {
            console.log(`Syncing goals for user ${userData.id} from JSONB to Table...`);
            const legacyGoals = userData.goals as string[];
            
            try {
                await db.insert(userGoals).values(
                    legacyGoals.map(gid => ({
                        userId: userData.id,
                        goalId: gid
                    }))
                ).onConflictDoNothing();
                console.log(`Syncing complete.`);
            } catch (e) {
                console.error(`Syncing failed:`, e);
            }

            activeGoals = await db.select({
                id: userGoals.goalId
            }).from(userGoals).where(eq(userGoals.userId, sessionUser.id));
        }

        const activeEnrollments = await db.select({
            id: programs.id,
            title: programs.title
        })
        .from(enrollments)
        .innerJoin(programs, eq(enrollments.programId, programs.id))
        .where(eq(enrollments.userId, sessionUser.id));

        res.json({
            ...userData,
            goals: activeGoals.map(g => g.id),
            assignedPrograms: activeEnrollments.map(e => ({ id: e.id, name: e.title }))
        });
    } catch (error) {
        console.error("Error fetching profile:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}
