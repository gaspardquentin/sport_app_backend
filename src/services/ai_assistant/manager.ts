import { db } from '../../db/index.js';
import { athleteInjuries, programPersonalizations } from '../../db/ai_assistant.js';
import { enrollments, programs } from '../../db/training.js';
import { eq, and, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { 
  AthleteProfileDTO, 
  InjuryDTO, 
  ProgramJSON, 
  TrainingLogicProvider 
} from './interfaces.js';
import { serializeProgramWeek } from './serialization.js';

import { callAIAssistant } from './openai_client.js';

export class AIAssistantManager {
  constructor(private logicProvider: TrainingLogicProvider) {}

  /**
   * Case 1: Adapt program for an injury
   */
  async adaptForInjury(userId: string, injury: InjuryDTO): Promise<ProgramJSON> {
    // 1. Persist injury
    const injuryId = uuidv4();
    await db.insert(athleteInjuries).values({
      id: injuryId,
      userId,
      description: injury.description,
      affectedBodyParts: injury.affectedBodyParts,
      severity: injury.severity,
      isActive: true,
    });

    return this.recalculateProgramForInjuries(userId);
  }

  async cancelInjury(userId: string, injuryId: string): Promise<ProgramJSON> {
    await db.update(athleteInjuries)
        .set({ isActive: false, resolvedAt: new Date() })
        .where(and(eq(athleteInjuries.id, injuryId), eq(athleteInjuries.userId, userId)));
    
    return this.recalculateProgramForInjuries(userId);
  }

  async recalculateProgramForInjuries(userId: string): Promise<ProgramJSON> {
    // Get all active injuries
    const injuries = await db.select().from(athleteInjuries)
        .where(and(eq(athleteInjuries.userId, userId), eq(athleteInjuries.isActive, true)));
    
    // Get ALL current program enrollments
    const userEnrollments = await db.select().from(enrollments).where(eq(enrollments.userId, userId));
    if (userEnrollments.length === 0) throw new Error("User not enrolled in any program");

    let lastAdaptedProgram: ProgramJSON | null = null;

    for (const enrollment of userEnrollments) {
        const currentWeek = Math.ceil(enrollment.currentDay / 7);
        
        // Start with FRESH template
        let program = await serializeProgramWeek(enrollment.programId, currentWeek);

        // Apply ALL injuries sequentially
        for (const inj of injuries) {
            const injuryDTO: InjuryDTO = {
                description: inj.description,
                affectedBodyParts: inj.affectedBodyParts as string[],
                severity: inj.severity
            };
            program = await this.logicProvider.adaptProgramForInjury(program, injuryDTO);
        }

        // Save personalization for THIS program
        // We use a specific ID based on user+program+week to avoid infinite insert growth? 
        // No, UUID is fine, assuming we query by 'latest'.
        await db.insert(programPersonalizations).values({
            id: uuidv4(),
            userId,
            originalProgramId: enrollment.programId,
            weekNumber: currentWeek,
            personalizationType: 'injury_adaptation',
            data: program as any,
        });

        lastAdaptedProgram = program;
    }

    return lastAdaptedProgram!;
  }

  async getActiveInjuries(userId: string): Promise<InjuryDTO[] & { id: string; createdAt: Date }[]> {
    const injuries = await db.select().from(athleteInjuries)
        .where(and(eq(athleteInjuries.userId, userId), eq(athleteInjuries.isActive, true)));
    
    return injuries.map(inj => ({
      id: inj.id,
      description: inj.description,
      affectedBodyParts: inj.affectedBodyParts as string[],
      severity: inj.severity as 'low' | 'medium' | 'high',
      createdAt: inj.createdAt
    }));
  }

  /**
   * Case 2: Recommend default program
   */
  async recommendProgram(profile: AthleteProfileDTO): Promise<string> {
    const programJson = await this.logicProvider.selectDefaultProgram(profile);
    // In a real scenario, this would return an existing Program ID from the DB
    return programJson.id || "default-program-id";
  }
  /**
   * Case 3: Reschedule missed workout
   */
  async rescheduleWorkout(userId: string, missedWorkoutId: string, constraints: { maxDurationMinutes: number }): Promise<ProgramJSON> {
    // 1. Get current program
    const [enrollment] = await db.select().from(enrollments).where(eq(enrollments.userId, userId));
    if (!enrollment) throw new Error("User not enrolled in any program");

    const currentWeek = Math.ceil(enrollment.currentDay / 7);
    
    const [existingPerso] = await db.select()
      .from(programPersonalizations)
      .where(and(
        eq(programPersonalizations.userId, userId),
        eq(programPersonalizations.weekNumber, currentWeek)
      ))
      .orderBy(desc(programPersonalizations.createdAt));

    const baseProgram = existingPerso ? (existingPerso.data as unknown as ProgramJSON) : await serializeProgramWeek(enrollment.programId, currentWeek);

    // 2. Prepare Prompt
    const prompt = `
      You are a professional sports coach assistant. 
      An athlete missed a workout (ID: ${missedWorkoutId}) and needs to reschedule their week.
      
      CONSTRAINTS:
      - Max duration per workout: ${constraints.maxDurationMinutes} minutes.
      - Do NOT create new exercises. Use only the ones provided.
      - Maintain muscular balance.
      - If Sunday is skipped, move the load to next week (not applicable in this simple JSON which is 1 week).
      
      CURRENT WEEK PLAN:
      ${JSON.stringify(baseProgram, null, 2)}
      
      OUTPUT:
      Respond ONLY with a valid JSON object matching the input ProgramJSON schema.
    `;

    // 3. Call AI
    const aiResult = await callAIAssistant(prompt);
    let rescheduledProgram: ProgramJSON;
    
    try {
      rescheduledProgram = JSON.parse(aiResult);
    } catch (e) {
      console.error("AI returned invalid JSON, falling back to deterministic logic");
      // Fallback
      rescheduledProgram = await this.logicProvider.adaptProgramForInjury(baseProgram, { 
        description: "Rescheduling missed workout (AI Failure Fallback)", 
        affectedBodyParts: [], 
        severity: 'low' 
      });
    }

    // 4. Validate
    const validation = this.logicProvider.validateProgram(rescheduledProgram);
    if (!validation.isValid) {
      throw new Error(`AI generated an invalid program: ${validation.errors?.join(', ')}`);
    }

    // 5. Save personalization
    await db.insert(programPersonalizations).values({
      id: uuidv4(),
      userId,
      originalProgramId: enrollment.programId,
      weekNumber: currentWeek,
      personalizationType: 'reschedule',
      data: rescheduledProgram as any,
    });

    return rescheduledProgram;
  }
}
