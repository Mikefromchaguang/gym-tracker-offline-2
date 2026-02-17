import type { Exercise, CompletedExercise } from './types';

export type ExerciseGroupType = 'superset';

export interface SupersetDisplayItem {
  kind: 'superset';
  key: string; // groupId
  groupId: string;
  // Indices in A-then-B order (based on groupPosition)
  indices: [number, number];
}

export interface SingleDisplayItem {
  kind: 'single';
  key: string; // exercise.id
  indices: [number];
}

export type ExerciseDisplayItem = SupersetDisplayItem | SingleDisplayItem;

type Groupable = Pick<Exercise, 'id' | 'groupId' | 'groupType' | 'groupPosition'>;

export function isSupersetExercise(ex: Groupable): ex is Groupable & {
  groupType: 'superset';
  groupId: string;
  groupPosition: 0 | 1;
} {
  return ex.groupType === 'superset' && typeof ex.groupId === 'string' && (ex.groupPosition === 0 || ex.groupPosition === 1);
}

/**
 * Groups an ordered exercise array into display items.
 *
 * Assumption: superset members are stored adjacent (A next to B).
 * If that invariant is broken, we fall back to treating entries as singles.
 */
export function groupExercisesForDisplay<T extends Groupable>(exercises: readonly T[]): ExerciseDisplayItem[] {
  const items: ExerciseDisplayItem[] = [];

  for (let i = 0; i < exercises.length; i += 1) {
    const current = exercises[i];

    if (isSupersetExercise(current)) {
      const next = exercises[i + 1];
      if (next && isSupersetExercise(next) && next.groupId === current.groupId) {
        const pair = [
          { idx: i as number, pos: current.groupPosition },
          { idx: (i + 1) as number, pos: next.groupPosition },
        ].sort((a, b) => a.pos - b.pos);

        items.push({
          kind: 'superset',
          key: current.groupId,
          groupId: current.groupId,
          indices: [pair[0].idx, pair[1].idx],
        });

        i += 1; // consumed next
        continue;
      }
    }

    items.push({ kind: 'single', key: current.id, indices: [i] });
  }

  return items;
}

/**
 * Moves a display item (single or superset) up/down as a block.
 *
 * This operates on the underlying exercises array and preserves order inside blocks.
 */
export function moveDisplayItem<T>(
  exercises: readonly T[],
  items: readonly ExerciseDisplayItem[],
  fromDisplayIndex: number,
  toDisplayIndex: number
): T[] {
  if (fromDisplayIndex === toDisplayIndex) return [...exercises];
  if (fromDisplayIndex < 0 || fromDisplayIndex >= items.length) return [...exercises];
  if (toDisplayIndex < 0 || toDisplayIndex >= items.length) return [...exercises];

  const from = items[fromDisplayIndex];
  const to = items[toDisplayIndex];

  const fromIndices = [...from.indices].sort((a, b) => a - b);
  const toIndices = [...to.indices].sort((a, b) => a - b);

  const fromStart = fromIndices[0];
  const fromCount = fromIndices.length;

  const extracted = exercises.slice(fromStart, fromStart + fromCount);
  const remaining = [...exercises.slice(0, fromStart), ...exercises.slice(fromStart + fromCount)];

  // Compute insertion index in the remaining array.
  // If moving down, the target's start index shifts left by `fromCount` when it was after the removed block.
  const originalToStart = toIndices[0];
  const insertionIndex = originalToStart > fromStart ? originalToStart - fromCount : originalToStart;

  return [...remaining.slice(0, insertionIndex), ...extracted, ...remaining.slice(insertionIndex)];
}

export function isExerciseInSuperset(ex: Pick<Exercise, 'groupType' | 'groupId'> | Pick<CompletedExercise, 'groupType' | 'groupId'>): boolean {
  return ex.groupType === 'superset' && typeof ex.groupId === 'string';
}

/**
 * Helper interface for exercises with sets that can be merged into supersets.
 * Works with both template exercises (sets as TemplateSetConfig[]) and
 * active workout exercises (completedSets as CompletedSet[]).
 */
type ExerciseWithSets<T> = T & {
  id: string;
  restTimer?: number;
  timerEnabled?: boolean;
  groupType?: 'superset';
  groupId?: string;
  groupPosition?: 0 | 1;
};

/**
 * Merges two standalone exercises into a superset.
 * If they have different set counts, pads the shorter one with 0s.
 * Returns the updated exercises array with both exercises marked as superset partners.
 *
 * @param exercises - The current exercises array
 * @param indexA - Index of first exercise to merge
 * @param indexB - Index of second exercise to merge
 * @param groupId - Unique ID for this superset group
 * @param getSetCount - Function to get number of sets for an exercise
 * @param padSets - Function to pad sets to a target count
 * @returns Updated exercises array with the two exercises as a superset
 */
export function mergeExercisesToSuperset<T extends ExerciseWithSets<unknown>>(
  exercises: readonly T[],
  indexA: number,
  indexB: number,
  groupId: string,
  getSetCount: (ex: T) => number,
  padSets: (ex: T, targetCount: number) => T
): T[] {
  if (indexA === indexB || indexA < 0 || indexB < 0 || indexA >= exercises.length || indexB >= exercises.length) {
    return [...exercises];
  }

  const exA = exercises[indexA];
  const exB = exercises[indexB];

  // Determine the max set count and pad as needed
  const setCountA = getSetCount(exA);
  const setCountB = getSetCount(exB);
  const maxSetCount = Math.max(setCountA, setCountB);

  const paddedA = setCountA < maxSetCount ? padSets(exA, maxSetCount) : exA;
  const paddedB = setCountB < maxSetCount ? padSets(exB, maxSetCount) : exB;

  // Use the first exercise's rest timer for the superset (or default)
  const restTimer = exA.restTimer ?? exB.restTimer ?? 180;
  const timerEnabled = exA.timerEnabled ?? exB.timerEnabled ?? true;

  // Mark both as superset partners
  const updatedA: T = {
    ...paddedA,
    groupType: 'superset',
    groupId,
    groupPosition: 0,
    restTimer,
    timerEnabled,
  };

  const updatedB: T = {
    ...paddedB,
    groupType: 'superset',
    groupId,
    groupPosition: 1,
    restTimer,
    timerEnabled,
  };

  // Build new array: remove both exercises, then insert them adjacent at the position of the first one
  const minIndex = Math.min(indexA, indexB);
  const maxIndex = Math.max(indexA, indexB);

  const result: T[] = [];
  for (let i = 0; i < exercises.length; i++) {
    if (i === minIndex) {
      // Insert the superset pair
      if (indexA < indexB) {
        result.push(updatedA, updatedB);
      } else {
        result.push(updatedB, updatedA);
      }
    } else if (i !== maxIndex) {
      result.push(exercises[i]);
    }
  }

  return result;
}

/**
 * Splits a superset back into two standalone exercises.
 * Preserves all set data, weights, reps, and other metadata.
 *
 * @param exercises - The current exercises array
 * @param groupId - The groupId of the superset to split
 * @returns Updated exercises array with the superset broken into standalone exercises
 */
export function splitSupersetToExercises<T extends ExerciseWithSets<unknown>>(
  exercises: readonly T[],
  groupId: string
): T[] {
  return exercises.map((ex) => {
    if (ex.groupType === 'superset' && ex.groupId === groupId) {
      // Remove superset metadata but keep everything else
      const { groupType, groupId: _gid, groupPosition, ...rest } = ex as T & { groupType?: string; groupId?: string; groupPosition?: number };
      return rest as T;
    }
    return ex;
  });
}
