/**
 * Data types and models for the gym tracker app
 */

export type WeightUnit = 'kg' | 'lbs';

export type ExerciseType = 'weighted' | 'bodyweight' | 'assisted-bodyweight' | 'weighted-bodyweight' | 'doubled';

export type ExerciseGroupType = 'superset';

/**
 * Muscle groups matching react-native-body-highlighter library
 * Supports front/back and male/female body visualization
 */
export type MuscleGroup =
  // Upper body - front
  | 'chest'
  | 'deltoids-front'
  | 'deltoids-side'
  | 'deltoids-rear'
  | 'deltoids' // legacy (pre-split)
  | 'biceps'
  | 'forearm' // legacy/current UI slug
  | 'forearms' // legacy
  | 'abs'
  | 'obliques'
  // Upper body - back
  | 'trapezius'
  | 'upper-back'
  | 'lower-back'
  | 'triceps'
  | 'lats'
  // Lower body - front
  | 'quadriceps'
  | 'adductors'
  | 'tibialis'
  | 'knees'
  // Lower body - back
  | 'gluteal'
  | 'hamstring'
  | 'calves'
  // Other body parts
  | 'neck'
  | 'hands'
  | 'feet'
  | 'ankles'
  | 'head'
  | 'hair';

/**
 * Set type - distinguishes warmup, working, and failure sets
 * - 'warmup': Not counted in volume or rep max calculations
 * - 'working': Normal working set
 * - 'failure': Set taken to true muscular failure, used for accurate rep max estimation
 */
export type SetType = 'warmup' | 'working' | 'failure';

/**
 * Individual set configuration in a template
 */
export interface TemplateSetConfig {
  reps: number;
  weight: number;
  unit: WeightUnit;
  setType?: SetType; // 'warmup' or 'working' (default: 'working')
}

/**
 * Exercise template - used in workout templates
 */
export interface Exercise {
  id: string;
  exerciseId?: string; // Reference to predefined exercise ID (ex_xxxxx format)
  name: string;
  sets: number; // Total number of sets (for backward compatibility)
  reps: number; // Default reps (for backward compatibility)
  weight?: number; // Default weight (for backward compatibility)
  unit: WeightUnit;
  type: ExerciseType;
  notes?: string;
  restTimer?: number; // Rest time in seconds, default 180 (3 mins)
  timerEnabled?: boolean; // Whether rest timer is enabled for this exercise (default true)
  autoProgressionEnabled?: boolean;
  autoProgressionMinReps?: number;
  autoProgressionMaxReps?: number;
  autoProgressionUseDefaultRange?: boolean;
  primaryMuscle?: MuscleGroup;
  secondaryMuscles?: MuscleGroup[];
  setDetails?: TemplateSetConfig[]; // Individual set configurations (reps/weight per set)

  // Optional grouping metadata (e.g. supersets)
  groupType?: ExerciseGroupType;
  groupId?: string;
  groupPosition?: 0 | 1; // For supersets: 0 = A, 1 = B
}

/**
 * Workout template - reusable workout plan
 */
export interface WorkoutTemplate {
  id: string;
  name: string;
  exercises: Exercise[];
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
}

/**
 * Weekly plan day assignment (0 = Sunday ... 6 = Saturday)
 */
export interface WeekPlanDay {
  dayIndex: WeekStartDay;
  routineIds: string[];
}

/**
 * Week plan - reusable weekly schedule of routine IDs
 */
export interface WeekPlan {
  id: string;
  name: string;
  days: WeekPlanDay[];
  createdAt: number;
  updatedAt: number;
}

/**
 * A single set of an exercise during a workout
 */
export interface CompletedSet {
  setNumber: number;
  reps: number;
  weight: number; // For bodyweight exercises, set to 0
  unit: WeightUnit;
  timestamp: number;
  completed?: boolean; // Whether this set was marked as complete
  isRepsPlaceholder?: boolean; // Whether reps value is a placeholder (not user-entered)
  isWeightPlaceholder?: boolean; // Whether weight value is a placeholder (not user-entered)
  setType?: SetType; // 'warmup' or 'working' (default: 'working')
}

/**
 * An exercise as logged during a completed workout
 */
