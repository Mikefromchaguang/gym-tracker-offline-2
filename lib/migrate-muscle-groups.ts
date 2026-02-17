/**
 * Data migration script for muscle group name changes
 * Migrates from old format (Chest, Back, etc.) to new format (chest, upper-back, etc.)
 * 
 * Run this once after updating muscle group types to migrate existing user data
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateMuscleGroup } from './muscle-groups';
import { MuscleGroup } from './types';

const MIGRATION_FLAG_KEY = '@gym_muscle_groups_migrated';

interface OldExerciseMetadata {
  name: string;
  primaryMuscle?: string;
  secondaryMuscles?: string[];
  exerciseType: string;
  type?: string;
  muscleContributions?: Record<string, number>;
}

interface OldCompletedExercise {
  name: string;
  sets: any[];
  primaryMuscle?: string;
  secondaryMuscles?: string[];
}

interface OldCompletedWorkout {
  id: string;
  name: string;
  exercises: OldCompletedExercise[];
  startTime: number;
  endTime: number;
}

interface OldTemplateExercise {
  id: string;
  name: string;
  sets?: number;
  reps?: number;
  weight?: number;
  unit?: string;
  type?: string;
  restTimer?: number;
  timerEnabled?: boolean;
  primaryMuscle?: string;
  secondaryMuscles?: string[];
  setDetails?: any[];
}

interface OldWorkoutTemplate {
  id: string;
  name: string;
  exercises: OldTemplateExercise[];
  createdAt: number;
  lastUsed?: number;
}

/**
 * Check if migration has already been run
 */
export async function isMigrationComplete(): Promise<boolean> {
  try {
    const flag = await AsyncStorage.getItem(MIGRATION_FLAG_KEY);
    return flag === 'true';
  } catch (error) {
    console.error('[Migration] Failed to check migration flag:', error);
    return false;
  }
}

/**
 * Mark migration as complete
 */
async function setMigrationComplete(): Promise<void> {
  try {
    await AsyncStorage.setItem(MIGRATION_FLAG_KEY, 'true');
    console.log('[Migration] Migration flag set');
  } catch (error) {
    console.error('[Migration] Failed to set migration flag:', error);
  }
}

/**
 * Migrate a single muscle group name
 */
function migrateSingleMuscle(oldMuscle: string | undefined): MuscleGroup | undefined {
  if (!oldMuscle) return undefined;
  
  // If already in new format, return as-is
  if (oldMuscle === oldMuscle.toLowerCase() && oldMuscle.includes('-')) {
    return oldMuscle as MuscleGroup;
  }
  
  const migrated = migrateMuscleGroup(oldMuscle);
  // Return first muscle if migration returns multiple (e.g., Core -> [abs, obliques])
  return migrated[0];
}

/**
 * Migrate an array of muscle group names
 */
function migrateMuscleArray(oldMuscles: string[] | undefined): MuscleGroup[] {
  if (!oldMuscles || !Array.isArray(oldMuscles)) return [];
  
  const migrated: MuscleGroup[] = [];
  oldMuscles.forEach(oldMuscle => {
    const newMuscles = migrateMuscleGroup(oldMuscle);
    migrated.push(...newMuscles);
  });
  
  return migrated;
}

/**
 * Migrate muscle contributions object
 */
function migrateMuscleContributions(
  oldContributions: Record<string, number> | undefined
): Record<MuscleGroup, number> | undefined {
  if (!oldContributions) return undefined;
  
  const newContributions: Record<string, number> = {};
  
  Object.entries(oldContributions).forEach(([oldMuscle, contribution]) => {
    const newMuscles = migrateMuscleGroup(oldMuscle);
    // If muscle splits into multiple (e.g., Core -> abs + obliques), divide contribution
    const contributionPerMuscle = contribution / newMuscles.length;
    newMuscles.forEach(newMuscle => {
      newContributions[newMuscle] = contributionPerMuscle;
    });
  });
  
  return newContributions as Record<MuscleGroup, number>;
}

/**
 * Migrate custom exercises
 */
