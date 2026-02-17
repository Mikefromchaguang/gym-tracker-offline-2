/**
 * Analytics Screen - Muscle group volume distribution for current week
 */

import { ScrollView, View, Text, Pressable, Platform } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { InteractiveLineChart } from '@/components/interactive-line-chart';
import { calculateRollingAverage } from '@/lib/rolling-average';
import { VolumePerDayChart } from '@/components/volume-per-day-chart';
import { MuscleGroupSelectionModal } from '@/components/muscle-group-selection-modal';
import { ScreenContainer } from '@/components/screen-container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useGym } from '@/lib/gym-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { BodyWeightStorage } from '@/lib/storage';
import type { BodyWeightLog } from '@/lib/types';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { useBodyweight } from '@/hooks/use-bodyweight';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MuscleGroup, getExerciseMuscles, getEffectiveExerciseMuscles, PREDEFINED_EXERCISES_WITH_MUSCLES } from '@/lib/types';
import { PRIMARY_MUSCLE_GROUPS, getMuscleGroupDisplayName } from '@/lib/muscle-groups';
import { convertWeight, formatWeight, formatVolume, convertWeightBetweenUnits, lbsToKg } from '@/lib/unit-conversion';
import { calculateSetVolume } from '@/lib/volume-calculation';
import { getExerciseContributions, calculateDefaultContributions } from '@/lib/muscle-contribution';
import { WorkoutMuscleMap } from '@/components/workout-muscle-map';
import { UnifiedMuscleChart } from '@/components/unified-muscle-chart';
import { ChartSettings } from '@/components/chart-settings-modal';
import { CumulativeWeekVolumeChart } from '@/components/cumulative-week-volume-chart';
import { getWeekStart, getWeekRange as getWeekRangeUtil, getDayIndexInWeek, getOrderedDayAbbrevs } from '@/lib/week-utils';

interface MuscleGroupStats {
  muscleGroup: MuscleGroup;
  totalVolume: number;
  totalSets: number;
}

const MUSCLE_COLORS: Partial<Record<MuscleGroup, string>> = {
  'chest': '#FF6B6B',
  'upper-back': '#4ECDC4',
  'lower-back': '#3ABDB0',
  'lats': '#3ABDB0',
  'deltoids-front': '#45B7D1',
  'deltoids-side': '#3FA9C3',
  'deltoids-rear': '#3392AB',
  'deltoids': '#45B7D1',
  'biceps': '#FFA07A',
  'triceps': '#98D8C8',
  'forearms': '#F7DC6F',
  'quadriceps': '#BB8FCE',
  'hamstring': '#85C1E2',
  'gluteal': '#F8B88B',
  'calves': '#A9DFBF',
  'abs': '#F5B7B1',
  'obliques': '#F5B7B1',
  'trapezius': '#D7BDE2',
  'adductors': '#D7BDE2',
  'tibialis': '#A9DFBF',
  'neck': '#D7BDE2',
};

type TimePeriod = 'week' | 'month' | '6months' | 'all';

// Chart card identifiers for reordering
type ChartCardId = 'weeklyStats' | 'bodyWeight' | 'statsPerMuscle' | 'muscleMap' | 'weeklyVolume';

const DEFAULT_CHART_ORDER: ChartCardId[] = ['weeklyStats', 'bodyWeight', 'statsPerMuscle', 'muscleMap', 'weeklyVolume'];

