import { CompletedSet } from '@/lib/types';

export type AutoProgressionConfig = {
  enabled?: boolean;
  minReps?: number;
  maxReps?: number;
};

const isWorkingSet = (set: Pick<CompletedSet, 'setType'>) => set.setType !== 'warmup';

export function getValidRepRange(config: AutoProgressionConfig): { min: number; max: number } | null {
  if (!config.enabled) return null;
  const min = Number(config.minReps);
  const max = Number(config.maxReps);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  if (min < 1 || max < min) return null;
  return { min, max };
}

export function getIncreaseWeightSuggestion(
  sets: Array<Pick<CompletedSet, 'reps' | 'setType'>>,
  config: AutoProgressionConfig
): boolean {
  const range = getValidRepRange(config);
  if (!range) return false;

  const working = sets.filter(isWorkingSet);
  if (working.length === 0) return false;

  const reps = working.map((s) => Math.max(0, Number(s.reps) || 0));
  const anyAboveMax = reps.some((r) => r > range.max);
  const allAtOrAboveMax = reps.every((r) => r >= range.max);
  return anyAboveMax || allAtOrAboveMax;
}

export function applyAutoProgressionOnStart<T extends Pick<CompletedSet, 'reps' | 'setType'>>(
  sets: T[],
  config: AutoProgressionConfig
): { sets: T[]; didChange: boolean; suggestIncreaseWeight: boolean } {
  const range = getValidRepRange(config);
  const next = sets.map((set) => ({ ...set }));

  if (!range || next.length === 0) {
    return {
      sets: next,
      didChange: false,
      suggestIncreaseWeight: false,
    };
  }

  let didChange = false;

  // Keep progression-eligible sets at or above min. Intentionally do NOT clamp down above max.
  for (let i = 0; i < next.length; i += 1) {
    const set = next[i];
    if (!isWorkingSet(set)) continue;
    const reps = Math.max(0, Number(set.reps) || 0);
    if (reps < range.min) {
      set.reps = range.min;
      didChange = true;
    }
  }

  const eligibleIndexes: number[] = [];
  for (let i = 0; i < next.length; i += 1) {
    const set = next[i];
    if (!isWorkingSet(set)) continue;
    const reps = Math.max(0, Number(set.reps) || 0);
    if (reps >= range.min && reps < range.max) {
      eligibleIndexes.push(i);
    }
  }

  if (eligibleIndexes.length > 0) {
    const lowest = Math.min(...eligibleIndexes.map((i) => Math.max(0, Number(next[i].reps) || 0)));
    const bottomMostLowest = [...eligibleIndexes]
      .reverse()
      .find((i) => Math.max(0, Number(next[i].reps) || 0) === lowest);

    if (typeof bottomMostLowest === 'number') {
      next[bottomMostLowest].reps = lowest + 1;
      didChange = true;
    }
  }

  return {
    sets: next,
    didChange,
    suggestIncreaseWeight: getIncreaseWeightSuggestion(next, config),
  };
}