export interface CompletedExercise {
  id: string;
  exerciseId?: string; // Reference to predefined exercise ID (ex_xxxxx format)
  name: string;
  sets: CompletedSet[];
  // Exercise metadata (preserved for template updates)
  type?: ExerciseType;
  primaryMuscle?: MuscleGroup;
  secondaryMuscles?: MuscleGroup[];
  muscleContributions?: Record<MuscleGroup, number>;
  restTimer?: number;
  timerEnabled?: boolean;
  notes?: string;

  // Optional grouping metadata (e.g. supersets)
  groupType?: ExerciseGroupType;
  groupId?: string;
  groupPosition?: 0 | 1; // For supersets: 0 = A, 1 = B
}

/**
 * A completed workout session
 */
export interface CompletedWorkout {
  id: string;
  templateId?: string;
  name: string;
  startTime: number;
  endTime: number;
  exercises: CompletedExercise[];
  notes?: string;
}

/**
 * Failure set data point for rep max tracking
 * Each data point represents a set taken to true failure
 */
export interface FailureSetData {
  reps: number;           // Rep count at failure
  weight: number;         // Weight used (in kg)
  timestamp: number;      // When this failure set was logged
  workoutId: string;      // Reference to the workout
}

/**
 * Day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 */
export type WeekStartDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * App settings stored locally
 */
export interface AppSettings {
  weightUnit: WeightUnit;
  theme: 'light' | 'dark' | 'auto';
  defaultRestTime: number; // Default rest time in seconds for new exercises
  autoProgressionEnabled: boolean;
  defaultAutoProgressionMinReps: number;
  defaultAutoProgressionMaxReps: number;
  defaultAutoProgressionWeightIncrement: number;
  bodyMapGender: 'male' | 'female'; // Gender for body map visualization
  weekStartDay: WeekStartDay; // Day to start the week (0 = Sunday, 1 = Monday, etc.)
  showQuotes: boolean; // Whether to show inspirational quotes on home screen
  lastUpdated: number;
  exerciseIdMigrationCompleted?: boolean; // Whether exercise ID migration has been completed
}

/**
 * Exercise metadata with muscle groups
 */
export interface ExerciseMetadata {
  id?: string; // Unique exercise ID (ex_xxxxx format)
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles?: MuscleGroup[];
  exerciseType: ExerciseType;
  type?: ExerciseType; // Alias for exerciseType (for convenience)
  muscleContributions?: Partial<Record<MuscleGroup, number>>; // Percentage contribution per muscle (must sum to 100)
}

/**
 * Body weight log entry
 */
export interface BodyWeightLog {
  date: string; // YYYY-MM-DD format
  weight: number;
  unit: WeightUnit;
  timestamp: number;
}

/**
 * Exercise volume log - tracks highest single set volume per day per exercise
 */
export interface ExerciseVolumeLog {
  exerciseId: string; // ID of the exercise
  date: string; // YYYY-MM-DD format
  volume: number; // Highest single set volume for this day
  reps: number; // Reps from the best set
  weight: number; // Weight from the best set
  unit: WeightUnit;
  timestamp: number;
  /**
   * Where this entry came from.
   * - 'workout': computed from completed workout history
   * - 'manual': user-entered override via the Exercise Detail volume history modal
   */
  source?: 'workout' | 'manual';
}

/**
 * Generate a deterministic exercise ID from the exercise name
 * Uses a simple hash function to create a consistent ID
 */
function generateExerciseIdFromName(name: string): string {
  let hash = 0;
  const str = name.toLowerCase();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Convert to base36 and take absolute value, pad to 6 chars
  const hashStr = Math.abs(hash).toString(36).padStart(6, '0').slice(0, 6);
  return `ex_${hashStr}`;
}

/**
 * Predefined exercises with muscle group associations and muscle contributions
 */
