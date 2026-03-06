import { describe, expect, it } from 'vitest';

import { applyAutoProgressionOnStart, getDerivedWorkingWeight, getIncreaseWeightSuggestion } from '@/lib/auto-progression';

describe('auto progression', () => {
  it('bumps reps below min up to min, then increments the bottom-most lowest in range', () => {
    const sets = [
      { reps: 11, setType: 'working' as const },
      { reps: 12, setType: 'working' as const },
      { reps: 12, setType: 'working' as const },
    ];

    const result = applyAutoProgressionOnStart(sets, {
      enabled: true,
      minReps: 12,
      maxReps: 15,
    });

    expect(result.sets.map((s) => s.reps)).toEqual([12, 12, 13]);
    expect(result.didChange).toBe(true);
    expect(result.suggestIncreaseWeight).toBe(false);
  });

  it('does not clamp down above-max reps and still suggests increase weight when all relevant sets are at max', () => {
    const sets = [
      { reps: 12, setType: 'working' as const },
      { reps: 15, setType: 'working' as const },
    ];

    const result = applyAutoProgressionOnStart(sets, {
      enabled: true,
      minReps: 12,
      maxReps: 15,
    });

    expect(result.sets.map((s) => s.reps)).toEqual([13, 15]);
    expect(result.suggestIncreaseWeight).toBe(true);
  });

  it('does not suggest increase when mixed reps include below-max in the evaluated sets', () => {
    const sets = [
      { reps: 12, setType: 'working' as const },
      { reps: 16, setType: 'working' as const },
    ];

    expect(
      getIncreaseWeightSuggestion(sets, {
        enabled: true,
        minReps: 12,
        maxReps: 15,
      })
    ).toBe(false);
  });

  it('suggests increase weight when all working sets are at or above max', () => {
    const sets = [
      { reps: 15, setType: 'working' as const },
      { reps: 15, setType: 'working' as const },
      { reps: 15, setType: 'warmup' as const },
    ];

    expect(
      getIncreaseWeightSuggestion(sets, {
        enabled: true,
        minReps: 12,
        maxReps: 15,
      })
    ).toBe(true);
  });

  it('derives working weight as the majority set weight', () => {
    const sets = [
      { weight: 60, setType: 'working' as const },
      { weight: 65, setType: 'working' as const },
      { weight: 65, setType: 'working' as const },
    ];

    expect(getDerivedWorkingWeight(sets)).toBe(65);
  });

  it('evaluates suggestion against working-weight sets when a majority weight exists', () => {
    const sets = [
      { reps: 13, weight: 60, setType: 'working' as const },
      { reps: 12, weight: 65, setType: 'working' as const },
      { reps: 11, weight: 65, setType: 'working' as const },
    ];

    expect(
      getIncreaseWeightSuggestion(sets, {
        enabled: true,
        minReps: 8,
        maxReps: 12,
      })
    ).toBe(false);
  });

  it('falls back to all working sets when no majority working weight exists', () => {
    const sets = [
      { reps: 12, weight: 60, setType: 'working' as const },
      { reps: 12, weight: 65, setType: 'working' as const },
    ];

    expect(
      getIncreaseWeightSuggestion(sets, {
        enabled: true,
        minReps: 8,
        maxReps: 12,
      })
    ).toBe(true);
  });
});
