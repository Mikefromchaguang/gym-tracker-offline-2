import { describe, expect, it } from 'vitest';

import { ACHIEVEMENTS } from '@/lib/achievements';
import type { CompletedWorkout } from '@/lib/types';

function getDef(id: string) {
  const def = ACHIEVEMENTS.find((a) => a.id === (id as any));
  if (!def) throw new Error(`Missing achievement definition: ${id}`);
  return def;
}

function makeWorkout(params: {
  id: string;
  endTime: Date;
  exerciseNames?: string[];
  repsByExercise?: Record<string, number[]>;
}): CompletedWorkout {
  const exerciseNames = params.exerciseNames ?? ['Bench Press'];
  const repsByExercise = params.repsByExercise ?? {};

  return {
    id: params.id,
    name: 'Test Workout',
    startTime: params.endTime.getTime() - 60 * 60 * 1000,
    endTime: params.endTime.getTime(),
    exercises: exerciseNames.map((name, idx) => {
      const reps = repsByExercise[name] ?? [10];
      return {
        id: String(idx + 1),
        name,
        sets: reps.map((r, setIdx) => ({
          setNumber: setIdx + 1,
          reps: r,
          weight: 50,
          unit: 'kg',
          timestamp: params.endTime.getTime(),
          completed: true,
          isRepsPlaceholder: false,
          isWeightPlaceholder: false,
        })),
      };
    }),
  };
}

describe('Achievements', () => {
  it('unlocks workout count milestones (5, 25, 100, 300)', () => {
    const workouts = Array.from({ length: 25 }, (_, i) =>
      makeWorkout({ id: String(i + 1), endTime: new Date(2026, 0, 1 + i, 12, 0) })
    );

    expect(getDef('origin_story').isUnlocked({ workouts })).toBe(true);
    expect(getDef('comin_up').isUnlocked({ workouts })).toBe(true);
    expect(getDef('addicted_to_iron').isUnlocked({ workouts })).toBe(true);
    expect(getDef('triple_digit_demon').isUnlocked({ workouts })).toBe(false);
    expect(getDef('flex_god').isUnlocked({ workouts })).toBe(false);
  });

  it('unlocks time-of-day achievements (before 6am / after 10pm)', () => {
    const early = makeWorkout({ id: '1', endTime: new Date(2026, 0, 1, 5, 30) });
    const late = makeWorkout({ id: '2', endTime: new Date(2026, 0, 2, 22, 5) });

    expect(getDef('up_like_marcus').isUnlocked({ workouts: [early] })).toBe(true);
    expect(getDef('i_never_sleep').isUnlocked({ workouts: [late] })).toBe(true);
  });

  it('unlocks streak achievements (5 days / 7 days)', () => {
    const fiveDays = Array.from({ length: 5 }, (_, i) =>
      makeWorkout({ id: String(i + 1), endTime: new Date(2026, 0, 1 + i, 12, 0) })
    );
    const sevenDays = Array.from({ length: 7 }, (_, i) =>
      makeWorkout({ id: String(i + 1), endTime: new Date(2026, 0, 1 + i, 12, 0) })
    );

    expect(getDef('five_day_streak').isUnlocked({ workouts: fiveDays })).toBe(true);
    expect(getDef('no_off_day_week').isUnlocked({ workouts: fiveDays })).toBe(false);

    expect(getDef('no_off_day_week').isUnlocked({ workouts: sevenDays })).toBe(true);
  });

  it('unlocks “Back from the Dead” after a 2-week break', () => {
    const w1 = makeWorkout({ id: '1', endTime: new Date(2026, 0, 1, 12, 0) });
    const w2 = makeWorkout({ id: '2', endTime: new Date(2026, 0, 20, 12, 0) });

    expect(getDef('back_from_the_dead').isUnlocked({ workouts: [w1, w2] })).toBe(true);
  });

  it('unlocks “Master of the Craft” after 10 different exercises', () => {
    const exerciseNames = Array.from({ length: 10 }, (_, i) => `Exercise ${i + 1}`);
    const w = makeWorkout({ id: '1', endTime: new Date(2026, 0, 1, 12, 0), exerciseNames });

    expect(getDef('master_of_the_craft').isUnlocked({ workouts: [w] })).toBe(true);
  });

  it('unlocks “You OK Bro?” when any set has 20+ reps', () => {
    const w = makeWorkout({
      id: '1',
      endTime: new Date(2026, 0, 1, 12, 0),
      exerciseNames: ['Bench Press'],
      repsByExercise: { 'Bench Press': [10, 20] },
    });

    expect(getDef('you_ok_bro').isUnlocked({ workouts: [w] })).toBe(true);
  });

  it('unlocks “Weekend Warrior” when any workout lands on a weekend', () => {
    let d = new Date(2026, 0, 1, 12, 0);
    // advance to next Saturday/Sunday in local time
    while (![0, 6].includes(d.getDay())) d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 12, 0);

    const w = makeWorkout({ id: '1', endTime: d });
    expect(getDef('weekend_warrior').isUnlocked({ workouts: [w] })).toBe(true);
  });
});