const PREDEFINED_EXERCISES_RAW: Omit<ExerciseMetadata, 'id'>[] = [
  // Chest
  { name: 'Bench Press (Barbell)', primaryMuscle: 'chest', secondaryMuscles: ['triceps'], exerciseType: 'weighted', muscleContributions: { chest: 70, triceps: 30 } },
  { name: 'Bench Press (Dumbbell)', primaryMuscle: 'chest', secondaryMuscles: ['triceps'], exerciseType: 'weighted', muscleContributions: { chest: 70, triceps: 30 } },
  { name: 'Bench Press (Incline)', primaryMuscle: 'chest', secondaryMuscles: ['deltoids-front'], exerciseType: 'weighted', muscleContributions: { chest: 65, 'deltoids-front': 35 } },
  { name: 'Bench Press (Smith)', primaryMuscle: 'chest', secondaryMuscles: ['deltoids-front'], exerciseType: 'weighted', muscleContributions: { chest: 70, 'deltoids-front': 30 } },
  { name: 'Cable Fly', primaryMuscle: 'chest', exerciseType: 'weighted', muscleContributions: { chest: 100 } },
  { name: 'Chest Press (Machine)', primaryMuscle: 'chest', secondaryMuscles: ['triceps'], exerciseType: 'weighted', muscleContributions: { chest: 70, triceps: 30 } },
  { name: 'Pec Deck', primaryMuscle: 'chest', exerciseType: 'weighted', muscleContributions: { chest: 100 } },
  { name: 'Push-up', primaryMuscle: 'chest', secondaryMuscles: ['triceps'], exerciseType: 'bodyweight', muscleContributions: { chest: 70, triceps: 30 } },

  // Back
  { name: 'Back Extension', primaryMuscle: 'lower-back', secondaryMuscles: ['gluteal', 'hamstring'], exerciseType: 'weighted', muscleContributions: { 'lower-back': 60, gluteal: 20, hamstring: 20 } },
  { name: 'Back Extension (Machine)', primaryMuscle: 'lower-back', secondaryMuscles: ['gluteal', 'hamstring'], exerciseType: 'weighted', muscleContributions: { 'lower-back': 60, gluteal: 20, hamstring: 20 } },
  { name: 'Deadlift', primaryMuscle: 'lower-back', secondaryMuscles: ['hamstring', 'gluteal'], exerciseType: 'weighted', muscleContributions: { 'lower-back': 50, hamstring: 30, gluteal: 20 } },
  { name: 'Lat Pulldown (Cable)', primaryMuscle: 'lats', secondaryMuscles: ['biceps', 'upper-back'], exerciseType: 'weighted', muscleContributions: { lats: 70, biceps: 20, 'upper-back': 10 } },
  { name: 'Lat Pulldown (Machine)', primaryMuscle: 'lats', secondaryMuscles: ['biceps', 'upper-back'], exerciseType: 'weighted', muscleContributions: { lats: 70, biceps: 20, 'upper-back': 10 } },
  { name: 'Lat Pull-over', primaryMuscle: 'lats', secondaryMuscles: ['biceps', 'upper-back'], exerciseType: 'weighted', muscleContributions: { lats: 100} },
  { name: 'Pull-up', primaryMuscle: 'lats', secondaryMuscles: ['biceps', 'upper-back'], exerciseType: 'bodyweight', muscleContributions: { lats: 60, 'upper-back': 10, biceps: 30 } },
  { name: 'Pull-up (Assisted)', primaryMuscle: 'lats', secondaryMuscles: ['upper-back', 'biceps'], exerciseType: 'assisted-bodyweight', muscleContributions: { lats: 60, 'upper-back': 10, biceps: 30 } },
  { name: 'Pull-up (Weighted)', primaryMuscle: 'lats', secondaryMuscles: ['biceps', 'upper-back'], exerciseType: 'weighted-bodyweight', muscleContributions: { lats: 60, 'upper-back': 10, biceps: 30 } },
  { name: 'Row (Barbell)', primaryMuscle: 'upper-back', secondaryMuscles: ['biceps', 'lats'], exerciseType: 'weighted', muscleContributions: { 'upper-back': 50, biceps: 25, lats: 25 } },
  { name: 'Row (Dumbbell)', primaryMuscle: 'upper-back', secondaryMuscles: ['biceps', 'lats'], exerciseType: 'doubled', muscleContributions: { 'upper-back': 50, biceps: 25, lats: 25 } },
  { name: 'Row (Seated Cable)', primaryMuscle: 'lats', secondaryMuscles: ['upper-back', 'biceps'], exerciseType: 'weighted', muscleContributions: { lats: 60, 'upper-back': 20, biceps: 20 } },

  // Shoulders
  { name: 'Face Pull', primaryMuscle: 'deltoids-rear', secondaryMuscles: ['upper-back'], exerciseType: 'weighted', muscleContributions: { 'deltoids-rear': 60, 'upper-back': 40 } },
  { name: 'Front Raise', primaryMuscle: 'deltoids-front', exerciseType: 'weighted', muscleContributions: { 'deltoids-front': 100 } },
  { name: 'Lateral Raise (Dumbell)', primaryMuscle: 'deltoids-side', exerciseType: 'doubled', muscleContributions: { 'deltoids-side': 100 } },
  { name: 'Lateral Raise (Cable)', primaryMuscle: 'deltoids-side', exerciseType: 'doubled', muscleContributions: { 'deltoids-side': 100 } },
  { name: 'Rear Delt Fly', primaryMuscle: 'deltoids-rear', secondaryMuscles: ['upper-back'], exerciseType: 'weighted', muscleContributions: { 'deltoids-rear': 70, 'upper-back': 30 } },
  { name: 'Shoulder Press (Dumbbell)', primaryMuscle: 'deltoids-front', secondaryMuscles: ['triceps', 'deltoids-side'], exerciseType: 'weighted', muscleContributions: { 'deltoids-front': 50, 'deltoids-side': 20, triceps: 30 } },
  { name: 'Shoulder Press (Machine)', primaryMuscle: 'deltoids-front', secondaryMuscles: ['triceps', 'deltoids-side'], exerciseType: 'weighted', muscleContributions: { 'deltoids-front': 50, 'deltoids-side': 20, triceps: 30 } },
  { name: 'Shrug', primaryMuscle: 'trapezius', exerciseType: 'weighted', muscleContributions: { trapezius: 100 } },

  // Arms
  { name: 'Bicep Curl (Barbell)', primaryMuscle: 'biceps', exerciseType: 'weighted', muscleContributions: { biceps: 100 } },
  { name: 'Bicep Curl (Bayesian)', primaryMuscle: 'biceps', exerciseType: 'doubled', muscleContributions: { biceps: 100 } },
  { name: 'Bicep Curl (Dumbbell)', primaryMuscle: 'biceps', exerciseType: 'doubled', muscleContributions: { biceps: 100 } },
  { name: 'Bicep Curl (Machine)', primaryMuscle: 'biceps', exerciseType: 'weighted', muscleContributions: { biceps: 100 } },
  { name: 'Chin-up (Assisted)', primaryMuscle: 'biceps', secondaryMuscles: ['upper-back', 'lats'], exerciseType: 'assisted-bodyweight', muscleContributions: { biceps: 50, 'upper-back': 25, lats: 25 } },
  { name: 'Dip (Assisted)', primaryMuscle: 'triceps', secondaryMuscles: ['chest'], exerciseType: 'assisted-bodyweight', muscleContributions: { triceps: 65, chest: 35 } },
  { name: 'Hammer Curl (Dumbbell)', primaryMuscle: 'biceps', secondaryMuscles: ['forearms'], exerciseType: 'doubled', muscleContributions: { biceps: 85, forearms: 15 } },
  { name: 'Hammer Curl (Machine)', primaryMuscle: 'biceps', secondaryMuscles: ['forearms'], exerciseType: 'weighted', muscleContributions: { biceps: 85, forearms: 15 } },
  { name: 'Preacher Curl', primaryMuscle: 'biceps', exerciseType: 'weighted', muscleContributions: { biceps: 100 } },
  { name: 'Tricep Dip', primaryMuscle: 'triceps', secondaryMuscles: ['chest'], exerciseType: 'bodyweight', muscleContributions: { triceps: 65, chest: 35 } },
  { name: 'Tricep Pushdown', primaryMuscle: 'triceps', exerciseType: 'weighted', muscleContributions: { triceps: 100 } },

  // Legs
  { name: 'Calf Raise', primaryMuscle: 'calves', exerciseType: 'weighted', muscleContributions: { calves: 100 } },
  { name: 'Hip Abduction (Machine)', primaryMuscle: 'gluteal', exerciseType: 'weighted', muscleContributions: { gluteal: 100 } },
  { name: 'Hip Adduction (Machine)', primaryMuscle: 'adductors', secondaryMuscles: ['quadriceps'], exerciseType: 'weighted', muscleContributions: { adductors: 80, quadriceps: 20 } },
  { name: 'Kettlebell Swing', primaryMuscle: 'gluteal', secondaryMuscles: ['hamstring', 'lower-back', 'abs'], exerciseType: 'weighted', muscleContributions: { gluteal: 40, hamstring: 30, 'lower-back': 20, abs: 10 } },
  { name: 'Leg Curl (Lying)', primaryMuscle: 'hamstring', exerciseType: 'weighted', muscleContributions: { hamstring: 100 } },
  { name: 'Leg Curl (Seated)', primaryMuscle: 'hamstring', secondaryMuscles: ['calves'], exerciseType: 'weighted', muscleContributions: { hamstring: 85, calves: 15 } },
  { name: 'Leg Extension', primaryMuscle: 'quadriceps', exerciseType: 'weighted', muscleContributions: { quadriceps: 100 } },
  { name: 'Leg Press', primaryMuscle: 'quadriceps', secondaryMuscles: ['gluteal', 'hamstring'], exerciseType: 'weighted', muscleContributions: { quadriceps: 60, gluteal: 25, hamstring: 15 } },
  { name: 'Lunge', primaryMuscle: 'quadriceps', secondaryMuscles: ['gluteal', 'hamstring'], exerciseType: 'weighted', muscleContributions: { quadriceps: 50, gluteal: 30, hamstring: 20 } },
  { name: 'Squat', primaryMuscle: 'quadriceps', secondaryMuscles: ['gluteal', 'hamstring'], exerciseType: 'weighted', muscleContributions: { quadriceps: 50, gluteal: 30, hamstring: 20 } },
  { name: 'Goblet Squat', primaryMuscle: 'quadriceps', secondaryMuscles: ['gluteal', 'abs'], exerciseType: 'weighted', muscleContributions: { quadriceps: 60, gluteal: 25, abs: 15 } },

  // Core
  { name: 'Ab Wheel Rollout', primaryMuscle: 'abs', exerciseType: 'bodyweight', muscleContributions: { abs: 100 } },
  { name: "Captain's Chair Leg Raise", primaryMuscle: 'abs', exerciseType: 'bodyweight', muscleContributions: { abs: 100 } },
  { name: 'Crunch (Machine)', primaryMuscle: 'abs', exerciseType: 'weighted', muscleContributions: { abs: 100 } },
  { name: 'Crunch', primaryMuscle: 'abs', exerciseType: 'bodyweight', muscleContributions: { abs: 100 } },
  { name: 'Hanging Leg Raise', primaryMuscle: 'abs', exerciseType: 'bodyweight', muscleContributions: { abs: 100 } },
  { name: 'Plank', primaryMuscle: 'abs', secondaryMuscles: ['obliques'], exerciseType: 'bodyweight', muscleContributions: { abs: 70, obliques: 30 } },
  { name: 'Russian Twist', primaryMuscle: 'obliques', secondaryMuscles: ['abs'], exerciseType: 'bodyweight', muscleContributions: { obliques: 70, abs: 30 } },
  { name: 'Torso Rotation Machine', primaryMuscle: 'obliques', exerciseType: 'weighted', muscleContributions: { obliques: 100 } },
];

