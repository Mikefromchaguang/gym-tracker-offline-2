/**
 * Volume calculation utilities that handle different exercise types correctly
 */

import { CompletedSet, ExerciseType } from './types';

/**
 * Calculate volume for a single set based on exercise type and bodyweight
 * 
 * @param set - The completed set
 * @param exerciseType - Type of exercise (weighted, bodyweight, weighted-bodyweight, assisted)
 * @param bodyWeight - User's current body weight (required for bodyweight exercises)
 * @returns Volume in weight units (kg or lbs)
 */
export function calculateSetVolume(
  set: CompletedSet,
  exerciseType: ExerciseType | undefined,
  bodyWeight: number
): number {
  // Only count completed sets, exclude warmup sets from volume
  if (set.completed === false || set.setType === 'warmup') {
    return 0;
  }

  const reps = set.reps || 0;
  const weight = set.weight || 0;

  switch (exerciseType) {
    case 'doubled':
      // Doubled: reps × weight × 2
      return 2 * reps * weight;
    
    case 'bodyweight':
      // Bodyweight: reps × bodyweight
      return reps * bodyWeight;
    
    case 'weighted-bodyweight':
      // Weighted bodyweight: reps × (bodyweight + added weight)
      return reps * (bodyWeight + weight);
    
    case 'assisted-bodyweight':
      // Assisted: reps × (bodyweight - assistance weight)
      return reps * (bodyWeight - weight);
    
    case 'weighted':
    default:
      // Weighted/other: reps × weight
      return reps * weight;
  }
}

/**
 * Calculate total volume for an exercise (sum of all completed sets)
 * Only counts sets marked as completed
 * 
 * @param sets - Array of completed sets
 * @param exerciseType - Type of exercise
 * @param bodyWeight - User's current body weight
 * @returns Total volume
 */
export function calculateExerciseVolume(
  sets: CompletedSet[],
  exerciseType: ExerciseType | undefined,
  bodyWeight: number
): number {
  return sets.reduce((total, set) => {
    return total + calculateSetVolume(set, exerciseType, bodyWeight);
  }, 0);
}

/**
 * Calculate total volume for an exercise configuration (for templates)
 * Counts all sets regardless of completion status
 * Used for template previews where sets aren't marked completed
 * 
 * @param sets - Array of configured sets
 * @param exerciseType - Type of exercise
 * @param bodyWeight - User's current body weight
 * @returns Total volume
 */
export function calculateTemplateExerciseVolume(
  sets: CompletedSet[],
  exerciseType: ExerciseType | undefined,
  bodyWeight: number
): number {
  return sets.reduce((total, set) => {
    // Exclude warmup sets from volume
    if (set.setType === 'warmup') {
      return total;
    }
    const reps = set.reps || 0;
    const weight = set.weight || 0;

    switch (exerciseType) {
      case 'doubled':
        return total + (2 * reps * weight);
      case 'bodyweight':
        return total + (reps * bodyWeight);
      case 'weighted-bodyweight':
        return total + (reps * (bodyWeight + weight));
      case 'assisted-bodyweight':
        return total + (reps * (bodyWeight - weight));
      case 'weighted':
      default:
        return total + (reps * weight);
    }
  }, 0);
}
