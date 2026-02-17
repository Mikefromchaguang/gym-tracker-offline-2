/**
 * Workout Detail Modal - Display completed workout details in a modal
 */

import { ScrollView, Text, View, Modal, Pressable, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useGym } from '@/lib/gym-context';
import { CompletedWorkout } from '@/lib/types';
import { useColors } from '@/hooks/use-colors';
import { useBodyweight } from '@/hooks/use-bodyweight';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { formatWeight, formatVolume } from '@/lib/unit-conversion';
import { calculateSetVolume } from '@/lib/volume-calculation';
import { useMemo } from 'react';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';

interface WorkoutDetailModalProps {
  workout: CompletedWorkout | null;
  visible: boolean;
  onClose: () => void;
}

export function WorkoutDetailModal({ workout, visible, onClose }: WorkoutDetailModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings, detectWorkoutPRs, deleteWorkout } = useGym();
  const router = useRouter();
  
  // Get bodyweight for the workout date (for accurate historical volume calculations)
  const workoutDate = useMemo(() => 
    workout ? new Date(workout.startTime) : undefined, 
    [workout?.startTime]
  );
  const { bodyWeightKg: bodyWeight } = useBodyweight({ forDate: workoutDate });

  const handleClose = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onClose();
  };

  const handleDelete = () => {
    if (!workout) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    Alert.alert(
      'Delete workout?',
      'This will permanently remove this workout from History and from all charts/analytics. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteWorkout(workout.id);
              onClose();
            } catch (error) {
              Alert.alert('Delete failed', 'Could not delete the workout. Please try again.');
            }
          },
        },
      ]
    );
  };

  if (!workout) {
    return null;
  }

  const handleEdit = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onClose();
    router.push(`/_hidden/edit-workout/${workout.id}`);
  };

  const duration = Math.round((workout.endTime - workout.startTime) / 1000 / 60); // minutes
  const totalVolume = workout.exercises.reduce((sum, ex) => {
    const exVolume = ex.sets
      .filter(set => set.completed !== false && set.setType !== 'warmup') // Exclude warmup sets
      .reduce((setSum, set) => setSum + calculateSetVolume(set, ex.type, bodyWeight), 0);
    return sum + exVolume;
  }, 0);

  const totalSets = workout.exercises.reduce((sum, ex) => 
    sum + ex.sets.filter(set => set.completed !== false && set.setType !== 'warmup').length, 0); // Exclude warmup sets

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingTop: insets.top + 16,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.foreground }}>
              {workout.name}
            </Text>
            <Text style={{ fontSize: 14, color: colors.muted, marginTop: 4 }}>
              {new Date(workout.startTime).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable
              onPress={handleEdit}
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <IconSymbol size={20} name="pencil" color={colors.primary} />
            </Pressable>

            <Pressable
              onPress={handleDelete}
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <IconSymbol size={20} name="trash" color={colors.error} />
            </Pressable>

            <Pressable
              onPress={handleClose}
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <IconSymbol size={20} name="xmark.circle.fill" color={colors.muted} />
            </Pressable>
          </View>
        </View>

        {/* Content */}
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 16 }} showsVerticalScrollIndicator={true}>
          {/* Summary Stats */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Card className="flex-1">
              <CardContent className="items-center gap-1 pt-4">
                <Text className="text-2xl font-bold text-primary">{duration}</Text>
                <Text className="text-xs text-muted">Minutes</Text>
              </CardContent>
            </Card>
            <Card className="flex-1">
              <CardContent className="items-center gap-1 pt-4">
                <Text className="text-2xl font-bold text-primary">{totalSets}</Text>
                <Text className="text-xs text-muted">Sets</Text>
              </CardContent>
            </Card>
            <Card className="flex-1">
              <CardContent className="items-center gap-1 pt-4">
                <Text className="text-2xl font-bold text-primary">
                  {formatVolume(totalVolume, settings.weightUnit)}
                </Text>
                <Text className="text-xs text-muted">Volume</Text>
              </CardContent>
            </Card>
          </View>

          {/* Exercises Breakdown */}
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.foreground }}>
              Exercises
            </Text>
            {workout.exercises.map((exercise, idx) => {
              const exVolume = exercise.sets
                .filter(set => set.completed !== false && set.setType !== 'warmup') // Exclude warmup sets
                .reduce((sum, set) => sum + calculateSetVolume(set, exercise.type, bodyWeight), 0);
              
              // Detect PRs for this exercise (pass bodyWeight for proper volume calculation)
              const exercisePRs = detectWorkoutPRs(workout, bodyWeight).filter(pr => pr.exerciseName === exercise.name);
              
              return (
                <Card key={idx}>
                  <CardHeader>
                    <CardTitle className="text-base">{exercise.name}</CardTitle>
                    
                    {/* PR Badges */}
                    {exercisePRs.length > 0 && (
                      <View className="flex-row flex-wrap gap-2 mt-2">
                        {exercisePRs.map((pr, prIdx) => (
                          <View key={prIdx} className="flex-row items-center gap-1 px-2 py-1 rounded" style={{ backgroundColor: '#FFD700' + '20' }}>
                            <Text style={{ fontSize: 12 }}>🏆</Text>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: '#B8860B' }}>
                              {pr.prType === 'heaviest_weight' ? `Heaviest: ${formatWeight(pr.value, settings.weightUnit)}` :
                               pr.prType === 'highest_volume' ? `Volume: ${formatVolume(pr.value, settings.weightUnit)}` :
                               `Unknown PR: ${pr.value}`}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                    
                    <CardDescription>
                      {exercise.sets.length} sets • {formatVolume(exVolume, settings.weightUnit)} total
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="gap-2">
                    {exercise.sets.map((set, setIdx) => (
                      <View
                        key={setIdx}
                        className="flex-row items-center justify-between p-2 bg-background rounded"
                      >
                        <Text className="text-sm text-foreground font-medium">
                          Set {setIdx + 1}
                        </Text>
                        <View className="flex-row gap-3">
                          <Text className="text-sm text-muted">
                            {set.reps} reps × {formatWeight(set.weight, settings.weightUnit)}
                          </Text>
                          {set.completed && (
                            <Text className="text-sm text-success font-semibold">✓</Text>
                          )}
                        </View>
                      </View>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </View>

          {/* Workout Notes */}
          {workout.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Workout Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Text className="text-sm text-foreground leading-relaxed">{workout.notes}</Text>
              </CardContent>
            </Card>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
