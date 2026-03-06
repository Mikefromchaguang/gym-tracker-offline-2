import { CompletedSet } from '@/lib/types';

export type AutoProgressionConfig = {
  enabled?: boolean;
  minReps?: number;
  maxReps?: number;
};

const isWorkingSet = (set: Pick<CompletedSet, 'setType'>) => set.setType !== 'warmup';
const normalizeWeight = (value: number) => Math.round(value * 100) / 100;

export function getValidRepRange(config: AutoProgressionConfig): { min: number; max: number } | null {
  if (!config.enabled) return null;
  const min = Number(config.minReps);
  const max = Number(config.maxReps);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  if (min < 1 || max < min) return null;
  return { min, max };
}

export function getDerivedWorkingWeight(
  sets: Array<Pick<CompletedSet, 'setType'> & Partial<Pick<CompletedSet, 'weight'>>>
): number | null {
  const working = sets.filter(isWorkingSet);
  if (working.length === 0) return null;

  const weightCounts = new Map<number, number>();
  for (const set of working) {
    const weight = Number(set.weight);
    if (!Number.isFinite(weight)) continue;
    const normalized = normalizeWeight(weight);
    weightCounts.set(normalized, (weightCounts.get(normalized) ?? 0) + 1);
  }

  if (weightCounts.size === 0) return null;

  let bestWeight: number | null = null;
  let bestCount = 0;

  for (const [weight, count] of weightCounts.entries()) {
    if (count > bestCount || (count === bestCount && (bestWeight == null || weight > bestWeight))) {
      bestWeight = weight;
      bestCount = count;
    }
  }

  if (bestWeight == null) return null;

  // Require a clear majority to treat this as the session's working weight.
  if (bestCount / working.length <= 0.5) {
    return null;
  }

  return bestWeight;
}

export function getIncreaseWeightSuggestion(
  sets: Array<Pick<CompletedSet, 'reps' | 'setType'> & Partial<Pick<CompletedSet, 'weight'>>>,
  config: AutoProgressionConfig
): boolean {
  const range = getValidRepRange(config);
  if (!range) return false;

  const working = sets.filter(isWorkingSet);
  if (working.length === 0) return false;

  const workingWeight = getDerivedWorkingWeight(working);

  const setsToEvaluate = workingWeight == null
    ? working
    : working.filter((set) => normalizeWeight(Number(set.weight) || 0) === workingWeight);

  if (setsToEvaluate.length === 0) return false;

  return setsToEvaluate.every((set) => Math.max(0, Number(set.reps) || 0) >= range.max);
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