/**
 * Predefined exercises with generated IDs
 */
export const PREDEFINED_EXERCISES_WITH_MUSCLES: ExerciseMetadata[] = PREDEFINED_EXERCISES_RAW.map(ex => ({
  ...ex,
  id: generateExerciseIdFromName(ex.name),
}));

/**
 * Get just the exercise names for backward compatibility
 */
export const PREDEFINED_EXERCISES = PREDEFINED_EXERCISES_WITH_MUSCLES.map((ex) => ex.name);

/**
 * Get a predefined exercise by its ID
 */
export function getExerciseMusclesById(exerciseId: string): ExerciseMetadata | undefined {
  return PREDEFINED_EXERCISES_WITH_MUSCLES.find(ex => ex.id === exerciseId);
}

/**
 * Get a predefined exercise by name or ID (for backward compatibility)
 */
export function getExerciseMusclesByNameOrId(nameOrId: string): ExerciseMetadata | undefined {
  // Try ID lookup first
  if (nameOrId.startsWith('ex_')) {
    const byId = PREDEFINED_EXERCISES_WITH_MUSCLES.find(ex => ex.id === nameOrId);
    if (byId) return byId;
  }
  // Fall back to name lookup
  return PREDEFINED_EXERCISES_WITH_MUSCLES.find(
    ex => ex.name.toLowerCase() === nameOrId.toLowerCase()
  );
}

