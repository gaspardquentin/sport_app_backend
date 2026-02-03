import { 
  ProgramJSON, 
  InjuryDTO, 
  AthleteProfileDTO, 
  ValidationResult, 
  TrainingLogicProvider 
} from './interfaces.js';
import { db } from '../../db/index.js';
import { programs, defaultPrograms } from '../../db/training.js';
import { serializeProgramWeek } from './serialization.js';
import { eq } from 'drizzle-orm';

export const deterministicLogic: TrainingLogicProvider = {
  adaptProgramForInjury: async (program: ProgramJSON, injury: InjuryDTO): Promise<ProgramJSON> => {
    console.log(`[DeterministicLogic] Adapting program for injury: ${injury.description}`);
    
    // Deep clone to avoid mutating original
    const newProgram: ProgramJSON = JSON.parse(JSON.stringify(program));
    
    if (!injury.affectedBodyParts || injury.affectedBodyParts.length === 0) {
      return newProgram;
    }

    newProgram.weeks.forEach(week => {
      week.days.forEach(day => {
        // 1. Filter exercises in each bloc
        day.wodBlocs.forEach(bloc => {
          bloc.exercises = bloc.exercises.filter(ex => {
            // Keep exercise if it has no specific muscle group
            if (!ex.muscleGroup) return true;
            
            // Remove if muscle group is in affected body parts
            // We assume case-insensitive match or exact match depending on data
            // Since both are controlled enums/strings, exact match is expected.
            return !injury.affectedBodyParts.includes(ex.muscleGroup);
          });
        });

        // 2. Remove blocs that have no exercises left
        day.wodBlocs = day.wodBlocs.filter(bloc => bloc.exercises.length > 0);
      });
    });

    return newProgram;
  },

  selectDefaultProgram: async (profile: AthleteProfileDTO): Promise<ProgramJSON> => {
    console.log(`[DeterministicLogic] Selecting default program for profile: ${JSON.stringify(profile)}`);
    
    // 1. Fetch candidate programs from default_programs table
    const candidates = await db.select({
        program: programs,
        meta: defaultPrograms
    })
    .from(defaultPrograms)
    .innerJoin(programs, eq(defaultPrograms.programId, programs.id));
    
    if (candidates.length === 0) {
        throw new Error("No default programs configured in the database.");
    }

    // 2. Score programs based on Goal ID match
    let bestProgram = candidates[0].program;
    let bestScore = -1;

    for (const cand of candidates) {
        let score = 0;
        
        // Direct Goal Match (High Priority)
        if (cand.meta.goalId && profile.goals.includes(cand.meta.goalId)) {
            score += 10; 
        }
        
        // Secondary Criteria (Gender, Age) - Optional implementation
        // if (cand.meta.gender && cand.meta.gender === profile.gender) score += 2;
        
        // Fallback scoring or tie-breaking logic could go here
        
        if (score > bestScore) {
            bestScore = score;
            bestProgram = cand.program;
        }
    }

    console.log(`[DeterministicLogic] Selected program: ${bestProgram.title} (Score: ${bestScore})`);

    return await serializeProgramWeek(bestProgram.id, 1);
  },

  validateProgram: (program: ProgramJSON): ValidationResult => {
    return { isValid: true };
  }
};