async function migrateCustomExercises(): Promise<void> {
  try {
    const data = await AsyncStorage.getItem('@gym_custom_exercises');
    if (!data) {
      console.log('[Migration] No custom exercises to migrate');
      return;
    }
    
    const exercises: OldExerciseMetadata[] = JSON.parse(data);
    console.log(`[Migration] Migrating ${exercises.length} custom exercises...`);
    
    const migrated = exercises.map(ex => ({
      ...ex,
      primaryMuscle: migrateSingleMuscle(ex.primaryMuscle),
      secondaryMuscles: migrateMuscleArray(ex.secondaryMuscles),
      muscleContributions: migrateMuscleContributions(ex.muscleContributions),
    }));
    
    await AsyncStorage.setItem('@gym_custom_exercises', JSON.stringify(migrated));
    console.log('[Migration] Custom exercises migrated successfully');
  } catch (error) {
    console.error('[Migration] Failed to migrate custom exercises:', error);
    throw error;
  }
}

/**
 * Migrate workout templates
 */
async function migrateTemplates(): Promise<void> {
  try {
    const data = await AsyncStorage.getItem('@gym_templates');
    if (!data) {
      console.log('[Migration] No templates to migrate');
      return;
    }
    
    const templates: OldWorkoutTemplate[] = JSON.parse(data);
    console.log(`[Migration] Migrating ${templates.length} templates...`);
    
    const migrated = templates.map(template => ({
      ...template,
      exercises: template.exercises.map(ex => ({
        ...ex,
        primaryMuscle: migrateSingleMuscle(ex.primaryMuscle),
        secondaryMuscles: migrateMuscleArray(ex.secondaryMuscles),
      })),
    }));
    
    await AsyncStorage.setItem('@gym_templates', JSON.stringify(migrated));
    console.log('[Migration] Templates migrated successfully');
  } catch (error) {
    console.error('[Migration] Failed to migrate templates:', error);
    throw error;
  }
}

/**
 * Migrate completed workouts
 */
async function migrateWorkouts(): Promise<void> {
  try {
    const data = await AsyncStorage.getItem('@gym_workouts');
    if (!data) {
      console.log('[Migration] No workouts to migrate');
      return;
    }
    
    const workouts: OldCompletedWorkout[] = JSON.parse(data);
    console.log(`[Migration] Migrating ${workouts.length} workouts...`);
    
    const migrated = workouts.map(workout => ({
      ...workout,
      exercises: workout.exercises.map(ex => ({
        ...ex,
        primaryMuscle: migrateSingleMuscle(ex.primaryMuscle),
        secondaryMuscles: migrateMuscleArray(ex.secondaryMuscles),
      })),
    }));
    
    await AsyncStorage.setItem('@gym_workouts', JSON.stringify(migrated));
    console.log('[Migration] Workouts migrated successfully');
  } catch (error) {
    console.error('[Migration] Failed to migrate workouts:', error);
    throw error;
  }
}

/**
 * Migrate selected muscles for spider chart
 */
async function migrateSelectedMuscles(): Promise<void> {
  try {
    const data = await AsyncStorage.getItem('selectedMusclesForSpider');
    if (!data) {
      console.log('[Migration] No selected muscles to migrate');
      return;
    }
    
    const oldMuscles: string[] = JSON.parse(data);
    console.log(`[Migration] Migrating ${oldMuscles.length} selected muscles...`);
    
    const migrated = migrateMuscleArray(oldMuscles);
    
    await AsyncStorage.setItem('selectedMusclesForSpider', JSON.stringify(migrated));
    console.log('[Migration] Selected muscles migrated successfully');
  } catch (error) {
    console.error('[Migration] Failed to migrate selected muscles:', error);
    // Don't throw - this is not critical
  }
}

/**
 * Run the complete migration
 * This should be called once on app startup after updating muscle group types
 */
export async function runMuscleGroupMigration(): Promise<void> {
  // Check if already migrated
  const isComplete = await isMigrationComplete();
  if (isComplete) {
    console.log('[Migration] Muscle group migration already complete, skipping');
    return;
  }
  
  console.log('[Migration] Starting muscle group migration...');
  
  try {
    // Migrate all data stores
    await migrateCustomExercises();
    await migrateTemplates();
    await migrateWorkouts();
    await migrateSelectedMuscles();
    
    // Mark migration as complete
    await setMigrationComplete();
    
    console.log('[Migration] Muscle group migration completed successfully!');
  } catch (error) {
    console.error('[Migration] Muscle group migration failed:', error);
    throw error;
  }
}

/**
 * Reset migration flag (for testing only)
 */
export async function resetMigrationFlag(): Promise<void> {
  try {
    await AsyncStorage.removeItem(MIGRATION_FLAG_KEY);
    console.log('[Migration] Migration flag reset');
  } catch (error) {
    console.error('[Migration] Failed to reset migration flag:', error);
  }
}
