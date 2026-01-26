import { 
  ProgramJSON, 
  InjuryDTO, 
  AthleteProfileDTO, 
  ValidationResult, 
  TrainingLogicProvider 
} from './interfaces.js';

/**
 * Trivial implementation of training logic as requested.
 * These functions are placeholders for the user to implement actual business logic.
 */
export const deterministicLogic: TrainingLogicProvider = {
  adaptProgramForInjury: async (program: ProgramJSON, injury: InjuryDTO): Promise<ProgramJSON> => {
    console.log(`[DeterministicLogic] Adapting program for injury: ${injury.description}`);
    // Trivial: return as is
    return { ...program };
  },

  selectDefaultProgram: async (profile: AthleteProfileDTO): Promise<ProgramJSON> => {
    console.log(`[DeterministicLogic] Selecting default program for profile: ${JSON.stringify(profile)}`);
    // Trivial: return a mock program
    return {
      id: "default-strength-program",
      title: "Default Strength Program",
      weeks: []
    };
  },

  validateProgram: (program: ProgramJSON): ValidationResult => {
    // Trivial: always valid
    return { isValid: true };
  }
};
