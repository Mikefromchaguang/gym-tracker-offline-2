import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePreventRemove } from '@react-navigation/native';
import Body from 'react-native-body-highlighter';
import { ScreenContainer } from '@/components/screen-container';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { useBodyweight } from '@/hooks/use-bodyweight';
import { useGym } from '@/lib/gym-context';
import { getDayName } from '@/lib/week-utils';
import {
  CompletedSet,
  ExerciseType,
  MuscleGroup,
  WeekPlan,
  WeekPlanDay,
  WeekStartDay,
  getEffectiveExerciseMuscles,
  getExerciseMuscles,
} from '@/lib/types';
import { getExerciseContributions } from '@/lib/muscle-contribution';
import { calculateTemplateExerciseVolume } from '@/lib/volume-calculation';
import { formatVolume } from '@/lib/unit-conversion';
import { getMuscleGroupDisplayName } from '@/lib/muscle-groups';

const ROUTINE_MUSCLE_MAP: Partial<Record<MuscleGroup, string[]>> = {
  chest: ['chest'],
  'upper-back': ['upper-back'],
  'lower-back': ['lower-back'],
  lats: ['back-deltoids'],
  'deltoids-front': ['deltoids'],
  'deltoids-side': ['deltoids'],
  'deltoids-rear': ['back-deltoids'],
  deltoids: ['deltoids'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  forearms: ['forearm'],
  abs: ['abs'],
  obliques: ['obliques'],
  quadriceps: ['quadriceps'],
  hamstring: ['hamstring'],
  gluteal: ['gluteal'],
  calves: ['calves'],
  trapezius: ['trapezius'],
  adductors: ['adductors'],
  tibialis: ['tibialis-anterior'],
  neck: ['neck'],
};

const buildEmptyDays = (): WeekPlanDay[] =>
  ([0, 1, 2, 3, 4, 5, 6] as WeekStartDay[]).map((dayIndex) => ({ dayIndex, routineIds: [] }));

export default function EditWeekPlanScreen() {
  const router = useRouter();
  const colors = useColors();
  const { bodyWeightKg: currentBodyweight } = useBodyweight();
  const {
    templates,
    weekPlans,
    addWeekPlan,
    updateWeekPlan,
    deleteWeekPlan,
    customExercises,
    predefinedExerciseCustomizations,
    settings,
  } = useGym();
  const { planId } = useLocalSearchParams<{ planId?: string }>();

  const editingPlan = useMemo(
    () => (planId ? weekPlans.find((p) => p.id === planId) : undefined),
    [planId, weekPlans]
  );

  const [name, setName] = useState('');
  const [days, setDays] = useState<WeekPlanDay[]>(buildEmptyDays());
  const [showRoutinePicker, setShowRoutinePicker] = useState(false);
  const [pickerDayIndex, setPickerDayIndex] = useState<WeekStartDay>(1);
  const [saving, setSaving] = useState(false);
  const [allowRemove, setAllowRemove] = useState(false);
  const [initialName, setInitialName] = useState('');
  const [initialDaysSignature, setInitialDaysSignature] = useState('[]');

  useEffect(() => {
    if (!editingPlan) {
      const defaultName = 'My Week Planner';
      const defaultDays = buildEmptyDays();
      setName(defaultName);
      setDays(defaultDays);
      setInitialName(defaultName);
      setInitialDaysSignature(JSON.stringify(defaultDays));
      return;
    }

    setName(editingPlan.name);
    const merged = buildEmptyDays().map((d) => ({
      ...d,
      routineIds: editingPlan.days.find((x) => x.dayIndex === d.dayIndex)?.routineIds ?? [],
    }));
    setDays(merged);
    setInitialName(editingPlan.name);
    setInitialDaysSignature(JSON.stringify(merged));
  }, [editingPlan]);

  const hasUnsavedChanges = useMemo(() => {
    const currentName = name.trim();
    const baseName = initialName.trim();
    if (currentName !== baseName) return true;
    return JSON.stringify(days) !== initialDaysSignature;
  }, [name, days, initialName, initialDaysSignature]);

  const handleBackPress = useCallback(() => {
    if (!hasUnsavedChanges) {
      router.back();
      return;
    }

    Alert.alert(
      'Discard changes?',
      'You have unsaved changes. Are you sure you want to discard them?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            setInitialName(name.trim());
            setInitialDaysSignature(JSON.stringify(days));
            setAllowRemove(true);
            setTimeout(() => {
              router.back();
            }, 0);
          },
        },
      ]
    );
  }, [hasUnsavedChanges, name, days, router]);

  usePreventRemove(hasUnsavedChanges && !allowRemove, () => {
    Alert.alert(
      'Discard changes?',
      'You have unsaved changes. Are you sure you want to discard them?',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => {} },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            setInitialName(name.trim());
            setInitialDaysSignature(JSON.stringify(days));
            setAllowRemove(true);
            setTimeout(() => {
              router.back();
            }, 0);
          },
        },
      ]
    );
  });

  const orderedDays = useMemo(() => {
    const start = settings.weekStartDay ?? 1;
    return ([0, 1, 2, 3, 4, 5, 6] as WeekStartDay[]).map((_, i) => ((start + i) % 7) as WeekStartDay);
  }, [settings.weekStartDay]);

  const addRoutineToDay = useCallback((dayIndex: WeekStartDay, routineId: string) => {
    setDays((prev) =>
      prev.map((d) => {
        if (d.dayIndex !== dayIndex) return d;
        if (d.routineIds.includes(routineId)) return d;
        return { ...d, routineIds: [...d.routineIds, routineId] };
      })
    );
  }, []);

  const removeRoutineFromDay = useCallback((dayIndex: WeekStartDay, routineId: string) => {
    setDays((prev) => prev.map((d) => (d.dayIndex === dayIndex ? { ...d, routineIds: d.routineIds.filter((id) => id !== routineId) } : d)));
  }, []);

  const totalSessions = useMemo(() => days.reduce((acc, d) => acc + d.routineIds.length, 0), [days]);

  const scheduledTemplates = useMemo(() => {
    const list: typeof templates = [];
    for (const day of days) {
      for (const routineId of day.routineIds) {
        const routine = templates.find((t) => t.id === routineId);
        if (routine) list.push(routine);
      }
    }
    return list;
  }, [days, templates]);

  const planSummary = useMemo(() => {
    let exercisesCount = 0;
    let setsCount = 0;
    let repsCount = 0;
    let totalVolume = 0;

    scheduledTemplates.forEach((routine) => {
      exercisesCount += routine.exercises.length;

      routine.exercises.forEach((exercise) => {
        const configuredSets: CompletedSet[] = exercise.setDetails?.length
          ? exercise.setDetails.map((setConfig, i) => ({
              setNumber: i + 1,
              reps: setConfig.reps,
              weight: setConfig.weight,
              unit: setConfig.unit,
              setType: setConfig.setType,
              timestamp: 0,
            }))
          : Array.from({ length: exercise.sets }, (_, i) => ({
              setNumber: i + 1,
              reps: exercise.reps,
              weight: exercise.weight ?? 0,
              unit: exercise.unit,
              setType: 'working',
              timestamp: 0,
            }));

        const workingSets = configuredSets.filter((s) => s.setType !== 'warmup' && !!s.reps);
        setsCount += workingSets.length;
        repsCount += workingSets.reduce((acc, s) => acc + (s.reps || 0), 0);
        totalVolume += calculateTemplateExerciseVolume(workingSets, (exercise.type || 'weighted') as ExerciseType, currentBodyweight);
      });
    });

    return {
      totalVolume,
      exercisesCount,
      setsCount,
      repsCount,
    };
  }, [scheduledTemplates, currentBodyweight]);

  const muscleBreakdown = useMemo(() => {
    type Row = {
      muscle: MuscleGroup;
      name: string;
      primarySets: number;
      secondarySets: number;
      primaryVolume: number;
      secondaryVolume: number;
    };

    const byMuscle = new Map<MuscleGroup, Omit<Row, 'muscle' | 'name'>>();
    const ensure = (muscle: MuscleGroup) => {
      const current = byMuscle.get(muscle);
      if (current) return current;
      const initial = { primarySets: 0, secondarySets: 0, primaryVolume: 0, secondaryVolume: 0 };
      byMuscle.set(muscle, initial);
      return initial;
    };

    for (const routine of scheduledTemplates) {
      for (const ex of routine.exercises) {
        const exName = ex.name;

        let muscleMeta: any;
        const predefinedBase = getExerciseMuscles(exName);
        if (predefinedBase) {
          muscleMeta = {
            ...(predefinedBase as any),
            primaryMuscle: ((predefinedExerciseCustomizations as any)?.[exName]?.primaryMuscle ?? (predefinedBase as any).primaryMuscle) as MuscleGroup,
            secondaryMuscles: (((predefinedExerciseCustomizations as any)?.[exName]?.secondaryMuscles ?? (predefinedBase as any).secondaryMuscles ?? []) as MuscleGroup[]),
            muscleContributions: (predefinedExerciseCustomizations as any)?.[exName]?.muscleContributions,
          } as any;
        } else {
          const customEx = customExercises.find((ce) => ce.name.toLowerCase() === exName.toLowerCase());
          const isCustom = !getExerciseMuscles(exName);
          muscleMeta = getEffectiveExerciseMuscles(exName, predefinedExerciseCustomizations as any, isCustom, customEx) as any;
        }

        if (!muscleMeta) continue;

        const exerciseType = (ex.type || 'weighted') as ExerciseType;
        const contributions = getExerciseContributions(muscleMeta);
        const primary = muscleMeta.primaryMuscle as MuscleGroup;
        const secondaries = ((muscleMeta.secondaryMuscles || []) as MuscleGroup[]).filter(Boolean);

        const configuredSets: CompletedSet[] = ex.setDetails?.length
          ? ex.setDetails.map((setConfig, i) => ({
              setNumber: i + 1,
              reps: setConfig.reps,
              weight: setConfig.weight,
              unit: setConfig.unit,
              setType: setConfig.setType,
              timestamp: 0,
            }))
          : Array.from({ length: ex.sets }, (_, i) => ({
              setNumber: i + 1,
              reps: ex.reps,
              weight: ex.weight ?? 0,
              unit: ex.unit,
              setType: 'working',
              timestamp: 0,
            }));

        const workingSets = configuredSets.filter((s) => s.setType !== 'warmup' && !!s.reps);
        if (workingSets.length === 0) continue;

        const totalExerciseVolume = calculateTemplateExerciseVolume(workingSets, exerciseType, currentBodyweight);
        const primaryContrib = contributions[primary] ?? 100;

        const p = ensure(primary);
        p.primarySets += workingSets.length;
        p.primaryVolume += totalExerciseVolume * (primaryContrib / 100);

        for (const sec of secondaries) {
          const secContrib = contributions[sec] ?? 0;
          if (secContrib <= 0) continue;
          const s = ensure(sec);
          s.secondarySets += workingSets.length * (secContrib / 100);
          s.secondaryVolume += totalExerciseVolume * (secContrib / 100);
        }
      }
    }

    const rows: Row[] = Array.from(byMuscle.entries())
      .map(([muscle, stats]) => ({
        muscle,
        name: getMuscleGroupDisplayName(muscle),
        ...stats,
      }))
      .filter((r) => r.primarySets + r.secondarySets > 0)
      .sort((a, b) => b.primarySets + b.secondarySets - (a.primarySets + a.secondarySets));

    return rows;
  }, [scheduledTemplates, customExercises, predefinedExerciseCustomizations, currentBodyweight]);

  const bodyMapData = useMemo(() => {
    const active = new Set<string>();
    muscleBreakdown.forEach((row) => {
      const slugs = ROUTINE_MUSCLE_MAP[row.muscle];
      if (!slugs) return;
      slugs.forEach((s) => active.add(s));
    });
    return Array.from(active).map((slug) => ({ slug, intensity: 1 }));
  }, [muscleBreakdown]);

  const maxSets = useMemo(() => {
    let max = 1;
    muscleBreakdown.forEach((r) => {
      max = Math.max(max, r.primarySets + r.secondarySets);
    });
    return max;
  }, [muscleBreakdown]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter a plan name.');
      return;
    }

    setSaving(true);
    try {
      const payload: WeekPlan = {
        id: editingPlan?.id || '',
        name: name.trim(),
        days,
        createdAt: editingPlan?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      if (editingPlan) {
        await updateWeekPlan(payload);
      } else {
        await addWeekPlan(payload);
      }

      // Use replace instead of back to avoid closing app when this screen is the first route in stack.
      setInitialName(name.trim());
      setInitialDaysSignature(JSON.stringify(days));
      setAllowRemove(true);
      setTimeout(() => {
        router.replace('/_hidden/week-plans');
      }, 0);
    } catch (error) {
      console.error('[WeekPlanner] Save failed:', error);
      Alert.alert('Save failed', 'There was a problem saving this plan. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!editingPlan) return;
    Alert.alert('Delete Plan', `Delete "${editingPlan.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteWeekPlan(editingPlan.id);
          setAllowRemove(true);
          router.replace('/_hidden/week-plans');
        },
      },
    ]);
  };

  return (
    <ScreenContainer className="p-4 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="gap-4">
          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <Pressable onPress={handleBackPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                <IconSymbol name="chevron.left" size={28} color={colors.foreground} />
              </Pressable>
              {editingPlan ? (
                <Pressable onPress={handleDelete} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                  <IconSymbol name="trash" size={20} color={colors.error} />
                </Pressable>
              ) : <View style={{ width: 20 }} />}
            </View>
            <Text className="text-3xl font-bold text-foreground">{editingPlan ? 'Edit Week Planner' : 'New Week Planner'}</Text>
            <Text className="text-sm text-muted">Assign routines to each day and preview weekly muscle distribution</Text>
          </View>

          <Card>
            <CardContent className="pt-4 gap-2">
              <Text className="text-xs font-semibold text-muted">Plan Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="My Week Planner"
                placeholderTextColor={colors.muted}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: colors.foreground,
                  fontSize: 16,
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Plan Summary</CardTitle>
              <CardDescription>Planned weekly distribution</CardDescription>
            </CardHeader>
            <CardContent className="gap-3">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    backgroundColor: colors.background,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    paddingVertical: 6,
                    paddingHorizontal: 6,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    <Body data={bodyMapData as any} colors={['#FF4D4D']} scale={0.38} side="front" gender={(settings.bodyMapGender as any) || 'male'} />
                    <Body data={bodyMapData as any} colors={['#FF4D4D']} scale={0.38} side="back" gender={(settings.bodyMapGender as any) || 'male'} />
                  </View>
                </View>

                <View style={{ flex: 1, gap: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '700' }}>Volume ({settings.weightUnit})</Text>
                    <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '800' }}>{formatVolume(planSummary.totalVolume, settings.weightUnit)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '700' }}>Sessions</Text>
                    <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '800' }}>{totalSessions}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '700' }}>Exercises</Text>
                    <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '800' }}>{planSummary.exercisesCount}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '700' }}>Sets</Text>
                    <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '800' }}>{planSummary.setsCount}</Text>
                  </View>
                </View>
              </View>

              <ScrollView
                nestedScrollEnabled
                style={{ maxHeight: 220 }}
                contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
                showsVerticalScrollIndicator
              >
                {muscleBreakdown.map((row) => {
                  const totalSetsForMuscle = row.primarySets + row.secondarySets;
                  const rowWidthPct = (totalSetsForMuscle / maxSets) * 100;
                  const total = row.primarySets + row.secondarySets;
                  const primaryPct = total > 0 ? (row.primarySets / total) * 100 : 0;
                  const secondaryPct = total > 0 ? (row.secondarySets / total) * 100 : 0;

                  return (
                    <View key={row.muscle} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text numberOfLines={1} style={{ width: 80, fontSize: 12, fontWeight: '500', color: colors.foreground }}>
                        {row.name}
                      </Text>
                      <View style={{ flex: 1, height: 16 }}>
                        <View style={{ width: `${rowWidthPct}%`, height: 16, borderRadius: 4, overflow: 'hidden', flexDirection: 'row', backgroundColor: colors.border }}>
                          <View style={{ width: `${primaryPct}%`, backgroundColor: '#6B7280' }} />
                          <View style={{ width: `${secondaryPct}%`, backgroundColor: '#9CA3AF' }} />
                        </View>
                      </View>
                      <View style={{ width: 110, alignItems: 'flex-end' }}>
                        <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '600', color: colors.foreground }}>
                          {totalSetsForMuscle % 1 === 0 ? totalSetsForMuscle : totalSetsForMuscle.toFixed(1)} sets
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </CardContent>
          </Card>

          {orderedDays.map((dayIndex) => {
            const day = days.find((d) => d.dayIndex === dayIndex) || { dayIndex, routineIds: [] };
            return (
              <Card key={dayIndex}>
                <CardHeader>
                  <View className="flex-row items-center justify-between">
                    <CardTitle>{getDayName(dayIndex)}</CardTitle>
                    <Pressable
                      onPress={() => {
                        setPickerDayIndex(dayIndex);
                        setShowRoutinePicker(true);
                      }}
                    >
                      <Text className="text-xs font-semibold text-primary">Add Routine</Text>
                    </Pressable>
                  </View>
                </CardHeader>
                <CardContent className="gap-2">
                  {day.routineIds.length === 0 ? (
                    <Text className="text-xs text-muted">No routines scheduled</Text>
                  ) : (
                    day.routineIds.map((id) => {
                      const routine = templates.find((t) => t.id === id);
                      if (!routine) {
                        return (
                          <View key={id} className="flex-row items-center justify-between">
                            <Text className="text-xs text-muted">Missing routine</Text>
                            <Pressable onPress={() => removeRoutineFromDay(dayIndex, id)}>
                              <IconSymbol name="xmark.circle.fill" size={16} color={colors.muted} />
                            </Pressable>
                          </View>
                        );
                      }

                      return (
                        <View
                          key={id}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: colors.surface,
                            borderRadius: 10,
                            paddingVertical: 8,
                            paddingHorizontal: 10,
                            gap: 8,
                          }}
                        >
                          <Text className="text-sm font-medium text-foreground" style={{ flex: 1 }}>{routine.name}</Text>
                          <Pressable onPress={() => router.push({ pathname: '/_hidden/templates/create', params: { templateId: routine.id } })}>
                            <IconSymbol name="pencil" size={15} color={colors.primary} />
                          </Pressable>
                          <Pressable onPress={() => removeRoutineFromDay(dayIndex, id)}>
                            <IconSymbol name="xmark.circle.fill" size={16} color={colors.muted} />
                          </Pressable>
                        </View>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            );
          })}

          <Button
            variant="secondary"
            size="lg"
            onPress={() => router.push('/_hidden/templates/create')}
            className="w-full"
          >
            <IconSymbol size={18} name="plus" color={colors.foreground} />
            <Text className="text-foreground font-semibold">Create Routine</Text>
          </Button>

          <Button size="lg" onPress={handleSave} disabled={saving} className="w-full">
            {saving ? 'Saving...' : editingPlan ? 'Save Plan' : 'Create Plan'}
          </Button>
        </View>
      </ScrollView>

      <Modal visible={showRoutinePicker} transparent animationType="fade" onRequestClose={() => setShowRoutinePicker(false)}>
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}
          onPress={() => setShowRoutinePicker(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 420,
              maxHeight: '70%',
              backgroundColor: colors.background,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: 'hidden',
            }}
          >
            <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: '700' }}>
                Add routine to {getDayName(pickerDayIndex)}
              </Text>
            </View>

            <ScrollView>
              <View style={{ padding: 12, gap: 8 }}>
                {templates.length === 0 ? (
                  <Text style={{ color: colors.muted, fontSize: 13 }}>No routines available.</Text>
                ) : (
                  templates.map((routine) => {
                    const alreadyAdded = (days.find((d) => d.dayIndex === pickerDayIndex)?.routineIds || []).includes(routine.id);
                    return (
                      <Pressable
                        key={routine.id}
                        disabled={alreadyAdded}
                        onPress={() => {
                          addRoutineToDay(pickerDayIndex, routine.id);
                          setShowRoutinePicker(false);
                        }}
                        style={({ pressed }) => [{
                          paddingVertical: 10,
                          paddingHorizontal: 10,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: alreadyAdded ? colors.surface : (pressed ? colors.surface : colors.background),
                          opacity: alreadyAdded ? 0.5 : 1,
                        }]}
                      >
                        <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: '600' }}>{routine.name}</Text>
                        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{routine.exercises.length} exercises</Text>
                      </Pressable>
                    );
                  })
                )}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}
