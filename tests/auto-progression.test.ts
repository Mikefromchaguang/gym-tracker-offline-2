import { describe, expect, it } from 'vitest';

import { applyAutoProgressionOnStart, getIncreaseWeightSuggestion } from '@/lib/auto-progression';

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

  it('does not clamp down above-max reps and still suggests increase weight', () => {
    const sets = [
      { reps: 12, setType: 'working' as const },
      { reps: 16, setType: 'working' as const },
    ];

    const result = applyAutoProgressionOnStart(sets, {
      enabled: true,
      minReps: 12,
      maxReps: 15,
    });

    expect(result.sets.map((s) => s.reps)).toEqual([13, 16]);
    expect(result.suggestIncreaseWeight).toBe(true);
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
});
