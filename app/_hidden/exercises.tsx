/**
 * Exercises Screen - Manage custom exercises
 */

import { ScrollView, Text, View, Pressable, Alert, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '@/components/screen-container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useState, useCallback, useMemo } from 'react';
import { MuscleGroup, PREDEFINED_EXERCISES, PREDEFINED_EXERCISES_WITH_MUSCLES, getExerciseMuscles, getEffectiveExerciseMuscles, ExerciseType } from '@/lib/types';
import { PRIMARY_MUSCLE_GROUPS, getMuscleGroupDisplayName } from '@/lib/muscle-groups';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useGym } from '@/lib/gym-context';
import { useRouter } from 'expo-router';
import { CreateExerciseModal } from '@/components/create-exercise-modal';
import { EditPredefinedExerciseModal } from '@/components/edit-predefined-exercise-modal';
import { generateCustomExerciseId } from '@/lib/exercise-id-migration';

// Use centralized muscle groups
const MUSCLE_GROUPS: MuscleGroup[] = PRIMARY_MUSCLE_GROUPS;

export default function ExercisesScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    customExercises,
    addCustomExercise,
    deleteCustomExercise,
    workouts,
    templates,
    settings,
    updateTemplate,
    predefinedExerciseCustomizations,
    updatePredefinedExerciseCustomization,
    deletePredefinedExerciseCustomization,
  } = useGym();
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingPredefinedExercise, setEditingPredefinedExercise] = useState<string | null>(null);
  // Get set of exercise names that have logged data
  const exercisesWithData = useMemo(() => {
    const names = new Set<string>();
    workouts.forEach((workout) => {
      workout.exercises.forEach((exercise) => {
        if (exercise.sets && exercise.sets.length > 0) {
          names.add(exercise.name);
        }
      });
    });
    return names;
  }, [workouts]);

  const hasMuscleCustomization = useCallback((exerciseName: string) => {
    const customization = (predefinedExerciseCustomizations as any)[exerciseName];
    if (!customization) return false;
    return (
      customization.primaryMuscle != null ||
      (Array.isArray(customization.secondaryMuscles) && customization.secondaryMuscles.length > 0) ||
      (customization.muscleContributions != null &&
        typeof customization.muscleContributions === 'object' &&
        Object.keys(customization.muscleContributions).length > 0)
    );
  }, [predefinedExerciseCustomizations]);

  const allExercises = useMemo(() => {
    const predefined = PREDEFINED_EXERCISES.map((name) => ({
      name,
      ...getEffectiveExerciseMuscles(
        name,
        predefinedExerciseCustomizations,
        false,
        undefined
      ),
      isCustom: false,
      isModified: hasMuscleCustomization(name),
      hasData: exercisesWithData.has(name),
    }));
    const custom = (customExercises || []).map((ex) => ({
      ...ex,
      isCustom: true,
      isModified: false,
      hasData: exercisesWithData.has(ex.name),
    }));
    return [...predefined, ...custom];
  }, [customExercises, exercisesWithData, hasMuscleCustomization, predefinedExerciseCustomizations]);

  const filteredExercises = useMemo(() => {
    if (!searchQuery.trim()) {
      return allExercises;
    }

    const query = searchQuery.toLowerCase().trim();
    return allExercises.filter((exercise) => {
      const nameMatch = exercise.name.toLowerCase().includes(query);
      const primaryMatch = exercise.primaryMuscle?.toLowerCase().includes(query);
      const secondaryMatch = exercise.secondaryMuscles?.some((m) => m.toLowerCase().includes(query));
      return nameMatch || primaryMatch || secondaryMatch;
    });
  }, [allExercises, searchQuery]);

  const handleCreateExercise = useCallback(async (exerciseData: {
    name: string;
    primaryMuscle: MuscleGroup;
    secondaryMuscles: MuscleGroup[];
    type: ExerciseType;
    muscleContributions: Record<MuscleGroup, number>;
    preferredAutoProgressionEnabled?: boolean;
    preferredAutoProgressionMinReps?: number;
    preferredAutoProgressionMaxReps?: number;
  }) => {
    // Check if exercise already exists
    if (allExercises.some((ex) => ex.name.toLowerCase() === exerciseData.name.toLowerCase())) {
      throw new Error('An exercise with this name already exists');
    }

    await addCustomExercise({
      id: generateCustomExerciseId(),
      name: exerciseData.name,
      primaryMuscle: exerciseData.primaryMuscle,
      secondaryMuscles: exerciseData.secondaryMuscles,
      exerciseType: exerciseData.type,
      type: exerciseData.type, // Alias for convenience
      muscleContributions: exerciseData.muscleContributions,
      preferredAutoProgressionEnabled: exerciseData.preferredAutoProgressionEnabled,
      preferredAutoProgressionMinReps: exerciseData.preferredAutoProgressionMinReps,
      preferredAutoProgressionMaxReps: exerciseData.preferredAutoProgressionMaxReps,
    });
  }, [allExercises, addCustomExercise]);

  const handleDeleteExercise = useCallback(
    (exerciseName: string) => {
      Alert.alert('Delete Exercise', `Remove "${exerciseName}" from your exercises?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteCustomExercise(exerciseName);
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
          },
        },
      ]);
    },
    [deleteCustomExercise]
  );

  const exercisesByMuscle = useMemo(() => {
    const grouped: Record<string, typeof allExercises> = {};
    filteredExercises.forEach((ex) => {
      const muscle = ex.primaryMuscle || 'Other';
      if (!grouped[muscle]) grouped[muscle] = [];
      grouped[muscle].push(ex);
    });
    return grouped;
  }, [filteredExercises]);

  const navigateToExerciseDetail = useCallback((exerciseName: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push({
      pathname: '/_hidden/exercises/[exerciseName]',
      params: { exerciseName },
    });
  }, [router]);

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="gap-4 pb-6">
          {/* Header */}
          <View className="flex-row items-center justify-between">
            <Text className="text-2xl font-bold text-foreground">Exercises</Text>
            <Button
              onPress={() => setShowAddModal(true)}
              size="sm"
              className="flex-row items-center gap-2"
            >
              <IconSymbol size={16} name="plus" color={colors.background} />
              <Text className="text-background font-semibold">Add Exercise</Text>
            </Button>
          </View>

          {/* Search Bar */}
          <View className="bg-surface rounded-lg border border-border">
            <Input
              placeholder="Search by name or muscle group..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="h-12 px-4 text-base"
            />
          </View>

          {/* Exercise List by Muscle Group */}
          {Object.entries(exercisesByMuscle).map(([muscle, exercises]) => (
            <Card key={muscle}>
              <CardHeader>
                <CardTitle>{getMuscleGroupDisplayName(muscle as MuscleGroup)}</CardTitle>
              </CardHeader>
              <CardContent className="gap-2">
                {exercises.map((exercise) => (
                  <Pressable
                    key={exercise.name}
                    onPress={() => navigateToExerciseDetail(exercise.name)}
                    style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                    className="flex-row items-center justify-between py-2 border-b border-border"
                  >
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2 mb-1 flex-wrap">
                        <Text className="text-base font-medium text-foreground">{exercise.name}</Text>
                        {exercise.isCustom && (
                          <View className="bg-orange-500 px-2 py-1 rounded-full">
                            <Text className="text-xs font-semibold text-background">Custom</Text>
                          </View>
                        )}
                        {exercise.isModified && (
                          <View className="bg-blue-500 px-2 py-1 rounded-full">
                            <Text className="text-xs font-semibold text-background">Modified</Text>
                          </View>
                        )}
                        {exercise.hasData && (
                          <View className="bg-primary px-2 py-1 rounded-full">
                            <Text className="text-xs font-semibold text-background">Data</Text>
                          </View>
                        )}
                      </View>
                      <Text className="text-xs text-muted">
                        Primary: {getMuscleGroupDisplayName(exercise.primaryMuscle as MuscleGroup)}
                        {exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0 && (
                          <>, Secondary: {exercise.secondaryMuscles.map((m) => getMuscleGroupDisplayName(m as MuscleGroup)).join(', ')}</>
                        )}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-1">
                      {/* Edit button for all exercises */}
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          if (!exercise.isCustom) {
                            // Edit predefined exercise customization
                            setEditingPredefinedExercise(exercise.name);
                          } else {
                            navigateToExerciseDetail(exercise.name);
                          }
                        }}
                        style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                        className="p-2"
                      >
                        <IconSymbol size={18} name="slider.horizontal.3" color={colors.primary} />
                      </Pressable>
                      {exercise.isCustom && (
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation();
                            handleDeleteExercise(exercise.name);
                          }}
                          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                          className="p-2"
                        >
                          <IconSymbol size={18} name="trash" color={colors.error} />
                        </Pressable>
                      )}
                    </View>
                  </Pressable>
                ))}
              </CardContent>
            </Card>
          ))}
        </View>
      </ScrollView>

      {/* Add Exercise Modal */}
      <CreateExerciseModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleCreateExercise}
        mode="create"
      />

      {/* Edit Predefined Exercise Modal */}
      <EditPredefinedExerciseModal
        visible={!!editingPredefinedExercise}
        onClose={() => setEditingPredefinedExercise(null)}
        onSave={async (customization, options) => {
          if (editingPredefinedExercise) {
            const previous = predefinedExerciseCustomizations[editingPredefinedExercise];
            const prevPreferredEnabled = previous?.preferredAutoProgressionEnabled !== false;
            const prevPreferredMin = previous?.preferredAutoProgressionMinReps;
            const prevPreferredMax = previous?.preferredAutoProgressionMaxReps;
            const nextPreferredEnabled = customization.preferredAutoProgressionEnabled !== false;
            const nextPreferredMin = customization.preferredAutoProgressionMinReps;
            const nextPreferredMax = customization.preferredAutoProgressionMaxReps;

            await updatePredefinedExerciseCustomization(editingPredefinedExercise, customization);

            const preferredChanged =
              prevPreferredEnabled !== nextPreferredEnabled ||
              prevPreferredMin !== nextPreferredMin ||
              prevPreferredMax !== nextPreferredMax;

            if (preferredChanged && options?.preferredRangeApplyMode === 'existing-templates') {
              const predefined = PREDEFINED_EXERCISES_WITH_MUSCLES.find(
                (ex) => ex.name.toLowerCase() === editingPredefinedExercise.toLowerCase()
              );
              const hasPreferred =
                nextPreferredEnabled &&
                typeof nextPreferredMin === 'number' &&
                typeof nextPreferredMax === 'number';

              for (const template of templates) {
                let changed = false;
                const nextExercises = template.exercises.map((ex) => {
                  const isMatch =
                    ex.name.toLowerCase() === editingPredefinedExercise.toLowerCase() ||
                    (predefined?.id ? ex.exerciseId === predefined.id : false);
                  if (!isMatch) return ex;

                  changed = true;
                  const autoProgressionAvailable =
                    ex.type !== 'bodyweight' && ex.type !== 'assisted-bodyweight';
                  const applyPreferred = autoProgressionAvailable && hasPreferred;
                  return {
                    ...ex,
                    autoProgressionEnabled: autoProgressionAvailable ? nextPreferredEnabled : false,
                    autoProgressionMinReps: autoProgressionAvailable
                      ? (applyPreferred
                      ? nextPreferredMin
                      : settings.defaultAutoProgressionMinReps)
                      : undefined,
                    autoProgressionMaxReps: autoProgressionAvailable
                      ? (applyPreferred
                      ? nextPreferredMax
                      : settings.defaultAutoProgressionMaxReps)
                      : undefined,
                    autoProgressionUseDefaultRange: autoProgressionAvailable ? !applyPreferred : false,
                    autoProgressionUsePreferredRange: autoProgressionAvailable ? applyPreferred : false,
                  };
                });

                if (changed) {
                  await updateTemplate({ ...template, exercises: nextExercises });
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
