/**
 * Exercise ID Migration Utilities
 * 
 * Handles the migration from name-based exercise identification to ID-based.
 * Uses deterministic ID generation so exercises get consistent IDs across devices.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ExerciseMetadata, CompletedWorkout, WorkoutTemplate, AppSettings, ExerciseVolumeLog } from './types';
import { PREDEFINED_EXERCISES_WITH_MUSCLES } from './types';

// Storage keys
const STORAGE_KEYS = {
  TEMPLATES: 'workout_templates',
  WORKOUTS: 'completed_workouts',
  VOLUME_LOG: 'exercise_volume_log',
  CUSTOM_EXERCISES: 'custom_exercises',
  PREDEFINED_CUSTOMIZATIONS: 'predefined_exercise_customizations',
  SETTINGS: 'app_settings',
};

/**
 * Generate a deterministic ID for an exercise based on its name
 * Uses a simple hash to ensure consistency across app instances
 */
export function generateExerciseId(exerciseName: string): string {
  const normalized = exerciseName.trim().toLowerCase();
  
  // Simple deterministic hash
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to hex and prefix with 'ex_'
  const hexHash = Math.abs(hash).toString(36).padStart(8, '0');
  return `ex_${hexHash}`;
}

/**
 * Get or generate an ID for an exercise
 * Checks if exercise already has an ID, otherwise generates one
 */
export function getOrGenerateExerciseId(exercise: { id?: string; name: string }): string {
  if (exercise.id) return exercise.id;
  return generateExerciseId(exercise.name);
}

/**
 * Migrate custom exercises to add IDs
 */
export function migrateCustomExercises(exercises: ExerciseMetadata[]): Array<ExerciseMetadata & { id: string }> {
  return exercises.map(ex => ({
    ...ex,
    id: 'id' in ex && ex.id ? (ex as any).id : generateExerciseId(ex.name),
  }));
}

/**
 * Migrate predefined exercise customizations from name-based keys to ID-based keys
 */
export function migratePredefinedCustomizations(
  customizations: Record<string, any>,
  predefinedExercisesWithIds: Array<{ id: string; name: string }>
): Record<string, any> {
  const migrated: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(customizations)) {
    // Check if key is already an ID (starts with 'ex_')
    if (key.startsWith('ex_')) {
      migrated[key] = value;
    } else {
      // Find the exercise by name and use its ID
      const exercise = predefinedExercisesWithIds.find(
        ex => ex.name.toLowerCase() === key.toLowerCase()
      );
      if (exercise) {
        migrated[exercise.id] = value;
      } else {
        // Fallback: generate ID from name
        migrated[generateExerciseId(key)] = value;
      }
    }
  }
  
  return migrated;
}

/**
 * Migrate workout templates to use exercise IDs
 */
export function migrateTemplates(
  templates: WorkoutTemplate[],
  customExercises: Array<ExerciseMetadata & { id: string }>,
  predefinedExercises: Array<{ id: string; name: string }>
): WorkoutTemplate[] {
  return templates.map(template => ({
    ...template,
    exercises: template.exercises.map(ex => {
      // Skip if already has proper ID
      if ('exerciseId' in ex && (ex as any).exerciseId) {
        return ex;
      }
      
      // Find matching exercise by name
      const customEx = customExercises.find(ce => ce.name.toLowerCase() === ex.name.toLowerCase());
      const predefinedEx = predefinedExercises.find(pe => pe.name.toLowerCase() === ex.name.toLowerCase());
      
      const exerciseId = customEx?.id || predefinedEx?.id || generateExerciseId(ex.name);
      
      return {
        ...ex,
        exerciseId,
      };
    }),
  }));
}

/**
 * Migrate completed workouts to use exercise IDs
 */
export function migrateWorkouts(
  workouts: CompletedWorkout[],
  customExercises: Array<ExerciseMetadata & { id: string }>,
  predefinedExercises: Array<{ id: string; name: string }>
): CompletedWorkout[] {
  return workouts.map(workout => ({
    ...workout,
    exercises: workout.exercises.map(ex => {
      // Skip if already has proper exerciseId
      if ('exerciseId' in ex && (ex as any).exerciseId) {
        return ex;
      }
      
      // Find matching exercise by name
      const customEx = customExercises.find(ce => ce.name.toLowerCase() === ex.name.toLowerCase());
      const predefinedEx = predefinedExercises.find(pe => pe.name.toLowerCase() === ex.name.toLowerCase());
      
      const exerciseId = customEx?.id || predefinedEx?.id || generateExerciseId(ex.name);
      
      return {
        ...ex,
        exerciseId,
      };
    }),
  }));
}

