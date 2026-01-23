import { Request, Response } from 'express';
import { db } from '../db/index.js';
import { user as userSchema } from '../db/schema.js';
import { enrollments, programs } from '../db/training.js';
import { eq, and, like, isNull, ne } from 'drizzle-orm';

// GET /coach/athletes
export const getCoachAthletes = async (req: Request, res: Response) => {
    try {
        const currentUser = (req as any).user;
        if (!currentUser) return res.status(401).json({ message: "Unauthorized" });

        const athletes = await db.select({
            id: userSchema.id,
            name: userSchema.name,
            email: userSchema.email,
            image: userSchema.image,
            role: userSchema.role,
        })
        .from(userSchema)
        .where(eq(userSchema.coachId, currentUser.id));

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

        const results = await db.select({
            id: userSchema.id,
            name: userSchema.name,
            email: userSchema.email,
            image: userSchema.image
        })
        .from(userSchema)
        .where(
            and(
                eq(userSchema.role, 'athlete'),
                isNull(userSchema.coachId), // Only athletes without a coach
                like(userSchema.name, `%${query}%`) // Simple case-sensitive search for now, adjust for case-insensitive if needed (ilike in Postgres)
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
export const addAthlete = async (req: Request, res: Response) => {
    try {
        const currentUser = (req as any).user;
        const { athleteId } = req.params;

        // Verify athlete exists and has no coach
        const athlete = await db.select().from(userSchema).where(eq(userSchema.id, athleteId)).then(r => r[0]);
        if (!athlete) return res.status(404).json({ message: "Athlete not found" });
        if (athlete.coachId) return res.status(400).json({ message: "Athlete already has a coach" });

        await db.update(userSchema)
            .set({ coachId: currentUser.id })
            .where(eq(userSchema.id, athleteId));

        res.json({ message: "Athlete added successfully" });
    } catch (error) {
        console.error("Error adding athlete:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// DELETE /coach/athletes/:athleteId
export const removeAthlete = async (req: Request, res: Response) => {
    try {
        const currentUser = (req as any).user;
        const { athleteId } = req.params;

        await db.update(userSchema)
            .set({ coachId: null })
            .where(and(eq(userSchema.id, athleteId), eq(userSchema.coachId, currentUser.id)));

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

        // 1. Verify Athlete belongs to Coach
        const athlete = await db.select().from(userSchema)
            .where(and(eq(userSchema.id, athleteId), eq(userSchema.coachId, currentUser.id)))
            .then(r => r[0]);
        
        if (!athlete) return res.status(403).json({ message: "Athlete not found or not yours" });

        // 2. Check if already enrolled
        const existing = await db.select().from(enrollments)
            .where(and(eq(enrollments.userId, athleteId), eq(enrollments.programId, programId)))
            .then(r => r[0]);

        if (existing) {
             // Idempotency: Return 200 if already assigned
             return res.status(200).json({ message: "Program already assigned" });
        }

        // 3. Add new enrollment
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
        const athlete = await db.select().from(userSchema)
            .where(and(eq(userSchema.id, athleteId), eq(userSchema.coachId, currentUser.id)))
            .then(r => r[0]);
        
        if (!athlete) return res.status(403).json({ message: "Athlete not found or not yours" });

        // 2. Remove enrollment
        await db.delete(enrollments)
            .where(and(eq(enrollments.userId, athleteId), eq(enrollments.programId, programId)));

        res.json({ message: "Program unassigned successfully" });
    } catch (error) {
        console.error("Error unassigning program:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};
