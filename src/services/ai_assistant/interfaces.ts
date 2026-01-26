export interface AthleteProfileDTO {
  age: number;
  gender: 'male' | 'female' | 'other';
  goals: string[];
  availabilityPerWeek: number;
}

export interface InjuryDTO {
  description: string;
  affectedBodyParts: string[];
  severity: 'low' | 'medium' | 'high';
}

export interface ValidationResult {
  isValid: boolean;
  errors?: string[];
}

export interface ProgramJSON {
  id?: string;
  title: string;
  description?: string;
  weeks: WeekJSON[];
}

export interface WeekJSON {
  weekNumber: number;
  days: DayJSON[];
}

export interface DayJSON {
  dayNumber: number;
  wodBlocs: WodBlocJSON[];
}

export interface WodBlocJSON {
  id?: string;
  title: string;
  type: string;
  exercises: ExerciseJSON[];
}

export interface ExerciseJSON {
  id?: string;
  name: string;
  sets: number;
  reps?: number;
  time?: string;
  type?: string;
}

export interface TrainingLogicProvider {
  adaptProgramForInjury(program: ProgramJSON, injury: InjuryDTO): Promise<ProgramJSON>;
  selectDefaultProgram(profile: AthleteProfileDTO): Promise<ProgramJSON>;
  validateProgram(program: ProgramJSON): ValidationResult;
}