/**
 * Get muscle group info for an exercise
 */
export function getExerciseMuscles(exerciseName: string) {
  return PREDEFINED_EXERCISES_WITH_MUSCLES.find(
    (ex) => ex.name.toLowerCase() === exerciseName.toLowerCase()
  );
}
/**
 * Get effective exercise muscle data, merging customizations with defaults
 * Order of resolution:
 * 1. Customized predefined exercise data (by ID first, then by name)
 * 2. Hardcoded predefined exercise data (by ID first, then by name)
 * 3. Custom exercise data
 * 4. Falls back to undefined
 */
export function getEffectiveExerciseMuscles(
  exerciseNameOrId: string,
  customizations?: Record<string, { primaryMuscle?: MuscleGroup; secondaryMuscles?: MuscleGroup[]; muscleContributions?: Record<MuscleGroup, number>; exerciseType?: ExerciseType; type?: ExerciseType }>,
  isCustomExercise?: boolean,
  customExerciseData?: ExerciseMetadata
): ExerciseMetadata | undefined {
  // Check if user has customized a predefined exercise (by ID first)
  if (customizations) {
    // Try ID-based lookup first
    if (customizations[exerciseNameOrId]) {
      const predefinedById = PREDEFINED_EXERCISES_WITH_MUSCLES.find(
        (ex) => ex.id === exerciseNameOrId
      );
      if (predefinedById) {
        const customization = customizations[exerciseNameOrId];
        const customType = customization.exerciseType || customization.type || predefinedById.exerciseType;
        return {
          ...predefinedById,
          primaryMuscle: customization.primaryMuscle || predefinedById.primaryMuscle,
          secondaryMuscles: customization.secondaryMuscles || predefinedById.secondaryMuscles,
          muscleContributions: customization.muscleContributions || predefinedById.muscleContributions,
          exerciseType: customType,
          type: customType,
        };
      }
    }
    
    // Fall back to name-based lookup (for backward compatibility with non-migrated data)
    const predefinedByName = PREDEFINED_EXERCISES_WITH_MUSCLES.find(
      (ex) => ex.name.toLowerCase() === exerciseNameOrId.toLowerCase()
    );
    if (predefinedByName && customizations[predefinedByName.name]) {
      const customization = customizations[predefinedByName.name];
      const customType = customization.exerciseType || customization.type || predefinedByName.exerciseType;
      return {
        ...predefinedByName,
        primaryMuscle: customization.primaryMuscle || predefinedByName.primaryMuscle,
        secondaryMuscles: customization.secondaryMuscles || predefinedByName.secondaryMuscles,
        muscleContributions: customization.muscleContributions || predefinedByName.muscleContributions,
        exerciseType: customType,
        type: customType,
      };
    }
  }

  // Check predefined exercises by ID
  if (exerciseNameOrId.startsWith('ex_')) {
    const predefined = PREDEFINED_EXERCISES_WITH_MUSCLES.find(ex => ex.id === exerciseNameOrId);
    if (predefined) return predefined;
  }

  // Check predefined exercises by name
  const predefined = PREDEFINED_EXERCISES_WITH_MUSCLES.find(
    (ex) => ex.name.toLowerCase() === exerciseNameOrId.toLowerCase()
  );
  if (predefined) {
    return predefined;
  }

  // Return custom exercise data if provided
  if (customExerciseData) {
    return customExerciseData;
  }

  return undefined;
}