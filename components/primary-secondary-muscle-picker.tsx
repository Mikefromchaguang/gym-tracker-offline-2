import { View, Text, Pressable, Platform } from 'react-native';
import { useMemo, useState } from 'react';
import * as Haptics from 'expo-haptics';

import { useColors } from '@/hooks/use-colors';
import { MuscleGroup } from '@/lib/types';
import { PRIMARY_MUSCLE_GROUPS, getMuscleGroupDisplayName } from '@/lib/muscle-groups';

type MusclePickMode = 'primary' | 'secondary';

export interface PrimarySecondaryMusclePickerProps {
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  onChangePrimary: (muscle: MuscleGroup) => void;
  onChangeSecondary: (secondary: MuscleGroup[]) => void;
  initialMode?: MusclePickMode;
  title?: string;
}

function withOpacity(color: string, opacity: number): string {
  if (!color) return `rgba(0,0,0,${opacity})`;
  if (color.startsWith('rgba(') || color.startsWith('rgb(')) return color;
  if (color[0] !== '#') return color;

  const hex = color.slice(1);
  const normalized = hex.length === 3
    ? hex.split('').map((c) => c + c).join('')
    : hex;

  if (normalized.length !== 6) return color;

  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

export function PrimarySecondaryMusclePicker({
  primaryMuscle,
  secondaryMuscles,
  onChangePrimary,
  onChangeSecondary,
  initialMode = 'primary',
  title = 'Muscles',
}: PrimarySecondaryMusclePickerProps) {
  const colors = useColors();
  const [mode, setMode] = useState<MusclePickMode>(initialMode);

  const secondarySet = useMemo(() => new Set(secondaryMuscles), [secondaryMuscles]);

  const handleToggleMode = (next: MusclePickMode) => {
    setMode(next);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handlePressMuscle = (muscle: MuscleGroup) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (mode === 'primary') {
      onChangePrimary(muscle);
      return;
    }

    if (muscle === primaryMuscle) {
      return; // Primary cannot also be a secondary
    }

    const nextSecondary = secondarySet.has(muscle)
      ? secondaryMuscles.filter((m) => m !== muscle)
      : [...secondaryMuscles, muscle];

    onChangeSecondary(nextSecondary);
  };

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>{title}</Text>

        <View
          style={{
            flexDirection: 'row',
            overflow: 'hidden',
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <Pressable
            onPress={() => handleToggleMode('primary')}
            style={({ pressed }) => ({
              paddingVertical: 6,
              paddingHorizontal: 10,
              backgroundColor: mode === 'primary' ? colors.primary : 'transparent',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: mode === 'primary' ? colors.background : colors.foreground,
              }}
            >
              Primary
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleToggleMode('secondary')}
            style={({ pressed }) => ({
              paddingVertical: 6,
              paddingHorizontal: 10,
              backgroundColor: mode === 'secondary' ? colors.primary : 'transparent',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: mode === 'secondary' ? colors.background : colors.foreground,
              }}
            >
              Secondary
            </Text>
          </Pressable>
        </View>
      </View>

      <Text style={{ fontSize: 12, color: colors.muted }}>
        {mode === 'primary'
          ? 'Tap a muscle to set the primary.'
          : 'Tap muscles to toggle secondaries (primary cannot be selected here).'}
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {PRIMARY_MUSCLE_GROUPS.map((muscle) => {
          const isPrimary = primaryMuscle === muscle;
          const isSecondary = secondarySet.has(muscle);

          const backgroundColor = isPrimary
            ? colors.primary
            : isSecondary
              ? withOpacity(colors.primary, 0.18)
              : colors.surface;

          const borderColor = isPrimary
            ? colors.primary
            : isSecondary
              ? withOpacity(colors.primary, 0.7)
              : colors.border;

          const textColor = isPrimary
            ? colors.background
            : isSecondary
              ? colors.primary
              : colors.foreground;

          return (
            <Pressable
              key={muscle}
              onPress={() => handlePressMuscle(muscle)}
              style={({ pressed }) => ({
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderRadius: 20,
                borderWidth: 1,
                backgroundColor,
                borderColor,
                opacity: pressed ? 0.82 : 1,
              })}
            >
              <Text style={{ color: textColor, fontSize: 13, fontWeight: '600' }}>
                {getMuscleGroupDisplayName(muscle)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
