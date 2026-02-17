/**
 * Utility functions for gym tracker calculations and formatting
 */

import { CompletedWorkout, CompletedExercise, WeightUnit } from './types';
import { calculateSetVolume } from './volume-calculation';

/**
 * Calculate total volume (sum of reps × weight for all completed sets)
 */
export function calculateVolume(exercise: CompletedExercise, bodyWeight: number = 70): number {
  return exercise.sets
    .filter(set => set.completed !== false && set.setType !== 'warmup') // Exclude warmup sets
    .reduce((total, set) => total + calculateSetVolume(set, exercise.type, bodyWeight), 0);
}

/**
 * Calculate total workout volume
 */
export function calculateWorkoutVolume(workout: CompletedWorkout, bodyWeight: number = 70): number {
  return workout.exercises.reduce((total, exercise) => total + calculateVolume(exercise, bodyWeight), 0);
}

/**
 * Format duration in milliseconds to readable string
 * e.g., 3661000 -> "1h 1m"
 */
export function formatDuration(durationMs: number): string {
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }
  return `${remainingMinutes}m`;
}

/**
 * Format date to readable string
 * e.g., "Today", "Yesterday", "Jan 15, 2025"
 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Format date and time
 * e.g., "Jan 15, 2025 at 2:30 PM"
 */
export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format time to HH:MM:SS
 */
export function formatTime(durationMs: number): string {
  const seconds = Math.floor((durationMs / 1000) % 60);
  const minutes = Math.floor((durationMs / 1000 / 60) % 60);
  const hours = Math.floor(durationMs / 1000 / 60 / 60);

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Convert weight between units
 */
export function convertWeight(weight: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return weight;
  if (from === 'kg' && to === 'lbs') {
    return Math.round(weight * 2.20462 * 100) / 100;
  }
  if (from === 'lbs' && to === 'kg') {
    return Math.round((weight / 2.20462) * 100) / 100;
  }
  return weight;
}

/**
 * Format weight with unit
 */
export function formatWeight(weight: number, unit: WeightUnit): string {
  return `${weight} ${unit}`;
}

/**
 * Group workouts by date
 */
export function groupWorkoutsByDate(workouts: CompletedWorkout[]): Map<string, CompletedWorkout[]> {
  const grouped = new Map<string, CompletedWorkout[]>();

  workouts.forEach((workout) => {
    const dateKey = formatDate(workout.startTime);
    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, []);
    }
    grouped.get(dateKey)!.push(workout);
  });

  return grouped;
}

/**
 * Sort workouts by date (newest first)
 */
export function sortWorkoutsByDate(workouts: CompletedWorkout[]): CompletedWorkout[] {
  return [...workouts].sort((a, b) => b.startTime - a.startTime);
}

/**
 * Get workout statistics
 */
export function getWorkoutStats(workouts: CompletedWorkout[], bodyWeight: number = 70) {
  const totalWorkouts = workouts.length;
  const totalVolume = workouts.reduce((sum, w) => sum + calculateWorkoutVolume(w, bodyWeight), 0);
  const totalExercises = workouts.reduce((sum, w) => sum + w.exercises.length, 0);
  const avgDuration =
    totalWorkouts > 0
      ? Math.round(
          workouts.reduce((sum, w) => sum + (w.endTime - w.startTime), 0) / totalWorkouts
        )
      : 0;

  return {
    totalWorkouts,
    totalVolume,
    totalExercises,
    avgDuration,
  };
}

/**
 * Validate template name
 */
export function isValidTemplateName(name: string): boolean {
  return name.trim().length > 0 && name.trim().length <= 100;
}

/**
 * Validate exercise name
 */
export function isValidExerciseName(name: string): boolean {
  return name.trim().length > 0 && name.trim().length <= 100;
}

/**
 * Validate reps and weight
 */
export function isValidSet(reps: number, weight: number): boolean {
  return reps > 0 && reps <= 999 && weight >= 0 && weight <= 9999;
}
