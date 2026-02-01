import { Request, Response } from 'express';
import { db } from '../db/index.js';
import { user } from '../db/schema.js';
import { userGoals } from '../db/goals.js';
import { programs, enrollments } from '../db/training.js';
import { eq } from 'drizzle-orm';

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
