import { View, Text, Pressable, ScrollView, FlatList } from 'react-native';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useGym } from '@/lib/gym-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { CompletedWorkout } from '@/lib/types';
import { formatVolume, convertWeight, lbsToKg } from '@/lib/unit-conversion';
import { calculateSetVolume } from '@/lib/volume-calculation';
import { BodyWeightStorage } from '@/lib/storage';
import { WorkoutDetailModal } from '@/components/workout-detail-modal';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export default function HistoryScreen() {
  const colors = useColors();
  const { workouts, settings } = useGym();
  const [selectedWorkout, setSelectedWorkout] = useState<CompletedWorkout | null>(null);
  const [workoutStats, setWorkoutStats] = useState<Map<string, { totalSets: number; totalVolume: number }>>(new Map());

  // Calculate stats for all workouts
  useEffect(() => {
    const calculateAllStats = async () => {
      const stats = new Map<string, { totalSets: number; totalVolume: number }>();
      
      for (const workout of workouts) {
        const stat = await calculateWorkoutStats(workout);
        stats.set(workout.id, stat);
      }
      
      setWorkoutStats(stats);
    };
    
    calculateAllStats();
  }, [workouts]);

  // Note: Bodyweight is fetched per-workout in calculateWorkoutStats for historical accuracy

  // Sort workouts by date (newest first)
  const sortedWorkouts = [...workouts].sort((a, b) => b.endTime - a.endTime);

  const handleWorkoutPress = (workout: CompletedWorkout) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedWorkout(workout);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    
    if (date.toDateString() === today.toDateString()) {
      return `Today, ${dateStr}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday, ${dateStr}`;
    }
    return dateStr;
  };

  const calculateWorkoutStats = async (workout: CompletedWorkout) => {
    let totalSets = 0;
    let totalVolume = 0;

    // Get bodyweight for the workout date
    const workoutDate = new Date(workout.startTime);
    const bodyWeightLog = await BodyWeightStorage.getWeightForDate(workoutDate);
    let workoutBodyWeight = 70; // Default fallback
    
    if (bodyWeightLog) {
      // Convert to kg for internal calculations
      workoutBodyWeight = bodyWeightLog.unit === 'lbs' ? lbsToKg(bodyWeightLog.weight) : bodyWeightLog.weight;
    }

    workout.exercises.forEach((exercise) => {
      exercise.sets.forEach((set) => {
        // Only count completed sets, exclude warmup sets
        if (set.completed !== false && set.setType !== 'warmup') {
          totalSets += 1;
          totalVolume += calculateSetVolume(set, exercise.type, workoutBodyWeight);
        }
      });
    });

    return { totalSets, totalVolume };
  };

  const renderWorkoutItem = ({ item }: { item: CompletedWorkout }) => {
    const stats = workoutStats.get(item.id) || { totalSets: 0, totalVolume: 0 };
    const templateName = item.name || 'Quick Workout';

    return (
      <Pressable
        onPress={() => handleWorkoutPress(item)}
        style={({ pressed }) => [
          {
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 16,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: colors.border,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.foreground }}>
              {formatDate(item.endTime)}
            </Text>
            <Text style={{ fontSize: 14, color: colors.muted, marginTop: 4 }}>
              {templateName} · {stats.totalSets} sets · {formatVolume(stats.totalVolume, settings.weightUnit)}
            </Text>
          </View>
          <IconSymbol size={20} name="chevron.right" color={colors.muted} />
        </View>
      </Pressable>
    );
  };

  return (
    <>
      <ScreenContainer className="p-4">
        <View className="flex-1">
        {/* Header */}
        <View className="mb-4">
          <Text className="text-3xl font-bold text-foreground">History</Text>
          <Text className="text-sm text-muted mt-1">
            {workouts.length} completed workout{workouts.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Workout List */}
        {workouts.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <IconSymbol size={64} name="clock.fill" color={colors.muted} />
            <Text className="text-lg text-muted mt-4">No workouts yet</Text>
            <Text className="text-sm text-muted mt-2 text-center">
              Complete your first workout to see it here
            </Text>
          </View>
        ) : (
          <FlatList
            data={sortedWorkouts}
            renderItem={renderWorkoutItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
          />
        )}
        </View>
      </ScreenContainer>

      {/* Workout Detail Modal */}
      <WorkoutDetailModal
        workout={selectedWorkout}
        visible={selectedWorkout !== null}
        onClose={() => setSelectedWorkout(null)}
      />
    </>
  );
}
