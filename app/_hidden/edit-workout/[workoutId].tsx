import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ScreenContainer } from '@/components/screen-container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { useGym } from '@/lib/gym-context';
import { CompletedExercise, CompletedSet, CompletedWorkout, ExerciseType, SetType, WeightUnit } from '@/lib/types';
import { convertWeight, lbsToKg } from '@/lib/unit-conversion';

function deepCopyWorkout(workout: CompletedWorkout): CompletedWorkout {
  return {
    ...workout,
    exercises: workout.exercises.map((ex) => ({
      ...ex,
      sets: ex.sets.map((s) => ({ ...s })),
    })),
  };
}

function getShowWeightInput(exType: ExerciseType | undefined): boolean {
  return exType !== 'bodyweight';
}

function cycleSetType(current: SetType | undefined): SetType {
  if (current === 'working' || !current) return 'warmup';
  if (current === 'warmup') return 'failure';
  return 'working';
}

function setTypeLabel(setType: SetType | undefined, index: number): string {
  if (setType === 'warmup') return 'W';
  if (setType === 'failure') return 'F';
  return String(index + 1);
}

export default function EditWorkoutScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ workoutId?: string }>();
  const workoutId = typeof params.workoutId === 'string' ? params.workoutId : undefined;

  const { workouts, settings, updateWorkout, getWorkoutById } = useGym();

  const [draft, setDraft] = useState<CompletedWorkout | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const existingFromState = useMemo(() => {
    if (!workoutId) return undefined;
    return workouts.find((w) => w.id === workoutId);
  }, [workouts, workoutId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!workoutId) {
        setLoading(false);
        return;
      }

      const fromState = existingFromState;
      if (fromState) {
        if (!cancelled) {
          setDraft(deepCopyWorkout(fromState));
          setLoading(false);
        }
        return;
      }

      try {
        const fromStorage = await getWorkoutById(workoutId);
        if (!cancelled) {
          setDraft(fromStorage ? deepCopyWorkout(fromStorage) : null);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setDraft(null);
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [workoutId, existingFromState, getWorkoutById]);

  const handleBack = () => {
    router.back();
  };

  const handleUpdateSet = (
    exerciseIndex: number,
    setIndex: number,
    field: 'weight' | 'reps',
    displayValue: number
  ) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = deepCopyWorkout(prev);
      const ex = next.exercises[exerciseIndex];
      const set = ex?.sets[setIndex];
      if (!ex || !set) return prev;

      if (field === 'weight') {
        const storedKg = settings.weightUnit === 'lbs' ? lbsToKg(displayValue) : displayValue;
        set.weight = isFinite(storedKg) ? storedKg : 0;
        set.isWeightPlaceholder = false;
      } else {
        set.reps = isFinite(displayValue) ? Math.max(0, Math.trunc(displayValue)) : 0;
        set.isRepsPlaceholder = false;
      }

      return next;
    });
  };

  const handleToggleSetComplete = (exerciseIndex: number, setIndex: number) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = deepCopyWorkout(prev);
      const ex = next.exercises[exerciseIndex];
      const set = ex?.sets[setIndex];
      if (!ex || !set) return prev;
      set.completed = set.completed === false ? true : false;
      return next;
    });
  };

  const handleCycleSetType = (exerciseIndex: number, setIndex: number) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = deepCopyWorkout(prev);
      const ex = next.exercises[exerciseIndex];
      const set = ex?.sets[setIndex];
      if (!ex || !set) return prev;
      set.setType = cycleSetType(set.setType);
      return next;
    });
  };

  const handleDeleteSet = (exerciseIndex: number, setIndex: number) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = deepCopyWorkout(prev);
      const ex = next.exercises[exerciseIndex];
      if (!ex) return prev;
      ex.sets = ex.sets.filter((_, idx) => idx !== setIndex).map((s, idx) => ({ ...s, setNumber: idx + 1 }));
      return next;
    });
  };

  const handleAddSet = (exerciseIndex: number) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = deepCopyWorkout(prev);
      const ex = next.exercises[exerciseIndex];
      if (!ex) return prev;

      const newSet: CompletedSet = {
        setNumber: ex.sets.length + 1,
        reps: 0,
        weight: 0,
        unit: (settings.weightUnit || 'kg') as WeightUnit,
        timestamp: prev.endTime,
        completed: true,
        setType: 'working',
      };

      ex.sets = [...ex.sets, newSet];
      return next;
    });
  };

  const handleRemoveExercise = (exerciseIndex: number) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = deepCopyWorkout(prev);
      next.exercises = next.exercises.filter((_, idx) => idx !== exerciseIndex);
      return next;
    });
  };

  const handleSave = async () => {
    if (!draft) return;

    setSaving(true);
    try {
      const normalizedExercises: CompletedExercise[] = draft.exercises.map((ex) => ({
        ...ex,
        sets: ex.sets.map((s, idx) => ({
          ...s,
          setNumber: idx + 1,
        })),
      }));

      const updated: CompletedWorkout = {
        ...draft,
        exercises: normalizedExercises,
      };

      await updateWorkout(updated);
      router.back();
    } catch (e) {
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ScreenContainer className="p-4">
        <Text className="text-foreground">Loading…</Text>
      </ScreenContainer>
    );
  }

  if (!draft || !workoutId) {
    return (
      <ScreenContainer className="p-4">
        <View style={{ gap: 12 }}>
          <Text className="text-2xl font-bold text-foreground">Workout not found</Text>
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => ({
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 10,
              opacity: pressed ? 0.7 : 1,
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            })}
          >
            <IconSymbol name="arrow.left" size={18} color={colors.foreground} />
            <Text className="text-foreground">Back</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.background,
        }}
      >
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            opacity: pressed ? 0.7 : 1,
            paddingVertical: 6,
            paddingHorizontal: 6,
          })}
        >
          <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: '600' }}>Edit Workout</Text>
        </Pressable>

        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: colors.primary,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 10,
            opacity: saving ? 0.6 : pressed ? 0.8 : 1,
          })}
        >
          <IconSymbol name="checkmark" size={18} color={colors.background} />
          <Text style={{ color: colors.background, fontWeight: '700' }}>{saving ? 'Saving…' : 'Save'}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 14 }}>
        {/* Basic info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{draft.name}</CardTitle>
            <Text style={{ color: colors.muted, marginTop: 4 }}>
              {new Date(draft.startTime).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </CardHeader>
          <CardContent style={{ gap: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Workout notes</Text>
            <TextInput
              value={draft.notes || ''}
              onChangeText={(text) => setDraft((prev) => (prev ? { ...prev, notes: text } : prev))}
              placeholder="Notes (optional)"
              placeholderTextColor={colors.muted}
              multiline
              style={{
                minHeight: 80,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 10,
                padding: 10,
                color: colors.foreground,
                backgroundColor: colors.surface,
                textAlignVertical: 'top',
              }}
            />
          </CardContent>
        </Card>

        {/* Exercises */}
        {draft.exercises.map((exercise, exerciseIndex) => {
          const showWeight = getShowWeightInput(exercise.type);
          return (
            <Card key={`${exercise.id}-${exerciseIndex}`}>
              <CardHeader>
                <CardTitle className="text-base">{exercise.name}</CardTitle>
              </CardHeader>
              <CardContent style={{ gap: 10 }}>
                {exercise.sets.length === 0 ? (
                  <Text style={{ color: colors.muted }}>No sets</Text>
                ) : (
                  <View style={{ gap: 8 }}>
                    {exercise.sets.map((set, setIndex) => {
                      const label = setTypeLabel(set.setType, setIndex);
                      const displayWeight = Math.round(convertWeight(set.weight || 0, settings.weightUnit));
                      return (
                        <View
                          key={`${set.timestamp}-${setIndex}`}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                            paddingVertical: 8,
                            paddingHorizontal: 10,
                            borderWidth: 1,
                            borderColor: colors.border,
                            borderRadius: 10,
                            backgroundColor: colors.surface,
                            opacity: set.completed === false ? 0.6 : 1,
                          }}
                        >
                          {/* Set label / type */}
                          <Pressable
                            onPress={() => handleCycleSetType(exerciseIndex, setIndex)}
                            style={({ pressed }) => ({
                              width: 30,
                              height: 30,
                              borderRadius: 8,
                              borderWidth: 1,
                              borderColor: colors.border,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: colors.background,
                              opacity: pressed ? 0.7 : 1,
                            })}
                          >
                            <Text style={{
                              color:
                                set.setType === 'warmup'
                                  ? (colors.warning || colors.muted)
                                  : set.setType === 'failure'
                                    ? colors.error
                                    : colors.foreground,
                              fontWeight: '800',
                            }}>
                              {label}
                            </Text>
                          </Pressable>

                          {showWeight && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <TextInput
                                value={set.isWeightPlaceholder ? '' : String(displayWeight)}
                                placeholder={String(displayWeight)}
                                placeholderTextColor={colors.muted}
                                onChangeText={(val) => handleUpdateSet(exerciseIndex, setIndex, 'weight', parseFloat(val) || 0)}
                                keyboardType="decimal-pad"
                                style={{
                                  width: 70,
                                  height: 36,
                                  borderWidth: 1,
                                  borderColor: colors.border,
                                  borderRadius: 8,
                                  backgroundColor: colors.background,
                                  paddingHorizontal: 10,
                                  color: colors.foreground,
                                  textAlign: 'center',
                                  fontWeight: '700',
                                }}
                              />
                              <Text style={{ color: colors.muted, fontSize: 12 }}>{settings.weightUnit}</Text>
                            </View>
                          )}

                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <TextInput
                              value={set.isRepsPlaceholder ? '' : String(set.reps || 0)}
                              placeholder={String(set.reps || 0)}
                              placeholderTextColor={colors.muted}
                              onChangeText={(val) => handleUpdateSet(exerciseIndex, setIndex, 'reps', parseInt(val, 10) || 0)}
                              keyboardType="numeric"
                              style={{
                                width: 60,
                                height: 36,
                                borderWidth: 1,
                                borderColor: colors.border,
                                borderRadius: 8,
                                backgroundColor: colors.background,
                                paddingHorizontal: 10,
                                color: colors.foreground,
                                textAlign: 'center',
                                fontWeight: '700',
                              }}
                            />
                            <Text style={{ color: colors.muted, fontSize: 12 }}>reps</Text>
                          </View>

                          <View style={{ flex: 1 }} />

                          <Pressable
                            onPress={() => handleToggleSetComplete(exerciseIndex, setIndex)}
                            style={({ pressed }) => ({
                              width: 34,
                              height: 34,
                              borderRadius: 10,
                              borderWidth: 2,
                              borderColor: set.completed === false ? colors.border : colors.success,
                              backgroundColor: set.completed === false ? 'transparent' : colors.success,
                              alignItems: 'center',
                              justifyContent: 'center',
                              opacity: pressed ? 0.7 : 1,
                            })}
                          >
                            {set.completed === false ? null : (
                              <Text style={{ color: colors.background, fontWeight: '900' }}>✓</Text>
                            )}
                          </Pressable>

                          <Pressable
                            onPress={() => handleDeleteSet(exerciseIndex, setIndex)}
                            style={({ pressed }) => ({
                              width: 34,
                              height: 34,
                              borderRadius: 10,
                              alignItems: 'center',
                              justifyContent: 'center',
                              opacity: pressed ? 0.7 : 1,
                            })}
                          >
                            <IconSymbol name="trash" size={18} color={colors.error} />
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                )}

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable
                    onPress={() => handleAddSet(exerciseIndex)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <IconSymbol name="plus" size={18} color={colors.primary} />
                    <Text style={{ color: colors.foreground, fontWeight: '700' }}>Add set</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      Alert.alert(
                        'Remove exercise?',
                        `Remove ${exercise.name} from this workout?`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Remove',
                            style: 'destructive',
                            onPress: () => handleRemoveExercise(exerciseIndex),
                          },
                        ]
                      );
                    }}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <IconSymbol name="trash" size={18} color={colors.error} />
                    <Text style={{ color: colors.error, fontWeight: '700' }}>Remove</Text>
                  </Pressable>
                </View>

                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  Tip: tap the set number to cycle set type (Working → Warmup → Failure).
                </Text>
              </CardContent>
            </Card>
          );
        })}
      </ScrollView>
    </ScreenContainer>
  );
}
