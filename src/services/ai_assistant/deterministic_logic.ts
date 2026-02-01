import { 
  ProgramJSON, 
  InjuryDTO, 
  AthleteProfileDTO, 
  ValidationResult, 
  TrainingLogicProvider 
} from './interfaces.js';
import { db } from '../../db/index.js';
import { programs } from '../../db/training.js';
import { goals } from '../../db/goals.js';
import { serializeProgramWeek } from './serialization.js';
import { eq, inArray } from 'drizzle-orm';

const SYSTEM_ADMIN_ID = 'system_admin_001';

export const deterministicLogic: TrainingLogicProvider = {
  adaptProgramForInjury: async (program: ProgramJSON, injury: InjuryDTO): Promise<ProgramJSON> => {
    console.log(`[DeterministicLogic] Adapting program for injury: ${injury.description}`);
    return { ...program };
  },

  selectDefaultProgram: async (profile: AthleteProfileDTO): Promise<ProgramJSON> => {
    console.log(`[DeterministicLogic] Selecting default program for profile: ${JSON.stringify(profile)}`);
    
    // 1. Fetch system programs
    let availablePrograms = await db.select().from(programs).where(eq(programs.creatorId, SYSTEM_ADMIN_ID));
    
    if (availablePrograms.length === 0) {
        console.warn("No system programs found. Falling back to all programs.");
        availablePrograms = await db.select().from(programs);
        if (availablePrograms.length === 0) throw new Error("No programs available in the database.");
    }

    // 2. Fetch Goal Labels
    let goalLabels: string[] = [];
    if (profile.goals && profile.goals.length > 0) {
        const goalRecords = await db.select().from(goals).where(inArray(goals.id, profile.goals));
        goalLabels = goalRecords.map(g => g.label);
    }

    // 3. Score programs based on goals
    const goalKeywords: Record<string, string[]> = {
        'Weight Loss': ['cardio', 'burn', 'fat', 'loss', 'metcon', 'hiit'],
        'Weight Gain': ['hypertrophy', 'mass', 'bulk', 'strength'],
        'Build Muscle': ['hypertrophy', 'muscle', 'bodybuilding'],
        'Improve Cardio': ['cardio', 'run', 'endurance', 'stamina'],
        'Focus Legs': ['leg', 'squat'],
        'Focus Upper Body': ['upper', 'bench', 'press'],
        'Flexibility': ['yoga', 'stretch', 'mobility'],
        'Strength': ['strength', 'power', 'lift', 'heavy'],
    };

    let bestProgram = availablePrograms[0];
    let bestScore = -1;

    for (const prog of availablePrograms) {
        let score = 0;
        const text = `${prog.title} ${prog.description || ''}`.toLowerCase();
        
        for (const label of goalLabels) {
            const keywords = goalKeywords[label] || [];
            for (const keyword of keywords) {
                if (text.includes(keyword.toLowerCase())) {
                    score += 1;
                }
            }
        }
        
        if (text.includes('builder') || text.includes('general')) {
            score += 0.5;
        }

        if (score > bestScore) {
            bestScore = score;
            bestProgram = prog;
        }
    }

    console.log(`[DeterministicLogic] Selected program: ${bestProgram.title} (Score: ${bestScore})`);

    return await serializeProgramWeek(bestProgram.id, 1);
  },

  validateProgram: (program: ProgramJSON): ValidationResult => {
    return { isValid: true };
  }
};