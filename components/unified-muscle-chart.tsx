import { View, Text, StyleSheet, Pressable, Switch } from 'react-native';
import { useMemo, useState } from 'react';
import { useColors } from '@/hooks/use-colors';
import { useBodyweight } from '@/hooks/use-bodyweight';
import { CompletedWorkout, MuscleGroup, WeekStartDay, getExerciseMuscles, getEffectiveExerciseMuscles } from '@/lib/types';
import { PRIMARY_MUSCLE_GROUPS, getMuscleGroupDisplayName } from '@/lib/muscle-groups';
import { formatVolume } from '@/lib/unit-conversion';
import { calculateSetVolume } from '@/lib/volume-calculation';
import { calculateDefaultContributions } from '@/lib/muscle-contribution';
import { SpiderChart } from '@/components/spider-chart';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ModalBottomSheet } from '@/components/modal-bottom-sheet';
import { getWeekStart, getWeekRange } from '@/lib/week-utils';

type ChartMode = 'week-comparison' | 'current-sets' | 'spider';

interface UnifiedMuscleChartProps {
  workouts: CompletedWorkout[];
  customExercises: Array<{ 
    name: string; 
    primaryMuscle: MuscleGroup; 
    secondaryMuscles?: MuscleGroup[];
    muscleContributions?: Record<MuscleGroup, number>;
  }>;
  predefinedExerciseCustomizations?: Record<string, { primaryMuscle?: MuscleGroup; secondaryMuscles?: MuscleGroup[]; muscleContributions?: Record<MuscleGroup, number> }>;
  weightUnit: 'kg' | 'lbs';
  weekStartDay?: WeekStartDay;
  // Spider chart props
  selectedMusclesForSpider?: MuscleGroup[];
  showSpiderLastWeek?: boolean;
  onToggleSpiderLastWeek?: () => void;
  onOpenMuscleSelection?: () => void;
}

interface MuscleData {
  muscle: MuscleGroup;
  // For week comparison
  lastWeekPrimary: number;
  lastWeekSecondary: number;
  thisWeekPrimary: number;
  thisWeekSecondary: number;
  // For current week sets
  primarySets: number;
  secondarySets: number;
  totalSets: number;
  totalVolume: number;
}

