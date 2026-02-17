import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Platform, Alert } from 'react-native';
import Body from 'react-native-body-highlighter';
import type { MuscleGroup, CompletedWorkout, ExerciseMetadata } from '@/lib/types';
import { getEffectiveExerciseMuscles, getExerciseMuscles } from '@/lib/types';
import { useColors } from '@/hooks/use-colors';
import * as Haptics from 'expo-haptics';

type TimePeriod = 'today' | '3days' | '7days';

interface WorkoutMuscleMapProps {
  workouts: CompletedWorkout[];
  customExercises: ExerciseMetadata[];
  gender?: 'male' | 'female'; // Body map gender (male or female)
  predefinedExerciseCustomizations?: Record<
    string,
    {
      primaryMuscle?: MuscleGroup;
      secondaryMuscles?: MuscleGroup[];
      muscleContributions?: Record<MuscleGroup, number>;
      exerciseType?: any;
      type?: any;
    }
  >;
}

// Mapping from our muscle groups to body-highlighter muscle names
const MUSCLE_MAP: Partial<Record<MuscleGroup, string[]>> = {
  'chest': ['chest'],
  'upper-back': ['upper-back'],
  'lower-back': ['lower-back'],
  'lats': ['back-deltoids'],
  // Deltoid split (front/side share the front-shoulder slug; rear uses back-shoulder slug)
  'deltoids-front': ['deltoids'],
  'deltoids-side': ['deltoids'],
  'deltoids-rear': ['back-deltoids'],
  // Legacy (pre-split) fallback
  'deltoids': ['deltoids'],
  'biceps': ['biceps'],
  'triceps': ['triceps'],
  'forearms': ['forearm'],
  'abs': ['abs'],
  'obliques': ['obliques'],
  'quadriceps': ['quadriceps'],
  'hamstring': ['hamstring'],
  'gluteal': ['gluteal'],
  'calves': ['calves'],
  'trapezius': ['trapezius'],
  'adductors': ['adductors'],
  'tibialis': ['tibialis-anterior'],
  'neck': ['neck'],
};

export function WorkoutMuscleMap({ workouts, customExercises, gender = 'male', predefinedExerciseCustomizations }: WorkoutMuscleMapProps) {
  const colors = useColors();
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('today');

  // Single color for basic muscle highlighting
  const darkRed = '#FF4D4D';
  const basicColors = useMemo(() => [darkRed], []);

  const muscleData = useMemo(() => {
    const nowDate = new Date();
    const endMs = nowDate.getTime();

    const startOfDayMs = (date: Date): number => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    };

    const startOfDaysAgoMs = (daysAgo: number): number => {
      const d = new Date(nowDate);
      d.setDate(d.getDate() - daysAgo);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    };

    // Use calendar-day windows (not rolling N*24h) so "Today" never includes yesterday.
    const windowStartMs: Record<TimePeriod, number> = {
      today: startOfDayMs(nowDate),
      '3days': startOfDaysAgoMs(2),
      '7days': startOfDaysAgoMs(6),
    };

    const windowWorkouts = workouts.filter((w) => w.startTime >= windowStartMs[selectedPeriod] && w.startTime <= endMs);

    // Basic mode: highlight if used at all (primary OR secondary), one color.
    const used = new Set<string>();
    for (const w of windowWorkouts) {
      for (const exercise of w.exercises as any[]) {
        const name = (exercise.name ?? '').trim();
        if (!name) continue;
        const hasWork = (exercise.sets || []).some((set: any) => set?.completed !== false && !!set?.reps);
        if (!hasWork) continue;

        let muscleMeta: ExerciseMetadata | undefined;
        if (exercise.primaryMuscle) {
          muscleMeta = {
            name,
            primaryMuscle: exercise.primaryMuscle as MuscleGroup,
            secondaryMuscles: (exercise.secondaryMuscles || []) as MuscleGroup[],
          } as any;
        } else {
          const customEx = customExercises.find((ex) => ex.name.toLowerCase() === name.toLowerCase());
          const isCustom = !getExerciseMuscles(name);
          muscleMeta = getEffectiveExerciseMuscles(name, predefinedExerciseCustomizations as any, isCustom, customEx);
        }
        if (!muscleMeta) continue;
        used.add(muscleMeta.primaryMuscle);
        for (const m of muscleMeta.secondaryMuscles || []) used.add(m);
      }
    }

    const bodyData: any[] = [];
    for (const muscle of Object.keys(MUSCLE_MAP)) {
      const bodyMuscles = MUSCLE_MAP[muscle as MuscleGroup];
      if (!bodyMuscles) continue;
      if (!used.has(muscle)) continue;
      bodyMuscles.forEach((slug) => bodyData.push({ slug, intensity: 1 }));
    }
    return bodyData;
  }, [workouts, customExercises, predefinedExerciseCustomizations, selectedPeriod]);

  const periodButtons = [
    { key: 'today' as const, label: 'Today' },
    { key: '3days' as const, label: '3 Days' },
    { key: '7days' as const, label: '7 Days' },
  ];

  return (
    <View className="gap-3">
      {/* Title */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 10,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: '700' }}>
          Muscles Worked
        </Text>
      </View>

      {/* Period selector */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <View className="flex-row gap-2">
          {periodButtons.map(({ key, label }) => (
            <Pressable
              key={key}
              onPress={() => {
                setSelectedPeriod(key);
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              }}
              style={({ pressed }) => [
                {
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 8,
                  backgroundColor: selectedPeriod === key ? colors.primary : colors.surface,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text
                style={{
                  color: selectedPeriod === key ? colors.background : colors.foreground,
                  fontSize: 12,
                  fontWeight: '600',
                }}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={() => {
            Alert.alert(
              'Muscles Worked',
              'Shows which muscles were used in the selected time period. Red highlighting indicates the muscle was worked.',
            );
          }}
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: colors.muted, fontSize: 14, fontWeight: '800' }}>i</Text>
          </View>
        </Pressable>
      </View>

      {/* Body map - Front and Back */}
      <View className="bg-surface rounded-lg p-4">
        <View className="flex-row justify-center gap-4">
          <View className="items-center">
            <Text className="text-xs text-muted mb-2">Front</Text>
            <Body
              data={muscleData}
              colors={basicColors}
              scale={0.7}
              side="front"
              gender={gender}
            />
          </View>
          <View className="items-center">
            <Text className="text-xs text-muted mb-2">Back</Text>
            <Body
              data={muscleData}
              colors={basicColors}
              scale={0.7}
              side="back"
              gender={gender}
            />
          </View>
        </View>
      </View>
    </View>
  );
}
