import type { CompletedWorkout } from '@/lib/types';

export type AchievementId =
  | 'origin_story'
  | 'comin_up'
  | 'addicted_to_iron'
  | 'triple_digit_demon'
  | 'flex_god'
  | 'up_like_marcus'
  | 'i_never_sleep'
  | 'five_day_streak'
  | 'no_off_day_week'
  | 'weekend_warrior'
  | 'back_from_the_dead'
  | 'master_of_the_craft'
  | 'you_ok_bro';

export type AchievementDefinition = {
  id: AchievementId;
  title: string;
  description: string;
  message: string;
  isUnlocked: (ctx: { workouts: CompletedWorkout[] }) => boolean;
};

export type UnlockedAchievement = {
  id: AchievementId;
  unlockedAt: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function toLocalDayNumber(ts: number): number {
  const d = new Date(ts);
  const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.floor(midnight / DAY_MS);
}

function getUniqueWorkoutDayNumbers(workouts: CompletedWorkout[]): number[] {
  const s = new Set<number>();
  for (const w of workouts) s.add(toLocalDayNumber(w.endTime));
  return Array.from(s).sort((a, b) => a - b);
}

function getMaxConsecutiveRun(sortedUniqueDayNumbers: number[]): number {
  if (sortedUniqueDayNumbers.length === 0) return 0;
  let maxRun = 1;
  let run = 1;
  for (let i = 1; i < sortedUniqueDayNumbers.length; i++) {
    if (sortedUniqueDayNumbers[i] === sortedUniqueDayNumbers[i - 1] + 1) {
      run++;
      if (run > maxRun) maxRun = run;
    } else {
      run = 1;
    }
  }
  return maxRun;
}

function anyWorkoutEndsBeforeHour(workouts: CompletedWorkout[], hour: number): boolean {
  return workouts.some((w) => {
    const d = new Date(w.endTime);
    return d.getHours() < hour;
  });
}

function anyWorkoutEndsAtOrAfterHour(workouts: CompletedWorkout[], hour: number): boolean {
  return workouts.some((w) => {
    const d = new Date(w.endTime);
    return d.getHours() >= hour;
  });
}

function anyWorkoutOnWeekend(workouts: CompletedWorkout[]): boolean {
  return workouts.some((w) => {
    const d = new Date(w.endTime);
    const day = d.getDay();
    return day === 0 || day === 6;
  });
}

function hasBreakReturn(workouts: CompletedWorkout[], minGapDays: number): boolean {
  const days = getUniqueWorkoutDayNumbers(workouts);
  for (let i = 1; i < days.length; i++) {
    if (days[i] - days[i - 1] >= minGapDays) return true;
  }
  return false;
}

function getUniqueExerciseCount(workouts: CompletedWorkout[]): number {
  const names = new Set<string>();
  for (const w of workouts) {
    for (const ex of w.exercises) {
      const name = (ex.name ?? '').trim().toLowerCase();
      if (name) names.add(name);
    }
  }
  return names.size;
}

function hasSetWithRepsAtLeast(workouts: CompletedWorkout[], minReps: number): boolean {
  for (const w of workouts) {
    for (const ex of w.exercises) {
      for (const set of ex.sets) {
        const isCompleted = set.completed ?? true;
        const isPlaceholder = set.isRepsPlaceholder ?? false;
        const isWarmup = set.setType === 'warmup';
        if (isCompleted && !isPlaceholder && !isWarmup && set.reps >= minReps) return true;
      }
    }
  }
  return false;
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'origin_story',
    title: 'Origin Story',
    description: 'Log your first workout',
    message: 'Log your first workout',
    isUnlocked: ({ workouts }) => workouts.length >= 1,
  },
  {
    id: 'comin_up',
    title: 'The Come Up',
    description: 'Complete 5 workouts',
    message: 'Complete 5 workouts',
    isUnlocked: ({ workouts }) => workouts.length >= 5,
  },
  {
    id: 'addicted_to_iron',
    title: 'Addicted to Iron',
    description: 'Complete 25 workouts',
    message: 'Complete 25 workouts',
    isUnlocked: ({ workouts }) => workouts.length >= 25,
  },
  {
    id: 'triple_digit_demon',
    title: 'One Hunnid',
    description: 'Complete 100 workouts',
    message: 'Complete 100 workouts',
    isUnlocked: ({ workouts }) => workouts.length >= 100,
  },
  {
    id: 'flex_god',
    title: 'Flex God',
    description: 'Complete 300 workouts',
    message: 'Complete 300 workouts',
    isUnlocked: ({ workouts }) => workouts.length >= 300,
  },
  {
    id: 'up_like_marcus',
    title: 'Up Like Marcus',
    description: 'Complete a workout before 6am',
    message: 'Complete a workout before 6am',
    isUnlocked: ({ workouts }) => anyWorkoutEndsBeforeHour(workouts, 6),
  },
  {
    id: 'i_never_sleep',
    title: 'I Never Sleep',
    description: 'Complete a workout after 10pm',
    message: 'Complete a workout after 10pm',
    isUnlocked: ({ workouts }) => anyWorkoutEndsAtOrAfterHour(workouts, 22),
  },
  {
    id: 'five_day_streak',
    title: 'One, two, three, fo, fif!',
    description: 'Work out 5 days in a row',
    message: 'Work out 5 days in a row',
    isUnlocked: ({ workouts }) => getMaxConsecutiveRun(getUniqueWorkoutDayNumbers(workouts)) >= 5,
  },
  {
    id: 'no_off_day_week',
    title: 'Fuck a Off Day',
    description: 'Work out every day in a week',
    message: 'Work out every day in a week',
    isUnlocked: ({ workouts }) => getMaxConsecutiveRun(getUniqueWorkoutDayNumbers(workouts)) >= 7,
  },
  {
    id: 'weekend_warrior',
    title: 'Weekend Warrior',
    description: 'Complete a workout on the weekend',
    message: 'Complete a workout on the weekend',
    isUnlocked: ({ workouts }) => anyWorkoutOnWeekend(workouts),
  },
  {
    id: 'back_from_the_dead',
    title: 'Back from the Dead',
    description: 'Return after a 2-week break',
    message: 'Return after a 2-week break',
    isUnlocked: ({ workouts }) => hasBreakReturn(workouts, 14),
  },
  {
    id: 'master_of_the_craft',
    title: 'Master of the Craft',
    description: 'Log 10 different exercises',
    message: 'Log 10 different exercises',
    isUnlocked: ({ workouts }) => getUniqueExerciseCount(workouts) >= 10,
  },
  {
    id: 'you_ok_bro',
    title: 'You OK Bro?',
    description: 'Log a set with 20 or more reps',
    message: 'Log a set with 20 or more reps',
    isUnlocked: ({ workouts }) => hasSetWithRepsAtLeast(workouts, 20),
  },
];

export function getAchievementDefinition(id: AchievementId): AchievementDefinition | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

export function computeNewlyUnlockedAchievements(params: {
  workouts: CompletedWorkout[];
  unlocked: UnlockedAchievement[];
}): AchievementDefinition[] {
  const unlockedIds = new Set(params.unlocked.map((u) => u.id));
  return ACHIEVEMENTS.filter((def) => !unlockedIds.has(def.id) && def.isUnlocked({ workouts: params.workouts }));
}