export function UnifiedMuscleChart({ 
  workouts, 
  customExercises, 
  predefinedExerciseCustomizations, 
  weightUnit,
  weekStartDay = 1,
  selectedMusclesForSpider = [],
  showSpiderLastWeek = false,
  onToggleSpiderLastWeek,
  onOpenMuscleSelection,
}: UnifiedMuscleChartProps) {
  const colors = useColors();
  const [chartMode, setChartMode] = useState<ChartMode>('week-comparison');
  const [showAllMuscles, setShowAllMuscles] = useState(false);
  const [showSpiderSettings, setShowSpiderSettings] = useState(false);
  const { bodyWeightKg: bodyWeight } = useBodyweight();

  // Calculate week ranges
  const { thisWeekRange, lastWeekRange } = useMemo(() => {
    const now = new Date();
    const thisWeekStart = getWeekStart(now, weekStartDay);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    
    return {
      thisWeekRange: getWeekRange(thisWeekStart),
      lastWeekRange: getWeekRange(lastWeekStart),
    };
  }, [weekStartDay]);

  // Calculate muscle data for both modes
  const muscleData = useMemo(() => {
    const data: Record<MuscleGroup, MuscleData> = {} as Record<MuscleGroup, MuscleData>;
    
    // Initialize all primary muscle groups
    PRIMARY_MUSCLE_GROUPS.forEach(muscle => {
      data[muscle] = {
        muscle,
        lastWeekPrimary: 0,
        lastWeekSecondary: 0,
        thisWeekPrimary: 0,
        thisWeekSecondary: 0,
        primarySets: 0,
        secondarySets: 0,
        totalSets: 0,
        totalVolume: 0,
      };
    });

    workouts.forEach((workout) => {
      const workoutDate = workout.startTime;
      const isThisWeek = workoutDate >= thisWeekRange.start && workoutDate <= thisWeekRange.end;
      const isLastWeek = workoutDate >= lastWeekRange.start && workoutDate <= lastWeekRange.end;

      workout.exercises.forEach((exercise) => {
        // Use saved muscle data from workout if available, otherwise get effective muscles
        let muscleMeta;
        if (exercise.primaryMuscle && exercise.muscleContributions) {
          // Use saved data from workout (preferred)
          muscleMeta = {
            primaryMuscle: exercise.primaryMuscle,
            secondaryMuscles: exercise.secondaryMuscles || [],
            muscleContributions: exercise.muscleContributions,
            exerciseType: exercise.type,
          };
        } else {
          // Fall back to getting effective muscles with customizations
          muscleMeta = getEffectiveExerciseMuscles(
            exercise.name,
            predefinedExerciseCustomizations,
            exercise.name ? !getExerciseMuscles(exercise.name) : false,
            customExercises.find(ex => ex.name.toLowerCase() === exercise.name.toLowerCase())
          );
        }

        if (!muscleMeta) return;

        const primary = muscleMeta.primaryMuscle;
        const secondaries = muscleMeta.secondaryMuscles || [];
        const contributions = muscleMeta.muscleContributions 
          ? muscleMeta.muscleContributions 
          : calculateDefaultContributions(primary, secondaries);

        exercise.sets.forEach((set) => {
          // Only count completed sets, exclude warmup sets
          if (set.completed === false) return;
          if (set.setType === 'warmup') return;
          if (!set.reps) return; // Allow 0 weight for bodyweight exercises
          
          const volume = calculateSetVolume(set, exercise.type, bodyWeight);
          const primaryContrib = contributions[primary] || 100;
          
          // Week comparison data
          if (isThisWeek || isLastWeek) {
            if (data[primary]) {
              if (isThisWeek) {
                data[primary].thisWeekPrimary += volume * (primaryContrib / 100);
              } else {
                data[primary].lastWeekPrimary += volume * (primaryContrib / 100);
              }
            }

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
          }

          // Current week sets data
          if (isThisWeek) {
            if (data[primary]) {
              data[primary].primarySets += 1;
              data[primary].totalSets += 1;
              data[primary].totalVolume += volume * (primaryContrib / 100);
            }

            secondaries.forEach((muscle) => {
              const secContrib = contributions[muscle] || 0;
              if (secContrib > 0 && data[muscle]) {
                data[muscle].secondarySets += secContrib / 100;
                data[muscle].totalSets += secContrib / 100;
                data[muscle].totalVolume += volume * (secContrib / 100);
              }
            });
          }
        });
      });
    });

    return data;
  }, [workouts, customExercises, predefinedExerciseCustomizations, thisWeekRange, lastWeekRange, bodyWeight]);

  // Filter and sort data based on mode
  const displayData = useMemo(() => {
    let dataArray = Object.values(muscleData);

    if (chartMode === 'week-comparison') {
      // Filter by active muscles if needed
      if (!showAllMuscles) {
        dataArray = dataArray.filter(d => 
          (d.thisWeekPrimary + d.thisWeekSecondary) > 0 || 
          (d.lastWeekPrimary + d.lastWeekSecondary) > 0
        );
      }
      // Sort by this week total volume
      dataArray.sort((a, b) => {
        const totalA = a.thisWeekPrimary + a.thisWeekSecondary;
        const totalB = b.thisWeekPrimary + b.thisWeekSecondary;
        return totalB - totalA;
      });
    } else {
      // Current week sets mode
      if (!showAllMuscles) {
        dataArray = dataArray.filter(d => d.totalSets > 0);
      }
      // Sort by total volume
      dataArray.sort((a, b) => b.totalSets - a.totalSets);
    }

    return dataArray;
  }, [muscleData, chartMode, showAllMuscles]);

  // Find max value for scaling
  const maxValue = useMemo(() => {
    let max = 0;
    displayData.forEach((d) => {
      if (chartMode === 'week-comparison') {
        const lastWeekTotal = d.lastWeekPrimary + d.lastWeekSecondary;
        const thisWeekTotal = d.thisWeekPrimary + d.thisWeekSecondary;
        max = Math.max(max, lastWeekTotal, thisWeekTotal);
      } else {
        max = Math.max(max, d.totalSets);
      }
    });
    return max || 1;
  }, [displayData, chartMode]);

  // Cycle through chart modes
  const cycleChartMode = () => {
    if (chartMode === 'week-comparison') {
      setChartMode('current-sets');
    } else if (chartMode === 'current-sets') {
      setChartMode('spider');
    } else {
      setChartMode('week-comparison');
    }
  };

  const getChartModeLabel = () => {
    switch (chartMode) {
      case 'week-comparison': return 'WoW Muscle Volume';
      case 'current-sets': return 'Current Week Sets';
      case 'spider': return 'Volume Radar';
    }
  };

  // Prepare spider chart data
  const spiderData = useMemo(() => {
    return selectedMusclesForSpider.map((muscle) => ({
      muscle,
      volume: muscleData[muscle]?.totalVolume || 0,
    }));
  }, [selectedMusclesForSpider, muscleData]);

  const spiderComparisonData = useMemo(() => {
    if (!showSpiderLastWeek) return undefined;
    return selectedMusclesForSpider.map((muscle) => ({
      muscle,
      volume: muscleData[muscle]?.lastWeekPrimary + muscleData[muscle]?.lastWeekSecondary || 0,
    }));
  }, [selectedMusclesForSpider, muscleData, showSpiderLastWeek]);

  return (
    <View style={styles.container}>
      {/* Header with dropdown and toggle */}
      <View style={styles.header}>
        {/* Dropdown selector */}
        <View style={styles.dropdownContainer}>
          <Pressable
            onPress={cycleChartMode}
            style={({ pressed }) => [
              styles.dropdown,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.dropdownText, { color: colors.foreground }]}>
              {getChartModeLabel()}
            </Text>
            <Text style={[styles.dropdownArrow, { color: colors.muted }]}>▼</Text>
          </Pressable>
        </View>

        {/* Spider mode: Settings + Edit muscles buttons */}
        {chartMode === 'spider' && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {onToggleSpiderLastWeek && (
              <Pressable
                onPress={() => setShowSpiderSettings(true)}
                style={({ pressed }) => [
                  styles.toggle,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <IconSymbol name="gearshape" size={16} color={colors.muted} />
              </Pressable>
            )}

            {onOpenMuscleSelection && (
              <Pressable
                onPress={onOpenMuscleSelection}
                style={({ pressed }) => [
                  styles.toggle,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <IconSymbol name="pencil" size={16} color={colors.primary} />
              </Pressable>
            )}
          </View>
        )}

        {/* Non-spider modes: Active Only / All Muscles toggle */}
        {chartMode !== 'spider' && (
          <Pressable
            onPress={() => setShowAllMuscles(!showAllMuscles)}
            style={({ pressed }) => [
              styles.toggle,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.toggleText, { color: colors.foreground }]}>
              {showAllMuscles ? 'All Muscles' : 'Active Only'}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Legend - different for each mode */}
      <View style={styles.legendContainer}>
        {chartMode === 'week-comparison' && (
          <>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#9CA3AF' }]} />
              <Text style={[styles.legendText, { color: colors.muted }]}>Last week</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#DC2626' }]} />
              <Text style={[styles.legendText, { color: colors.muted }]}>Below target</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#16A34A' }]} />
              <Text style={[styles.legendText, { color: colors.muted }]}>Exceeded target</Text>
            </View>
          </>
        )}
        {chartMode === 'current-sets' && (
          <>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#FBBF24' }]} />
              <Text style={[styles.legendText, { color: colors.muted }]}>1-9 sets</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#22C55E' }]} />
              <Text style={[styles.legendText, { color: colors.muted }]}>10-20 sets</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
              <Text style={[styles.legendText, { color: colors.muted }]}>20+ sets</Text>
            </View>
          </>
        )}
        {chartMode === 'spider' ? null : null}
      </View>

      {/* Chart */}
      {chartMode === 'spider' ? (
        <View style={{ alignItems: 'center' }}>
          <SpiderChart
            data={spiderData}
            comparisonData={spiderComparisonData}
            height={340}
            width={340}
          />
        </View>
      ) : (
        <View style={styles.chartContainer}>
          {displayData.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              No data available
            </Text>
          ) : (
            displayData.map((d) => {
              if (chartMode === 'week-comparison') {
                return (
                  <WeekComparisonRow
                    key={d.muscle}
                    data={d}
                    maxValue={maxValue}
                    colors={colors}
                    weightUnit={weightUnit}
                  />
                );
              } else {
                return (
                  <CurrentWeekRow
                    key={d.muscle}
                    data={d}
                    maxValue={maxValue}
                    colors={colors}
                  />
                );
              }
            })
          )}
        </View>
      )}

      {/* Spider mode settings */}
      <ModalBottomSheet
        visible={showSpiderSettings}
        onClose={() => setShowSpiderSettings(false)}
        title="Chart Settings"
      >
        <View style={{ gap: 12 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 6,
            }}
          >
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: '700' }}>Show last week</Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                Overlay last week’s volume on the radar for comparison
              </Text>
            </View>
            <Switch
              value={!!showSpiderLastWeek}
              onValueChange={() => {
                onToggleSpiderLastWeek?.();
              }}
              trackColor={{ false: colors.muted, true: colors.primary }}
              thumbColor={colors.background}
            />
          </View>
        </View>
      </ModalBottomSheet>
    </View>
  );
}

// Week comparison row component
function WeekComparisonRow({ 
  data, 
  maxValue, 
  colors, 
  weightUnit 
}: { 
  data: MuscleData; 
  maxValue: number; 
  colors: any; 
  weightUnit: 'kg' | 'lbs';
}) {
  const lastWeekTotal = data.lastWeekPrimary + data.lastWeekSecondary;
  const thisWeekTotal = data.thisWeekPrimary + data.thisWeekSecondary;
  
  const percentChange = lastWeekTotal > 0 
    ? ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100 
    : (thisWeekTotal > 0 ? 100 : 0);
  
  const exceededLastWeek = thisWeekTotal > lastWeekTotal;
  const isNegative = percentChange < 0;

  const lastWeekWidth = (lastWeekTotal / maxValue) * 100;
  const thisWeekWidth = (thisWeekTotal / maxValue) * 100;

  const lastWeekPrimaryPercent = lastWeekTotal > 0 ? (data.lastWeekPrimary / lastWeekTotal) * 100 : 0;
  const lastWeekSecondaryPercent = lastWeekTotal > 0 ? (data.lastWeekSecondary / lastWeekTotal) * 100 : 0;
  const thisWeekPrimaryPercent = thisWeekTotal > 0 ? (data.thisWeekPrimary / thisWeekTotal) * 100 : 0;
  const thisWeekSecondaryPercent = thisWeekTotal > 0 ? (data.thisWeekSecondary / thisWeekTotal) * 100 : 0;

  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: colors.foreground }]}>
        {getMuscleGroupDisplayName(data.muscle)}
      </Text>

      <View style={styles.barsWrapper}>
        {/* Gray background bar (last week) */}
        <View style={[styles.barContainer, { width: `${lastWeekWidth}%` }]}>
          {lastWeekTotal > 0 && (
            <>
              <View
                style={[
                  styles.barSegment,
                  { width: `${lastWeekPrimaryPercent}%`, backgroundColor: '#6B7280' },
                ]}
              />
              <View
                style={[
                  styles.barSegment,
                  { width: `${lastWeekSecondaryPercent}%`, backgroundColor: '#9CA3AF' },
                ]}
              />
            </>
          )}
        </View>
        
        {/* Colored overlay bar (this week) */}
        <View style={[styles.overlayBar, { width: `${thisWeekWidth}%` }]}>
          {thisWeekTotal > 0 && (
            <>
              <View
                style={[
                  styles.barSegment,
                  { width: `${thisWeekPrimaryPercent}%`, backgroundColor: exceededLastWeek ? '#16A34A' : '#DC2626' },
                ]}
              />
              <View
                style={[
                  styles.barSegment,
                  { width: `${thisWeekSecondaryPercent}%`, backgroundColor: exceededLastWeek ? '#4ADE80' : '#F87171' },
                ]}
              />
            </>
          )}
        </View>
      </View>

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
          numberOfLines={1}
        >
          {percentChange > 0 ? '+' : ''}{percentChange.toFixed(0)}% · {formatVolume(thisWeekTotal, weightUnit)}
        </Text>
      </View>
    </View>
  );
}

