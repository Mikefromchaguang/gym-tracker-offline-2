import { View, Text } from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { ModalBottomSheet } from '@/components/modal-bottom-sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';

interface ExerciseQuickActionsSheetProps {
  visible: boolean;
  exerciseName: string | null;
  restTimeSeconds?: number | null;
  defaultRestTimeSeconds?: number;
  restTimerEnabled?: boolean;
  autoProgressionEnabled?: boolean;
  autoProgressionMinReps?: number | null;
  autoProgressionMaxReps?: number | null;
  /** Whether this exercise is part of a superset */
  isInSuperset?: boolean;
  onClose: () => void;
  onSeeDetails: (exerciseName: string) => void;
  onSyncToLastSession?: () => void;
  onReplaceExercise?: () => void;
  onRemoveExercise?: () => void;
  onChangeRestTimeSeconds?: (seconds: number) => void;
  onToggleRestTimerEnabled?: () => void;
  onChangeAutoProgressionMinReps?: (reps: number | null) => void;
  onChangeAutoProgressionMaxReps?: (reps: number | null) => void;
  onToggleAutoProgressionEnabled?: () => void;
  /** For non-superset exercises: add to a superset */
  onAddToSuperset?: () => void;
  /** For superset exercises: split into individual exercises */
  onSplitSuperset?: () => void;
}