export default function AnalyticsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { workouts, settings, customExercises, predefinedExerciseCustomizations } = useGym();
  const { bodyWeightKg: currentBodyweight } = useBodyweight();
  const [volumeChartMode, setVolumeChartMode] = useState<'per-day' | 'wow-cumulative'>('wow-cumulative');
  const [bodyWeightPeriod, setBodyWeightPeriod] = useState<TimePeriod>('week');
  const [selectedMusclesForSpider, setSelectedMusclesForSpider] = useState<MuscleGroup[]>([]);
  const [showSpiderLastWeek, setShowSpiderLastWeek] = useState(true);
  const [showMuscleSelectionModal, setShowMuscleSelectionModal] = useState(false);
  const [bodyWeightLogs, setBodyWeightLogs] = useState<BodyWeightLog[]>([]);
  const [showAllMuscles, setShowAllMuscles] = useState(false); // Toggle for muscle chart view
  const [chartSettings, setChartSettings] = useState<ChartSettings>({
    showRollingAverage: true,
    rollingAverageWindow: 7,
    showTrendline: false,
  });
  const [chartOrder, setChartOrder] = useState<ChartCardId[]>(DEFAULT_CHART_ORDER);

  useFocusEffect(
    useCallback(() => {
      loadBodyWeightLogs();
      loadSelectedMuscles();
      loadChartSettings();
      loadSpiderLastWeekSetting();
      loadChartOrder();
    }, [])
  );

  const loadChartOrder = async () => {
    try {
      const saved = await AsyncStorage.getItem('analyticsChartOrder');
      if (saved) {
        const parsed = JSON.parse(saved) as ChartCardId[];
        // Validate all expected cards are present
        if (DEFAULT_CHART_ORDER.every(id => parsed.includes(id))) {
          setChartOrder(parsed);
        } else {
          setChartOrder(DEFAULT_CHART_ORDER);
        }
      }
    } catch (error) {
      console.error('Failed to load chart order:', error);
    }
  };

  const saveChartOrder = async (order: ChartCardId[]) => {
    try {
      await AsyncStorage.setItem('analyticsChartOrder', JSON.stringify(order));
    } catch (error) {
      console.error('Failed to save chart order:', error);
    }
  };

  const handleMoveChartUp = useCallback((index: number) => {
    if (index === 0) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setChartOrder((prev) => {
      const reordered = [...prev];
      const [removed] = reordered.splice(index, 1);
      reordered.splice(index - 1, 0, removed);
      saveChartOrder(reordered);
      return reordered;
    });
  }, []);

  const handleMoveChartDown = useCallback((index: number) => {
    setChartOrder((prev) => {
      if (index === prev.length - 1) return prev;
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      const reordered = [...prev];
      const [removed] = reordered.splice(index, 1);
      reordered.splice(index + 1, 0, removed);
      saveChartOrder(reordered);
      return reordered;
    });
  }, []);

  const loadSpiderLastWeekSetting = async () => {
    try {
      const saved = await AsyncStorage.getItem('spiderShowLastWeek');
      if (saved === null) {
        setShowSpiderLastWeek(true);
      } else {
        setShowSpiderLastWeek(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load spider chart last week toggle:', error);
      setShowSpiderLastWeek(true);
    }
  };

  const saveSpiderLastWeekSetting = async (value: boolean) => {
    try {
      await AsyncStorage.setItem('spiderShowLastWeek', JSON.stringify(value));
      setShowSpiderLastWeek(value);
    } catch (error) {
      console.error('Failed to save spider chart last week toggle:', error);
      setShowSpiderLastWeek(value);
    }
  };

  const loadSelectedMuscles = async () => {
    try {
      const saved = await AsyncStorage.getItem('selectedMusclesForSpider');
      if (saved) {
        setSelectedMusclesForSpider(JSON.parse(saved));
      } else {
        // Default muscles if none saved
        setSelectedMusclesForSpider(['chest', 'upper-back', 'deltoids-side', 'quadriceps', 'hamstring']);
      }
    } catch (error) {
      console.error('Failed to load selected muscles:', error);
      setSelectedMusclesForSpider(['chest', 'upper-back', 'deltoids-side', 'quadriceps', 'hamstring']);
    }
  };

  const saveSelectedMuscles = async (muscles: MuscleGroup[]) => {
    try {
      await AsyncStorage.setItem('selectedMusclesForSpider', JSON.stringify(muscles));
    } catch (error) {
      console.error('Failed to save selected muscles:', error);
    }
  };

  const loadChartSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem('bodyWeightChartSettings');
      if (saved) {
        setChartSettings(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load chart settings:', error);
    }
  };

  const saveChartSettings = async (settings: ChartSettings) => {
    try {
      await AsyncStorage.setItem('bodyWeightChartSettings', JSON.stringify(settings));
      setChartSettings(settings);
    } catch (error) {
      console.error('Failed to save chart settings:', error);
    }
  };

  const loadBodyWeightLogs = async () => {
    // Ensure daily entries are created/backfilled
    await BodyWeightStorage.ensureDailyEntries();
    
    const logs = await BodyWeightStorage.getAll();
    
    // Since we now have one entry per day, just sort by date
    const sorted = logs.sort((a, b) => a.date.localeCompare(b.date));
    
    setBodyWeightLogs(sorted);
  };

  // Get current week using user's preferred week start day
  const getWeekRange = () => {
    const weekStartDay = settings.weekStartDay ?? 1;
    const weekStart = getWeekStart(new Date(), weekStartDay);
    return getWeekRangeUtil(weekStart);
  };

  const formatDuration = (ms: number) => {
    const totalMinutes = Math.round(Math.max(0, ms) / (60 * 1000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours <= 0) return `${minutes}m`;
    if (minutes <= 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  };

  const getDeltaColor = (delta: number) => {
    if (delta > 0) return '#22c55e';
    if (delta < 0) return '#ef4444';
    return colors.muted;
  };

  const WeeklyStatRow = ({
    label,
    value,
    deltaText,
    deltaColor,
  }: {
    label: string;
    value: string;
    deltaText: string;
    deltaColor: string;
  }) => {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 6,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          gap: 8,
        }}
      >
        <Text style={{ fontSize: 13, color: colors.muted, flexShrink: 1 }}>{label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <Text style={{ fontSize: 13, color: colors.foreground, fontWeight: '600' }}>{value}</Text>
          <Text style={{ fontSize: 12, color: deltaColor, fontWeight: '600' }}>{deltaText}</Text>
        </View>
      </View>
    );
  };

  // Calculate muscle group stats for current week (and last week for comparisons)
  const { muscleGroupStats, allMuscleStats, lastWeekAllMuscleStats, totalVolume, totalSets, weekRange, volumePerDayData, weeklyStats } = useMemo(() => {
    const range = getWeekRange();
    const weekWorkouts = workouts.filter((w) => w.startTime >= range.start && w.startTime <= range.end);

    const MS_7D = 7 * 24 * 60 * 60 * 1000;
    const lastWeekRange = { start: range.start - MS_7D, end: range.end - MS_7D };
    const lastWeekWorkouts = workouts.filter((w) => w.startTime >= lastWeekRange.start && w.startTime <= lastWeekRange.end);

    const computeWeeklyAggregates = (workoutsInRange: typeof workouts) => {
      let volume = 0;
      let sets = 0;
      let reps = 0;
      let gymTimeMs = 0;
      const exerciseSetCounts = new Map<string, { name: string; sets: number; volume: number }>();

      workoutsInRange.forEach((workout) => {
        const durationMs = (workout.endTime || 0) - (workout.startTime || 0);
        if (Number.isFinite(durationMs) && durationMs > 0) {
          gymTimeMs += durationMs;
        }

        workout.exercises.forEach((exercise) => {
          const countedSets = (exercise.sets || []).filter((set) => set.completed !== false && set.setType !== 'warmup');

          countedSets.forEach((set) => {
            reps += set.reps || 0;
            sets += 1;
            volume += calculateSetVolume(set, exercise.type || 'weighted', currentBodyweight);
          });

          const key = (exercise.exerciseId || exercise.name || '').trim() || exercise.id;
          if (key) {
            const prev = exerciseSetCounts.get(key);
            const exVolume = countedSets.reduce((sum, set) => sum + calculateSetVolume(set, exercise.type || 'weighted', currentBodyweight), 0);
            if (prev) {
              prev.sets += countedSets.length;
              prev.volume += exVolume;
            } else {
              exerciseSetCounts.set(key, {
                name: exercise.name,
                sets: countedSets.length,
                volume: exVolume,
              });
            }
          }
        });
      });

      let favoriteExerciseName: string | null = null;
      let favoriteExerciseSets = 0;
      let favoriteExerciseVolume = 0;
      exerciseSetCounts.forEach((v) => {
        if (v.sets > favoriteExerciseSets || (v.sets === favoriteExerciseSets && v.volume > favoriteExerciseVolume)) {
          favoriteExerciseName = v.name;
          favoriteExerciseSets = v.sets;
          favoriteExerciseVolume = v.volume;
        }
      });

      return {
        workouts: workoutsInRange.length,
        volume,
        sets,
        reps,
        gymTimeMs,
        favoriteExerciseName,
        favoriteExerciseSets,
      };
    };

    const currentWeekAgg = computeWeeklyAggregates(weekWorkouts);
    const lastWeekAgg = computeWeeklyAggregates(lastWeekWorkouts);

    const lastWeekSetsForThisWeeksFavorite = currentWeekAgg.favoriteExerciseName
      ? lastWeekWorkouts.reduce((sum, w) => {
          w.exercises.forEach((ex) => {
            if (ex.name !== currentWeekAgg.favoriteExerciseName) return;
            sum += (ex.sets || []).filter((s) => s.completed !== false && s.setType !== 'warmup').length;
          });
          return sum;
        }, 0)
      : 0;

    const computeMuscleStats = (workoutsInRange: typeof workouts) => {
      const stats: Record<MuscleGroup, MuscleGroupStats> = {} as Record<MuscleGroup, MuscleGroupStats>;
      PRIMARY_MUSCLE_GROUPS.forEach(muscle => {
        stats[muscle] = { muscleGroup: muscle, totalVolume: 0, totalSets: 0 };
      });

      let actualTotalVolume = 0;
      let actualTotalSets = 0;

      workoutsInRange.forEach((workout) => {
        workout.exercises.forEach((exercise) => {
          // Use saved muscle data from workout if available, otherwise get effective muscles
          let muscleMeta;
          if (exercise.primaryMuscle && exercise.muscleContributions) {
            muscleMeta = {
              primaryMuscle: exercise.primaryMuscle,
              secondaryMuscles: exercise.secondaryMuscles || [],
              muscleContributions: exercise.muscleContributions,
              exerciseType: exercise.type,
            };
          } else {
            muscleMeta = getEffectiveExerciseMuscles(
              exercise.name,
              predefinedExerciseCustomizations,
              exercise.name ? !getExerciseMuscles(exercise.name) : false,
              customExercises.find(ex => ex.name === exercise.name)
            );
          }

          if (!muscleMeta?.primaryMuscle) return;

          const primary = muscleMeta.primaryMuscle;
          const secondaries = muscleMeta.secondaryMuscles || [];
          const contributions = muscleMeta.muscleContributions
            ? muscleMeta.muscleContributions
            : calculateDefaultContributions(primary, secondaries);

          exercise.sets
            .filter(set => set.completed !== false && set.setType !== 'warmup')
            .forEach((set) => {
              const volume = calculateSetVolume(
                set,
                exercise.type || muscleMeta.exerciseType || 'weighted',
                currentBodyweight
              );

              actualTotalVolume += volume;
              actualTotalSets += 1;

              const primaryContrib = contributions[primary] || 100;
              if (stats[primary]) {
                stats[primary].totalVolume += volume * (primaryContrib / 100);
                stats[primary].totalSets += 1;
              }

              secondaries.forEach(secondary => {
                const secContrib = contributions[secondary] || 0;
                if (secContrib > 0 && stats[secondary]) {
                  stats[secondary].totalVolume += volume * (secContrib / 100);
                  stats[secondary].totalSets += secContrib / 100;
                }
              });
            });
        });
      });

      return { stats, actualTotalVolume, actualTotalSets };
    };

    const currentWeekStats = computeMuscleStats(weekWorkouts);
    const lastWeekStats = computeMuscleStats(lastWeekWorkouts);

    // Calculate volume per day for current week
    const volumePerDay: Record<string, number> = {
      Mon: 0,
      Tue: 0,
      Wed: 0,
      Thu: 0,
      Fri: 0,
      Sat: 0,
      Sun: 0,
    };

    weekWorkouts.forEach((workout) => {
      const workoutDate = new Date(workout.startTime);
      const dayOfWeek = workoutDate.getDay();
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayName = dayNames[dayOfWeek];

      let workoutVolume = 0;
      workout.exercises.forEach((exercise) => {
        exercise.sets
          .filter(set => set.completed !== false && set.setType !== 'warmup') // Exclude warmup sets
          .forEach((set) => {
          workoutVolume += calculateSetVolume(
            set,
            exercise.type || 'weighted',
            currentBodyweight
          );
        });
      });

      volumePerDay[dayName] += workoutVolume;
    });

    const volumePerDayData = getOrderedDayAbbrevs(settings.weekStartDay ?? 1).map((day) => ({
      day,
      volume: convertWeight(volumePerDay[day], settings.weightUnit), // Convert to display unit
    }));

    return { 
      muscleGroupStats: Object.values(currentWeekStats.stats).filter((s) => s.totalVolume > 0).sort((a, b) => b.totalVolume - a.totalVolume),
      allMuscleStats: currentWeekStats.stats,
      lastWeekAllMuscleStats: lastWeekStats.stats,
      totalVolume: currentWeekStats.actualTotalVolume, // Actual unweighted total
      totalSets: currentWeekStats.actualTotalSets, // Actual unweighted total
      weekRange: range,
      volumePerDayData,
      weeklyStats: {
        current: currentWeekAgg,
        last: lastWeekAgg,
        lastWeekSetsForThisWeeksFavorite,
      },
    };
  }, [workouts, customExercises, predefinedExerciseCustomizations, currentBodyweight, settings.weightUnit, settings.weekStartDay]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const thisWeekTotalVolumeDisplay = useMemo(() => {
    return (volumePerDayData || []).reduce((sum, d) => sum + (d.volume || 0), 0);
  }, [volumePerDayData]);

  const wowComparison = useMemo(() => {
    const weekStartDay = settings.weekStartDay ?? 1;

    const now = new Date();
    const todayIndex = getDayIndexInWeek(now, weekStartDay);
    const thisWeekStart = getWeekStart(now, weekStartDay);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const thisRange = getWeekRangeUtil(thisWeekStart);
    const lastRange = getWeekRangeUtil(lastWeekStart);

    const sumWorkoutVolumeKg = (workout: any): number => {
      let total = 0;
      workout.exercises.forEach((exercise: any) => {
        exercise.sets
          .filter((set: any) => set.completed !== false && set.setType !== 'warmup')
          .forEach((set: any) => {
            total += calculateSetVolume(set, exercise.type || 'weighted', currentBodyweight);
          });
      });
      return total;
    };

    const sumCumulativeThroughTodayDisplay = (range: { start: number; end: number }): number => {
      const totalsKg = Array(7).fill(0) as number[];
      workouts.forEach((workout: any) => {
        if (workout.startTime < range.start || workout.startTime > range.end) return;
        const dayIdx = getDayIndexInWeek(new Date(workout.startTime), weekStartDay);
        totalsKg[dayIdx] += sumWorkoutVolumeKg(workout);
      });

      let runningKg = 0;
      for (let i = 0; i <= todayIndex; i++) {
        runningKg += totalsKg[i];
      }
      return convertWeight(runningKg, settings.weightUnit);
    };

    const thisThroughToday = sumCumulativeThroughTodayDisplay(thisRange);
    const lastThroughToday = sumCumulativeThroughTodayDisplay(lastRange);
    const delta = thisThroughToday - lastThroughToday;
    const pct = lastThroughToday > 0 ? (delta / lastThroughToday) * 100 : null;

    return {
      todayIndex,
      thisThroughToday,
      lastThroughToday,
      delta,
      pct,
    };
  }, [workouts, currentBodyweight, settings.weightUnit, settings.weekStartDay]);

  const wowDeltaText = useMemo(() => {
    const sign = wowComparison.delta >= 0 ? '+' : '-';
    const absDelta = Math.abs(wowComparison.delta);

    if (wowComparison.pct === null) {
      if (absDelta < 1) return `0 ${settings.weightUnit}`;
      return `${sign}${Math.round(absDelta)} ${settings.weightUnit}`;
    }

    const absPct = Math.abs(wowComparison.pct);
    return `${sign}${Math.round(absPct)}% (${Math.round(absDelta)} ${settings.weightUnit})`;
  }, [wowComparison.delta, wowComparison.pct, settings.weightUnit]);

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={true}>
        <View className="gap-4 pb-6">
          {/* Header */}
          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <View className="gap-1">
                <Text className="text-3xl font-bold text-foreground">Analytics</Text>
                <Text className="text-sm text-muted">
                  {formatDate(weekRange.start)} - {formatDate(weekRange.end)}
                </Text>
              </View>
            </View>

            {/* Quick Stats removed as requested */}
          </View>

          {/* Reorderable Chart Cards */}
          {chartOrder.map((chartId, index) => {
            const isFirst = index === 0;
            const isLast = index === chartOrder.length - 1;

            const renderReorderArrows = () => (
              <View style={{ flexDirection: 'column', marginRight: 8, marginLeft: -4 }}>
                <Pressable
                  onPress={() => handleMoveChartUp(index)}
                  disabled={isFirst}
                  style={({ pressed }) => ({
                    padding: 4,
                    opacity: isFirst ? 0.3 : pressed ? 0.6 : 1,
                  })}
                >
                  <IconSymbol size={16} name="chevron.up" color={isFirst ? colors.muted : colors.foreground} />
                </Pressable>
                <Pressable
                  onPress={() => handleMoveChartDown(index)}
                  disabled={isLast}
                  style={({ pressed }) => ({
                    padding: 4,
                    opacity: isLast ? 0.3 : pressed ? 0.6 : 1,
                  })}
                >
                  <IconSymbol size={16} name="chevron.down" color={isLast ? colors.muted : colors.foreground} />
                </Pressable>
              </View>
            );

            if (chartId === 'bodyWeight') {
              return (
                <Animated.View
                  key={chartId}
                  layout={Platform.OS === 'web' ? undefined : LinearTransition.duration(120)}
                >
                  <Card>
                    <CardHeader>
                      <View className="flex-row items-center">
                        {renderReorderArrows()}
                        <CardTitle className="text-lg flex-1">Body Weight Tracker</CardTitle>
                      </View>
                    </CardHeader>
                    <CardContent className="gap-4">
                      {/* Time Period Selector */}
                      <View className="flex-row gap-2">
                        {(['week', 'month', '6months', 'all'] as TimePeriod[]).map((period) => (
                          <Pressable
                            key={period}
                            onPress={() => setBodyWeightPeriod(period)}
                            style={({ pressed }) => [{
                              flex: 1,
                              paddingVertical: 8,
                              paddingHorizontal: 12,
                              borderRadius: 8,
                              backgroundColor: bodyWeightPeriod === period ? colors.primary : colors.surface,
                              opacity: pressed ? 0.8 : 1,
                            }]}
                          >
                            <Text
                              style={{
                                color: bodyWeightPeriod === period ? colors.background : colors.foreground,
                                fontSize: 12,
                                fontWeight: '600',
                                textAlign: 'center',
                              }}
                            >
                              {period === 'week' ? '7d' : period === 'month' ? '30d' : period === '6months' ? '180d' : 'All'}
                            </Text>
                          </Pressable>
                        ))}
                      </View>

                      {/* Body Weight Line Chart */}
                      {(() => {
                        const getFilteredLogs = () => {
                          const sorted = [...bodyWeightLogs].sort((a, b) => b.timestamp - a.timestamp);
                          let count = sorted.length;
                          if (bodyWeightPeriod === 'week') count = 7;
                          else if (bodyWeightPeriod === 'month') count = 30;
                          else if (bodyWeightPeriod === '6months') count = 180;
                          return sorted.slice(0, count).reverse();
                        };

                        const filteredLogs = getFilteredLogs();
                        const convertedLogs = filteredLogs.map(log => ({
                          ...log,
                          weight: convertWeightBetweenUnits(log.weight, log.unit, settings.weightUnit),
                        }));

                        const weightDataPoints = convertedLogs.map((log) => ({
                          date: new Date(log.timestamp).toISOString().split('T')[0],
                          value: log.weight,
                        }));

                        return convertedLogs.length > 0 ? (
                          <View className="gap-4">
                            <InteractiveLineChart
                              data={convertedLogs.map((log, idx) => ({
                                x: idx,
                                y: log.weight,
                              }))}
                              xLabels={convertedLogs.map((log) => {
                                const date = new Date(log.timestamp);
                                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                              })}
                              yLabel={`Weight (${settings.weightUnit})`}
                              height={250}
                              formatYValue={(v) => v.toFixed(1)}
                              rawDataForRollingAverage={weightDataPoints}
                              calculateRollingAvg={calculateRollingAverage}
                              unit={settings.weightUnit}
                              showSettings={true}
                              initialSettings={chartSettings}
                              onSettingsChange={saveChartSettings}
                            />
                            <View style={{ height: 6 }} />
                          </View>
                        ) : (
                          <Text className="text-sm text-muted text-center py-8">
                            No body weight data available for {bodyWeightPeriod === 'week' ? 'this week' : bodyWeightPeriod === 'month' ? 'this month' : bodyWeightPeriod === '6months' ? 'the last 6 months' : 'all time'}
                          </Text>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </Animated.View>
              );
            }

            if (chartId === 'weeklyStats') {
              const stat = weeklyStats;

              const makeDeltaText = (current: number, last: number, formatAmount: (v: number) => string) => {
                const delta = current - last;
                const sign = delta >= 0 ? '+' : '-';
                const absDelta = Math.abs(delta);
                const pct = last > 0 ? (absDelta / last) * 100 : null;
                const pctText = pct === null ? '—%' : `${sign}${Math.round(pct)}%`;
                return {
                  delta,
                  text: `${sign}${formatAmount(absDelta)} (${pctText})`,
                };
              };

              const volumeDelta = makeDeltaText(stat.current.volume, stat.last.volume, (v) => `${Math.round(convertWeight(v, settings.weightUnit))} ${settings.weightUnit}`);
              const setsDelta = makeDeltaText(stat.current.sets, stat.last.sets, (v) => `${Math.round(v)}`);
              const repsDelta = makeDeltaText(stat.current.reps, stat.last.reps, (v) => `${Math.round(v)}`);
              const workoutsDelta = makeDeltaText(stat.current.workouts, stat.last.workouts, (v) => `${Math.round(v)}`);
              const timeDelta = makeDeltaText(stat.current.gymTimeMs, stat.last.gymTimeMs, (v) => formatDuration(v));
              const favDelta = makeDeltaText(stat.current.favoriteExerciseSets, stat.lastWeekSetsForThisWeeksFavorite, (v) => `${Math.round(v)} sets`);

              const favoriteValue = stat.current.favoriteExerciseName
                ? `${stat.current.favoriteExerciseName} (${stat.current.favoriteExerciseSets} sets)`
                : '—';

              return (
                <Animated.View
                  key={chartId}
                  layout={Platform.OS === 'web' ? undefined : LinearTransition.duration(120)}
                >
                  <Card>
                    <CardHeader>
                      <View className="flex-row items-center">
                        {renderReorderArrows()}
                        <CardTitle className="text-lg flex-1">Weekly Stats</CardTitle>
                      </View>
                      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>
                        Compared to last week
                      </Text>
                    </CardHeader>
                    <CardContent style={{ paddingTop: 0 }}>
                      <WeeklyStatRow
                        label="Workouts"
                        value={`${stat.current.workouts}`}
                        deltaText={workoutsDelta.text}
                        deltaColor={getDeltaColor(workoutsDelta.delta)}
                      />
                      <WeeklyStatRow
                        label={`Volume (${settings.weightUnit})`}
                        value={formatVolume(stat.current.volume, settings.weightUnit)}
                        deltaText={volumeDelta.text}
                        deltaColor={getDeltaColor(volumeDelta.delta)}
                      />
                      <WeeklyStatRow
                        label="Reps"
                        value={`${stat.current.reps}`}
                        deltaText={repsDelta.text}
                        deltaColor={getDeltaColor(repsDelta.delta)}
                      />
                      <WeeklyStatRow
                        label="Sets"
                        value={`${stat.current.sets}`}
                        deltaText={setsDelta.text}
                        deltaColor={getDeltaColor(setsDelta.delta)}
                      />
                      <WeeklyStatRow
                        label="Gym Time"
                        value={formatDuration(stat.current.gymTimeMs)}
                        deltaText={timeDelta.text}
                        deltaColor={getDeltaColor(timeDelta.delta)}
                      />
                      <WeeklyStatRow
                        label="Favorite"
                        value={favoriteValue}
                        deltaText={stat.current.favoriteExerciseName ? favDelta.text : '—'}
                        deltaColor={stat.current.favoriteExerciseName ? getDeltaColor(favDelta.delta) : colors.muted}
                      />
                      <View style={{ height: 1, backgroundColor: 'transparent' }} />
                    </CardContent>
                  </Card>
                </Animated.View>
              );
            }

            if (chartId === 'statsPerMuscle') {
              return (
                <Animated.View
                  key={chartId}
                  layout={Platform.OS === 'web' ? undefined : LinearTransition.duration(120)}
                >
                  <Card>
                    <CardHeader>
                      <View className="flex-row items-center">
                        {renderReorderArrows()}
                        <CardTitle className="text-lg flex-1">Stats per Muscle</CardTitle>
                      </View>
                    </CardHeader>
                    <CardContent>
                      <UnifiedMuscleChart
                        workouts={workouts}
                        customExercises={customExercises as any}
                        predefinedExerciseCustomizations={predefinedExerciseCustomizations}
                        weightUnit={settings.weightUnit}
                        weekStartDay={settings.weekStartDay ?? 1}
                        selectedMusclesForSpider={selectedMusclesForSpider}
                        showSpiderLastWeek={showSpiderLastWeek}
                        onToggleSpiderLastWeek={() => saveSpiderLastWeekSetting(!showSpiderLastWeek)}
                        onOpenMuscleSelection={() => setShowMuscleSelectionModal(true)}
                      />
                    </CardContent>
                  </Card>
                </Animated.View>
              );
            }

            if (chartId === 'muscleMap') {
              return (
                <Animated.View
                  key={chartId}
                  layout={Platform.OS === 'web' ? undefined : LinearTransition.duration(120)}
                >
                  <Card>
                    <CardHeader>
                      <View className="flex-row items-center">
                        {renderReorderArrows()}
                        <CardTitle className="text-lg flex-1">Muscles Worked</CardTitle>
                      </View>
                    </CardHeader>
                    <CardContent>
                      <WorkoutMuscleMap
                        workouts={workouts}
                        customExercises={customExercises}
                        gender={settings.bodyMapGender}
                        predefinedExerciseCustomizations={predefinedExerciseCustomizations}
                      />
                    </CardContent>
                  </Card>
                </Animated.View>
              );
            }

            if (chartId === 'weeklyVolume') {
              return (
                <Animated.View
                  key={chartId}
                  layout={Platform.OS === 'web' ? undefined : LinearTransition.duration(120)}
                >
                  <Card>
                    <CardHeader>
                      <View className="flex-row items-center">
                        {renderReorderArrows()}
                        <CardTitle className="text-lg flex-1">Weekly Volume</CardTitle>
                      </View>
                      <View style={{ gap: 6, marginTop: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                          <Pressable
                            onPress={() => setVolumeChartMode(volumeChartMode === 'wow-cumulative' ? 'per-day' : 'wow-cumulative')}
                            style={({ pressed }) => ({
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 8,
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              borderWidth: 1,
                              borderColor: colors.border,
                              borderRadius: 10,
                              backgroundColor: colors.surface,
                              opacity: pressed ? 0.7 : 1,
                            })}
                          >
                            <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: '600' }}>
                              {volumeChartMode === 'wow-cumulative' ? 'WoW Cumulative Volume' : 'Volume Per Day'}
                            </Text>
                            <Text style={{ color: colors.muted, fontSize: 12 }}>▼</Text>
                          </Pressable>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={{ color: colors.muted, fontSize: 12 }}>
                            {`${Math.round(thisWeekTotalVolumeDisplay)} ${settings.weightUnit} this week`}
                          </Text>
                          <Text
                            style={{
                              color: wowComparison.delta >= 0 ? '#22c55e' : '#ef4444',
                              fontSize: 12,
                              fontWeight: '600',
                            }}
                            numberOfLines={1}
                          >
                            {wowDeltaText}
                          </Text>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 12, minHeight: 20 }}>
                          {volumeChartMode === 'wow-cumulative' && (
                            <>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} />
                                <Text style={{ color: colors.muted, fontSize: 12 }}>This week</Text>
                              </View>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#9CA3AF' }} />
                                <Text style={{ color: colors.muted, fontSize: 12 }}>Last week</Text>
                              </View>
                            </>
                          )}
                        </View>
                      </View>
                    </CardHeader>
                    <CardContent>
                      {volumeChartMode === 'wow-cumulative' ? (
                        <CumulativeWeekVolumeChart 
                          workouts={workouts} 
                          weightUnit={settings.weightUnit} 
                          weekStartDay={settings.weekStartDay ?? 1}
                        />
                      ) : (
                        <VolumePerDayChart
                          data={volumePerDayData}
                          unit={settings.weightUnit}
                          height={250}
                          width={350}
                        />
                      )}
                    </CardContent>
                  </Card>
                </Animated.View>
              );
            }

            return null;
          })}

          {/* Link to exercise details removed */}
        </View>
      </ScrollView>

      {/* Muscle Group Selection Modal */}
      <MuscleGroupSelectionModal
        visible={showMuscleSelectionModal}
        selectedMuscles={selectedMusclesForSpider}
        onClose={() => setShowMuscleSelectionModal(false)}
        onApply={(selected) => {
          setSelectedMusclesForSpider(selected);
          saveSelectedMuscles(selected);
        }}
      />
    </ScreenContainer>
  );
}