// Current week row component
function CurrentWeekRow({ 
  data, 
  maxValue, 
  colors 
}: { 
  data: MuscleData; 
  maxValue: number; 
  colors: any;
}) {
  const barWidth = (data.totalSets / maxValue) * 100;
  const setCount = data.totalSets;
  
  // Color based on set count - dark for primary, light for secondary
  let primaryColor: string;
  let secondaryColor: string;
  
  if (setCount < 10) {
    primaryColor = '#F59E0B';  // Amber-500 (yellow)
    secondaryColor = '#FCD34D'; // Amber-300 (light yellow)
  } else if (setCount <= 20) {
    primaryColor = '#22C55E';  // Green-500
    secondaryColor = '#86EFAC'; // Green-300 (light green)
  } else {
    primaryColor = '#EF4444';  // Red-500
    secondaryColor = '#FCA5A5'; // Red-300 (light red)
  }

  const primary = data.primarySets;
  const secondary = data.secondarySets;
  const total = primary + secondary;
  const primaryPercent = total > 0 ? (primary / total) * 100 : 0;
  const secondaryPercent = total > 0 ? (secondary / total) * 100 : 0;

  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: colors.foreground }]}>
        {getMuscleGroupDisplayName(data.muscle)}
      </Text>

      <View style={styles.barsWrapper}>
        <View style={[styles.barContainer, { width: `${barWidth}%` }]}>
          {total > 0 ? (
            <>
              <View style={[styles.barSegment, { width: `${primaryPercent}%`, backgroundColor: primaryColor }]} />
              <View style={[styles.barSegment, { width: `${secondaryPercent}%`, backgroundColor: secondaryColor }]} />
            </>
          ) : null}
        </View>
      </View>

      <View style={styles.stats}>
        <Text style={[styles.statsText, { color: colors.foreground }]}>
          {setCount % 1 === 0 ? setCount : setCount.toFixed(1)} sets
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  dropdownContainer: {
    flex: 1,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  dropdownText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dropdownArrow: {
    fontSize: 10,
  },
  toggle: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '500',
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
  },
  chartContainer: {
    gap: 12,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    paddingVertical: 24,
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
    width: 115,
    alignItems: 'flex-end',
  },
  statsText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
