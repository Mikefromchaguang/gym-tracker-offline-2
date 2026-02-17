/**
 * Template Set Row Component - Displays a single set in template creation
 * Compact one-line layout: SET | -/WEIGHT/+ | REPS | DELETE
 */

import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import { CompletedSet } from '@/lib/types';
import { useColors } from '@/hooks/use-colors';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

interface TemplateSetRowProps {
  set: CompletedSet;
  setIndex: number;
  onUpdateSet: (updates: Partial<CompletedSet>) => void;
  onDelete: () => void;
}

export function TemplateSetRow({
  set,
  setIndex,
  onUpdateSet,
  onDelete,
}: TemplateSetRowProps) {
  const colors = useColors();

  const handleWeightDecrease = () => {
    const newWeight = Math.max(0, (set.weight || 0) - 2.5);
    onUpdateSet({ weight: newWeight });
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleWeightIncrease = () => {
    const newWeight = (set.weight || 0) + 2.5;
    onUpdateSet({ weight: newWeight });
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      {/* Set number */}
      <Text style={[styles.setNumber, { color: colors.foreground }]}>{setIndex + 1}</Text>

      {/* Weight with +/- buttons */}
      <Pressable
        onPress={handleWeightDecrease}
        style={({ pressed }) => [
          styles.adjustButton,
          { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Text style={[styles.adjustText, { color: colors.primary }]}>−</Text>
      </Pressable>

      <TextInput
        value={set.weight?.toString() || '0'}
        onChangeText={(val) => onUpdateSet({ weight: parseFloat(val) || 0 })}
        keyboardType="decimal-pad"
        style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
      />

      <Pressable
        onPress={handleWeightIncrease}
        style={({ pressed }) => [
          styles.adjustButton,
          { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Text style={[styles.adjustText, { color: colors.primary }]}>+</Text>
      </Pressable>

      {/* Reps input */}
      <TextInput
        value={set.reps?.toString() || '0'}
        onChangeText={(val) => onUpdateSet({ reps: parseInt(val, 10) || 0 })}
        keyboardType="numeric"
        style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground, marginLeft: 8 }]}
      />

      {/* Delete button */}
      <Pressable
        onPress={onDelete}
        style={({ pressed }) => [styles.deleteButton, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Text style={{ color: colors.error, fontSize: 14 }}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    gap: 4,
  },
  setNumber: {
    width: 24,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  adjustButton: {
    width: 28,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    borderWidth: 1,
  },
  adjustText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  input: {
    width: 52,
    height: 32,
    borderRadius: 4,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
    paddingHorizontal: 4,
  },
  deleteButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
