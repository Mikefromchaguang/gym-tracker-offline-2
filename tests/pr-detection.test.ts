import { describe, it, expect } from 'vitest';
import { CompletedWorkout, ExerciseType } from '@/lib/types';
import { calculateSetVolume } from '@/lib/volume-calculation';

/**
 * Test PR detection logic
 * 
 * This test verifies that the PR detection system correctly identifies:
 * 1. Heaviest Weight PRs for weighted exercises
 * 2. Highest Volume PRs (weight × reps for weighted, bodyweight × reps for bodyweight, etc.)
 * Note: Most Reps PRs are no longer tracked
 */

describe('PR Detection System', () => {
  // Mock workout data with optional exercise type
  const createWorkout = (
    id: string,
    exerciseName: string,
    sets: Array<{ reps: number; weight: number }>,
    exerciseType: ExerciseType = 'weighted'
  ): CompletedWorkout => ({
    id,
    name: 'Test Workout',
    startTime: Date.now(),
    endTime: Date.now() + 3600000,
    exercises: [
      {
        id: '1',
        name: exerciseName,
        type: exerciseType,
        sets: sets.map((set, idx) => ({
          setNumber: idx + 1,
          reps: set.reps,
          weight: set.weight,
          unit: 'kg',
          completed: true,
          timestamp: Date.now(),
          isRepsPlaceholder: false,
          isWeightPlaceholder: false,
        })),
      },
    ],
  });

  /**
   * Get the effective resistance/weight for PR comparison based on exercise type
   */
  const getEffectiveWeight = (setWeight: number, exerciseType: ExerciseType | undefined, bodyWeight: number): number => {
    switch (exerciseType) {
      case 'bodyweight':
        return bodyWeight;
      case 'weighted-bodyweight':
        return bodyWeight + setWeight;
      case 'assisted-bodyweight':
        return Math.max(0, bodyWeight - setWeight);
      case 'weighted':
      case 'doubled':
      default:
        return setWeight;
    }
  };

  // PR detection logic that handles different exercise types (mimics the actual implementation)
  const detectPRs = (currentWorkout: CompletedWorkout, historicalWorkouts: CompletedWorkout[], bodyWeight: number = 70) => {
    const prs: Array<{ exerciseName: string; prType: 'heaviest_weight' | 'highest_volume'; value: number }> = [];
    
    for (const exercise of currentWorkout.exercises) {
      const exerciseType = exercise.type;
      const isPureBodyweight = exerciseType === 'bodyweight';

      // Find all historical exercises for this exercise
      const historicalExercises = historicalWorkouts
        .filter(w => w.id !== currentWorkout.id)
        .flatMap(w => w.exercises)
        .filter(ex => ex.name === exercise.name);

      const historicalSets = historicalExercises.flatMap(ex => 
        ex.sets.map(set => ({ set, type: ex.type }))
      );

      // If no history, first workout with this exercise should show PRs
      if (historicalSets.length === 0) {
        const maxEffectiveWeight = Math.max(...exercise.sets.map(s => getEffectiveWeight(s.weight || 0, exerciseType, bodyWeight)));
        const maxVolume = Math.max(...exercise.sets.map(s => calculateSetVolume(s, exerciseType, bodyWeight)));
        
        // For pure bodyweight exercises, always show PRs if there are reps
        // For other exercises, only show if there's effective weight > 0
        if (maxEffectiveWeight > 0 || isPureBodyweight) {
          prs.push({ exerciseName: exercise.name, prType: 'heaviest_weight', value: maxEffectiveWeight });
          prs.push({ exerciseName: exercise.name, prType: 'highest_volume', value: maxVolume });
        }
        continue;
      }

      // Calculate historical PRs using exercise type from historical data
      const historicalPRWeight = Math.max(...historicalSets.map(h => 
        getEffectiveWeight(h.set.weight || 0, h.type || exerciseType, bodyWeight)
      ));
      const historicalPRVolume = Math.max(...historicalSets.map(h => 
        calculateSetVolume(h.set, h.type || exerciseType, bodyWeight)
      ));

      // Check for heaviest weight PR
      const currentMaxEffectiveWeight = Math.max(...exercise.sets.map(s => 
        getEffectiveWeight(s.weight || 0, exerciseType, bodyWeight)
      ));
      
      if (currentMaxEffectiveWeight > historicalPRWeight) {
        prs.push({
          exerciseName: exercise.name,
          prType: 'heaviest_weight',
          value: currentMaxEffectiveWeight,
        });
      }

      // Check for highest volume PR
      const currentMaxVolume = Math.max(...exercise.sets.map(s => calculateSetVolume(s, exerciseType, bodyWeight)));
      
      if (currentMaxVolume > historicalPRVolume) {
        prs.push({
          exerciseName: exercise.name,
          prType: 'highest_volume',
          value: currentMaxVolume,
        });
      }
    }

    return prs;
  };

  it('should detect heaviest weight PR', () => {
    const historical = [
      createWorkout('1', 'Bench Press', [
        { reps: 10, weight: 100 },
        { reps: 8, weight: 110 },
      ]),
    ];

    const current = createWorkout('2', 'Bench Press', [
      { reps: 10, weight: 100 },
      { reps: 8, weight: 120 }, // New PR!
    ]);

    const prs = detectPRs(current, [...historical, current]);
    
    expect(prs).toContainEqual({
      exerciseName: 'Bench Press',
      prType: 'heaviest_weight',
      value: 120,
    });
  });

  it('should detect highest volume PR', () => {
    const historical = [
      createWorkout('1', 'Squat', [
        { reps: 10, weight: 100 }, // Volume: 1000
        { reps: 8, weight: 110 },  // Volume: 880
      ]),
    ];

    const current = createWorkout('2', 'Squat', [
      { reps: 12, weight: 100 }, // Volume: 1200 - New PR!
      { reps: 8, weight: 110 },
    ]);

    const prs = detectPRs(current, [...historical, current]);
    
    expect(prs).toContainEqual({
      exerciseName: 'Squat',
      prType: 'highest_volume',
      value: 1200,
    });
  });

  it('should detect multiple PRs in one workout', () => {
    const historical = [
      createWorkout('1', 'Deadlift', [
        { reps: 5, weight: 150 },
        { reps: 5, weight: 150 },
      ]),
    ];

    const current = createWorkout('2', 'Deadlift', [
      { reps: 8, weight: 160 }, // Both weight and volume PR!
      { reps: 5, weight: 160 },
    ]);

    const prs = detectPRs(current, [...historical, current]);
    
    // Should detect both heaviest weight and highest volume PRs
    expect(prs.length).toBeGreaterThanOrEqual(2);
    expect(prs.some(pr => pr.prType === 'heaviest_weight' && pr.value === 160)).toBe(true);
    expect(prs.some(pr => pr.prType === 'highest_volume' && pr.value === 1280)).toBe(true);
  });

  it('should not detect PRs when no improvement', () => {
    const historical = [
      createWorkout('1', 'Bench Press', [
        { reps: 10, weight: 100 },
        { reps: 8, weight: 110 },
      ]),
    ];

    const current = createWorkout('2', 'Bench Press', [
      { reps: 10, weight: 100 },
      { reps: 8, weight: 105 }, // Lower than historical
    ]);

    const prs = detectPRs(current, [...historical, current]);
    
    expect(prs.length).toBe(0);
  });

  it('should detect PR on first workout for an exercise', () => {
    const historical: CompletedWorkout[] = [];

    const current = createWorkout('1', 'Bench Press', [
      { reps: 10, weight: 100 },
    ]);

    const prs = detectPRs(current, [current]);
    
    // First workout should create PRs for weight and volume (most_reps removed)
    expect(prs.length).toBe(2);
    expect(prs.some(pr => pr.prType === 'heaviest_weight' && pr.value === 100)).toBe(true);
    expect(prs.some(pr => pr.prType === 'highest_volume' && pr.value === 1000)).toBe(true);
  });

  // Tests for different exercise types
  describe('Bodyweight Exercise PRs', () => {
    it('should detect PRs for pure bodyweight exercises (no weight needed)', () => {
      const historical: CompletedWorkout[] = [];
      const bodyWeight = 80;

      // Pull-ups with just reps, no weight
      const current = createWorkout('1', 'Pull-ups', [
        { reps: 10, weight: 0 },
      ], 'bodyweight');

      const prs = detectPRs(current, [current], bodyWeight);
      
      // Should detect PRs for bodyweight exercises
      expect(prs.length).toBe(2);
      // Heaviest weight = bodyweight (80kg)
      expect(prs.some(pr => pr.prType === 'heaviest_weight' && pr.value === 80)).toBe(true);
      // Volume = bodyweight × reps = 80 × 10 = 800
      expect(prs.some(pr => pr.prType === 'highest_volume' && pr.value === 800)).toBe(true);
    });

    it('should detect PRs for weighted-bodyweight exercises', () => {
      const bodyWeight = 80;
      
      const historical = [
        createWorkout('1', 'Dips', [
          { reps: 8, weight: 10 }, // 80 + 10 = 90kg, volume = 720
        ], 'weighted-bodyweight'),
      ];

      // New workout with more added weight
      const current = createWorkout('2', 'Dips', [
        { reps: 8, weight: 20 }, // 80 + 20 = 100kg, volume = 800
      ], 'weighted-bodyweight');

      const prs = detectPRs(current, [...historical, current], bodyWeight);
      
      // Should detect both PRs
      expect(prs.some(pr => pr.prType === 'heaviest_weight' && pr.value === 100)).toBe(true);
      expect(prs.some(pr => pr.prType === 'highest_volume' && pr.value === 800)).toBe(true);
    });

    it('should detect PRs for assisted-bodyweight exercises', () => {
      const bodyWeight = 80;
      
      const historical = [
        createWorkout('1', 'Assisted Pull-ups', [
          { reps: 10, weight: 30 }, // 80 - 30 = 50kg resistance, volume = 500
        ], 'assisted-bodyweight'),
      ];

      // New workout with less assistance (harder = higher effective weight)
      const current = createWorkout('2', 'Assisted Pull-ups', [
        { reps: 10, weight: 20 }, // 80 - 20 = 60kg resistance, volume = 600
      ], 'assisted-bodyweight');

      const prs = detectPRs(current, [...historical, current], bodyWeight);
      
      // Should detect both PRs (less assistance = higher effective resistance)
      expect(prs.some(pr => pr.prType === 'heaviest_weight' && pr.value === 60)).toBe(true);
      expect(prs.some(pr => pr.prType === 'highest_volume' && pr.value === 600)).toBe(true);
    });

    it('should detect PRs for doubled exercises', () => {
      const historical = [
        createWorkout('1', 'Dumbbell Curl', [
          { reps: 10, weight: 15 }, // Volume = 10 × 15 × 2 = 300
        ], 'doubled'),
      ];

      const current = createWorkout('2', 'Dumbbell Curl', [
        { reps: 10, weight: 20 }, // Volume = 10 × 20 × 2 = 400
      ], 'doubled');

      const prs = detectPRs(current, [...historical, current], 70);
      
      // Heaviest weight = 20
      expect(prs.some(pr => pr.prType === 'heaviest_weight' && pr.value === 20)).toBe(true);
      // Volume PR = 400
      expect(prs.some(pr => pr.prType === 'highest_volume' && pr.value === 400)).toBe(true);
    });
  });
});