/**
 * Migrate exercise volume logs from name-based to ID-based
 */
export function migrateVolumeLog(
  logs: Array<{ exerciseId: string; [key: string]: any }>,
  customExercises: Array<ExerciseMetadata & { id: string }>,
  predefinedExercises: Array<{ id: string; name: string }>
): Array<{ exerciseId: string; [key: string]: any }> {
  return logs.map(log => {
    // If exerciseId already looks like a proper ID, keep it
    if (log.exerciseId.startsWith('ex_')) {
      return log;
    }
    
    // exerciseId is actually a name, migrate it
    const exerciseName = log.exerciseId;
    const customEx = customExercises.find(ce => ce.name.toLowerCase() === exerciseName.toLowerCase());
    const predefinedEx = predefinedExercises.find(pe => pe.name.toLowerCase() === exerciseName.toLowerCase());
    
    const newExerciseId = customEx?.id || predefinedEx?.id || generateExerciseId(exerciseName);
    
    return {
      ...log,
      exerciseId: newExerciseId,
      // Store original name for reference during migration
      _migrated: true,
      _originalName: exerciseName,
    };
  });
}

/**
 * Find an exercise by name or ID
 * Supports both old (name-based) and new (ID-based) lookups
 */
export function findExerciseByNameOrId(
  nameOrId: string,
  customExercises: Array<ExerciseMetadata & { id: string }>,
  predefinedExercises: Array<{ id: string; name: string }>
): { id: string; name: string } | undefined {
  // Try ID lookup first
  if (nameOrId.startsWith('ex_')) {
    const customEx = customExercises.find(ex => ex.id === nameOrId);
    if (customEx) return { id: customEx.id, name: customEx.name };
    
    const predefinedEx = predefinedExercises.find(ex => ex.id === nameOrId);
    if (predefinedEx) return predefinedEx;
  }
  
  // Fallback to name lookup
  const customEx = customExercises.find(ex => ex.name.toLowerCase() === nameOrId.toLowerCase());
  if (customEx) return { id: customEx.id, name: customEx.name };
  
  const predefinedEx = predefinedExercises.find(ex => ex.name.toLowerCase() === nameOrId.toLowerCase());
  if (predefinedEx) return predefinedEx;
  
  return undefined;
}

/**
 * Generate a unique random ID for custom exercises
 */
export function generateCustomExerciseId(): string {
  const randomPart = Math.random().toString(36).substring(2, 8);
  const timestampPart = Date.now().toString(36).slice(-4);
  return `cex_${randomPart}${timestampPart}`;
}

/**
 * Run custom exercises migration with AsyncStorage
 */
export async function runCustomExercisesMigration(): Promise<void> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.CUSTOM_EXERCISES);
    if (!data) return;

    const exercises = JSON.parse(data);
    const migrated = migrateCustomExercises(exercises);
    await AsyncStorage.setItem(STORAGE_KEYS.CUSTOM_EXERCISES, JSON.stringify(migrated));
    console.log('[Migration] Custom exercises migrated with IDs');
  } catch (error) {
    console.error('[Migration] Error migrating custom exercises:', error);
  }
}

/**
 * Run predefined customizations migration with AsyncStorage
 */
export async function runPredefinedCustomizationsMigration(): Promise<void> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.PREDEFINED_CUSTOMIZATIONS);
    if (!data) return;

    const customizations = JSON.parse(data);
    const predefinedExercises = PREDEFINED_EXERCISES_WITH_MUSCLES.map(ex => ({ 
      id: ex.id!, 
      name: ex.name 
    }));
    const migrated = migratePredefinedCustomizations(customizations, predefinedExercises);
    await AsyncStorage.setItem(STORAGE_KEYS.PREDEFINED_CUSTOMIZATIONS, JSON.stringify(migrated));
    console.log('[Migration] Predefined customizations migrated to use IDs');
  } catch (error) {
    console.error('[Migration] Error migrating predefined customizations:', error);
  }
}

/**
 * Run templates migration with AsyncStorage
 */
