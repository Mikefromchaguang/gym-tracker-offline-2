/**
 * Exercise Detail Screen - View exercise stats and progression
 */

import { ScrollView, View, Text, Pressable, Dimensions, Alert, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { InteractiveLineChart } from '@/components/interactive-line-chart';
import { ScreenContainer } from '@/components/screen-container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useGym } from '@/lib/gym-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PREDEFINED_EXERCISES_WITH_MUSCLES, MuscleGroup, ExerciseType, getExerciseMuscles } from '@/lib/types';
import { PRIMARY_MUSCLE_GROUPS, getMuscleGroupDisplayName } from '@/lib/muscle-groups';
import { useColors } from '@/hooks/use-colors';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { Svg, Line, Circle, Text as SvgText, Polyline } from 'react-native-svg';
import { convertWeight, formatWeight, formatVolume } from '@/lib/unit-conversion';
import { CreateExerciseModal } from '@/components/create-exercise-modal';
import { EditPredefinedExerciseModal } from '@/components/edit-predefined-exercise-modal';
import { ExerciseDetailChartPrefsStorage, ExerciseVolumeStorage, FailureSetStorage } from '@/lib/storage';
import { ExerciseVolumeLog, FailureSetData } from '@/lib/types';
import { TextInput } from 'react-native';
import { calculateRepMaxEstimates, RepMaxEstimate } from '@/lib/rep-max-calculator';
import { calculateRollingAverage } from '@/lib/rolling-average';
import { calculateSetVolume } from '@/lib/volume-calculation';
import { useBodyweight } from '@/hooks/use-bodyweight';

type TimePeriod = 'week' | 'month' | '6months' | 'all';
type VolumeAggregation = 'best_set' | 'avg_set' | 'total_volume' | 'heaviest_weight' | 'weekly_volume' | 'estimated_1rm';

interface ChartDataPoint {
  date: string;
  value: number;
  timestamp: number;
  // Enhanced tooltip data
  weight?: number;
  reps?: number;
  tooltipLabel?: string;
}

export interface ExerciseDetailViewProps {
  /**
   * Override the route param. Used by in-place modals (active workout/template create).
   */
  exerciseName?: string;
  /**
   * If provided, the screen acts like a modal and will call this instead of navigating back.
   */
  onRequestClose?: () => void;
}

