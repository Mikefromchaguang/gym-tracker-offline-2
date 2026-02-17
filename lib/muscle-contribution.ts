/**
 * Weighted muscle contribution calculations
 * 
 * This module provides utilities for calculating exercise workload distribution
 * across muscle groups using percentage-based contributions.
 */

import type { MuscleGroup, ExerciseMetadata } from './types';

/**
 * Calculate default muscle contributions based on primary and secondary muscles
 * Primary muscle gets 70%, remaining 30% split evenly across secondary muscles
 * If no secondary muscles, primary gets 100%
 */
export function calculateDefaultContributions(
  primaryMuscle: MuscleGroup,
  secondaryMuscles?: MuscleGroup[]
): Record<MuscleGroup, number> {
  const contributions: Partial<Record<MuscleGroup, number>> = {};
  
  if (!secondaryMuscles || secondaryMuscles.length === 0) {
    contributions[primaryMuscle] = 100;
  } else {
    contributions[primaryMuscle] = 70;
    const secondaryShare = 30 / secondaryMuscles.length;
    secondaryMuscles.forEach(muscle => {
      contributions[muscle] = secondaryShare;
    });
  }
  
  return contributions as Record<MuscleGroup, number>;
}

/**
 * Validate that muscle contributions sum to 100%
 * @param contributions The contribution percentages record
 * @param muscles Optional list of muscles to validate - if provided, only these muscles are summed
 *                If not provided, all values in the contributions record are summed
 */
export function validateContributions(
  contributions: Record<MuscleGroup, number>,
  muscles?: MuscleGroup[]
): boolean {
  const total = muscles 
    ? muscles.reduce((sum, muscle) => sum + (contributions[muscle] || 0), 0)
    : Object.values(contributions).reduce((sum, val) => sum + val, 0);
  return Math.abs(total - 100) < 0.01; // Allow small floating point errors
}

/**
 * Calculate weighted volume per muscle for a given set
 * @param volume Total volume (weight × reps)
 * @param contributions Muscle contribution percentages
 * @returns Volume distributed across muscles
 */
export function calculateWeightedVolume(
  volume: number,
  contributions: Record<MuscleGroup, number>
): Record<MuscleGroup, number> {
  const result: Partial<Record<MuscleGroup, number>> = {};
  
  Object.entries(contributions).forEach(([muscle, percentage]) => {
    result[muscle as MuscleGroup] = (volume * percentage) / 100;
  });
  
  return result as Record<MuscleGroup, number>;
}

/**
 * Calculate weighted set counts per muscle
 * Primary muscle always gets full set count (1.0 per set)
 * Secondary muscles get fractional sets based on their percentage
 * @param setCount Number of sets
 * @param contributions Muscle contribution percentages
 * @param primaryMuscle The primary muscle group
 * @returns Set counts distributed across muscles
 */
export function calculateWeightedSets(
  setCount: number,
  contributions: Record<MuscleGroup, number>,
  primaryMuscle: MuscleGroup
): Record<MuscleGroup, number> {
  const result: Partial<Record<MuscleGroup, number>> = {};
  
  Object.entries(contributions).forEach(([muscle, percentage]) => {
    if (muscle === primaryMuscle) {
      // Primary muscle always gets full set count
      result[muscle as MuscleGroup] = setCount;
    } else {
      // Secondary muscles get fractional sets based on percentage
      result[muscle as MuscleGroup] = (setCount * percentage) / 100;
    }
  });
  
  return result as Record<MuscleGroup, number>;
}

/**
 * Get muscle contributions for an exercise, using defaults if not set
 */
export function getExerciseContributions(exercise: ExerciseMetadata): Record<MuscleGroup, number> {
  if (exercise.muscleContributions) {
    return exercise.muscleContributions as Record<MuscleGroup, number>;
  }
  
  return calculateDefaultContributions(exercise.primaryMuscle, exercise.secondaryMuscles);
}

/**
 * Aggregate weighted muscle data across multiple exercises
 * @param exerciseData Array of { contributions, volume, sets }
 * @returns Aggregated volume and sets per muscle
 */
export function aggregateMuscleData(
  exerciseData: Array<{
    contributions: Record<MuscleGroup, number>;
    primaryMuscle: MuscleGroup;
    volume: number;
    sets: number;
  }>
): {
  volumePerMuscle: Record<MuscleGroup, number>;
  setsPerMuscle: Record<MuscleGroup, number>;
} {
  const volumePerMuscle: Partial<Record<MuscleGroup, number>> = {};
  const setsPerMuscle: Partial<Record<MuscleGroup, number>> = {};
  
  exerciseData.forEach(({ contributions, primaryMuscle, volume, sets }) => {
    const weightedVolume = calculateWeightedVolume(volume, contributions);
    const weightedSets = calculateWeightedSets(sets, contributions, primaryMuscle);
    
    Object.entries(weightedVolume).forEach(([muscle, vol]) => {
      volumePerMuscle[muscle as MuscleGroup] = (volumePerMuscle[muscle as MuscleGroup] || 0) + vol;
    });
    
    Object.entries(weightedSets).forEach(([muscle, setCount]) => {
      setsPerMuscle[muscle as MuscleGroup] = (setsPerMuscle[muscle as MuscleGroup] || 0) + setCount;
    });
  });
  
  return {
    volumePerMuscle: volumePerMuscle as Record<MuscleGroup, number>,
    setsPerMuscle: setsPerMuscle as Record<MuscleGroup, number>,
  };
}