export function ExerciseQuickActionsSheet({
  visible,
  exerciseName,
  restTimeSeconds,
  defaultRestTimeSeconds,
  restTimerEnabled,
  autoProgressionEnabled,
  autoProgressionMinReps,
  autoProgressionMaxReps,
  isInSuperset,
  onClose,
  onSeeDetails,
  onSyncToLastSession,
  onReplaceExercise,
  onRemoveExercise,
  onChangeRestTimeSeconds,
  onToggleRestTimerEnabled,
  onChangeAutoProgressionMinReps,
  onChangeAutoProgressionMaxReps,
  onToggleAutoProgressionEnabled,
  onAddToSuperset,
  onSplitSuperset,
}: ExerciseQuickActionsSheetProps) {
  const colors = useColors();
  const [restDraft, setRestDraft] = useState('');
  const [minRepsDraft, setMinRepsDraft] = useState('');
  const [maxRepsDraft, setMaxRepsDraft] = useState('');

  const canEditRest = typeof onChangeRestTimeSeconds === 'function';
  const canToggleRest = typeof onToggleRestTimerEnabled === 'function' && typeof restTimerEnabled === 'boolean';
  const isRestDisabled = canToggleRest && restTimerEnabled === false;
  const canEditAutoProgression =
    typeof onChangeAutoProgressionMinReps === 'function' &&
    typeof onChangeAutoProgressionMaxReps === 'function';
  const canToggleAutoProgression =
    typeof onToggleAutoProgressionEnabled === 'function' && typeof autoProgressionEnabled === 'boolean';
  const isAutoProgressionDisabled = canToggleAutoProgression && autoProgressionEnabled === false;

  // Initialize the draft when the sheet opens for an exercise.
  // Important: do NOT re-initialize on every restTimeSeconds change (that fights user typing).
  useEffect(() => {
    if (!visible || !exerciseName) return;
    const initial = restTimeSeconds ?? defaultRestTimeSeconds ?? 0;
    setRestDraft(String(initial));
    setMinRepsDraft(
      autoProgressionMinReps && autoProgressionMinReps > 0 ? String(autoProgressionMinReps) : ''
    );
    setMaxRepsDraft(
      autoProgressionMaxReps && autoProgressionMaxReps > 0 ? String(autoProgressionMaxReps) : ''
    );
  }, [visible, exerciseName]);

  const handleRequestClose = useCallback(() => {
    // If the user clears the input and closes the sheet, interpret as "disabled".
    // Prefer the explicit enable/disable mechanism when available.
    if (canEditRest && restDraft.trim().length === 0) {
      if (canToggleRest && restTimerEnabled === true) {
        onToggleRestTimerEnabled?.();
      } else {
        // Fallback for contexts without a separate enabled flag.
        onChangeRestTimeSeconds?.(0);
      }
    }

    if (canEditAutoProgression) {
      const minEmpty = minRepsDraft.trim().length === 0;
      const maxEmpty = maxRepsDraft.trim().length === 0;

      if (minEmpty) onChangeAutoProgressionMinReps?.(null);
      if (maxEmpty) onChangeAutoProgressionMaxReps?.(null);

      if ((minEmpty || maxEmpty) && canToggleAutoProgression && autoProgressionEnabled === true) {
        onToggleAutoProgressionEnabled?.();
      }
    }

    onClose();
  }, [
    canEditRest,
    canToggleRest,
    restDraft,
    restTimerEnabled,
    onToggleRestTimerEnabled,
    onChangeRestTimeSeconds,
    canEditAutoProgression,
    minRepsDraft,
    maxRepsDraft,
    onChangeAutoProgressionMinReps,
    onChangeAutoProgressionMaxReps,
    canToggleAutoProgression,
    autoProgressionEnabled,
    onToggleAutoProgressionEnabled,
    onClose,
  ]);

  if (!exerciseName) return null;

  return (
    <ModalBottomSheet visible={visible} onClose={handleRequestClose} title={exerciseName}>
      <View className="gap-3">
        {(canEditAutoProgression || canToggleAutoProgression) && (
          <View className="gap-2">
            <Text className="text-sm text-muted">Auto-progression</Text>

            <View style={isAutoProgressionDisabled ? { opacity: 0.5 } : undefined}>
              <Text className="text-sm text-muted">Rep range</Text>
              <View className="flex-row items-center gap-2">
                {canEditAutoProgression && (
                  <>
                    <View className="flex-1">
                      <Input
                        placeholder="Min"
                        value={minRepsDraft}
                        keyboardType="numeric"
                        editable={!isAutoProgressionDisabled}
                        onChangeText={(text) => {
                          const filtered = text.replace(/[^0-9]/g, '');
                          setMinRepsDraft(filtered);
                          if (filtered.length > 0) {
                            const parsed = parseInt(filtered, 10);
                            if (!Number.isNaN(parsed)) {
                              onChangeAutoProgressionMinReps?.(parsed);
                            }
                          } else {
                            onChangeAutoProgressionMinReps?.(null);
                          }
                        }}
                      />
                    </View>
                    <Text className="text-sm text-muted">-</Text>
                    <View className="flex-1">
                      <Input
                        placeholder="Max"
                        value={maxRepsDraft}
                        keyboardType="numeric"
                        editable={!isAutoProgressionDisabled}
                        onChangeText={(text) => {
                          const filtered = text.replace(/[^0-9]/g, '');
                          setMaxRepsDraft(filtered);
                          if (filtered.length > 0) {
                            const parsed = parseInt(filtered, 10);
                            if (!Number.isNaN(parsed)) {
                              onChangeAutoProgressionMaxReps?.(parsed);
                            }
                          } else {
                            onChangeAutoProgressionMaxReps?.(null);
                          }
                        }}
                      />
                    </View>
                  </>
                )}

                {canToggleAutoProgression && (
                  <Button
                    variant="outline"
                    onPress={() => {
                      onToggleAutoProgressionEnabled?.();
                    }}
                    className="shrink-0"
                  >
                    <IconSymbol
                      size={18}
                      name="chart.line.uptrend.xyaxis"
                      color={isAutoProgressionDisabled ? colors.muted : colors.foreground}
                    />
                    <Text
                      className="text-base font-semibold"
                      style={{ color: isAutoProgressionDisabled ? colors.muted : colors.foreground }}
                    >
                      {autoProgressionEnabled ? 'Disable' : 'Enable'}
                    </Text>
                  </Button>
                )}
              </View>
            </View>
          </View>
        )}

        {(canEditRest || canToggleRest) && (
          <View className="gap-2">
            <Text className="text-sm text-muted">Rest timer</Text>

            <View style={isRestDisabled ? { opacity: 0.5 } : undefined}>
              <Text className="text-sm text-muted">Rest time (seconds)</Text>
              <View className="flex-row items-center gap-2">
                {canEditRest && (
                  <View className="flex-1">
                    <Input
                      placeholder="e.g., 180"
                      value={restDraft}
                      keyboardType="numeric"
                      editable={!isRestDisabled}
                      onChangeText={(text) => {
                        const filtered = text.replace(/[^0-9]/g, '');
                        setRestDraft(filtered);
                        if (filtered.length > 0) {
                          const parsed = parseInt(filtered, 10);
                          if (!Number.isNaN(parsed)) {
                            onChangeRestTimeSeconds?.(parsed);
                          }
                        }
                      }}
                    />
                  </View>
                )}

                {canToggleRest && (
                  <Button
                    variant="outline"
                    onPress={() => {
                      onToggleRestTimerEnabled?.();
                    }}
                    className="shrink-0"
                  >
                    <IconSymbol
                      size={18}
                      name="timer"
                      color={isRestDisabled ? colors.muted : colors.foreground}
                    />
                    <Text
                      className="text-base font-semibold"
                      style={{ color: isRestDisabled ? colors.muted : colors.foreground }}
                    >
                      {restTimerEnabled ? 'Disable' : 'Enable'}
                    </Text>
                  </Button>
                )}
              </View>
            </View>
          </View>
        )}

        <Text className="text-sm text-muted">Actions</Text>

        <Button
          variant="secondary"
          onPress={() => {
            onSeeDetails(exerciseName);
            onClose();
          }}
          className="w-full"
        >
          <IconSymbol size={18} name="info.circle" color={colors.foreground} />
          <Text className="text-base font-semibold text-foreground">See exercise details</Text>
        </Button>

        {onSyncToLastSession && (
          <Button
            variant="secondary"
            onPress={() => {
              onSyncToLastSession();
              onClose();
            }}
            className="w-full"
          >
            <IconSymbol size={18} name="square.and.arrow.down" color={colors.foreground} />
            <Text className="text-base font-semibold text-foreground">Pull sets from last session</Text>
          </Button>
        )}

        {onReplaceExercise && (
          <Button
            variant="secondary"
            onPress={() => {
              onReplaceExercise();
              onClose();
            }}
            className="w-full"
          >
            <IconSymbol size={18} name="arrow.triangle.2.circlepath" color={colors.foreground} />
            <Text className="text-base font-semibold text-foreground">Replace exercise</Text>
          </Button>
        )}

        {/* Superset actions */}
        {onAddToSuperset && !isInSuperset && (
          <Button
            variant="secondary"
            onPress={() => {
              onAddToSuperset();
              onClose();
            }}
            className="w-full"
          >
            <IconSymbol size={18} name="arrow.down.right" color={colors.foreground} />
            <Text className="text-base font-semibold text-foreground">Add to superset</Text>
          </Button>
        )}

        {onSplitSuperset && isInSuperset && (
          <Button
            variant="secondary"
            onPress={() => {
              onSplitSuperset();
              onClose();
            }}
            className="w-full"
          >
            <IconSymbol size={18} name="minus" color={colors.foreground} />
            <Text className="text-base font-semibold text-foreground">Split superset</Text>
          </Button>
        )}

        {onRemoveExercise && (
          <Button
            variant="destructive"
            onPress={() => {
              onRemoveExercise();
              onClose();
            }}
            className="w-full"
          >
            <IconSymbol size={18} name="trash" color={colors.background} />
            <Text className="text-base font-semibold text-background">Remove exercise</Text>
          </Button>
        )}
      </View>
    </ModalBottomSheet>
  );
}
