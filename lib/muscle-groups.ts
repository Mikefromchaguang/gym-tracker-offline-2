/**
 * Muscle group constants and utilities
 * Matches react-native-body-highlighter library format
 */

import { MuscleGroup } from './types';

/**
 * All available muscle groups (matching body-highlighter library)
 * Organized by body region for easier selection in UI
 */
export const MUSCLE_GROUPS: MuscleGroup[] = [
  // Upper body - front
  'chest',
  'deltoids-front',
  'deltoids-side',
  'deltoids-rear',
  'biceps',
  'abs',
  'obliques',
  'forearms',
  // Upper body - back
  'trapezius',
  'upper-back',
  'lower-back',
  'triceps',
  'lats',
  // Lower body - front
  'quadriceps',
  'adductors',
  'tibialis',
  'knees',
  // Lower body - back
  'gluteal',
  'hamstring',
  'calves',
  // Other body parts
  'neck',
  'hands',
  'feet',
  'ankles',
  'head',
  'hair',
];

/**
 * Primary muscle groups (commonly used for exercise targeting)
 * Excludes minor parts like hands, feet, ankles, head, hair, knees
 */
export const PRIMARY_MUSCLE_GROUPS: MuscleGroup[] = [
  'chest',
  'deltoids-front',
  'deltoids-side',
  'deltoids-rear',
  'biceps',
  'triceps',
  'forearms',
  'trapezius',
  'upper-back',
  'lower-back',
  'lats',
  'abs',
  'obliques',
  'quadriceps',
  'hamstring',
  'gluteal',
  'calves',
  'adductors',
  'tibialis',
  'neck',
];

/**
 * Display names for muscle groups (capitalized for UI)
 */
export const MUSCLE_GROUP_DISPLAY_NAMES: Record<MuscleGroup, string> = {
  // Upper body - front
  'chest': 'Chest',
  'deltoids-front': 'Front delts',
  'deltoids-side': 'Side delts',
  'deltoids-rear': 'Rear delts',
  'deltoids': 'Deltoids',
  'biceps': 'Biceps',
  'forearm': 'Forearms',
  'abs': 'Abs',
  'obliques': 'Obliques',
  'forearms': 'Forearms',
  // Upper body - back
  'trapezius': 'Trapezius',
  'upper-back': 'Upper Back',
  'lower-back': 'Lower Back',
  'triceps': 'Triceps',
  'lats': 'Lats',
  // Lower body - front
  'quadriceps': 'Quadriceps',
  'adductors': 'Adductors',
  'tibialis': 'Tibialis',
  'knees': 'Knees',
  // Lower body - back
  'gluteal': 'Glutes',
  'hamstring': 'Hamstrings',
  'calves': 'Calves',
  // Other body parts
  'neck': 'Neck',
  'hands': 'Hands',
  'feet': 'Feet',
  'ankles': 'Ankles',
  'head': 'Head',
  'hair': 'Hair',
};

/**
 * Get display name for a muscle group
 */
export function getMuscleGroupDisplayName(muscle: MuscleGroup): string {
  return MUSCLE_GROUP_DISPLAY_NAMES[muscle];
}

/**
 * Migration mapping from old muscle group names to new names
 * Used for data migration from previous app version
 */
export const MUSCLE_GROUP_MIGRATION_MAP: Record<string, MuscleGroup | MuscleGroup[]> = {
  'Chest': 'chest',
  'Back': 'upper-back', // Default to upper-back (could be upper or lower)
  'Lats': 'lats',
  'Shoulders': 'deltoids-front',
  'Deltoids': 'deltoids-front',
  'Biceps': 'biceps',
  'Triceps': 'triceps',
  'Forearms': 'forearms',
  'Quads': 'quadriceps',
  'Hamstrings': 'hamstring',
  'Glutes': 'gluteal',
  'Calves': 'calves',
  'Core': ['abs', 'obliques'], // Split into abs and obliques
  'Traps': 'trapezius',
};

/**
 * Migrate old muscle group name to new format
 * Returns array to handle cases where one old group maps to multiple new groups (e.g., Core -> abs + obliques)
 */
export function migrateMuscleGroup(oldMuscle: string): MuscleGroup[] {
  const mapped = MUSCLE_GROUP_MIGRATION_MAP[oldMuscle];
  if (!mapped) {
    console.warn(`Unknown muscle group in migration: ${oldMuscle}`);
    return [];
  }
  return Array.isArray(mapped) ? mapped : [mapped];
}