export async function runTemplatesMigration(): Promise<void> {
  try {
    const [templatesData, customExercisesData] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.TEMPLATES),
      AsyncStorage.getItem(STORAGE_KEYS.CUSTOM_EXERCISES),
    ]);
    
    if (!templatesData) return;

    const templates = JSON.parse(templatesData);
    const customExercises = customExercisesData ? JSON.parse(customExercisesData) : [];
    const predefinedExercises = PREDEFINED_EXERCISES_WITH_MUSCLES.map(ex => ({ 
      id: ex.id!, 
      name: ex.name 
    }));
    
    const migrated = migrateTemplates(templates, customExercises, predefinedExercises);
    await AsyncStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(migrated));
    console.log('[Migration] Templates migrated with exercise IDs');
  } catch (error) {
    console.error('[Migration] Error migrating templates:', error);
  }
}

/**
 * Run workouts migration with AsyncStorage
 */
export async function runWorkoutsMigration(): Promise<void> {
  try {
    const [workoutsData, customExercisesData] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.WORKOUTS),
      AsyncStorage.getItem(STORAGE_KEYS.CUSTOM_EXERCISES),
    ]);
    
    if (!workoutsData) return;

    const workouts = JSON.parse(workoutsData);
    const customExercises = customExercisesData ? JSON.parse(customExercisesData) : [];
    const predefinedExercises = PREDEFINED_EXERCISES_WITH_MUSCLES.map(ex => ({ 
      id: ex.id!, 
      name: ex.name 
    }));
    
    const migrated = migrateWorkouts(workouts, customExercises, predefinedExercises);
    await AsyncStorage.setItem(STORAGE_KEYS.WORKOUTS, JSON.stringify(migrated));
    console.log('[Migration] Workouts migrated with exercise IDs');
  } catch (error) {
    console.error('[Migration] Error migrating workouts:', error);
  }
}

/**
 * Run volume log migration with AsyncStorage
 */
export async function runVolumeLogMigration(): Promise<void> {
  try {
    const [volumeLogData, customExercisesData] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.VOLUME_LOG),
      AsyncStorage.getItem(STORAGE_KEYS.CUSTOM_EXERCISES),
    ]);
    
    if (!volumeLogData) return;

    const volumeLog = JSON.parse(volumeLogData);
    const customExercises = customExercisesData ? JSON.parse(customExercisesData) : [];
    const predefinedExercises = PREDEFINED_EXERCISES_WITH_MUSCLES.map(ex => ({ 
      id: ex.id!, 
      name: ex.name 
    }));
    
    const migrated = migrateVolumeLog(volumeLog, customExercises, predefinedExercises);
    await AsyncStorage.setItem(STORAGE_KEYS.VOLUME_LOG, JSON.stringify(migrated));
    console.log('[Migration] Volume log migrated with exercise IDs');
  } catch (error) {
    console.error('[Migration] Error migrating volume log:', error);
  }
}

/**
 * Run all exercise ID migrations
 */
export async function runExerciseIdMigration(): Promise<void> {
  try {
    // Check if migration already completed
    const settingsData = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (settingsData) {
      const settings: AppSettings = JSON.parse(settingsData);
      if (settings.exerciseIdMigrationCompleted) {
        console.log('[Migration] Exercise ID migration already completed');
        return;
      }
    }

    console.log('[Migration] Starting exercise ID migration...');

    // Run all migrations in order (custom exercises first as others depend on it)
    await runCustomExercisesMigration();
    await runPredefinedCustomizationsMigration();
    await runTemplatesMigration();
    await runWorkoutsMigration();
    await runVolumeLogMigration();

    // Mark migration as complete
    const currentSettings: AppSettings = settingsData 
      ? JSON.parse(settingsData) 
      : {
          weightUnit: 'kg',
          theme: 'auto',
          defaultRestTime: 180,
          autoProgressionEnabled: false,
          defaultAutoProgressionMinReps: 8,
          defaultAutoProgressionMaxReps: 12,
          defaultAutoProgressionWeightIncrement: 2.5,
          bodyMapGender: 'male',
          weekStartDay: 1,
          showQuotes: true,
          lastUpdated: Date.now(),
        };
    
    const updatedSettings: AppSettings = {
      ...currentSettings,
      exerciseIdMigrationCompleted: true,
      lastUpdated: Date.now(),
    };

    await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updatedSettings));
    console.log('[Migration] Exercise ID migration completed successfully');
  } catch (error) {
    console.error('[Migration] Error running exercise ID migration:', error);
  }
}
