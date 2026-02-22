/**
 * Workout Summary Screen - Display completed workout and save options
 */

import { ScrollView, Text, View, Alert, Modal, TextInput, Pressable } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useGym } from '@/lib/gym-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { CompletedWorkout, WorkoutTemplate, Exercise as TemplateExercise, CompletedExercise, WeightUnit, getExerciseMuscles, getEffectiveExerciseMuscles } from '@/lib/types';
import { generateId } from '@/lib/storage';
import { useColors } from '@/hooks/use-colors';
import { useBodyweight } from '@/hooks/use-bodyweight';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { convertWeight, formatVolume, formatWeight } from '@/lib/unit-conversion';
import { calculateExerciseVolume } from '@/lib/volume-calculation';

/**
 * Converts completed workout exercises to routine exercise format.
 * Maps CompletedExercise (with sets: CompletedSet[]) to Exercise (with sets: number and setDetails).
 */
function completedExercisesToTemplateExercises(
  completedExercises: CompletedExercise[],
  unit: WeightUnit,
  predefinedExerciseCustomizations: Record<string, any>,
  customExercises: any[],
  existingTemplateExercises?: TemplateExercise[]
): TemplateExercise[] {
  return completedExercises.map((ex) => {
    // Use saved metadata if available, otherwise infer from exercise name
    const customEx = customExercises.find(ce => ce.name.toLowerCase() === ex.name.toLowerCase());
    const muscles = getEffectiveExerciseMuscles(
      ex.name,
      predefinedExerciseCustomizations,
      !!customEx,
      customEx
    );

    const setDetails = ex.sets.map((s) => ({
      reps: s.reps,
      weight: s.weight,
      unit,
    }));

    const lastSet = ex.sets[ex.sets.length - 1];
    const existingExercise = existingTemplateExercises?.find((candidate) => {
      if (ex.exerciseId && candidate.exerciseId) {
        return candidate.exerciseId === ex.exerciseId;
      }
      return candidate.name.toLowerCase() === ex.name.toLowerCase();
    });

    return {
      id: ex.id,
      exerciseId: ex.exerciseId,
      name: ex.name,
      groupType: ex.groupType,
      groupId: ex.groupId,
      groupPosition: ex.groupPosition,
      // total number of sets
      sets: ex.sets.length,
      // default values (for backward compatibility)
      reps: lastSet?.reps ?? 0,
      weight: lastSet?.weight ?? 0,
      unit,
      // Use saved metadata if available, otherwise infer
      type: ex.type ?? muscles?.exerciseType ?? 'weighted',
      primaryMuscle: ex.primaryMuscle ?? muscles?.primaryMuscle,
      secondaryMuscles: ex.secondaryMuscles ?? muscles?.secondaryMuscles,
      muscleContributions: ex.muscleContributions,
      // detailed per-set configs
      setDetails,
      // Use saved values if available, otherwise defaults
      restTimer: ex.restTimer ?? 180,
      timerEnabled: ex.timerEnabled ?? true,
      notes: ex.notes,
      autoProgressionEnabled: ex.autoProgressionEnabled ?? existingExercise?.autoProgressionEnabled,
      autoProgressionMinReps: ex.autoProgressionMinReps ?? existingExercise?.autoProgressionMinReps,
      autoProgressionMaxReps: ex.autoProgressionMaxReps ?? existingExercise?.autoProgressionMaxReps,
      autoProgressionUseDefaultRange:
        ex.autoProgressionUseDefaultRange ?? existingExercise?.autoProgressionUseDefaultRange,
      autoProgressionUsePreferredRange:
        ex.autoProgressionUsePreferredRange ?? existingExercise?.autoProgressionUsePreferredRange,
    };
  });
}

