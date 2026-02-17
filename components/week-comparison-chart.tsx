import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { useBodyweight } from '@/hooks/use-bodyweight';
import { CompletedWorkout, MuscleGroup, WeekStartDay } from '@/lib/types';
import { PRIMARY_MUSCLE_GROUPS, getMuscleGroupDisplayName } from '@/lib/muscle-groups';
import { getExerciseMuscles } from '@/lib/types';
import { formatVolume } from '@/lib/unit-conversion';
import { calculateSetVolume } from '@/lib/volume-calculation';
import { calculateDefaultContributions } from '@/lib/muscle-contribution';
import { getWeekStart, getWeekRange } from '@/lib/week-utils';

interface WeekComparisonChartProps {
  workouts: CompletedWorkout[];
  customExercises: Array<{ 
    name: string; 
    primaryMuscle: MuscleGroup; 
    secondaryMuscles?: MuscleGroup[];
    muscleContributions?: Record<MuscleGroup, number>;
  }>;
  weightUnit: 'kg' | 'lbs';
  weekStartDay?: WeekStartDay;
}

interface MuscleVolumeData {
  muscle: MuscleGroup;
  lastWeekPrimary: number;
  lastWeekSecondary: number;
  thisWeekPrimary: number;
  thisWeekSecondary: number;
}

