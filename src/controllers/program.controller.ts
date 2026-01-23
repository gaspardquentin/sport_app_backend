import { Request, Response } from 'express';
import { db } from '../db/index.js';
import { programs, dayPlans, wodBlocs, exercises, wodBlocExercises, dayPlanWodBlocs } from '../db/training.js';
import { eq, and, inArray, ne } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export const getCoachPrograms = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (!user) {
             res.status(401).json({ message: "Unauthorized" });
             return;
        }
        
        // Fetch programs where creatorId == user.id
        const userPrograms = await db.select()
            .from(programs)
            .where(eq(programs.creatorId, user.id))
            .orderBy(programs.lastEditDate);
        
        // Return light version (no nested days) for the list
        res.status(200).json(userPrograms);
    } catch (error) {
        console.error("Error getting programs:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const getProgramById = async (req: Request, res: Response) => {
     try {
        const user = (req as any).user;
        const { id } = req.params;
        
        if (!user) {
             res.status(401).json({ message: "Unauthorized" });
             return;
        }

        const program = await db.select().from(programs).where(and(eq(programs.id, id), eq(programs.creatorId, user.id))).then(rows => rows[0]);
        
        if (!program) {
            res.status(404).json({ message: "Program not found" });
            return;
        }

        // Fetch Full Hierarchy
        const days = await db.select().from(dayPlans).where(eq(dayPlans.programId, id)).orderBy(dayPlans.dayNumber);
        const dayIds = days.map(d => d.id);
        
        let structuredDays: any[] = [];

        if (dayIds.length > 0) {
            // Get DayPlan -> WodBloc links
            const dayBlocJoins = await db.select()
                .from(dayPlanWodBlocs)
                .where(inArray(dayPlanWodBlocs.dayPlanId, dayIds))
                .orderBy(dayPlanWodBlocs.order);
            
            const wodBlocIds = dayBlocJoins.map(db => db.wodBlocId);
            
            let allWodBlocs: any[] = [];
            let allExercises: any[] = [];
            let blocExerciseJoins: any[] = [];

            if (wodBlocIds.length > 0) {
                 allWodBlocs = await db.select().from(wodBlocs).where(inArray(wodBlocs.id, wodBlocIds));
                 
                 blocExerciseJoins = await db.select().from(wodBlocExercises).where(inArray(wodBlocExercises.wodBlocId, wodBlocIds));
                 
                 if (blocExerciseJoins.length > 0) {
                     const exerciseIds = blocExerciseJoins.map(be => be.exerciseId);
                     allExercises = await db.select().from(exercises).where(inArray(exercises.id, exerciseIds));
                 }
            }

            structuredDays = days.map(day => {
                const dayJoins = dayBlocJoins.filter(j => j.dayPlanId === day.id);
                
                const structuredBlocs = dayJoins.map(join => {
                    const bloc = allWodBlocs.find(b => b.id === join.wodBlocId);
                    if (!bloc) return null;

                    const exerciseJoins = blocExerciseJoins.filter(j => j.wodBlocId === bloc.id);
                    const blocExercises = exerciseJoins.map(join => allExercises.find(e => e.id === join.exerciseId)).filter(Boolean);

                    return {
                        ...bloc,
                        exercises: blocExercises
                    };
                }).filter(Boolean);

                return {
                    ...day,
                    blocs: structuredBlocs // Note: frontend might expect 'blocks' or 'blocs', keeping consistency with model
                };
            });
        } else {
             structuredDays = days.map(d => ({ ...d, blocs: [] }));
        }

        res.status(200).json({
            ...program,
            days: structuredDays
        });

    } catch (error) {
        console.error("Error getting program:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

export const createProgram = async (req: Request, res: Response) => {
    const { title, description, days } = req.body;
    const user = (req as any).user;

    if (!title) {
        res.status(400).json({ message: "Title is required" });
        return;
    }

    try {
        // Check for duplicate name
        const existingName = await db.select().from(programs)
            .where(and(eq(programs.creatorId, user.id), eq(programs.title, title)))
            .then(rows => rows[0]);
        
        if (existingName) {
            res.status(400).json({ message: "A program with this name already exists" });
            return;
        }

        await db.transaction(async (tx) => {
            const programId = uuidv4();
            
            // 1. Create Program
            await tx.insert(programs).values({
                id: programId,
                title,
                description: description || "",
                creatorId: user.id,
                creationDate: new Date(),
                lastEditDate: new Date(),
            });

            // 2. Create Days
            if (days && Array.isArray(days)) {
                for (const day of days) {
                    const dayId = uuidv4();
                    await tx.insert(dayPlans).values({
                        id: dayId,
                        programId: programId,
                        dayNumber: day.dayIndex ?? day.dayNumber, // handling frontend variation
                    });

                    // 3. Create Blocs
                    if (day.blocs && Array.isArray(day.blocs)) {
                        for (let i = 0; i < day.blocs.length; i++) {
                            const blocData = day.blocs[i];
                            const blocId = uuidv4();
                            
                            // Create WodBloc
                            await tx.insert(wodBlocs).values({
                                id: blocId,
                                title: blocData.label ?? blocData.title ?? "Block",
                                type: blocData.type,
                            });
                            
                            // Link Day -> Bloc
                            await tx.insert(dayPlanWodBlocs).values({
                                dayPlanId: dayId,
                                wodBlocId: blocId,
                                order: i,
                            });

                            // 4. Create Exercises
                            if (blocData.exercises && Array.isArray(blocData.exercises)) {
                                for (const exData of blocData.exercises) {
                                    const exId = uuidv4();
                                    
                                    await tx.insert(exercises).values({
                                        id: exId,
                                        name: exData.title ?? exData.name ?? "Exercise",
                                        sets: exData.sets ?? 1,
                                        reps: exData.reps,
                                        time: exData.time ? (typeof exData.time === 'number' ? exData.time : null) : null, // Handle interval/string later if needed
                                        type: exData.type,
                                    });

                                    // Link Bloc -> Exercise
                                    await tx.insert(wodBlocExercises).values({
                                        wodBlocId: blocId,
                                        exerciseId: exId
                                    });
                                }
                            }
                        }
                    }
                }
            }
            
            res.status(201).json({ id: programId, message: "Program created successfully" });
        });

    } catch (error) {
        console.error("Error creating program:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const updateProgram = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { title, description, days } = req.body;
    const user = (req as any).user;

    try {
        // Verify ownership
        const existing = await db.select().from(programs).where(and(eq(programs.id, id), eq(programs.creatorId, user.id))).then(rows => rows[0]);
        if (!existing) {
             res.status(404).json({ message: "Program not found or unauthorized" });
             return;
        }

        // Check for duplicate name (excluding current program)
        const duplicateName = await db.select().from(programs)
            .where(and(
                eq(programs.creatorId, user.id), 
                eq(programs.title, title),
                ne(programs.id, id)
            ))
            .then(rows => rows[0]);

        if (duplicateName) {
            res.status(400).json({ message: "A program with this name already exists" });
            return;
        }

        await db.transaction(async (tx) => {
            // Update Program Metadata
            await tx.update(programs)
                .set({ 
                    title, 
                    description: description || "", 
                    lastEditDate: new Date() 
                })
                .where(eq(programs.id, id));

            // DELETE AND RECREATE STRATEGY for nested structure
            
            // 1. Get current Days
            const currentDays = await tx.select().from(dayPlans).where(eq(dayPlans.programId, id));
            const currentDayIds = currentDays.map(d => d.id);
            
            if (currentDayIds.length > 0) {
                // Get Day -> Bloc links
                const blocLinks = await tx.select().from(dayPlanWodBlocs).where(inArray(dayPlanWodBlocs.dayPlanId, currentDayIds));
                const blocIds = blocLinks.map(b => b.wodBlocId);
                
                if (blocIds.length > 0) {
                     // Get Bloc -> Exercise links
                     const exLinks = await tx.select().from(wodBlocExercises).where(inArray(wodBlocExercises.wodBlocId, blocIds));
                     const exIds = exLinks.map(e => e.exerciseId);
                     
                     // Delete Exercise Links
                     await tx.delete(wodBlocExercises).where(inArray(wodBlocExercises.wodBlocId, blocIds));
                     
                     // Delete Exercises (Assuming not shared for now per instructions)
                     if (exIds.length > 0) {
                        await tx.delete(exercises).where(inArray(exercises.id, exIds));
                     }

                     // Delete Bloc Links
                     await tx.delete(dayPlanWodBlocs).where(inArray(dayPlanWodBlocs.dayPlanId, currentDayIds));
                     
                     // Delete Blocs
                     await tx.delete(wodBlocs).where(inArray(wodBlocs.id, blocIds));
                }

                // Delete Days
                await tx.delete(dayPlans).where(inArray(dayPlans.id, currentDayIds));
            }
            
            // RE-CREATE (Copy-paste logic from createProgram roughly)
             if (days && Array.isArray(days)) {
                for (const day of days) {
                    const dayId = uuidv4();
                    await tx.insert(dayPlans).values({
                        id: dayId,
                        programId: id,
                        dayNumber: day.dayIndex ?? day.dayNumber, 
                    });

                    if (day.blocs && Array.isArray(day.blocs)) {
                        for (let i = 0; i < day.blocs.length; i++) {
                            const blocData = day.blocs[i];
                            const blocId = uuidv4();
                            
                            await tx.insert(wodBlocs).values({
                                id: blocId,
                                title: blocData.label ?? blocData.title ?? "Block",
                                type: blocData.type,
                            });
                            
                            await tx.insert(dayPlanWodBlocs).values({
                                dayPlanId: dayId,
                                wodBlocId: blocId,
                                order: i,
                            });

                            if (blocData.exercises && Array.isArray(blocData.exercises)) {
                                for (const exData of blocData.exercises) {
                                    const exId = uuidv4();
                                    
                                    await tx.insert(exercises).values({
                                        id: exId,
                                        name: exData.title ?? exData.name ?? "Exercise",
                                        sets: exData.sets ?? 1,
                                        reps: exData.reps,
                                        time: exData.time ? (typeof exData.time === 'number' ? exData.time : null) : null,
                                        type: exData.type,
                                    });

                                    await tx.insert(wodBlocExercises).values({
                                        wodBlocId: blocId,
                                        exerciseId: exId
                                    });
                                }
                            }
                        }
                    }
                }
            }
        });
        
        res.status(200).json({ message: "Program updated successfully" });

    } catch (error) {
        console.error("Error updating program:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const deleteProgram = async (req: Request, res: Response) => {
     // NOTE: We are choosing to CASCADE delete the nested exercises.
     // If exercises become a shared library later, this logic MUST change to only remove links.
     
     const { id } = req.params;
     const user = (req as any).user;

     try {
        const existing = await db.select().from(programs).where(and(eq(programs.id, id), eq(programs.creatorId, user.id))).then(rows => rows[0]);
        if (!existing) {
             res.status(404).json({ message: "Program not found or unauthorized" });
             return;
        }

        await db.transaction(async (tx) => {
             // 1. Get nested IDs to delete
            const currentDays = await tx.select().from(dayPlans).where(eq(dayPlans.programId, id));
            const currentDayIds = currentDays.map(d => d.id);
            
            if (currentDayIds.length > 0) {
                const blocLinks = await tx.select().from(dayPlanWodBlocs).where(inArray(dayPlanWodBlocs.dayPlanId, currentDayIds));
                const blocIds = blocLinks.map(b => b.wodBlocId);
                
                if (blocIds.length > 0) {
                     const exLinks = await tx.select().from(wodBlocExercises).where(inArray(wodBlocExercises.wodBlocId, blocIds));
                     const exIds = exLinks.map(e => e.exerciseId);
                     
                     // Delete Exercises & Links
                     if (exIds.length > 0) {
                        await tx.delete(wodBlocExercises).where(inArray(wodBlocExercises.wodBlocId, blocIds));
                        await tx.delete(exercises).where(inArray(exercises.id, exIds));
                     }

                     // Delete Blocs & Links
                     await tx.delete(dayPlanWodBlocs).where(inArray(dayPlanWodBlocs.dayPlanId, currentDayIds));
                     await tx.delete(wodBlocs).where(inArray(wodBlocs.id, blocIds));
                }
                // Delete Days
                await tx.delete(dayPlans).where(inArray(dayPlans.id, currentDayIds));
            }

            // Delete Program
            await tx.delete(programs).where(eq(programs.id, id));
        });

        res.status(200).json({ message: "Program deleted successfully" });

     } catch (error) {
        console.error("Error deleting program:", error);
        res.status(500).json({ message: "Internal Server Error" });
     }
};