export default function WorkoutSummaryScreen() {
  const router = useRouter();
  const colors = useColors();
  const { workouts, addTemplate, updateTemplate, templates, settings, detectWorkoutPRs, predefinedExerciseCustomizations, customExercises } = useGym();
  const { workoutId, templateId } = useLocalSearchParams();
  const { bodyWeightKg: bodyWeight } = useBodyweight();

  const [workout, setWorkout] = useState<CompletedWorkout | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Save as Routine modal state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

  useEffect(() => {
    // Fetch workout
    if (workoutId && typeof workoutId === 'string') {
      const found = workouts.find((w) => w.id === workoutId);
      setWorkout(found || null);
    }
  }, [workoutId, workouts]);

  const handleOpenSaveModal = useCallback(() => {
    setNewTemplateName(workout?.name || '');
    setShowSaveModal(true);
  }, [workout]);

  const handleSaveAsTemplate = useCallback(async () => {
    if (!newTemplateName.trim()) {
      Alert.alert('Error', 'Routine name cannot be empty');
      return;
    }

    if (!workout) {
      Alert.alert('Error', 'Workout not found');
      return;
    }

    // Check for duplicate name
    if (templates.some(t => t.name.toLowerCase() === newTemplateName.trim().toLowerCase())) {
      Alert.alert('Error', 'A routine with this name already exists');
      return;
    }

    try {
      setIsLoading(true);
      const newTemplate: WorkoutTemplate = {
        id: generateId(),
        name: newTemplateName.trim(),
        exercises: completedExercisesToTemplateExercises(
          workout.exercises,
          settings.weightUnit,
          predefinedExerciseCustomizations,
          customExercises
        ),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await addTemplate(newTemplate);

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setShowSaveModal(false);
      Alert.alert('Success', 'Routine saved successfully', [
        { text: 'OK', onPress: () => router.replace('/(tabs)') }
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to save routine');
    } finally {
      setIsLoading(false);
    }
  }, [newTemplateName, workout, templates, addTemplate, router]);

  const handleUpdateTemplate = useCallback(async () => {
    if (!templateId || typeof templateId !== 'string') {
      Alert.alert('Error', 'No routine to update');
      return;
    }

    const template = templates.find((t) => t.id === templateId);
    if (!template) {
      Alert.alert('Error', 'Routine not found');
      return;
    }

    if (!workout) {
      Alert.alert('Error', 'Workout not found');
      return;
    }

    Alert.alert(
      'Update Routine',
      `Update "${template.name}" with current workout values?`,
      [
        { text: 'Cancel', onPress: () => {} },
        {
          text: 'Update',
          onPress: async () => {
            try {
              setIsLoading(true);
              await updateTemplate({
                ...template,
                exercises: completedExercisesToTemplateExercises(
                  workout.exercises,
                  settings.weightUnit,
                  predefinedExerciseCustomizations,
                  customExercises,
                  template.exercises
                ),
                updatedAt: Date.now(),
              });

              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }

              Alert.alert('Success', 'Routine updated successfully', [
                { text: 'OK', onPress: () => router.replace('/(tabs)') }
              ]);
            } catch (error) {
              Alert.alert('Error', 'Failed to update routine');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  }, [templateId, templates, workout, updateTemplate, router]);

  if (!workout) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text className="text-base text-muted">Workout not found</Text>
      </ScreenContainer>
    );
  }

  const duration = Math.round((workout.endTime - workout.startTime) / 1000 / 60); // minutes
  const totalVolume = workout.exercises.reduce((sum, ex) => {
    const exVolume = calculateExerciseVolume(ex.sets, ex.type, bodyWeight);
    return sum + exVolume;
  }, 0);

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={true}>
        <View className="gap-6 pb-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-2xl font-bold text-foreground">Workout Complete!</Text>
            <Text className="text-base text-muted">
              {new Date(workout.startTime).toLocaleDateString()}
            </Text>
          </View>

          {/* Summary Stats */}
          <View className="flex-row gap-2">
            <Card className="flex-1">
              <CardContent className="items-center gap-1 pt-4">
                <Text className="text-2xl font-bold text-primary">{duration}</Text>
                <Text className="text-xs text-muted">Minutes</Text>
              </CardContent>
            </Card>
            <Card className="flex-1">
              <CardContent className="items-center gap-1 pt-4">
                <Text className="text-2xl font-bold text-primary">{workout.exercises.length}</Text>
                <Text className="text-xs text-muted">Exercises</Text>
              </CardContent>
            </Card>
            <Card className="flex-1">
              <CardContent className="items-center gap-1 pt-4">
                <Text className="text-2xl font-bold text-primary">{Math.round(convertWeight(totalVolume, settings.weightUnit))}</Text>
                <Text className="text-xs text-muted">Volume ({settings.weightUnit})</Text>
              </CardContent>
            </Card>
          </View>

          {/* Exercises Breakdown */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Exercises</Text>
            {workout.exercises.map((exercise, idx) => {
              const exVolume = calculateExerciseVolume(exercise.sets, exercise.type, bodyWeight);
              
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

          {/* Action Buttons */}
          <View className="gap-2">
            {templateId ? (
              <>
                <Button
                  size="lg"
                  onPress={handleUpdateTemplate}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? 'Updating...' : 'Update Routine'}
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  onPress={handleOpenSaveModal}
                  disabled={isLoading}
                  className="w-full"
                >
                  Save as New Routine
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  onPress={() => router.replace('/(tabs)')}
                  disabled={isLoading}
                  className="w-full"
                >
                  Done
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="lg"
                  onPress={handleOpenSaveModal}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? 'Saving...' : 'Save as Routine'}
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  onPress={() => router.replace('/(tabs)')}
                  disabled={isLoading}
                  className="w-full"
                >
                  Done
                </Button>
              </>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Save as Routine Modal */}
      <Modal
        visible={showSaveModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowSaveModal(false)}
      >
        <Pressable 
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
          onPress={() => setShowSaveModal(false)}
        >
          <Pressable 
            style={{ 
              backgroundColor: colors.background, 
              borderRadius: 16, 
              padding: 24, 
              width: '85%',
              maxWidth: 350,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.foreground, marginBottom: 8 }}>
              Save as Routine
            </Text>
            <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 16 }}>
              Enter a name for this routine:
            </Text>
            
            <TextInput
              value={newTemplateName}
              onChangeText={setNewTemplateName}
              placeholder="Routine name"
              placeholderTextColor={colors.muted}
              autoFocus={true}
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 12,
                fontSize: 16,
                color: colors.foreground,
                marginBottom: 20,
              }}
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={() => setShowSaveModal(false)}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    paddingVertical: 12,
                    backgroundColor: colors.surface,
                    borderRadius: 8,
                    alignItems: 'center',
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={{ color: colors.foreground, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              
              <Pressable
                onPress={handleSaveAsTemplate}
                disabled={isLoading}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    paddingVertical: 12,
                    backgroundColor: colors.primary,
                    borderRadius: 8,
                    alignItems: 'center',
                    opacity: pressed || isLoading ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={{ color: colors.background, fontWeight: '600' }}>
                  {isLoading ? 'Saving...' : 'Save'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}