export function ExerciseDetailView({ exerciseName: exerciseNameOverride, onRequestClose }: ExerciseDetailViewProps) {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const exerciseNameParam = (params as any)?.exerciseName;
  const {
    workouts,
    settings,
    templates,
    updateTemplate,
    customExercises,
    updateCustomExercise,
    predefinedExerciseCustomizations,
    updatePredefinedExerciseCustomization,
    deletePredefinedExerciseCustomization,
  } = useGym();
  const [statsPeriod, setStatsPeriod] = useState<'all' | 'week'>('all');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('week');
  const [volumeAggregation, setVolumeAggregation] = useState<VolumeAggregation>('best_set');
  const [overlaySettings, setOverlaySettings] = useState({
    showRollingAverage: true,
    rollingAverageWindow: 7,
    showTrendline: false,
  });
  const [chartPrefsLoaded, setChartPrefsLoaded] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPredefinedExercise, setEditingPredefinedExercise] = useState<string | null>(null);
  const [showVolumeHistory, setShowVolumeHistory] = useState(false);
  const [showAddVolumeModal, setShowAddVolumeModal] = useState(false);
  const [showEditVolumeModal, setShowEditVolumeModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ExerciseVolumeLog | null>(null);
  const [manualVolume, setManualVolume] = useState<string>('');
  const [manualDate, setManualDate] = useState<string>('');
  const [volumeHistory, setVolumeHistory] = useState<ExerciseVolumeLog[]>([]);
  const [repMaxView, setRepMaxView] = useState<'table' | 'graph'>('table');
  const [failureSetData, setFailureSetData] = useState<FailureSetData[]>([]);
  const [showAddDataPointModal, setShowAddDataPointModal] = useState(false);
  const [newDataPointWeight, setNewDataPointWeight] = useState('');
  const [newDataPointReps, setNewDataPointReps] = useState('');
  const [selectedFailureMarkerIndex, setSelectedFailureMarkerIndex] = useState<number | null>(null);
  const { bodyWeightKg: bodyWeightKgForCalc } = useBodyweight();

  const exerciseNameStr =
    typeof exerciseNameOverride === 'string'
      ? exerciseNameOverride
      : typeof exerciseNameParam === 'string'
        ? exerciseNameParam
        : '';

  // Get exercise ID
  const exerciseId = useMemo(() => {
    const predefinedExercise = PREDEFINED_EXERCISES_WITH_MUSCLES.find((ex) => ex.name === exerciseNameStr);
    if (predefinedExercise) return predefinedExercise.name;
    
    const customExercise = customExercises.find((ex) => ex.name === exerciseNameStr);
    return customExercise?.id || customExercise?.name || exerciseNameStr;
  }, [exerciseNameStr, customExercises]);

  // Check exercise type
  const exerciseType = useMemo(() => {
    const predefinedExercise = PREDEFINED_EXERCISES_WITH_MUSCLES.find((ex) => ex.name === exerciseNameStr);
    if (predefinedExercise) return predefinedExercise.exerciseType;
    
    const customExercise = customExercises.find((ex) => ex.name === exerciseNameStr);
    return customExercise?.type || 'weighted';
  }, [exerciseNameStr, customExercises]);

  const isBodyweightExercise = exerciseType === 'bodyweight';
  const isWeightedExercise = exerciseType === 'weighted' || exerciseType === 'doubled';

  // Load volume history
  const loadVolumeHistory = useCallback(async () => {
    const logs = await ExerciseVolumeStorage.getForExercise(exerciseId);
    setVolumeHistory(logs);
  }, [exerciseId]);

  // Load failure set data
  const loadFailureSetData = useCallback(async () => {
    const data = await FailureSetStorage.getForExercise(exerciseId);
    setFailureSetData(data);
  }, [exerciseId]);

  // Load volume history on mount
  useEffect(() => {
    loadVolumeHistory();
    loadFailureSetData();
  }, [loadVolumeHistory, loadFailureSetData]);

  // Restore Exercise Details chart preferences (persist across navigation/app restarts)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const prefs = await ExerciseDetailChartPrefsStorage.get();
        if (cancelled || !prefs) {
          if (!cancelled) setChartPrefsLoaded(true);
          return;
        }

        setTimePeriod(prefs.timePeriod);
        setVolumeAggregation(prefs.volumeAggregation);
        setOverlaySettings(prefs.overlays);
      } finally {
        if (!cancelled) setChartPrefsLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Persist Exercise Details chart preferences
  useEffect(() => {
    if (!chartPrefsLoaded) return;
    ExerciseDetailChartPrefsStorage.set({
      timePeriod,
      volumeAggregation,
      overlays: overlaySettings,
    }).catch(() => {
      // Non-fatal; ignore persistence errors
    });
  }, [chartPrefsLoaded, timePeriod, volumeAggregation, overlaySettings]);

  // Reload volume history when page comes into focus (e.g., after completing a workout)
  useFocusEffect(
    useCallback(() => {
      loadVolumeHistory();
      loadFailureSetData();
    }, [loadVolumeHistory, loadFailureSetData])
  );

  const StatRow = ({
    label,
    value,
    onPress,
  }: {
    label: string;
    value: string;
    onPress?: () => void;
  }) => {
    const RowWrap = onPress ? Pressable : View;
    const rowProps: any = onPress
      ? {
          onPress,
          style: ({ pressed }: any) => ({ opacity: pressed ? 0.7 : 1 }),
          hitSlop: 6,
        }
      : {};

    return (
      <RowWrap {...rowProps}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Text style={{ fontSize: 14, color: colors.muted }}>{label}</Text>
          <Text style={{ fontSize: 14, color: colors.foreground, fontWeight: '600' }}>{value}</Text>
        </View>
      </RowWrap>
    );
  };

  // Calculate exercise stats
  const exerciseData = useMemo(() => {
    const getEffectiveWeight = (setWeight: number, exType: ExerciseType | undefined): number => {
      switch (exType) {
        case 'bodyweight':
          return bodyWeightKgForCalc || 0;
        case 'weighted-bodyweight':
          return (bodyWeightKgForCalc || 0) + setWeight;
        case 'assisted-bodyweight':
          return Math.max(0, (bodyWeightKgForCalc || 0) - setWeight);
        case 'weighted':
        case 'doubled':
        default:
          return setWeight;
      }
    };

    const allSets = workouts.flatMap((workout) =>
      workout.exercises
        .filter((ex) => ex.name === exerciseNameStr || (exerciseId && ex.exerciseId === exerciseId))
        .flatMap((ex) =>
          ex.sets
            .filter((set) => set?.completed !== false && set?.setType !== 'warmup' && !!set?.reps)
            .map((set) => ({
              ...set,
              exType: ex.type || exerciseType,
              date: new Date(workout.endTime).toISOString().split('T')[0],
              timestamp: workout.endTime,
            }))
        )
    );

    if (allSets.length === 0) {
      return {
        heaviestWeight: 0,
        estimated1RM: 0,
        bestSetByWeight: { weight: 0, reps: 0 },
        bestSetByVolume: { weight: 0, reps: 0, volume: 0 },
        bestSetByReps: { weight: 0, reps: 0 },
        totalVolumeAllTime: 0,
        totalSetsAllTime: 0,
        chartData: [],
        dailyChartData: [],
        weeklyChartData: [],
        heaviestWeightPrDailyChartData: [],
        allSets: [],
      };
    }

    const totalVolumeAllTime = allSets.reduce((sum, s: any) => {
      return sum + calculateSetVolume(s, s.exType, bodyWeightKgForCalc);
    }, 0);
    const totalSetsAllTime = allSets.length;

    // Heaviest weight
    const heaviestWeight = Math.max(...allSets.map((s: any) => s.weight || 0));

    // Best set (Weight): highest weight, tie-breaker by reps
    const bestSetByWeight = allSets.reduce(
      (best: { weight: number; reps: number }, set: any) => {
        const w = set.weight || 0;
        const r = set.reps || 0;
        if (w > best.weight) return { weight: w, reps: r };
        if (w === best.weight && r > best.reps) return { weight: w, reps: r };
        return best;
      },
      { weight: 0, reps: 0 }
    );

    // Estimated 1RM (Epley). Only meaningful for weighted exercises.
    const estimated1RM = isWeightedExercise
      ? Math.max(...allSets.map((s: any) => (s.weight || 0) * (1 + (s.reps || 0) / 30)))
      : 0;

    // Best set (Volume): highest volume (weight × reps), tie-breaker by weight
    const bestSetByVolume = allSets.reduce(
      (best: { weight: number; reps: number; volume: number }, set: any) => {
        const w = set.weight || 0;
        const r = set.reps || 0;
        const v = w * r;
        if (v > best.volume) return { weight: w, reps: r, volume: v };
        if (v === best.volume && w > best.weight) return { weight: w, reps: r, volume: v };
        return best;
      },
      { weight: 0, reps: 0, volume: 0 }
    );

    // Best set (Reps): highest reps, tie-breaker by weight
    const bestSetByReps = allSets.reduce(
      (best: { weight: number; reps: number }, set: any) => {
        const w = set.weight || 0;
        const r = set.reps || 0;
        if (r > best.reps) return { weight: w, reps: r };
        if (r === best.reps && w > best.weight) return { weight: w, reps: r };
        return best;
      },
      { weight: 0, reps: 0 }
    );

    // Top 5 sets by weight (for improved rep max calculation with recency weighting)
    const topSets = allSets
      .map((set: any) => ({
        weight: set.weight || 0,
        reps: set.reps || 0,
        timestamp: set.timestamp,
      }))
      .sort((a: any, b: any) => b.weight - a.weight || b.reps - a.reps) // Sort by weight desc, then reps desc
      .slice(0, 5); // Take top 5

    // Chart data: use volume history for daily best set
    // Deduplicate by date, keeping the highest volume per date
    const dailyVolumeMap = new Map<string, { value: number; timestamp: number; weight: number; reps: number }>();
    volumeHistory.forEach((log) => {
      const existing = dailyVolumeMap.get(log.date);
      if (!existing || log.volume > existing.value) {
        dailyVolumeMap.set(log.date, { 
          value: log.volume, 
          timestamp: log.timestamp,
          weight: log.weight || 0,
          reps: log.reps || 0,
        });
      }
    });
    
    // Best set / session chart data (with tooltip info)
    const bestSetChartData: ChartDataPoint[] = Array.from(dailyVolumeMap.entries())
      .map(([date, data]) => ({
        date,
        value: data.value,
        timestamp: data.timestamp,
        weight: data.weight,
        reps: data.reps,
        tooltipLabel: `${data.weight} × ${data.reps}`,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    // Group sets by session (workout date) for session-based calculations
    const sessionMap = new Map<string, { sets: any[]; timestamp: number }>();
    allSets.forEach((set: any) => {
      const dateKey = set.date;
      const existing = sessionMap.get(dateKey) || { sets: [], timestamp: set.timestamp };
      existing.sets.push(set);
      sessionMap.set(dateKey, existing);
    });

    // Avg set / session: average weight × average reps for the session
    const avgSetChartData: ChartDataPoint[] = Array.from(sessionMap.entries())
      .map(([date, data]) => {
        const sets = data.sets;
        const avgWeight = sets.reduce((sum, s) => sum + (s.weight || 0), 0) / sets.length;
        const avgReps = sets.reduce((sum, s) => sum + (s.reps || 0), 0) / sets.length;
        const avgVolume = avgWeight * avgReps;
        return {
          date,
          value: avgVolume,
          timestamp: data.timestamp,
          weight: Math.round(avgWeight * 10) / 10,
          reps: Math.round(avgReps * 10) / 10,
          tooltipLabel: `${Math.round(avgWeight * 10) / 10} × ${Math.round(avgReps * 10) / 10}`,
        };
      })
      .sort((a, b) => a.timestamp - b.timestamp);

    // Total volume / session
    const totalVolumeChartData: ChartDataPoint[] = Array.from(sessionMap.entries())
      .map(([date, data]) => {
        const sets = data.sets;
        const totalVolume = sets.reduce((sum, s) => sum + (s.weight || 0) * (s.reps || 0), 0);
        const totalReps = sets.reduce((sum, s) => sum + (s.reps || 0), 0);
        return {
          date,
          value: totalVolume,
          timestamp: data.timestamp,
          weight: undefined,
          reps: totalReps,
          tooltipLabel: `${sets.length} sets • ${totalReps} reps`,
        };
      })
      .sort((a, b) => a.timestamp - b.timestamp);

    // Heaviest weight / session (max weight used in the session)
    const heaviestWeightChartData: ChartDataPoint[] = Array.from(sessionMap.entries())
      .map(([date, data]) => {
        const sets = data.sets;
        let maxWeight = 0;
        let maxReps = 0;
        sets.forEach((s) => {
          const effectiveWeight = getEffectiveWeight(s.weight || 0, s.exType);
          if (effectiveWeight > maxWeight) {
            maxWeight = effectiveWeight;
            maxReps = s.reps || 0;
          }
        });
        return {
          date,
          value: maxWeight,
          timestamp: data.timestamp,
          weight: maxWeight,
          reps: maxReps,
          tooltipLabel: `${maxWeight} × ${maxReps}`,
        };
      })
      .sort((a, b) => a.timestamp - b.timestamp);

    // Estimated 1RM / session (max estimated 1RM from any completed set in the session)
    // Uses effective weight so assisted/weighted-bodyweight sets are comparable.
    const estimated1RMChartData: ChartDataPoint[] = Array.from(sessionMap.entries())
      .map(([date, data]) => {
        const sets = data.sets;
        let best1RM = 0;
        let bestSetWeight = 0;
        let bestSetReps = 0;

        sets.forEach((s) => {
          const reps = s.reps || 0;
          if (!reps) return;
          const effectiveWeight = getEffectiveWeight(s.weight || 0, s.exType);
          if (effectiveWeight <= 0) return;

          const est = reps === 1 ? effectiveWeight : effectiveWeight * (1 + reps / 30);
          if (est > best1RM) {
            best1RM = est;
            bestSetWeight = effectiveWeight;
            bestSetReps = reps;
          }
        });

        return {
          date,
          value: best1RM,
          timestamp: data.timestamp,
          weight: bestSetWeight,
          reps: bestSetReps,
          tooltipLabel: best1RM > 0 ? `Est 1RM: ${Math.round(best1RM * 10) / 10}` : 'No data',
        };
      })
      .filter((d) => d.value > 0)
      .sort((a, b) => a.timestamp - b.timestamp);

    // Calculate weekly total volume from workout data
    const weeklyVolumeMap = new Map<string, { volume: number; timestamp: number; setCount: number; repCount: number }>();
    allSets.forEach((set) => {
      const setDate = new Date(set.timestamp);
      // Get Monday of the week (ISO week)
      const dayOfWeek = setDate.getDay();
      const diff = setDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const monday = new Date(setDate.setDate(diff));
      const weekKey = monday.toISOString().split('T')[0];
      
      const existing = weeklyVolumeMap.get(weekKey) || { volume: 0, timestamp: monday.getTime(), setCount: 0, repCount: 0 };
      existing.volume += set.weight * set.reps;
      existing.setCount += 1;
      existing.repCount += set.reps || 0;
      weeklyVolumeMap.set(weekKey, existing);
    });

    const weeklyVolumeChartData: ChartDataPoint[] = Array.from(weeklyVolumeMap.entries())
      .map(([date, data]) => ({
        date,
        value: data.volume,
        timestamp: data.timestamp,
        weight: undefined,
        reps: data.repCount,
        tooltipLabel: `${data.setCount} sets • ${data.repCount} reps`,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    return {
      heaviestWeight,
      estimated1RM,
      bestSetByWeight,
      bestSetByVolume,
      bestSetByReps,
      topSets, // Top 5 sets for improved rep max calculation
      totalVolumeAllTime,
      totalSetsAllTime,
      bestSetChartData,
      avgSetChartData,
      totalVolumeChartData,
      heaviestWeightChartData,
      weeklyVolumeChartData,
      estimated1RMChartData,
      allSets, // Include all sets for time period filtering
    };
  }, [workouts, exerciseNameStr, exerciseId, volumeHistory, exerciseType, bodyWeightKgForCalc, isWeightedExercise]);

  // Calculate rep max estimates from top 5 sets with recency weighting
  const repMaxEstimates = useMemo(() => {
    if (!exerciseData.estimated1RM || !exerciseData.bestSetByWeight.weight || !exerciseData.bestSetByWeight.reps) {
      return null;
    }

    return calculateRepMaxEstimates(
      {
        oneRepMax: exerciseData.estimated1RM,
        bestSetWeight: exerciseData.bestSetByWeight.weight,
        bestSetReps: exerciseData.bestSetByWeight.reps,
        topSets: exerciseData.topSets,
      },
      undefined
    );
  }, [exerciseData.estimated1RM, exerciseData.bestSetByWeight, exerciseData.topSets]);

  // Get actual failure data points for chart markers (supplements the estimated curve)
  const failureDataMarkers = useMemo(() => {
    return failureSetData.map((data) => ({
      x: data.reps,
      y: convertWeight(data.weight, settings.weightUnit),
      color: colors.error || '#EF4444', // Red for failure points
      timestamp: data.timestamp,
    }));
  }, [failureSetData, settings.weightUnit, colors.error]);

  // Tooltip data for failure markers
  const failureMarkerTooltips = useMemo(() => {
    return failureSetData.map((data) => ({
      value: convertWeight(data.weight, settings.weightUnit),
      hideValue: true,
      title: new Date(data.timestamp).toLocaleDateString(),
      lines: [`${Math.round(convertWeight(data.weight, settings.weightUnit))} × ${data.reps}`],
    }));
  }, [failureSetData, settings.weightUnit]);

  // Handle deleting a failure data point
  const handleDeleteFailureDataPoint = useCallback(async (timestamp: number) => {
    Alert.alert(
      'Delete Data Point',
      'Are you sure you want to remove this failure set data point?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await FailureSetStorage.delete(exerciseId, timestamp);
            await loadFailureSetData();
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          },
        },
      ]
    );
  }, [exerciseId, loadFailureSetData]);

  // Handle adding a manual data point
  const handleAddDataPoint = useCallback(async () => {
    const weight = parseFloat(newDataPointWeight);
    const reps = parseInt(newDataPointReps, 10);

    if (isNaN(weight) || weight <= 0) {
      Alert.alert('Invalid Weight', 'Please enter a valid weight greater than 0.');
      return;
    }
    if (isNaN(reps) || reps <= 0 || reps > 100) {
      Alert.alert('Invalid Reps', 'Please enter a valid rep count between 1 and 100.');
      return;
    }

    // Convert from display unit to kg for storage
    const weightInKg = settings.weightUnit === 'lbs' ? weight / 2.20462 : weight;

    await FailureSetStorage.add(exerciseId, {
      weight: weightInKg,
      reps,
      timestamp: Date.now(),
    });

    await loadFailureSetData();
    setShowAddDataPointModal(false);
    setNewDataPointWeight('');
    setNewDataPointReps('');

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [exerciseId, newDataPointWeight, newDataPointReps, settings.weightUnit, loadFailureSetData]);

  // Handle marker selection from the graph
  const handleFailureMarkerSelect = useCallback((marker: any, index: number | null) => {
    setSelectedFailureMarkerIndex(index);
  }, []);

  // Delete the currently selected failure marker
  const handleDeleteSelectedFailureMarker = useCallback(() => {
    if (selectedFailureMarkerIndex === null) return;
    const failurePoint = failureSetData[selectedFailureMarkerIndex];
    if (!failurePoint) return;
    
    handleDeleteFailureDataPoint(failurePoint.timestamp);
    setSelectedFailureMarkerIndex(null);
  }, [selectedFailureMarkerIndex, failureSetData, handleDeleteFailureDataPoint]);

  const repMaxEstimatesSorted = useMemo(() => {
    if (!repMaxEstimates) return null;
    return [...repMaxEstimates].sort((a, b) => a.reps - b.reps);
  }, [repMaxEstimates]);

  const repMaxChartData = useMemo(() => {
    if (!repMaxEstimatesSorted) return [];
    return repMaxEstimatesSorted.map((estimate) => ({
      x: estimate.reps,
      y: convertWeight(estimate.weight, settings.weightUnit),
    }));
  }, [repMaxEstimatesSorted, settings.weightUnit]);

  const repMaxXLabels = useMemo(() => {
    if (!repMaxEstimatesSorted) return [];
    return repMaxEstimatesSorted.map((e) => `${e.reps}r`);
  }, [repMaxEstimatesSorted]);

  const repMaxTooltipData = useMemo(() => {
    if (!repMaxEstimatesSorted) return [];
    return repMaxEstimatesSorted.map((estimate) => ({
      value: convertWeight(estimate.weight, settings.weightUnit),
      hideValue: true,
      hideTitle: true,
      lines: [`${Math.round(convertWeight(estimate.weight, settings.weightUnit))} ${settings.weightUnit} × ${estimate.reps}`],
    }));
  }, [repMaxEstimatesSorted, settings.weightUnit]);

  const thisWeekStats = useMemo(() => {
    const now = new Date();
    const d = new Date(now);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    const weekStart = d.getTime();
    const weekEnd = weekStart + 7 * 24 * 60 * 60 * 1000;

    const weekSets = (exerciseData.allSets || []).filter((s: any) => s.timestamp >= weekStart && s.timestamp < weekEnd);

    const totalVolume = weekSets.reduce((sum: number, s: any) => {
      return sum + calculateSetVolume(s, s.exType, bodyWeightKgForCalc);
    }, 0);

    const bestSetByWeight = weekSets.reduce(
      (best: { weight: number; reps: number }, set: any) => {
        const w = set.weight || 0;
        const r = set.reps || 0;
        if (w > best.weight) return { weight: w, reps: r };
        if (w === best.weight && r > best.reps) return { weight: w, reps: r };
        return best;
      },
      { weight: 0, reps: 0 }
    );

    const bestSetByVolume = weekSets.reduce(
      (best: { weight: number; reps: number; volume: number }, set: any) => {
        const w = set.weight || 0;
        const r = set.reps || 0;
        const v = w * r;
        if (v > best.volume) return { weight: w, reps: r, volume: v };
        if (v === best.volume && w > best.weight) return { weight: w, reps: r, volume: v };
        return best;
      },
      { weight: 0, reps: 0, volume: 0 }
    );

    const bestSetByReps = weekSets.reduce(
      (best: { weight: number; reps: number }, set: any) => {
        const w = set.weight || 0;
        const r = set.reps || 0;
        if (r > best.reps) return { weight: w, reps: r };
        if (r === best.reps && w > best.weight) return { weight: w, reps: r };
        return best;
      },
      { weight: 0, reps: 0 }
    );

    const heaviestWeight = weekSets.length > 0 ? Math.max(...weekSets.map((s: any) => s.weight || 0)) : 0;

    return {
      totalSets: weekSets.length,
      totalVolume,
      heaviestWeight,
      bestSetByWeight,
      bestSetByVolume,
      bestSetByReps,
    };
  }, [exerciseData.allSets, bodyWeightKgForCalc]);

  // Filter data by time period and calculate chart data
  const filteredData = useMemo(() => {
    // Select chart data based on aggregation mode
    let sourceData: ChartDataPoint[];
    switch (volumeAggregation) {
      case 'best_set':
        sourceData = exerciseData.bestSetChartData || [];
        break;
      case 'avg_set':
        sourceData = exerciseData.avgSetChartData || [];
        break;
      case 'total_volume':
        sourceData = exerciseData.totalVolumeChartData || [];
        break;
      case 'heaviest_weight':
        sourceData = exerciseData.heaviestWeightChartData || [];
        break;
      case 'weekly_volume':
        sourceData = exerciseData.weeklyVolumeChartData || [];
        break;
      case 'estimated_1rm':
        sourceData = (exerciseData as any).estimated1RMChartData || [];
        break;
      default:
        sourceData = exerciseData.bestSetChartData || [];
    }

    const sortedDesc = [...(sourceData || [])].sort((a, b) => b.timestamp - a.timestamp);
    let count = sortedDesc.length;
    // Note: chart is session-based (each point is a session), so these are session counts.
    if (timePeriod === 'week') count = 5;
    else if (timePeriod === 'month') count = 10;
    else if (timePeriod === '6months') count = 25;

    const filteredChartData = sortedDesc.slice(0, count).reverse();
    
    // Calculate rolling average (4-week window for weekly, 7-day for others)
    const windowSize = volumeAggregation === 'weekly_volume' ? 4 : 7;
    const seriesDataPoints = filteredChartData.map((d) => ({
      date: d.date,
      value: d.value,
    }));
    const rollingAvg = calculateRollingAverage(seriesDataPoints, windowSize);
    const rollingAvgData = rollingAvg.map((avg, idx) => ({
      x: idx,
      y: avg.value,
    }));
    
    return {
      chartData: filteredChartData,
      rollingAvgData,
    };
  }, [exerciseData, timePeriod, volumeAggregation]);

  const getProgressionModeLabel = (mode: VolumeAggregation) => {
    switch (mode) {
      case 'best_set':
        return 'Best Set / Session';
      case 'avg_set':
        return 'Avg Set / Session';
      case 'total_volume':
        return 'Total Volume / Session';
      case 'heaviest_weight':
        return 'Heaviest Weight / Session';
      case 'weekly_volume':
        return 'Total Volume / Week';
      case 'estimated_1rm':
        return '1RM / Session';
    }
  };

  const cycleProgressionMode = () => {
    setVolumeAggregation((prev) => {
      const modes: VolumeAggregation[] = ['best_set', 'avg_set', 'total_volume', 'heaviest_weight', 'estimated_1rm', 'weekly_volume'];
      const currentIndex = modes.indexOf(prev);
      const nextIndex = (currentIndex + 1) % modes.length;
      return modes[nextIndex];
    });
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleBack = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (onRequestClose) {
      onRequestClose();
      return;
    }
    router.back();
  };

  const handleTimePeriodChange = (period: TimePeriod) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setTimePeriod(period);
  };

  // Use centralized muscle groups
  const MUSCLE_GROUPS: MuscleGroup[] = PRIMARY_MUSCLE_GROUPS;

  const hasMuscleCustomization = useCallback((name: string) => {
    const customization = (predefinedExerciseCustomizations as any)[name];
    if (!customization) return false;
    return (
      customization.primaryMuscle != null ||
      (Array.isArray(customization.secondaryMuscles) && customization.secondaryMuscles.length > 0) ||
      (customization.muscleContributions != null &&
        typeof customization.muscleContributions === 'object' &&
        Object.keys(customization.muscleContributions).length > 0)
    );
  }, [predefinedExerciseCustomizations]);

  // Check if exercise is custom or predefined
  const currentExercise = useMemo(() => {
    if (!exerciseNameStr) return null;
    
    // First check custom exercises
    const custom = customExercises?.find(ex => ex.name === exerciseNameStr);
    if (custom) return { ...custom, isCustom: true, isModified: false };
    
    // Then check predefined exercises
    const predefined = PREDEFINED_EXERCISES_WITH_MUSCLES.find(ex => 
      ex.name.toLowerCase() === exerciseNameStr.toLowerCase()
    );
    if (predefined) {
      return { 
        ...predefined, 
        isCustom: false, 
        isModified: hasMuscleCustomization(exerciseNameStr),
      };
    }
    
    return null;
  }, [exerciseNameStr, customExercises, hasMuscleCustomization, predefinedExerciseCustomizations]);

  const handleResetToDefault = () => {
    Alert.alert(
      'Reset to Default',
      'This will remove all your customizations and restore the default settings for this exercise.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePredefinedExerciseCustomization(exerciseNameStr);
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
              // Go back to exercises list (or close modal)
              if (onRequestClose) {
                onRequestClose();
              } else {
                router.back();
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to reset exercise to default');
            }
          },
        },
      ]
    );
  };

  const handleOpenEditModal = () => {
    if (!currentExercise) return;
    setShowEditModal(true);
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleSaveEdit = async (exerciseData: {
    name: string;
    primaryMuscle: MuscleGroup;
    secondaryMuscles: MuscleGroup[];
    type: ExerciseType;
    muscleContributions: Record<MuscleGroup, number>;
    preferredAutoProgressionMinReps?: number;
    preferredAutoProgressionMaxReps?: number;
  }, options?: { preferredRangeApplyMode?: 'new-only' | 'existing-templates' }) => {
    const existingCustomExercise = customExercises.find((ex) => ex.name === exerciseNameStr);
    const prevPreferredMin = existingCustomExercise?.preferredAutoProgressionMinReps;
    const prevPreferredMax = existingCustomExercise?.preferredAutoProgressionMaxReps;
    const nextPreferredMin = exerciseData.preferredAutoProgressionMinReps;
    const nextPreferredMax = exerciseData.preferredAutoProgressionMaxReps;

    await updateCustomExercise(exerciseNameStr, {
      id: existingCustomExercise?.id,
      name: exerciseData.name,
      primaryMuscle: exerciseData.primaryMuscle,
      secondaryMuscles: exerciseData.secondaryMuscles,
      exerciseType: exerciseData.type,
      muscleContributions: exerciseData.muscleContributions,
      preferredAutoProgressionMinReps: exerciseData.preferredAutoProgressionMinReps,
      preferredAutoProgressionMaxReps: exerciseData.preferredAutoProgressionMaxReps,
    });

    const preferredChanged = prevPreferredMin !== nextPreferredMin || prevPreferredMax !== nextPreferredMax;

    if (preferredChanged && options?.preferredRangeApplyMode === 'existing-templates') {
      const linkedCount = templates.reduce((acc, template) => {
        const matches = template.exercises.filter(
          (ex) =>
            ex.name.toLowerCase() === exerciseNameStr.toLowerCase() ||
            ex.name.toLowerCase() === exerciseData.name.toLowerCase() ||
            (existingCustomExercise?.id ? ex.exerciseId === existingCustomExercise.id : false)
        ).length;
        return acc + matches;
      }, 0);

      if (linkedCount > 0) {
        const hasPreferred =
          typeof nextPreferredMin === 'number' && typeof nextPreferredMax === 'number';

        for (const template of templates) {
          let changed = false;
          const nextExercises = template.exercises.map((ex) => {
            const isMatch =
              ex.name.toLowerCase() === exerciseNameStr.toLowerCase() ||
              ex.name.toLowerCase() === exerciseData.name.toLowerCase() ||
              (existingCustomExercise?.id ? ex.exerciseId === existingCustomExercise.id : false);

            if (!isMatch) return ex;
            changed = true;

            return {
              ...ex,
              autoProgressionMinReps: hasPreferred
                ? nextPreferredMin
                : settings.defaultAutoProgressionMinReps,
              autoProgressionMaxReps: hasPreferred
                ? nextPreferredMax
                : settings.defaultAutoProgressionMaxReps,
              autoProgressionUseDefaultRange: !hasPreferred,
              autoProgressionUsePreferredRange: hasPreferred,
            };
          });

          if (changed) {
            await updateTemplate({ ...template, exercises: nextExercises });
          }
        }
      }
    }

    // If shown as an in-place modal, just close.
    if (onRequestClose) {
      onRequestClose();
      return;
    }

    // Route screen behavior: navigate back and then to the new exercise name
    router.back();
    setTimeout(() => {
      router.push({
        pathname: '/_hidden/exercises/[exerciseName]',
        params: { exerciseName: exerciseData.name },
      });
    }, 100);
  };

  const handleAddManualVolume = async () => {
    const volume = parseFloat(manualVolume);
    if (isNaN(volume) || volume <= 0) {
      Alert.alert('Invalid Volume', 'Please enter a valid volume');
      return;
    }

    if (!manualDate) {
      Alert.alert('Invalid Date', 'Please enter a date');
      return;
    }

    try {
      const newEntry: ExerciseVolumeLog = {
        exerciseId,
        date: manualDate,
        volume,
        reps: 0, // Manual entries don't have reps/weight breakdown
        weight: 0,
        unit: settings.weightUnit,
        timestamp: new Date(manualDate).getTime(),
        source: 'manual',
      };

      await ExerciseVolumeStorage.save(newEntry);
      await loadVolumeHistory();
      setShowAddVolumeModal(false);
      setManualVolume('');
      setManualDate('');
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to add volume entry');
    }
  };

  const handleEditVolume = (entry: ExerciseVolumeLog) => {
    setEditingEntry(entry);
    setManualVolume(entry.volume.toString());
    setManualDate(entry.date);
    setShowEditVolumeModal(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleSaveEditVolume = async () => {
    if (!editingEntry) return;

    const volume = parseFloat(manualVolume);
    if (isNaN(volume) || volume <= 0) {
      Alert.alert('Invalid Volume', 'Please enter a valid volume');
      return;
    }

    if (!manualDate) {
      Alert.alert('Invalid Date', 'Please enter a date');
      return;
    }

    try {
      const updatedEntry: ExerciseVolumeLog = {
        ...editingEntry,
        date: manualDate,
        volume,
        timestamp: editingEntry.timestamp,
        source: 'manual',
      };

      await ExerciseVolumeStorage.update(editingEntry.timestamp, updatedEntry);
      await loadVolumeHistory();
      setShowEditVolumeModal(false);
      setEditingEntry(null);
      setManualVolume('');
      setManualDate('');
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update volume entry');
    }
  };

  const handleDeleteVolume = async (timestamp: number) => {
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this volume entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await ExerciseVolumeStorage.delete(timestamp);
              await loadVolumeHistory();
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete volume entry');
            }
          },
        },
      ]
    );
  };

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={true}>
        <View className="gap-6 pb-6">
          {/* Header */}
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={handleBack}
              style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
            >
              <IconSymbol size={28} name={onRequestClose ? 'xmark.circle.fill' : 'chevron.left'} color={colors.foreground} />
            </Pressable>
            <View className="flex-1">
              <Text className="text-2xl font-bold text-foreground">{exerciseNameStr}</Text>
            </View>
            {currentExercise && (
              <Pressable
                onPress={() => {
                  if (currentExercise?.isCustom) {
                    setShowEditModal(true);
                  } else {
                    setEditingPredefinedExercise(exerciseNameStr);
                  }
                }}
                style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, padding: 4 }]}
              >
                <IconSymbol size={24} name="pencil" color={colors.primary} />
              </Pressable>
            )}
          </View>

          {/* Stats (All Time / This Week) */}
          <Card>
            <CardHeader>
              <View className="flex-row items-center justify-between gap-3">
                <CardTitle className="text-base">Stats</CardTitle>
                <View className="flex-row overflow-hidden rounded-lg" style={{ backgroundColor: colors.surface }}>
                  <Pressable
                    onPress={() => {
                      setStatsPeriod('all');
                      if (Platform.OS !== 'web') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                    }}
                    style={({ pressed }) => [{
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      backgroundColor: statsPeriod === 'all' ? colors.primary : 'transparent',
                      opacity: pressed ? 0.85 : 1,
                    }]}
                  >
                    <Text style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: statsPeriod === 'all' ? colors.background : colors.foreground,
                    }}>All Time</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setStatsPeriod('week');
                      if (Platform.OS !== 'web') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                    }}
                    style={({ pressed }) => [{
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      backgroundColor: statsPeriod === 'week' ? colors.primary : 'transparent',
                      opacity: pressed ? 0.85 : 1,
                    }]}
                  >
                    <Text style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: statsPeriod === 'week' ? colors.background : colors.foreground,
                    }}>This Week</Text>
                  </Pressable>
                </View>
              </View>
            </CardHeader>
            <CardContent style={{ paddingTop: 0 }}>
              <StatRow
                label="Total volume"
                value={
                  statsPeriod === 'all'
                    ? formatVolume(exerciseData.totalVolumeAllTime || 0, settings.weightUnit)
                    : formatVolume(thisWeekStats.totalVolume || 0, settings.weightUnit)
                }
              />
              <StatRow
                label="Total sets"
                value={statsPeriod === 'all' ? `${exerciseData.totalSetsAllTime || 0}` : `${thisWeekStats.totalSets || 0}`}
              />
              <StatRow
                label={`Heaviest weight (${settings.weightUnit})`}
                value={
                  statsPeriod === 'all'
                    ? `${Math.round(convertWeight(exerciseData.heaviestWeight || 0, settings.weightUnit))}`
                    : `${Math.round(convertWeight(thisWeekStats.heaviestWeight || 0, settings.weightUnit))}`
                }
              />
              <StatRow
                label="Best set (Weight)"
                value={(() => {
                  const best = statsPeriod === 'all' ? exerciseData.bestSetByWeight : thisWeekStats.bestSetByWeight;
                  return (best?.weight || 0) > 0 || (best?.reps || 0) > 0
                    ? `${Math.round(convertWeight(best?.weight || 0, settings.weightUnit))} ${settings.weightUnit} × ${best?.reps || 0} reps`
                    : '—';
                })()}
              />
              <StatRow
                label="Best set (Volume)"
                value={(() => {
                  const best = statsPeriod === 'all' ? exerciseData.bestSetByVolume : thisWeekStats.bestSetByVolume;
                  return (best?.volume || 0) > 0
                    ? `${Math.round(convertWeight(best?.weight || 0, settings.weightUnit))} ${settings.weightUnit} × ${best?.reps || 0} reps (${formatVolume(best?.volume || 0, settings.weightUnit)})`
                    : '—';
                })()}
              />
              <StatRow
                label="Best set (Reps)"
                value={(() => {
                  const best = statsPeriod === 'all' ? exerciseData.bestSetByReps : thisWeekStats.bestSetByReps;
                  return (best?.reps || 0) > 0
                    ? `${Math.round(convertWeight(best?.weight || 0, settings.weightUnit))} ${settings.weightUnit} × ${best?.reps || 0} reps`
                    : '—';
                })()}
              />
              <View style={{ height: 1, backgroundColor: 'transparent' }} />
            </CardContent>
          </Card>

          {/* Rep Maxes */}
          {isWeightedExercise && (
            <Card>
              <CardHeader>
                <View className="flex-row items-center justify-between">
                  <CardTitle className="text-base">Est Rep Maxes ({settings.weightUnit})</CardTitle>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable
                      onPress={() => {
                        setShowAddDataPointModal(true);
                        if (Platform.OS !== 'web') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }
                      }}
                      style={({ pressed }) => ({
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 999,
                        backgroundColor: colors.primary,
                        opacity: pressed ? 0.8 : 1,
                      })}
                    >
                      <Text style={{ color: colors.background, fontSize: 12, fontWeight: '600' }}>+ Add</Text>
                    </Pressable>
                  </View>
                </View>
              </CardHeader>
              <CardContent style={{ paddingTop: 0 }}>
                {!repMaxEstimates ? (
                  /* Empty State - no workout data yet */
                  <View style={{ paddingVertical: 24, alignItems: 'center', gap: 8 }}>
                    <IconSymbol name="target" size={32} color={colors.muted} />
                    <Text style={{ color: colors.muted, fontSize: 14, textAlign: 'center', maxWidth: 280 }}>
                      Complete workouts to see estimated rep maxes
                    </Text>
                  </View>
                ) : (
                  <>
                    <InteractiveLineChart
                      data={repMaxChartData}
                      xLabels={repMaxXLabels}
                      yLabel={`Weight (${settings.weightUnit})`}
                      height={220}
                      formatYValue={(v) => v.toFixed(0)}
                      tooltipData={repMaxTooltipData}
                      markers={failureDataMarkers}
                      markerTooltips={failureMarkerTooltips}
                      showSettings={false}
                      initialSettings={{ showRollingAverage: false, showTrendline: false }}
                      smoothCurve
                      onMarkerSelect={handleFailureMarkerSelect}
                    />
                    {/* Data point legend */}
                    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />
                        <Text style={{ color: colors.muted, fontSize: 11 }}>Estimated</Text>
                      </View>
                      {failureSetData.length > 0 && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.error || '#EF4444' }} />
                          <Text style={{ color: colors.muted, fontSize: 11 }}>Actual</Text>
                        </View>
                      )}
                    </View>
                    {/* Delete selected point button */}
                    {selectedFailureMarkerIndex !== null && failureSetData[selectedFailureMarkerIndex] && (
                      <Pressable
                        onPress={handleDeleteSelectedFailureMarker}
                        style={{
                          marginTop: 12,
                          paddingVertical: 8,
                          paddingHorizontal: 16,
                          backgroundColor: colors.destructive || '#EF4444',
                          borderRadius: 8,
                          alignSelf: 'center',
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <IconSymbol name="trash" size={14} color="#FFFFFF" />
                        <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>
                          Delete Selected Point
                        </Text>
                      </Pressable>
                    )}
                  </>
                )}
                <View style={{ height: 1, backgroundColor: 'transparent' }} />
              </CardContent>
            </Card>
          )}

          {/* Progressions Chart */}
          <Card>
            <CardHeader>
              <View className="flex-row items-center justify-between">
                <CardTitle className="text-base">Progressions</CardTitle>
              </View>
            </CardHeader>
            <CardContent className="gap-4">
              {/* Range Selector (match Body Weight Tracker) */}
              <View className="flex-row gap-2">
                {(['week', 'month', '6months', 'all'] as TimePeriod[]).map((period) => (
                  <Pressable
                    key={period}
                    onPress={() => handleTimePeriodChange(period)}
                    style={({ pressed }) => [{
                      flex: 1,
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 8,
                      backgroundColor: timePeriod === period ? colors.primary : colors.surface,
                      opacity: pressed ? 0.8 : 1,
                    }]}
                  >
                    <Text
                      style={{
                        color: timePeriod === period ? colors.background : colors.foreground,
                        fontSize: 12,
                        fontWeight: '600',
                        textAlign: 'center',
                      }}
                    >
                      {period === 'week' ? 'Last 5' : period === 'month' ? 'Last 10' : period === '6months' ? 'Last 25' : 'All'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Progression selector (dropdown-style) */}
              <View>
                <Pressable
                  onPress={cycleProgressionMode}
                  style={({ pressed }) => [{
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    opacity: pressed ? 0.8 : 1,
                  }]}
                >
                  <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '600' }}>
                    {getProgressionModeLabel(volumeAggregation)}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>▼</Text>
                </Pressable>
              </View>

              {filteredData.chartData.length > 0 ? (
                <InteractiveLineChart
                  data={filteredData.chartData.map((d, idx) => ({
                    x: idx,
                    y: convertWeight(d.value, settings.weightUnit),
                  }))}
                  xLabels={filteredData.chartData.map((d) => d.date)}
                  yLabel={
                    volumeAggregation === 'heaviest_weight' || volumeAggregation === 'estimated_1rm'
                      ? `Weight (${settings.weightUnit})`
                      : `Volume (${settings.weightUnit})`
                  }
                  height={250}
                  formatYValue={(v) => v.toFixed(1)}
                  tooltipData={filteredData.chartData.map((d) => ({
                    value: convertWeight(d.value, settings.weightUnit),
                    title: d.date,
                    lines: (() => {
                      const lines: string[] = [];
                      const reps = (d as any).reps;
                      const weight = (d as any).weight;

                      if (typeof weight === 'number' && typeof reps === 'number' && reps > 0) {
                        lines.push(`${Math.round(convertWeight(weight, settings.weightUnit))} ${settings.weightUnit} × ${reps}`);
                      } else if (d.tooltipLabel) {
                        lines.push(d.tooltipLabel);
                      }

                      if (volumeAggregation === 'estimated_1rm') {
                        const oneRm = convertWeight(d.value, settings.weightUnit);
                        if (oneRm > 0) lines.push(`Est 1RM: ${Math.round(oneRm)} ${settings.weightUnit}`);
                      }

                      if (volumeAggregation === 'heaviest_weight') {
                        const vol = typeof weight === 'number' && typeof reps === 'number' ? weight * reps : 0;
                        if (vol > 0) lines.push(`Vol: ${formatVolume(vol, settings.weightUnit)}`);
                      }

                      return lines;
                    })(),
                  }))}
                  rawDataForRollingAverage={filteredData.chartData.map((d) => ({
                    date: d.date,
                    value: convertWeight(d.value, settings.weightUnit),
                  }))}
                  calculateRollingAvg={(data, window) => calculateRollingAverage(data, window)}
                  rollingAverageData={filteredData.rollingAvgData.map((d) => ({
                    x: d.x,
                    y: convertWeight(d.y, settings.weightUnit),
                  }))}
                  rollingAverageLabel={'7-day avg'}
                  initialSettings={overlaySettings}
                  onSettingsChange={setOverlaySettings}
                  unit={settings.weightUnit}
                />
              ) : (
                <View className="items-center justify-center py-8">
                  <Text className="text-base text-muted">No data for this period</Text>
                </View>
              )}
            </CardContent>
          </Card>
        </View>
      </ScrollView>

      {/* Edit Exercise Modal */}
      <CreateExerciseModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSave={handleSaveEdit}
        mode="edit"
        existingExercise={currentExercise ? {
          name: currentExercise.name,
          primaryMuscle: currentExercise.primaryMuscle || 'chest',
          secondaryMuscles: currentExercise.secondaryMuscles || [],
          type: currentExercise.exerciseType || 'weighted',
          muscleContributions: (currentExercise.muscleContributions || {}) as Record<MuscleGroup, number>,
        } : undefined}
      />

      {/* Volume History Modal */}
      <Modal
        visible={showVolumeHistory}
        transparent
        animationType="slide"
        onRequestClose={() => setShowVolumeHistory(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ 
            backgroundColor: colors.background, 
            borderTopLeftRadius: 16, 
            borderTopRightRadius: 16, 
            maxHeight: '70%',
            paddingBottom: Math.max(insets.bottom, 16)
          }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: 18, fontWeight: '600', color: colors.foreground }}>Volume History</Text>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <Pressable
                  onPress={() => {
                    setManualDate(new Date().toISOString().split('T')[0]);
                    setManualVolume('');
                    setShowAddVolumeModal(true);
                  }}
                  style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, padding: 4 }]}
                >
                  <IconSymbol size={24} name="plus.circle.fill" color={colors.primary} />
                </Pressable>
                <Pressable
                  onPress={() => setShowVolumeHistory(false)}
                  style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, padding: 4 }]}
                >
                  <Text style={{ fontSize: 16, color: colors.primary }}>Close</Text>
                </Pressable>
              </View>
            </View>

            {/* History List */}
            <ScrollView style={{ flexGrow: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
              {volumeHistory.length > 0 ? (
                <View style={{ padding: 16, gap: 12 }}>
                  {volumeHistory.map((entry, index) => (
                    <View
                      key={index}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: 12,
                        backgroundColor: colors.surface,
                        borderRadius: 8,
                      }}
                    >
                      <Text style={{ fontSize: 14, color: colors.muted }}>
                        {new Date(entry.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.foreground }}>
                          {Math.round(convertWeight(entry.volume, settings.weightUnit))} {settings.weightUnit}
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <Pressable
                            onPress={() => handleEditVolume(entry)}
                            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, padding: 4 }]}
                          >
                            <IconSymbol size={20} name="pencil" color={colors.primary} />
                          </Pressable>
                          <Pressable
                            onPress={() => handleDeleteVolume(entry.timestamp)}
                            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, padding: 4 }]}
                          >
                            <IconSymbol size={20} name="trash" color={colors.error} />
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={{ padding: 32, alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, color: colors.muted }}>No volume history yet</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Volume Modal */}
      <Modal
        visible={showAddVolumeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddVolumeModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <View style={{ backgroundColor: colors.background, borderRadius: 16, padding: 20, width: '100%', maxWidth: 400, gap: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.foreground }}>Add Volume Entry</Text>
            
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 14, color: colors.muted }}>Date</Text>
              <TextInput
                value={manualDate}
                onChangeText={setManualDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.muted}
                style={{
                  height: 48,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  fontSize: 16,
                  color: colors.foreground,
                  backgroundColor: colors.surface,
                }}
              />
            </View>

            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 14, color: colors.muted }}>Volume ({settings.weightUnit})</Text>
              <TextInput
                value={manualVolume}
                onChangeText={setManualVolume}
                placeholder="0"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                style={{
                  height: 48,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  fontSize: 16,
                  color: colors.foreground,
                  backgroundColor: colors.surface,
                }}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <Pressable
                onPress={() => setShowAddVolumeModal(false)}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    height: 48,
                    backgroundColor: colors.surface,
                    borderRadius: 8,
                    justifyContent: 'center',
                    alignItems: 'center',
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.foreground }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleAddManualVolume}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    height: 48,
                    backgroundColor: colors.primary,
                    borderRadius: 8,
                    justifyContent: 'center',
                    alignItems: 'center',
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.background }}>Add</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Volume Modal */}
      <Modal
        visible={showEditVolumeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditVolumeModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <View style={{ backgroundColor: colors.background, borderRadius: 16, padding: 20, width: '100%', maxWidth: 400, gap: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.foreground }}>Edit Volume Entry</Text>
            
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 14, color: colors.muted }}>Date</Text>
              <TextInput
                value={manualDate}
                onChangeText={setManualDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.muted}
                style={{
                  height: 48,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  fontSize: 16,
                  color: colors.foreground,
                  backgroundColor: colors.surface,
                }}
              />
            </View>

            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 14, color: colors.muted }}>Volume ({settings.weightUnit})</Text>
              <TextInput
                value={manualVolume}
                onChangeText={setManualVolume}
                placeholder="0"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                style={{
                  height: 48,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  fontSize: 16,
                  color: colors.foreground,
                  backgroundColor: colors.surface,
                }}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <Pressable
                onPress={() => setShowEditVolumeModal(false)}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    height: 48,
                    backgroundColor: colors.surface,
                    borderRadius: 8,
                    justifyContent: 'center',
                    alignItems: 'center',
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.foreground }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveEditVolume}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    height: 48,
                    backgroundColor: colors.primary,
                    borderRadius: 8,
                    justifyContent: 'center',
                    alignItems: 'center',
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.background }}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Data Point Modal */}
      <Modal
        visible={showAddDataPointModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddDataPointModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <View style={{ backgroundColor: colors.background, borderRadius: 16, padding: 20, width: '100%', maxWidth: 400, gap: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.foreground }}>Add Rep Max Data Point</Text>
            <Text style={{ fontSize: 14, color: colors.muted }}>
              Enter the weight you lifted to failure at a specific rep count.
            </Text>
            
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 14, color: colors.muted }}>Reps</Text>
              <TextInput
                value={newDataPointReps}
                onChangeText={setNewDataPointReps}
                placeholder="e.g., 5"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                autoFocus
                style={{
                  height: 48,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  fontSize: 16,
                  color: colors.foreground,
                  backgroundColor: colors.surface,
                }}
              />
            </View>

            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 14, color: colors.muted }}>Weight ({settings.weightUnit})</Text>
              <TextInput
                value={newDataPointWeight}
                onChangeText={setNewDataPointWeight}
                placeholder="e.g., 225"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                style={{
                  height: 48,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  fontSize: 16,
                  color: colors.foreground,
                  backgroundColor: colors.surface,
                }}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <Pressable
                onPress={() => {
                  setShowAddDataPointModal(false);
                  setNewDataPointWeight('');
                  setNewDataPointReps('');
                }}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    height: 48,
                    backgroundColor: colors.surface,
                    borderRadius: 8,
                    justifyContent: 'center',
                    alignItems: 'center',
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.foreground }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleAddDataPoint}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    height: 48,
                    backgroundColor: colors.primary,
                    borderRadius: 8,
                    justifyContent: 'center',
                    alignItems: 'center',
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.background }}>Add</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Custom Exercise Modal */}
      <CreateExerciseModal
        visible={showEditModal && currentExercise?.isCustom}
        onClose={() => setShowEditModal(false)}
        onSave={handleSaveEdit}
        mode="edit"
        defaultPreferredMinReps={settings.defaultAutoProgressionMinReps}
        defaultPreferredMaxReps={settings.defaultAutoProgressionMaxReps}
        existingExercise={{
          name: currentExercise?.name || '',
          primaryMuscle: currentExercise?.primaryMuscle || 'chest',
          secondaryMuscles: currentExercise?.secondaryMuscles || [],
          type: currentExercise?.exerciseType || 'weighted',
          muscleContributions: currentExercise?.muscleContributions || {},
          preferredAutoProgressionMinReps: currentExercise?.preferredAutoProgressionMinReps,
          preferredAutoProgressionMaxReps: currentExercise?.preferredAutoProgressionMaxReps,
        }}
      />

      {/* Edit Predefined Exercise Modal */}
      <EditPredefinedExerciseModal
        visible={!!editingPredefinedExercise}
        onClose={() => setEditingPredefinedExercise(null)}
        onSave={async (customization, options) => {
          if (editingPredefinedExercise) {
            const previous = predefinedExerciseCustomizations[editingPredefinedExercise];
            const prevPreferredMin = previous?.preferredAutoProgressionMinReps;
            const prevPreferredMax = previous?.preferredAutoProgressionMaxReps;
            const nextPreferredMin = customization.preferredAutoProgressionMinReps;
            const nextPreferredMax = customization.preferredAutoProgressionMaxReps;
            await updatePredefinedExerciseCustomization(editingPredefinedExercise, customization);

            const preferredChanged =
              prevPreferredMin !== nextPreferredMin || prevPreferredMax !== nextPreferredMax;

            if (preferredChanged && options?.preferredRangeApplyMode === 'existing-templates') {
              const predefined = PREDEFINED_EXERCISES_WITH_MUSCLES.find(
                (ex) => ex.name.toLowerCase() === editingPredefinedExercise.toLowerCase()
              );

              const linkedCount = templates.reduce((acc, template) => {
                const matches = template.exercises.filter(
                  (ex) =>
                    ex.name.toLowerCase() === editingPredefinedExercise.toLowerCase() ||
                    (predefined?.id ? ex.exerciseId === predefined.id : false)
                ).length;
                return acc + matches;
              }, 0);

              if (linkedCount > 0) {
                const hasPreferred =
                  typeof nextPreferredMin === 'number' && typeof nextPreferredMax === 'number';

                for (const template of templates) {
                  let changed = false;
                  const nextExercises = template.exercises.map((ex) => {
                    const isMatch =
                      ex.name.toLowerCase() === editingPredefinedExercise.toLowerCase() ||
                      (predefined?.id ? ex.exerciseId === predefined.id : false);
                    if (!isMatch) return ex;

                    changed = true;
                    return {
                      ...ex,
                      autoProgressionMinReps: hasPreferred
                        ? nextPreferredMin
                        : settings.defaultAutoProgressionMinReps,
                      autoProgressionMaxReps: hasPreferred
                        ? nextPreferredMax
                        : settings.defaultAutoProgressionMaxReps,
                      autoProgressionUseDefaultRange: !hasPreferred,
                      autoProgressionUsePreferredRange: hasPreferred,
                    };
                  });

                  if (changed) {
                    await updateTemplate({ ...template, exercises: nextExercises });
                  }
                }
              }
            }
          }
        }}
        onReset={async () => {
          if (editingPredefinedExercise) {
            await deletePredefinedExerciseCustomization(editingPredefinedExercise);
          }
        }}
        exerciseName={editingPredefinedExercise || ''}
        defaultPreferredMinReps={settings.defaultAutoProgressionMinReps}
        defaultPreferredMaxReps={settings.defaultAutoProgressionMaxReps}
        currentCustomization={editingPredefinedExercise ? predefinedExerciseCustomizations[editingPredefinedExercise] : undefined}
      />
    </ScreenContainer>
  );
}

export default function ExerciseDetailScreen() {
  return <ExerciseDetailView />;
}
