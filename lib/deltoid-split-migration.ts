/**
 * Deltoid split migration
 *
 * Migrates legacy `deltoids` muscle usage to:
 * - deltoids-front
 * - deltoids-side
 * - deltoids-rear
 *
 * Goals:
 * - Update stored templates, workouts, active workout, custom exercises, and predefined customizations
 * - Preserve user customizations where possible
 * - Avoid breaking older stored data (we keep legacy `deltoids` as a fallback type)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from './storage';
import type { CompletedWorkout, ExerciseMetadata, MuscleGroup, WorkoutTemplate } from './types';
import { getExerciseMusclesByNameOrId } from './types';

const MIGRATION_FLAG_KEY = '@gym_deltoid_split_migrated_v1';

type AnyRecord = Record<string, any>;

type DeltoidSubgroup = 'deltoids-front' | 'deltoids-side' | 'deltoids-rear';

function isDeltoidSubgroup(muscle: string): muscle is DeltoidSubgroup {
  return muscle === 'deltoids-front' || muscle === 'deltoids-side' || muscle === 'deltoids-rear';
}

function inferDeltoidSubgroupFromName(name: string): DeltoidSubgroup {
  const n = (name || '').toLowerCase();

  // Side delts
  if (n.includes('lateral raise') || n.includes('lateral  raise') || n.includes('lateral') || n.includes('side raise') || n.includes('side delt')) {
    return 'deltoids-side';
  }

  // Rear delts
  if (n.includes('rear') || n.includes('reverse') || n.includes('rear delt') || n.includes('face pull') || n.includes('rear-delt') || n.includes('reverse fly')) {
    return 'deltoids-rear';
  }

  // Front delts (default)
  return 'deltoids-front';
}

function getCanonicalDeltoidContributionWeights(exerciseNameOrId: string): Record<DeltoidSubgroup, number> | null {
  const meta = getExerciseMusclesByNameOrId(exerciseNameOrId);
  if (!meta?.muscleContributions) return null;

  const weights: Partial<Record<DeltoidSubgroup, number>> = {};
  for (const [key, value] of Object.entries(meta.muscleContributions as AnyRecord)) {
    if (isDeltoidSubgroup(key)) {
      weights[key] = typeof value === 'number' ? value : 0;
    }
  }

  const total = Object.values(weights).reduce((sum, v) => sum + (v || 0), 0);
  if (!total) return null;

  return {
    'deltoids-front': weights['deltoids-front'] || 0,
    'deltoids-side': weights['deltoids-side'] || 0,
    'deltoids-rear': weights['deltoids-rear'] || 0,
  };
}

function migrateSingleMuscle(
  muscle: any,
  exerciseNameOrIdForInference: string
): MuscleGroup | undefined {
  if (!muscle || typeof muscle !== 'string') return undefined;
  if (isDeltoidSubgroup(muscle)) return muscle;

  if (muscle === 'deltoids') {
    const canonical = getExerciseMusclesByNameOrId(exerciseNameOrIdForInference);
    if (canonical && isDeltoidSubgroup(canonical.primaryMuscle)) {
      return canonical.primaryMuscle;
    }
    return inferDeltoidSubgroupFromName(exerciseNameOrIdForInference);
  }

  return muscle as MuscleGroup;
}

function migrateMuscleArray(muscles: any, exerciseNameOrIdForInference: string): MuscleGroup[] {
  if (!Array.isArray(muscles)) return [];
  const out: MuscleGroup[] = [];
  for (const m of muscles) {
    const migrated = migrateSingleMuscle(m, exerciseNameOrIdForInference);
    if (migrated) out.push(migrated);
  }
  // Deduplicate while preserving order
  return out.filter((m, idx) => out.indexOf(m) === idx);
}

function renormalizeTo100(contributions: Record<string, number>): Record<string, number> {
  const entries = Object.entries(contributions).filter(([, v]) => typeof v === 'number' && Number.isFinite(v));
  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  if (!entries.length || !Number.isFinite(total) || total === 0) return contributions;

  // If already close enough, leave it.
  if (Math.abs(total - 100) < 0.01) return contributions;

  // Scale then fix rounding drift by adjusting the largest bucket.
  const scaled: Record<string, number> = {};
  for (const [k, v] of entries) scaled[k] = (v / total) * 100;

  const scaledTotal = Object.values(scaled).reduce((sum, v) => sum + v, 0);
  const delta = 100 - scaledTotal;
  if (Math.abs(delta) < 0.0001) return scaled;

  let maxKey: string | null = null;
  let maxVal = -Infinity;
  for (const [k, v] of Object.entries(scaled)) {
    if (v > maxVal) {
      maxVal = v;
      maxKey = k;
    }
  }
  if (maxKey) scaled[maxKey] = (scaled[maxKey] || 0) + delta;
  return scaled;
}

function migrateMuscleContributions(
  contributions: any,
  exerciseNameOrIdForInference: string
): Record<MuscleGroup, number> | undefined {
  if (!contributions || typeof contributions !== 'object') return undefined;

  const out: Record<string, number> = {};
  for (const [rawKey, rawValue] of Object.entries(contributions as AnyRecord)) {
    const value = typeof rawValue === 'number' ? rawValue : undefined;
    if (value === undefined) continue;

    if (rawKey === 'deltoids') {
      const canonicalWeights = getCanonicalDeltoidContributionWeights(exerciseNameOrIdForInference);
      if (canonicalWeights) {
        const totalCanonical = Object.values(canonicalWeights).reduce((sum, v) => sum + v, 0) || 0;
        if (totalCanonical > 0) {
          for (const [subKey, w] of Object.entries(canonicalWeights)) {
            if (w <= 0) continue;
            out[subKey] = (out[subKey] || 0) + (value * w) / totalCanonical;
          }
          continue;
        }
      }

      const inferred = inferDeltoidSubgroupFromName(exerciseNameOrIdForInference);
      out[inferred] = (out[inferred] || 0) + value;
      continue;
    }

    out[rawKey] = (out[rawKey] || 0) + value;
  }

  return renormalizeTo100(out) as Record<MuscleGroup, number>;
}

function migrateExerciseLike<T extends AnyRecord>(ex: T, inferenceKey: string): T {
  const nameOrId = (ex.exerciseId && typeof ex.exerciseId === 'string') ? ex.exerciseId : inferenceKey;

  const primaryMuscle = migrateSingleMuscle(ex.primaryMuscle, nameOrId);
  const secondaryMuscles = migrateMuscleArray(ex.secondaryMuscles, nameOrId);
  const muscleContributions = migrateMuscleContributions(ex.muscleContributions, nameOrId);

  return {
    ...ex,
    ...(primaryMuscle ? { primaryMuscle } : {}),
    ...(Array.isArray(ex.secondaryMuscles) ? { secondaryMuscles } : {}),
    ...(ex.muscleContributions ? { muscleContributions } : {}),
  };
}

async function migrateCustomExercises(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.CUSTOM_EXERCISES);
  if (!raw) return false;

  const exercises = JSON.parse(raw) as ExerciseMetadata[];
  let changed = false;

  const migrated = exercises.map((ex) => {
    const before = JSON.stringify({ p: ex.primaryMuscle, s: ex.secondaryMuscles, c: ex.muscleContributions });
    const next = migrateExerciseLike(ex as any, ex.name);
    const after = JSON.stringify({ p: next.primaryMuscle, s: next.secondaryMuscles, c: next.muscleContributions });
    if (before !== after) changed = true;
    return next;
  });

  if (changed) {
    await AsyncStorage.setItem(STORAGE_KEYS.CUSTOM_EXERCISES, JSON.stringify(migrated));
  }
  return changed;
}

async function migratePredefinedExerciseCustomizations(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.PREDEFINED_EXERCISE_CUSTOMIZATIONS);
  if (!raw) return false;

  const customizations = JSON.parse(raw) as Record<string, AnyRecord>;
  let changed = false;

  const migrated: Record<string, AnyRecord> = {};
  for (const [key, customization] of Object.entries(customizations)) {
    const before = JSON.stringify(customization);
    const next = migrateExerciseLike(customization as any, key);
    const after = JSON.stringify(next);
    if (before !== after) changed = true;
    migrated[key] = next;
  }

  if (changed) {
    await AsyncStorage.setItem(STORAGE_KEYS.PREDEFINED_EXERCISE_CUSTOMIZATIONS, JSON.stringify(migrated));
  }
  return changed;
}

async function migrateTemplates(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.TEMPLATES);
  if (!raw) return false;

  const templates = JSON.parse(raw) as WorkoutTemplate[];
  let changed = false;

  const migrated = templates.map((t) => {
    const exercises = (t.exercises || []).map((ex: any) => {
      const before = JSON.stringify({ p: ex.primaryMuscle, s: ex.secondaryMuscles });
      const next = migrateExerciseLike(ex, ex.exerciseId || ex.name);
      const after = JSON.stringify({ p: next.primaryMuscle, s: next.secondaryMuscles });
      if (before !== after) changed = true;
      // Templates don't persist muscleContributions, so strip any accidental field rewrite
      if ('muscleContributions' in next && !('muscleContributions' in ex)) {
        delete (next as any).muscleContributions;
      }
      return next;
    });

    return {
      ...t,
      exercises,
    };
  });

  if (changed) {
    await AsyncStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(migrated));
  }
  return changed;
}

async function migrateWorkouts(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.WORKOUTS);
  if (!raw) return false;

  const workouts = JSON.parse(raw) as CompletedWorkout[];
  let changed = false;

  const migrated = workouts.map((w) => {
    const exercises = (w.exercises || []).map((ex: any) => {
      const before = JSON.stringify({ p: ex.primaryMuscle, s: ex.secondaryMuscles, c: ex.muscleContributions });
      const next = migrateExerciseLike(ex, ex.exerciseId || ex.name);
      const after = JSON.stringify({ p: next.primaryMuscle, s: next.secondaryMuscles, c: next.muscleContributions });
      if (before !== after) changed = true;
      return next;
    });

    return {
      ...w,
      exercises,
    };
  });

  if (changed) {
    await AsyncStorage.setItem(STORAGE_KEYS.WORKOUTS, JSON.stringify(migrated));
  }
  return changed;
}

async function migrateActiveWorkout(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_WORKOUT);
  if (!raw) return false;

  const state = JSON.parse(raw) as AnyRecord;
  if (!state || typeof state !== 'object') return false;

  const exercises = Array.isArray(state.exercises) ? state.exercises : null;
  if (!exercises) return false;

  let changed = false;
  const migratedExercises = exercises.map((ex: any) => {
    const before = JSON.stringify({ p: ex.primaryMuscle, s: ex.secondaryMuscles, c: ex.muscleContributions });
    const next = migrateExerciseLike(ex, ex.exerciseId || ex.name);
    const after = JSON.stringify({ p: next.primaryMuscle, s: next.secondaryMuscles, c: next.muscleContributions });
    if (before !== after) changed = true;
    return next;
  });

  if (changed) {
    await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_WORKOUT, JSON.stringify({ ...state, exercises: migratedExercises }));
  }
  return changed;
}

async function migrateSelectedMusclesForSpider(): Promise<boolean> {
  const raw = await AsyncStorage.getItem('selectedMusclesForSpider');
  if (!raw) return false;

  const muscles = JSON.parse(raw) as any[];
  if (!Array.isArray(muscles)) return false;

  let changed = false;
  const out: MuscleGroup[] = [];
  for (const m of muscles) {
    if (m === 'deltoids') {
      out.push('deltoids-front', 'deltoids-side', 'deltoids-rear');
      changed = true;
      continue;
    }
    out.push(m as MuscleGroup);
  }

  // Deduplicate
  const deduped = out.filter((m, idx) => out.indexOf(m) === idx);
  if (changed) {
    await AsyncStorage.setItem('selectedMusclesForSpider', JSON.stringify(deduped));
  }
  return changed;
}

export async function runDeltoidSplitMigration(): Promise<void> {
  const already = await AsyncStorage.getItem(MIGRATION_FLAG_KEY);
  if (already === 'true') return;

  try {
    const changed = await Promise.all([
      migrateCustomExercises(),
      migratePredefinedExerciseCustomizations(),
      migrateTemplates(),
      migrateWorkouts(),
      migrateActiveWorkout(),
      migrateSelectedMusclesForSpider(),
    ]);

    const anyChanged = changed.some(Boolean);
    if (anyChanged) {
      console.log('[DeltoidSplitMigration] Migrated legacy deltoids to deltoids-front/side/rear');
    } else {
      console.log('[DeltoidSplitMigration] No legacy deltoids found; nothing to migrate');
    }

    await AsyncStorage.setItem(MIGRATION_FLAG_KEY, 'true');
  } catch (error) {
    console.error('[DeltoidSplitMigration] Migration failed:', error);
    // Don’t set flag on failure.
    throw error;
  }
}
