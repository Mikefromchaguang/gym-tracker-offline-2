import { View, Text, Pressable, ScrollView, TextInput, Platform, Modal, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGym } from '@/lib/gym-context';
import { useEffect, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { getDayName } from '@/lib/week-utils';
import type { WeekStartDay } from '@/lib/types';
import { PREDEFINED_EXERCISES_WITH_MUSCLES } from '@/lib/types';
import { CustomExerciseStorage, PredefinedExerciseCustomizationStorage } from '@/lib/storage';

export default function PreferencesScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    settings,
    updateSettings,
    templates,
    updateTemplate,
    customExercises,
    predefinedExerciseCustomizations,
    refreshData,
  } = useGym();

  const [restTimeInput, setRestTimeInput] = useState((settings.defaultRestTime || 90).toString());
  const [defaultAutoMinInput, setDefaultAutoMinInput] = useState((settings.defaultAutoProgressionMinReps || 8).toString());
  const [defaultAutoMaxInput, setDefaultAutoMaxInput] = useState((settings.defaultAutoProgressionMaxReps || 12).toString());
  const [defaultAutoWeightIncrementInput, setDefaultAutoWeightIncrementInput] = useState(
    (settings.defaultAutoProgressionWeightIncrement ?? 2.5).toString()
  );
  const [showWeekStartPicker, setShowWeekStartPicker] = useState(false);

  const weekStartDay = settings.weekStartDay ?? 1; // Default to Monday

  useEffect(() => {
    if (settings.defaultRestTime) {
      setRestTimeInput(settings.defaultRestTime.toString());
    }
  }, [settings.defaultRestTime]);

  useEffect(() => {
    if (settings.defaultAutoProgressionMinReps) {
      setDefaultAutoMinInput(settings.defaultAutoProgressionMinReps.toString());
    }
    if (settings.defaultAutoProgressionMaxReps) {
      setDefaultAutoMaxInput(settings.defaultAutoProgressionMaxReps.toString());
    }
    if (typeof settings.defaultAutoProgressionWeightIncrement === 'number') {
      setDefaultAutoWeightIncrementInput(settings.defaultAutoProgressionWeightIncrement.toString());
    }
  }, [
    settings.defaultAutoProgressionMinReps,
    settings.defaultAutoProgressionMaxReps,
    settings.defaultAutoProgressionWeightIncrement,
  ]);

  const handleRestTimeChange = (text: string) => {
    setRestTimeInput(text);
    const value = parseInt(text, 10);
    if (!isNaN(value) && value > 0 && value <= 600) {
      updateSettings({ defaultRestTime: value });
    }
  };

  const applyDefaultRepRangeToTemplates = async (
    nextMin: number,
    nextMax: number,
    prevMin: number,
    prevMax: number,
    includeUsedOverrides = false
  ) => {
    const updates = templates
      .map((template) => {
        let changed = false;

        const updatedExercises = template.exercises.map((ex) => {
          const autoProgressionAvailable =
            ex.type !== 'bodyweight' && ex.type !== 'assisted-bodyweight';
          if (!autoProgressionAvailable) {
            const needsDisable =
              ex.autoProgressionEnabled !== false ||
              ex.autoProgressionMinReps !== undefined ||
              ex.autoProgressionMaxReps !== undefined ||
              ex.autoProgressionUseDefaultRange !== false ||
              ex.autoProgressionUsePreferredRange !== false;
            if (!needsDisable) {
              return ex;
            }
            changed = true;
            return {
              ...ex,
              autoProgressionEnabled: false,
              autoProgressionMinReps: undefined,
              autoProgressionMaxReps: undefined,
              autoProgressionUseDefaultRange: false,
              autoProgressionUsePreferredRange: false,
            };
          }

          // Legacy inference: if this exercise has a non-default stored range and no source flag,
          // treat it as customized so preference changes won't overwrite it.
          const hasStoredRange =
            typeof ex.autoProgressionMinReps === 'number' &&
            typeof ex.autoProgressionMaxReps === 'number';
          const looksLikeLegacyCustomRange =
            ex.autoProgressionUseDefaultRange === undefined &&
            hasStoredRange &&
            (ex.autoProgressionMinReps !== prevMin || ex.autoProgressionMaxReps !== prevMax);

          const isCustomRange =
            ex.autoProgressionUseDefaultRange === false ||
            ex.autoProgressionUsePreferredRange === true ||
            looksLikeLegacyCustomRange;

          if (!includeUsedOverrides && isCustomRange) {
            if (looksLikeLegacyCustomRange) {
              changed = true;
              return {
                ...ex,
                autoProgressionUseDefaultRange: false,
              };
            }
            return ex;
          }

          const needsUpdate =
            ex.autoProgressionMinReps !== nextMin ||
            ex.autoProgressionMaxReps !== nextMax ||
            ex.autoProgressionUseDefaultRange !== true;

          if (!needsUpdate) {
            return ex;
          }

          changed = true;
          return {
            ...ex,
            autoProgressionMinReps: nextMin,
            autoProgressionMaxReps: nextMax,
            autoProgressionUseDefaultRange: true,
            autoProgressionUsePreferredRange: false,
          };
        });

        if (!changed) {
          return null;
        }

        return {
          ...template,
          exercises: updatedExercises,
        };
      })
      .filter((template): template is NonNullable<typeof template> => template !== null);

    if (updates.length === 0) {
      return;
    }

    for (const template of updates) {
      await updateTemplate(template);
    }
  };

  const getRepRangePropagationCounts = (prevMin: number, prevMax: number) => {
    let inheritedCount = 0;
    let overrideCount = 0;
    templates.forEach((template) => {
      template.exercises.forEach((ex) => {
        const autoProgressionAvailable =
          ex.type !== 'bodyweight' && ex.type !== 'assisted-bodyweight';
        if (!autoProgressionAvailable) return;

        const hasStoredRange =
          typeof ex.autoProgressionMinReps === 'number' &&
          typeof ex.autoProgressionMaxReps === 'number';
        const looksLikeLegacyCustomRange =
          ex.autoProgressionUseDefaultRange === undefined &&
          hasStoredRange &&
          (ex.autoProgressionMinReps !== prevMin || ex.autoProgressionMaxReps !== prevMax);

        const isCustomRange =
          ex.autoProgressionUseDefaultRange === false ||
          ex.autoProgressionUsePreferredRange === true ||
          looksLikeLegacyCustomRange;

        if (isCustomRange) {
          overrideCount += 1;
        } else {
          inheritedCount += 1;
        }
      });
    });
    return {
      inheritedCount,
      overrideCount,
      totalCount: inheritedCount + overrideCount,
    };
  };

  const applyDefaultRangeToExercisePreferences = async (
    nextMin: number,
    nextMax: number,
    mode: 'fill-missing' | 'overwrite-all'
  ) => {
    let customUpdated = 0;
    let predefinedUpdated = 0;

    for (const ex of customExercises) {
      const exerciseType = ex.type || ex.exerciseType || 'weighted';
      const autoProgressionAvailable =
        exerciseType !== 'bodyweight' && exerciseType !== 'assisted-bodyweight';
      if (!autoProgressionAvailable) continue;

      const hasMin = typeof ex.preferredAutoProgressionMinReps === 'number';
      const hasMax = typeof ex.preferredAutoProgressionMaxReps === 'number';
      const shouldUpdate = mode === 'overwrite-all' ? true : (!hasMin || !hasMax);

      if (!shouldUpdate) continue;

      await CustomExerciseStorage.save({
        ...ex,
        preferredAutoProgressionMinReps:
          mode === 'overwrite-all' ? nextMin : (hasMin ? ex.preferredAutoProgressionMinReps : nextMin),
        preferredAutoProgressionMaxReps:
          mode === 'overwrite-all' ? nextMax : (hasMax ? ex.preferredAutoProgressionMaxReps : nextMax),
      });
      customUpdated += 1;
    }

    const predefinedNames = PREDEFINED_EXERCISES_WITH_MUSCLES.map((ex) => ex.name);

    for (const name of predefinedNames) {
      const current = (predefinedExerciseCustomizations as any)[name] ?? {};
      const predefined = PREDEFINED_EXERCISES_WITH_MUSCLES.find((ex) => ex.name === name);
      const exerciseType = current.exerciseType || current.type || predefined?.exerciseType || 'weighted';
      const autoProgressionAvailable =
        exerciseType !== 'bodyweight' && exerciseType !== 'assisted-bodyweight';
      if (!autoProgressionAvailable) continue;

      const hasMin = typeof current.preferredAutoProgressionMinReps === 'number';
      const hasMax = typeof current.preferredAutoProgressionMaxReps === 'number';
      const shouldUpdate = mode === 'overwrite-all' ? true : (!hasMin || !hasMax);
      if (!shouldUpdate) continue;

      await PredefinedExerciseCustomizationStorage.save(name, {
        ...current,
        preferredAutoProgressionMinReps:
          mode === 'overwrite-all' ? nextMin : (hasMin ? current.preferredAutoProgressionMinReps : nextMin),
        preferredAutoProgressionMaxReps:
          mode === 'overwrite-all' ? nextMax : (hasMax ? current.preferredAutoProgressionMaxReps : nextMax),
      });
      predefinedUpdated += 1;
    }

    await refreshData();

    return {
      customUpdated,
      predefinedUpdated,
    };
  };

  const handleDefaultAutoMinInputChange = (text: string) => {
    const filtered = text.replace(/[^0-9]/g, '');
    setDefaultAutoMinInput(filtered);
  };

  const handleDefaultAutoMaxInputChange = (text: string) => {
    const filtered = text.replace(/[^0-9]/g, '');
    setDefaultAutoMaxInput(filtered);
  };

  const handleApplyDefaultRepRange = async () => {
    const nextMin = parseInt(defaultAutoMinInput, 10);
    const nextMax = parseInt(defaultAutoMaxInput, 10);

    if (Number.isNaN(nextMin) || Number.isNaN(nextMax) || nextMin < 1 || nextMax > 100 || nextMin > nextMax) {
      Alert.alert('Invalid rep range', 'Enter a valid range where min is at least 1 and max is at most 100.');
      setDefaultAutoMinInput((settings.defaultAutoProgressionMinReps || 8).toString());
      setDefaultAutoMaxInput((settings.defaultAutoProgressionMaxReps || 12).toString());
      return;
    }

    const prevMin = settings.defaultAutoProgressionMinReps || 8;
    const prevMax = settings.defaultAutoProgressionMaxReps || 12;

    if (nextMin === prevMin && nextMax === prevMax) {
      return;
    }

    const counts = getRepRangePropagationCounts(prevMin, prevMax);

    const commit = async (overwriteAllRanges: boolean) => {
      await updateSettings({
        defaultAutoProgressionMinReps: nextMin,
        defaultAutoProgressionMaxReps: nextMax,
      });

      await applyDefaultRepRangeToTemplates(
        nextMin,
        nextMax,
        prevMin,
        prevMax,
        overwriteAllRanges
      );

      const preferenceUpdates = await applyDefaultRangeToExercisePreferences(
        nextMin,
        nextMax,
        overwriteAllRanges ? 'overwrite-all' : 'fill-missing'
      );

      Alert.alert(
        'Default range applied',
        `Default rep range set to ${nextMin}-${nextMax}.\n\nRoutine entries updated: ${overwriteAllRanges ? counts.totalCount : counts.inheritedCount}.\nExercise preferences updated: ${preferenceUpdates.customUpdated + preferenceUpdates.predefinedUpdated}.`
      );
    };

    Alert.alert(
      'Apply default rep range',
      `Choose how to apply ${nextMin}-${nextMax}:\n\n• Keep custom ranges: only blanks/missing ranges are filled.\n• Overwrite all ranges: replace all exercise and routine ranges with this default.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
            text: 'Keep custom ranges',
          onPress: () => {
            void commit(false);
          },
        },
        {
          text: 'Overwrite all ranges',
          style: 'destructive',
          onPress: () => {
            void commit(true);
          },
        },
      ]
    );
  };

  const handleDefaultAutoWeightIncrementInputChange = (text: string) => {
    const withDot = text.replace(/,/g, '.');
    const filtered = withDot.replace(/[^0-9.]/g, '');
    const dotIndex = filtered.indexOf('.');
    const normalized =
      dotIndex === -1
        ? filtered
        : `${filtered.slice(0, dotIndex + 1)}${filtered.slice(dotIndex + 1).replace(/\./g, '')}`;

    setDefaultAutoWeightIncrementInput(normalized);
  };

  const handleCommitDefaultAutoWeightIncrement = async () => {
    const value = parseFloat(defaultAutoWeightIncrementInput);
    if (!isNaN(value) && value > 0 && value <= 100) {
      await updateSettings({ defaultAutoProgressionWeightIncrement: value });
      return;
    }

    setDefaultAutoWeightIncrementInput((settings.defaultAutoProgressionWeightIncrement ?? 2.5).toString());
  };

  const handleWeightUnitChange = async () => {
    const newUnit = settings.weightUnit === 'kg' ? 'lbs' : 'kg';
    await updateSettings({ weightUnit: newUnit });
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleBodyMapGenderChange = async () => {
    const newGender = settings.bodyMapGender === 'male' ? 'female' : 'male';
    await updateSettings({ bodyMapGender: newGender });
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleWeekStartDayChange = async (day: WeekStartDay) => {
    await updateSettings({ weekStartDay: day });
    setShowWeekStartPicker(false);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleAutoProgressionChange = async () => {
    const nextEnabled = !settings.autoProgressionEnabled;
    await updateSettings({ autoProgressionEnabled: nextEnabled });

    if (nextEnabled) {
      const fallbackMin = settings.defaultAutoProgressionMinReps || 8;
      const fallbackMax = settings.defaultAutoProgressionMaxReps || 12;

      await Promise.all(
        templates.map((template) => {
          let changed = false;
          const updatedTemplate = {
            ...template,
            exercises: template.exercises.map((ex) => {
              const autoProgressionAvailable =
                ex.type !== 'bodyweight' && ex.type !== 'assisted-bodyweight';
              return {
                ...ex,
                autoProgressionEnabled: autoProgressionAvailable ? true : false,
                autoProgressionMinReps:
                  autoProgressionAvailable
                    ? (
                      ex.autoProgressionUseDefaultRange === false
                        ? ex.autoProgressionMinReps
                        : (ex.autoProgressionMinReps ?? fallbackMin)
                    )
                    : undefined,
                autoProgressionMaxReps:
                  autoProgressionAvailable
                    ? (
                      ex.autoProgressionUseDefaultRange === false
                        ? ex.autoProgressionMaxReps
                        : (ex.autoProgressionMaxReps ?? fallbackMax)
                    )
                    : undefined,
                autoProgressionUseDefaultRange:
                  autoProgressionAvailable
                    ? (ex.autoProgressionUseDefaultRange === false ? false : true)
                    : false,
                autoProgressionUsePreferredRange:
                  autoProgressionAvailable && ex.autoProgressionUsePreferredRange === true,
              };
            }),
          };
          changed = template.exercises.some((ex, index) => {
            const next = updatedTemplate.exercises[index];
            return (
              ex.autoProgressionEnabled !== next.autoProgressionEnabled ||
              ex.autoProgressionMinReps !== next.autoProgressionMinReps ||
              ex.autoProgressionMaxReps !== next.autoProgressionMaxReps ||
              ex.autoProgressionUseDefaultRange !== next.autoProgressionUseDefaultRange ||
              ex.autoProgressionUsePreferredRange !== next.autoProgressionUsePreferredRange
            );
          });
          return changed ? updateTemplate(updatedTemplate) : Promise.resolve();
        })
      );
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ padding: 24, gap: 16, paddingBottom: insets.bottom + 24 }}>
        {/* Header */}
        <View className="gap-2">
          <Pressable onPress={() => router.back()} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <IconSymbol name="chevron.left" size={28} color={colors.foreground} />
          </Pressable>
          <Text className="text-3xl font-bold text-foreground">Preferences</Text>
          <Text className="text-base text-muted">Update app defaults and units</Text>
        </View>

        {/* Default Rest Time */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 10,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.primary + '20',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconSymbol size={20} name="timer" color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.foreground }}>Default Rest Time</Text>
              <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>Applied to new exercises (seconds)</Text>
            </View>
            <TextInput
              value={restTimeInput}
              onChangeText={handleRestTimeChange}
              keyboardType="number-pad"
              style={{
                width: 80,
                height: 40,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 10,
                paddingHorizontal: 12,
                fontSize: 16,
                color: colors.foreground,
                backgroundColor: colors.background,
                textAlign: 'center',
              }}
            />
          </View>
        </View>

        {/* Auto-progression */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 10,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.primary + '20',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconSymbol size={20} name="chart.line.uptrend.xyaxis" color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                numberOfLines={1}
                style={{ fontSize: 16, fontWeight: '700', color: colors.foreground }}
              >
                Auto-progression
              </Text>
              <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
                {settings.autoProgressionEnabled ? 'Enabled' : 'Disabled'}
              </Text>
            </View>
            <Pressable
              onPress={handleAutoProgressionChange}
              style={({ pressed }) => [
                {
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 10,
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.background }}>
                Change
              </Text>
            </Pressable>
          </View>

          {settings.autoProgressionEnabled && (
            <View style={{ gap: 10, marginTop: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, color: colors.muted }}>Default rep range</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <TextInput
                    value={defaultAutoMinInput}
                    onChangeText={handleDefaultAutoMinInputChange}
                    onSubmitEditing={handleApplyDefaultRepRange}
                    keyboardType="number-pad"
                    style={{
                      width: 56,
                      height: 40,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 10,
                      paddingHorizontal: 8,
                      fontSize: 16,
                      color: colors.foreground,
                      backgroundColor: colors.background,
                      textAlign: 'center',
                    }}
                  />
                  <Text style={{ color: colors.muted, fontSize: 16, fontWeight: '700' }}>-</Text>
                  <TextInput
                    value={defaultAutoMaxInput}
                    onChangeText={handleDefaultAutoMaxInputChange}
                    onSubmitEditing={handleApplyDefaultRepRange}
                    keyboardType="number-pad"
                    style={{
                      width: 56,
                      height: 40,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 10,
                      paddingHorizontal: 8,
                      fontSize: 16,
                      color: colors.foreground,
                      backgroundColor: colors.background,
                      textAlign: 'center',
                    }}
                  />
                </View>
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <Pressable
                  onPress={handleApplyDefaultRepRange}
                  style={({ pressed }) => [
                    {
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 8,
                      backgroundColor: colors.primary,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.background }}>Apply default range</Text>
                </Pressable>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, color: colors.muted }}>Default weight increment</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <TextInput
                    value={defaultAutoWeightIncrementInput}
                    onChangeText={handleDefaultAutoWeightIncrementInputChange}
                    onBlur={handleCommitDefaultAutoWeightIncrement}
                    onSubmitEditing={handleCommitDefaultAutoWeightIncrement}
                    keyboardType="decimal-pad"
                    style={{
                      width: 90,
                      height: 40,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 10,
                      paddingHorizontal: 10,
                      fontSize: 16,
                      color: colors.foreground,
                      backgroundColor: colors.background,
                      textAlign: 'center',
                    }}
                  />
                  <Text style={{ color: colors.muted, fontSize: 14, fontWeight: '700' }}>
                    {settings.weightUnit}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Weight Unit */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 10,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.primary + '20',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconSymbol size={20} name="dumbbell" color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.foreground }}>Weight Unit</Text>
              <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
                {settings.weightUnit === 'kg' ? 'Kilograms (kg)' : 'Pounds (lbs)'}
              </Text>
            </View>
            <Pressable
              onPress={handleWeightUnitChange}
              style={({ pressed }) => [
                {
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 10,
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.background }}>
                Change
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Body Map Gender */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 10,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.primary + '20',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconSymbol size={20} name="person.fill" color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.foreground }}>Body Map</Text>
              <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
                {settings.bodyMapGender === 'male' ? 'Male' : 'Female'}
              </Text>
            </View>
            <Pressable
              onPress={handleBodyMapGenderChange}
              style={({ pressed }) => [
                {
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 10,
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.background }}>
                Change
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Week Start Day */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 10,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.primary + '20',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconSymbol size={20} name="calendar" color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.foreground }}>Week Starts On</Text>
              <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
                {getDayName(weekStartDay)}
              </Text>
            </View>
            <Pressable
              onPress={() => setShowWeekStartPicker(true)}
              style={({ pressed }) => [
                {
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 10,
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.background }}>Change</Text>
            </Pressable>
          </View>
        </View>

        {/* Inspirational Quotes */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 10,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.primary + '20',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconSymbol size={20} name="sparkles" color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.foreground }}>Inspirational Quotes</Text>
              <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
                {settings.showQuotes ? 'Shown' : 'Hidden'}
              </Text>
            </View>
            <Pressable
              onPress={async () => {
                await updateSettings({ showQuotes: !settings.showQuotes });
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              }}
              style={({ pressed }) => [
                {
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 10,
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.background }}>
                Change
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Week Start Day Picker Modal */}
      <Modal
        visible={showWeekStartPicker}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowWeekStartPicker(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={() => setShowWeekStartPicker(false)}
        >
          <Pressable
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 20,
              width: '80%',
              maxWidth: 320,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
              <IconSymbol size={20} name="calendar" color={colors.primary} />
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.foreground, textAlign: 'center' }}>
                Week Starts On
              </Text>
            </View>
            {([0, 1, 2, 3, 4, 5, 6] as WeekStartDay[]).map((day) => (
              <Pressable
                key={day}
                onPress={() => handleWeekStartDayChange(day)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 10,
                  backgroundColor: weekStartDay === day ? colors.primary + '20' : 'transparent',
                  opacity: pressed ? 0.7 : 1,
                  marginBottom: 4,
                })}
              >
                <Text
                  style={{
                    flex: 1,
                    fontSize: 16,
                    color: weekStartDay === day ? colors.primary : colors.foreground,
                    fontWeight: weekStartDay === day ? '600' : '400',
                  }}
                >
                  {getDayName(day)}
                </Text>
                {weekStartDay === day && (
                  <IconSymbol name="checkmark" size={20} color={colors.primary} />
                )}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}
