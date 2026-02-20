import { View, Text, Pressable, ScrollView, TextInput, Platform, Modal } from 'react-native';
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

export default function PreferencesScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings, updateSettings, templates, updateTemplate } = useGym();

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
    prevMax: number
  ) => {
    const updates = templates
      .map((template) => {
        let changed = false;

        const updatedExercises = template.exercises.map((ex) => {
          // Respect explicit per-exercise disable.
          if (ex.autoProgressionEnabled === false) {
            return ex;
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

          if (ex.autoProgressionUseDefaultRange === false || looksLikeLegacyCustomRange) {
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

    await Promise.all(updates.map((template) => updateTemplate(template)));
  };

  const handleDefaultAutoMinChange = async (text: string) => {
    const filtered = text.replace(/[^0-9]/g, '');
    setDefaultAutoMinInput(filtered);
    const value = parseInt(filtered, 10);
    const currentMax = settings.defaultAutoProgressionMaxReps || 12;
    if (!isNaN(value) && value >= 1 && value <= currentMax) {
      const prevMin = settings.defaultAutoProgressionMinReps || 8;
      const prevMax = settings.defaultAutoProgressionMaxReps || 12;
      await updateSettings({ defaultAutoProgressionMinReps: value });
      await applyDefaultRepRangeToTemplates(value, prevMax, prevMin, prevMax);
    }
  };

  const handleDefaultAutoMaxChange = async (text: string) => {
    const filtered = text.replace(/[^0-9]/g, '');
    setDefaultAutoMaxInput(filtered);
    const value = parseInt(filtered, 10);
    const currentMin = settings.defaultAutoProgressionMinReps || 8;
    if (!isNaN(value) && value >= currentMin && value <= 100) {
      const prevMin = settings.defaultAutoProgressionMinReps || 8;
      const prevMax = settings.defaultAutoProgressionMaxReps || 12;
      await updateSettings({ defaultAutoProgressionMaxReps: value });
      await applyDefaultRepRangeToTemplates(prevMin, value, prevMin, prevMax);
    }
  };

  const handleDefaultAutoWeightIncrementChange = async (text: string) => {
    const withDot = text.replace(/,/g, '.');
    const filtered = withDot.replace(/[^0-9.]/g, '');
    const dotIndex = filtered.indexOf('.');
    const normalized =
      dotIndex === -1
        ? filtered
        : `${filtered.slice(0, dotIndex + 1)}${filtered.slice(dotIndex + 1).replace(/\./g, '')}`;

    setDefaultAutoWeightIncrementInput(normalized);

    const value = parseFloat(normalized);
    if (!isNaN(value) && value > 0 && value <= 100) {
      await updateSettings({ defaultAutoProgressionWeightIncrement: value });
    }
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
            exercises: template.exercises.map((ex) => ({
              ...ex,
              autoProgressionEnabled: true,
              autoProgressionMinReps:
                ex.autoProgressionUseDefaultRange === false
                  ? ex.autoProgressionMinReps
                  : (ex.autoProgressionMinReps ?? fallbackMin),
              autoProgressionMaxReps:
                ex.autoProgressionUseDefaultRange === false
                  ? ex.autoProgressionMaxReps
                  : (ex.autoProgressionMaxReps ?? fallbackMax),
              autoProgressionUseDefaultRange:
                ex.autoProgressionUseDefaultRange === false ? false : true,
            })),
          };
          changed = template.exercises.some((ex, index) => {
            const next = updatedTemplate.exercises[index];
            return (
              ex.autoProgressionEnabled !== next.autoProgressionEnabled ||
              ex.autoProgressionMinReps !== next.autoProgressionMinReps ||
              ex.autoProgressionMaxReps !== next.autoProgressionMaxReps ||
              ex.autoProgressionUseDefaultRange !== next.autoProgressionUseDefaultRange
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
                    onChangeText={handleDefaultAutoMinChange}
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
                    onChangeText={handleDefaultAutoMaxChange}
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

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, color: colors.muted }}>Default weight increment</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <TextInput
                    value={defaultAutoWeightIncrementInput}
                    onChangeText={handleDefaultAutoWeightIncrementChange}
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