export function WeekComparisonChart({ workouts, customExercises, weightUnit, weekStartDay = 1 }: WeekComparisonChartProps) {
  const colors = useColors();
  const { bodyWeightKg: bodyWeight } = useBodyweight();

  const volumeData = useMemo(() => {
    const now = new Date();
    const thisWeekStart = getWeekStart(now, weekStartDay);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const thisWeekRange = getWeekRange(thisWeekStart);
    const lastWeekRange = getWeekRange(lastWeekStart);

    // Initialize volume tracking
    const data: Record<MuscleGroup, MuscleVolumeData> = {} as Record<MuscleGroup, MuscleVolumeData>;
    PRIMARY_MUSCLE_GROUPS.forEach((muscle) => {
      data[muscle] = {
        muscle,
        lastWeekPrimary: 0,
        lastWeekSecondary: 0,
        thisWeekPrimary: 0,
        thisWeekSecondary: 0,
      };
    });

    // Process workouts
    workouts.forEach((workout) => {
      const workoutDate = new Date(workout.endTime);
      const workoutTime = workoutDate.getTime();
      const isThisWeek = workoutTime >= thisWeekRange.start && workoutTime <= thisWeekRange.end;
      const isLastWeek = workoutTime >= lastWeekRange.start && workoutTime <= lastWeekRange.end;

      if (!isThisWeek && !isLastWeek) return;

      workout.exercises.forEach((exercise) => {
        // Get muscle groups for this exercise
        // First check predefined exercises
        let muscleMeta = getExerciseMuscles(exercise.name);
        // If not found, check custom exercises
        if (!muscleMeta) {
          const customExercise = customExercises.find(
            (ex) => ex.name.toLowerCase() === exercise.name.toLowerCase()
          );
          if (customExercise) {
            muscleMeta = {
              name: customExercise.name,
              primaryMuscle: customExercise.primaryMuscle,
              secondaryMuscles: customExercise.secondaryMuscles,
              exerciseType: 'weighted' as const,
              muscleContributions: customExercise.muscleContributions,
            };
          }
        }
        if (!muscleMeta) return;

        const primary = muscleMeta.primaryMuscle;
        const secondaries = muscleMeta.secondaryMuscles || [];
        
        // Get contributions (uses defaults if not set)
        const contributions = muscleMeta.muscleContributions 
          ? muscleMeta.muscleContributions 
          : calculateDefaultContributions(primary, secondaries);

        // Process each set with muscle contributions
        exercise.sets.forEach((set) => {
          // Only count completed sets, exclude warmup sets
          if (set.completed === false) return;
          if (set.setType === 'warmup') return;
          if (!set.weight || !set.reps) return;
          
          const volume = calculateSetVolume(set, exercise.type, bodyWeight);
          const primaryContrib = contributions[primary] || 100;
          
          // Add to primary muscle with contribution percentage
          if (data[primary]) {
            if (isThisWeek) {
              data[primary].thisWeekPrimary += volume * (primaryContrib / 100);
            } else {
              data[primary].lastWeekPrimary += volume * (primaryContrib / 100);
            }
          }

          // Add to secondary muscles with contribution percentages
          secondaries.forEach((muscle) => {
            const secContrib = contributions[muscle] || 0;
            if (secContrib > 0 && data[muscle]) {
              if (isThisWeek) {
                data[muscle].thisWeekSecondary += volume * (secContrib / 100);
              } else {
                data[muscle].lastWeekSecondary += volume * (secContrib / 100);
              }
            }
          });
        });
      });
    });

    // Convert to array and sort by total this week volume (descending)
    const dataArray = Object.values(data);
    dataArray.sort((a, b) => {
      const totalA = a.thisWeekPrimary + a.thisWeekSecondary;
      const totalB = b.thisWeekPrimary + b.thisWeekSecondary;
      return totalB - totalA;
    });

    return dataArray;
  }, [workouts, customExercises, bodyWeight]);

  // Find max volume for scaling
  const maxVolume = useMemo(() => {
    let max = 0;
    volumeData.forEach((d) => {
      const lastWeekTotal = d.lastWeekPrimary + d.lastWeekSecondary;
      const thisWeekTotal = d.thisWeekPrimary + d.thisWeekSecondary;
      max = Math.max(max, lastWeekTotal, thisWeekTotal);
    });
    return max || 1; // Avoid division by zero
  }, [volumeData]);

  return (
    <View style={styles.container}>
      {volumeData.map((d) => {
        const lastWeekTotal = d.lastWeekPrimary + d.lastWeekSecondary;
        const thisWeekTotal = d.thisWeekPrimary + d.thisWeekSecondary;
        
        // Skip muscles with no data at all
        if (lastWeekTotal === 0 && thisWeekTotal === 0) return null;

        const percentChange = lastWeekTotal > 0 
          ? ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100 
          : (thisWeekTotal > 0 ? 100 : 0);
        
        const exceededLastWeek = thisWeekTotal > lastWeekTotal;
        const isNegative = percentChange < 0;

        // Calculate bar widths as percentages
        const lastWeekWidth = (lastWeekTotal / maxVolume) * 100;
        const thisWeekWidth = (thisWeekTotal / maxVolume) * 100;

        // Calculate segment proportions within each bar
        const lastWeekPrimaryPercent = lastWeekTotal > 0 ? (d.lastWeekPrimary / lastWeekTotal) * 100 : 0;
        const lastWeekSecondaryPercent = lastWeekTotal > 0 ? (d.lastWeekSecondary / lastWeekTotal) * 100 : 0;
        const thisWeekPrimaryPercent = thisWeekTotal > 0 ? (d.thisWeekPrimary / thisWeekTotal) * 100 : 0;
        const thisWeekSecondaryPercent = thisWeekTotal > 0 ? (d.thisWeekSecondary / thisWeekTotal) * 100 : 0;

        return (
          <View key={d.muscle} style={styles.row}>
            {/* Muscle label - fixed width */}
            <Text style={[styles.label, { color: colors.foreground }]}>
              {getMuscleGroupDisplayName(d.muscle)}
            </Text>

            {/* Bar container - overlaid bars */}
            <View style={styles.barsWrapper}>
              {/* Gray background bar (last week) */}
              <View style={[styles.barContainer, { width: `${lastWeekWidth}%` }]}>
                {lastWeekTotal > 0 && (
                  <>
                    {/* Primary volume (darker gray) */}
                    <View
                      style={[
                        styles.barSegment,
                        {
                          width: `${lastWeekPrimaryPercent}%`,
                          backgroundColor: '#6B7280',
                        },
                      ]}
                    />
                    {/* Secondary volume (lighter gray) */}
                    <View
                      style={[
                        styles.barSegment,
                        {
                          width: `${lastWeekSecondaryPercent}%`,
                          backgroundColor: '#9CA3AF',
                        },
                      ]}
                    />
                  </>
                )}
              </View>
              
              {/* Colored overlay bar (this week) - positioned absolutely on top */}
              <View style={[styles.overlayBar, { width: `${thisWeekWidth}%` }]}>
                {thisWeekTotal > 0 && (
                  <>
                    {/* Primary volume */}
                    <View
                      style={[
                        styles.barSegment,
                        {
                          width: `${thisWeekPrimaryPercent}%`,
                          backgroundColor: exceededLastWeek ? '#16A34A' : '#DC2626',
                        },
                      ]}
                    />
                    {/* Secondary volume */}
                    <View
                      style={[
                        styles.barSegment,
                        {
                          width: `${thisWeekSecondaryPercent}%`,
                          backgroundColor: exceededLastWeek ? '#4ADE80' : '#F87171',
                        },
                      ]}
                    />
                  </>
                )}
              </View>
            </View>

            {/* Stats - percentage and volume on one line */}
            <View style={styles.stats}>
              <Text
                style={[
                  styles.statsText,
                  {
                    color: exceededLastWeek
                      ? '#16A34A'
                      : isNegative
                      ? '#DC2626'
                      : colors.muted,
                  },
                ]}
              >
                {percentChange > 0 ? '+' : ''}{percentChange.toFixed(0)}% · {formatVolume(thisWeekTotal, weightUnit)}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    width: 80,
  },
  barsWrapper: {
    flex: 1,
    height: 16,
    position: 'relative',
  },
  barContainer: {
    height: 16,
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  overlayBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 16,
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  barSegment: {
    height: '100%',
  },
  stats: {
    width: 100,
    alignItems: 'flex-end',
  },
  statsText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
