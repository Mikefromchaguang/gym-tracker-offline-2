import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { useColors } from '@/hooks/use-colors';
import { MuscleGroup } from '@/lib/types';
import { PRIMARY_MUSCLE_GROUPS, getMuscleGroupDisplayName } from '@/lib/muscle-groups';
import * as Haptics from 'expo-haptics';
import { IconSymbol } from '@/components/ui/icon-symbol';

export interface MuscleGroupSelectionModalProps {
  visible: boolean;
  selectedMuscles: MuscleGroup[];
  onClose: () => void;
  onApply: (selected: MuscleGroup[]) => void;
}

// Use primary muscle groups (excludes minor parts like hands, feet, etc.)
const ALL_MUSCLE_GROUPS: MuscleGroup[] = PRIMARY_MUSCLE_GROUPS;

/**
 * Modal for selecting which muscle groups to display in the spider chart
 * Requires at least 3 muscle groups to be selected
 */
export function MuscleGroupSelectionModal({
  visible,
  selectedMuscles,
  onClose,
  onApply,
}: MuscleGroupSelectionModalProps) {
  const colors = useColors();
  const [localSelection, setLocalSelection] = useState<MuscleGroup[]>(selectedMuscles);

  // Update local selection when modal opens
  useEffect(() => {
    if (visible) {
      setLocalSelection(selectedMuscles);
    }
  }, [visible, selectedMuscles]);

  const toggleMuscle = (muscle: MuscleGroup) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    setLocalSelection((prev) => {
      if (prev.includes(muscle)) {
        return prev.filter((m) => m !== muscle);
      } else {
        return [...prev, muscle];
      }
    });
  };

  const moveItem = useCallback((muscle: MuscleGroup, direction: 'up' | 'down') => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setLocalSelection((prev) => {
      const idx = prev.indexOf(muscle);
      if (idx === -1) return prev;
      if (direction === 'up' && idx === 0) return prev;
      if (direction === 'down' && idx === prev.length - 1) return prev;
      const newArr = [...prev];
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      [newArr[idx], newArr[swapIdx]] = [newArr[swapIdx], newArr[idx]];
      return newArr;
    });
  }, []);

  const handleApply = () => {
    if (localSelection.length >= 3) {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      onApply(localSelection);
      onClose();
    }
  };

  const handleCancel = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setLocalSelection(selectedMuscles); // Reset to original
    onClose();
  };

  const isApplyDisabled = localSelection.length < 3;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.modal,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Select Muscle Groups
            </Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              Choose at least 3 muscle groups to display
            </Text>
          </View>

          {/* Muscle group list */}
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.listContainer}>
            {/* Selected items at top, in order, with reorder controls */}
            {localSelection.length > 0 && (
              <View style={{ marginBottom: 12 }}>
                <Text style={[styles.sectionHeader, { color: colors.muted }]}>Selected (tap arrows to reorder)</Text>
                {localSelection.map((muscle, index) => (
                  <Animated.View
                    key={muscle}
                    layout={Platform.OS === 'web' ? undefined : LinearTransition.duration(120)}
                  >
                    <View style={styles.orderedRow}>
                      <View style={styles.orderControls}>
                        <Pressable
                          onPress={() => moveItem(muscle, 'up')}
                          disabled={index === 0}
                          style={({ pressed }) => [styles.arrowBtn, { opacity: index === 0 ? 0.3 : pressed ? 0.5 : 1 }]}
                        >
                          <IconSymbol name="chevron.up" size={18} color={colors.foreground} />
                        </Pressable>
                        <Pressable
                          onPress={() => moveItem(muscle, 'down')}
                          disabled={index === localSelection.length - 1}
                          style={({ pressed }) => [styles.arrowBtn, { opacity: index === localSelection.length - 1 ? 0.3 : pressed ? 0.5 : 1 }]}
                        >
                          <IconSymbol name="chevron.down" size={18} color={colors.foreground} />
                        </Pressable>
                      </View>
                      <Pressable
                        onPress={() => toggleMuscle(muscle)}
                        style={({ pressed }) => [
                          styles.muscleItem,
                          { flex: 1 },
                          {
                            backgroundColor: colors.primary,
                            borderColor: colors.border,
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                      >
                        <Text style={[styles.muscleText, { color: colors.background, fontWeight: '600' }]}>
                          {getMuscleGroupDisplayName(muscle)}
                        </Text>
                        <View style={[styles.checkmark, { backgroundColor: colors.background }]}>
                          <Text style={[styles.checkmarkText, { color: colors.primary }]}>✓</Text>
                        </View>
                      </Pressable>
                    </View>
                  </Animated.View>
                ))}
              </View>
            )}

            {/* Unselected items */}
            <View>
              <Text style={[styles.sectionHeader, { color: colors.muted }]}>Available</Text>
              {ALL_MUSCLE_GROUPS.filter((m) => !localSelection.includes(m)).map((muscle) => (
                <Pressable
                  key={muscle}
                  onPress={() => toggleMuscle(muscle)}
                  style={({ pressed }) => [
                    styles.muscleItem,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.muscleText, { color: colors.foreground, fontWeight: '400' }]}>
                    {getMuscleGroupDisplayName(muscle)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {/* Selection count */}
          <View style={styles.countContainer}>
            <Text style={[styles.countText, { color: colors.muted }]}>
              {localSelection.length} selected
              {localSelection.length < 3 && ` (minimum 3 required)`}
            </Text>
          </View>

          {/* Action buttons */}
          <View style={styles.actions}>
            <Pressable
              onPress={handleCancel}
              style={({ pressed }) => [
                styles.button,
                styles.cancelButton,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={[styles.buttonText, { color: colors.foreground }]}>
                Cancel
              </Text>
            </Pressable>

            <Pressable
              onPress={handleApply}
              disabled={isApplyDisabled}
              style={({ pressed }) => [
                styles.button,
                styles.applyButton,
                {
                  backgroundColor: isApplyDisabled ? colors.muted : colors.primary,
                  opacity: pressed && !isApplyDisabled ? 0.8 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.buttonText,
                  {
                    color: isApplyDisabled ? colors.surface : colors.background,
                  },
                ]}
              >
                Apply
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    padding: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  scrollView: {
    maxHeight: 400,
  },
  listContainer: {
    padding: 16,
    paddingTop: 8,
    gap: 8,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 4,
  },
  orderedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  orderControls: {
    flexDirection: 'column',
    gap: 2,
  },
  arrowBtn: {
    padding: 2,
  },
  muscleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 4,
  },
  muscleText: {
    fontSize: 16,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  countContainer: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  countText: {
    fontSize: 14,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    paddingTop: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  applyButton: {},
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
