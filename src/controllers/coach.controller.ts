import { Request, Response } from 'express';
import { db } from '../db/index.js';
import { user as userSchema, coachAthletes } from '../db/schema.js';
import { enrollments, programs, defaultPrograms } from '../db/training.js';
import { eq, and, like, isNull, ne, or, ilike, inArray } from 'drizzle-orm';
import { handleCoachDisconnect } from '../services/enrollment.service.js';

// GET /coach/athletes
export const getCoachAthletes = async (req: Request, res: Response) => {
    try {
        const currentUser = (req as any).user;
        if (!currentUser) return res.status(401).json({ message: "Unauthorized" });

        // Fetch athletes from the coach_athletes join table
        const athletes = await db.select({
            id: userSchema.id,
            name: userSchema.name,
            email: userSchema.email,
            age: userSchema.age,
            image: userSchema.image,
            role: userSchema.role,
        })
        .from(coachAthletes)
        .innerJoin(userSchema, eq(coachAthletes.athleteId, userSchema.id))
        .where(eq(coachAthletes.coachId, currentUser.id));

        // For each athlete, get their current assigned programs
        const athletesWithProgram = await Promise.all(athletes.map(async (athlete) => {
            const assignedEnrollments = await db.select({
                programTitle: programs.title,
                programId: programs.id
            })
            .from(enrollments)
            .innerJoin(programs, eq(enrollments.programId, programs.id))
            .where(eq(enrollments.userId, athlete.id));

            return {
                ...athlete,
                assignedPrograms: assignedEnrollments.map(e => ({ id: e.programId, name: e.programTitle }))
            };
        }));

        res.json(athletesWithProgram);
    } catch (error) {
        console.error("Error getting athletes:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// GET /coach/search?query=name
export const searchAvailableAthletes = async (req: Request, res: Response) => {
    try {
        const { query } = req.query;
        if (!query || typeof query !== 'string') return res.json([]);

        // Now we search all athletes who allow invites, regardless of coach status (since they can have multiple)
        const results = await db.select({
            id: userSchema.id,
            name: userSchema.name,
            email: userSchema.email,
            age: userSchema.age,
            image: userSchema.image
        })
        .from(userSchema)
        .where(
            and(
                eq(userSchema.role, 'athlete'),
                eq(userSchema.allowInvites, true),
                or(
                    ilike(userSchema.name, `%${query}%`), 
                    ilike(userSchema.email, `%${query}%`)
                )
            )
        )
        .limit(20);

        res.json(results);
    } catch (error) {
         console.error("Error searching athletes:", error);
         res.status(500).json({ message: "Internal Server Error" });
    }
};

// POST /coach/athletes/:athleteId
// @deprecated - Use Invitation System
export const addAthlete = async (req: Request, res: Response) => {
    res.status(410).json({ message: "This endpoint is deprecated. Use invitations system." });
};

// DELETE /coach/athletes/:athleteId
export const removeAthlete = async (req: Request, res: Response) => {
    try {
        const currentUser = (req as any).user;
        const { athleteId } = req.params;

        await db.delete(coachAthletes)
            .where(and(eq(coachAthletes.coachId, currentUser.id), eq(coachAthletes.athleteId, athleteId)));

        // Also cleanup legacy field if it matches
        await db.update(userSchema)
            .set({ coachId: null })
            .where(and(eq(userSchema.id, athleteId), eq(userSchema.coachId, currentUser.id)));

        // Remove coach's programs and re-assign default if no coaches left
        await handleCoachDisconnect(athleteId, currentUser.id);

        res.json({ message: "Athlete removed successfully" });
    } catch (error) {
        console.error("Error removing athlete:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// POST /coach/assign
export const assignProgram = async (req: Request, res: Response) => {
    try {
        const { athleteId, programId } = req.body;
        const currentUser = (req as any).user;

        // 1. Verify Athlete belongs to Coach (using new table)
        const relation = await db.select().from(coachAthletes)
            .where(and(eq(coachAthletes.coachId, currentUser.id), eq(coachAthletes.athleteId, athleteId)))
            .then(r => r[0]);
        
        if (!relation) return res.status(403).json({ message: "Athlete not found or not yours" });

        // 2. Check if already enrolled
        const existing = await db.select().from(enrollments)
            .where(and(eq(enrollments.userId, athleteId), eq(enrollments.programId, programId)))
            .then(r => r[0]);

        if (existing) {
             // Idempotency: Return 200 if already assigned
             return res.status(200).json({ message: "Program already assigned" });
        }

        // 3. Remove default program enrollments
        const defaultProgramIds = await db
            .select({ programId: defaultPrograms.programId })
            .from(defaultPrograms);

        if (defaultProgramIds.length > 0) {
            await db.delete(enrollments).where(
                and(
                    eq(enrollments.userId, athleteId),
                    inArray(enrollments.programId, defaultProgramIds.map(dp => dp.programId))
                )
            );
        }

        // 4. Add new enrollment
        if (programId) {
            await db.insert(enrollments).values({
                userId: athleteId,
                programId: programId,
                currentDay: 1,
                joinedAt: new Date()
            });
        }

        res.json({ message: "Program assigned successfully" });
    } catch (error) {
        console.error("Error assigning program:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// POST /coach/unassign
export const unassignProgram = async (req: Request, res: Response) => {
    try {
        const { athleteId, programId } = req.body;
        const currentUser = (req as any).user;

        // 1. Verify Athlete belongs to Coach
        const relation = await db.select().from(coachAthletes)
            .where(and(eq(coachAthletes.coachId, currentUser.id), eq(coachAthletes.athleteId, athleteId)))
            .then(r => r[0]);
        
        if (!relation) return res.status(403).json({ message: "Athlete not found or not yours" });

        // 2. Remove enrollment
        await db.delete(enrollments)
            .where(and(eq(enrollments.userId, athleteId), eq(enrollments.programId, programId)));

        res.json({ message: "Program unassigned successfully" });
    } catch (error) {
        console.error("Error unassigning program:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};
