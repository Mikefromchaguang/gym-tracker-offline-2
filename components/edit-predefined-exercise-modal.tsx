/**
 * EditPredefinedExerciseModal - Modal for editing predefined exercise customizations
 * Allows users to customize primary/secondary muscles and muscle contributions for predefined exercises
 */

import { Modal, View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MuscleContributionEditor } from '@/components/muscle-contribution-editor';
import { PrimarySecondaryMusclePicker } from '@/components/primary-secondary-muscle-picker';
import { useColors } from '@/hooks/use-colors';
import { MuscleGroup, getExerciseMuscles, getEffectiveExerciseMuscles, ExerciseType } from '@/lib/types';
import { calculateDefaultContributions } from '@/lib/muscle-contribution';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const EXERCISE_TYPES: ExerciseType[] = ['weighted', 'bodyweight', 'assisted-bodyweight', 'weighted-bodyweight', 'doubled'];

interface EditPredefinedExerciseModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (
    customization: {
      primaryMuscle?: MuscleGroup;
      secondaryMuscles?: MuscleGroup[];
      muscleContributions?: Record<MuscleGroup, number>;
      exerciseType?: ExerciseType;
      preferredAutoProgressionEnabled?: boolean;
      preferredAutoProgressionMinReps?: number;
      preferredAutoProgressionMaxReps?: number;
    }
  ) => Promise<void>;
  onReset: () => Promise<void>;
  exerciseName: string;
  defaultPreferredMinReps?: number;
  defaultPreferredMaxReps?: number;
  currentCustomization?: {
    primaryMuscle?: MuscleGroup;
    secondaryMuscles?: MuscleGroup[];
    muscleContributions?: Record<MuscleGroup, number>;
    exerciseType?: ExerciseType;
    type?: ExerciseType;
    preferredAutoProgressionEnabled?: boolean;
    preferredAutoProgressionMinReps?: number;
    preferredAutoProgressionMaxReps?: number;
  };
}

export function EditPredefinedExerciseModal({
  visible,
  onClose,
  onSave,
  onReset,
  exerciseName,
  defaultPreferredMinReps,
  defaultPreferredMaxReps,
  currentCustomization,
}: EditPredefinedExerciseModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  
  const [primaryMuscle, setPrimaryMuscle] = useState<MuscleGroup>('chest');
  const [secondaryMuscles, setSecondaryMuscles] = useState<MuscleGroup[]>([]);
  const [muscleContributions, setMuscleContributions] = useState<Record<MuscleGroup, number>>({} as Record<MuscleGroup, number>);
  const [exerciseType, setExerciseType] = useState<ExerciseType>('weighted');
  const [preferredAutoProgressionEnabled, setPreferredAutoProgressionEnabled] = useState(true);
  const [preferredMinDraft, setPreferredMinDraft] = useState('');
  const [preferredMaxDraft, setPreferredMaxDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Initialize form with current exercise data
  useEffect(() => {
    if (visible && exerciseName) {
      const predefinedExercise = getExerciseMuscles(exerciseName);
      
      if (currentCustomization && (currentCustomization.primaryMuscle || currentCustomization.secondaryMuscles || currentCustomization.muscleContributions || currentCustomization.exerciseType || currentCustomization.type)) {
        // Use customization values
        setPrimaryMuscle(currentCustomization.primaryMuscle || predefinedExercise?.primaryMuscle || 'chest');
        setSecondaryMuscles(currentCustomization.secondaryMuscles || predefinedExercise?.secondaryMuscles || []);
        setMuscleContributions(currentCustomization.muscleContributions || predefinedExercise?.muscleContributions || {});
        setExerciseType(currentCustomization.exerciseType || currentCustomization.type || predefinedExercise?.exerciseType || 'weighted');
        setPreferredAutoProgressionEnabled(currentCustomization.preferredAutoProgressionEnabled !== false);
        setPreferredMinDraft(
          typeof currentCustomization.preferredAutoProgressionMinReps === 'number'
            ? String(currentCustomization.preferredAutoProgressionMinReps)
            : String(defaultPreferredMinReps ?? 8)
        );
        setPreferredMaxDraft(
          typeof currentCustomization.preferredAutoProgressionMaxReps === 'number'
            ? String(currentCustomization.preferredAutoProgressionMaxReps)
            : String(defaultPreferredMaxReps ?? 12)
        );
      } else if (predefinedExercise) {
        // Use predefined defaults
        setPrimaryMuscle(predefinedExercise.primaryMuscle);
        setSecondaryMuscles(predefinedExercise.secondaryMuscles || []);
        setMuscleContributions(predefinedExercise.muscleContributions || calculateDefaultContributions(predefinedExercise.primaryMuscle, predefinedExercise.secondaryMuscles));
        setExerciseType(predefinedExercise.exerciseType || 'weighted');
        setPreferredAutoProgressionEnabled(true);
        setPreferredMinDraft(String(defaultPreferredMinReps ?? 8));
        setPreferredMaxDraft(String(defaultPreferredMaxReps ?? 12));
      }
    }
  }, [
    visible,
    exerciseName,
    currentCustomization,
    defaultPreferredMinReps,
    defaultPreferredMaxReps,
  ]);

  const handleClose = () => {
    onClose();
  };

  const validateContributions = (contributions: Record<MuscleGroup, number>): boolean => {
    const muscles = [primaryMuscle, ...secondaryMuscles];
    const total = muscles.reduce((sum, muscle) => sum + (contributions[muscle] || 0), 0);
    return Math.abs(total - 100) < 0.01; // Allow small floating point errors
  };

  const handleSave = async () => {
    if (!validateContributions(muscleContributions)) {
      Alert.alert('Invalid Contributions', 'Muscle contributions must sum to 100%');
      return;
    }

    const effectivePreferredEnabled = autoProgressionAvailable && preferredAutoProgressionEnabled;

    const parsedMin = effectivePreferredEnabled && preferredMinDraft.trim().length > 0
      ? parseInt(preferredMinDraft, 10)
      : undefined;
    const parsedMax = effectivePreferredEnabled && preferredMaxDraft.trim().length > 0
      ? parseInt(preferredMaxDraft, 10)
      : undefined;
    if (effectivePreferredEnabled) {
      if ((parsedMin && Number.isNaN(parsedMin)) || (parsedMax && Number.isNaN(parsedMax))) {
        Alert.alert('Invalid Range', 'Preferred rep range must be numeric');
        return;
      }
      if ((parsedMin !== undefined && parsedMin < 1) || (parsedMax !== undefined && parsedMax < 1)) {
        Alert.alert('Invalid Range', 'Preferred rep range must be at least 1');
        return;
      }
      if (parsedMin !== undefined && parsedMax !== undefined && parsedMin > parsedMax) {
        Alert.alert('Invalid Range', 'Preferred rep range min cannot exceed max');
        return;
      }
    }

    try {
      setIsSaving(true);
      const customization = {
        exerciseType,
        primaryMuscle,
        secondaryMuscles,
        muscleContributions,
        preferredAutoProgressionEnabled: effectivePreferredEnabled,
        preferredAutoProgressionMinReps: effectivePreferredEnabled ? parsedMin : undefined,
        preferredAutoProgressionMaxReps: effectivePreferredEnabled ? parsedMax : undefined,
      };
      await onSave(customization);
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      handleClose();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    Alert.alert('Reset to Defaults', 'This will remove your customizations for this exercise', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          try {
            setIsResetting(true);
            await onReset();
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            handleClose();
          } catch (error) {
            Alert.alert('Error', error instanceof Error ? error.message : 'Failed to reset');
          } finally {
            setIsResetting(false);
          }
        },
      },
    ]);
  };

  const handlePrimaryMuscleChange = (muscle: MuscleGroup) => {
    setPrimaryMuscle(muscle);
    setSecondaryMuscles((prev) => prev.filter((m) => m !== muscle));
  };

  const handleSecondaryMusclesChange = (nextSecondary: MuscleGroup[]) => {
    setSecondaryMuscles(nextSecondary.filter((m) => m !== primaryMuscle));
  };

  const autoProgressionAvailable =
    exerciseType !== 'bodyweight' && exerciseType !== 'assisted-bodyweight';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingTop: insets.top + 16,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.foreground }}>
            Customize {exerciseName}
          </Text>
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, padding: 8 }]}
          >
            <IconSymbol name="xmark" size={24} color={colors.foreground} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{
            padding: 16,
            gap: 20,
            paddingBottom: insets.bottom + 16,
          }}
        >
          {/* Exercise Type */}
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>
              Exercise Type
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {EXERCISE_TYPES.map((type) => (
                <Pressable
                  key={type}
                  onPress={() => setExerciseType(type)}
                  style={({ pressed }) => [{
                    flex: 1,
                    minWidth: '45%',
                    height: 48,
                    backgroundColor: exerciseType === type ? colors.primary : colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 8,
                    justifyContent: 'center',
                    alignItems: 'center',
                    opacity: pressed ? 0.7 : 1,
                  }]}
                >
                  <Text style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: exerciseType === type ? colors.background : colors.foreground,
                  }}>
                    {type === 'weighted' ? 'Weighted' : 
                     type === 'bodyweight' ? 'Bodyweight' : 
                     type === 'assisted-bodyweight' ? 'Assisted BW' :
                     type === 'weighted-bodyweight' ? 'Weighted BW' :
                     type === 'doubled' ? 'Doubled' : type}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
              {exerciseType === 'doubled' && 'Volume = reps × weight × 2 (both sides counted)'}
              {exerciseType === 'bodyweight' && 'Volume = reps × your bodyweight'}
              {exerciseType === 'weighted-bodyweight' && 'Volume = reps × (bodyweight + added weight)'}
              {exerciseType === 'assisted-bodyweight' && 'Volume = reps × (bodyweight - assistance)'}
              {exerciseType === 'weighted' && 'Volume = reps × weight'}
            </Text>
          </View>

          <PrimarySecondaryMusclePicker
            primaryMuscle={primaryMuscle}
            secondaryMuscles={secondaryMuscles}
            onChangePrimary={handlePrimaryMuscleChange}
            onChangeSecondary={handleSecondaryMusclesChange}
            title="Muscles"
          />

          {/* Muscle Contributions Editor */}
          <MuscleContributionEditor
            primaryMuscle={primaryMuscle}
            secondaryMuscles={secondaryMuscles}
            contributions={muscleContributions}
            onContributionsChange={setMuscleContributions}
            autoCalculate={false}
            exerciseNameOrId={exerciseName}
            onMusclesChange={(p, s) => {
              if (p) setPrimaryMuscle(p);
              setSecondaryMuscles(s);
            }}
          />

          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>
              Auto-progression
            </Text>
            {autoProgressionAvailable ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <Text style={{ fontSize: 13, color: colors.muted }}>
                    {preferredAutoProgressionEnabled ? 'Enabled' : 'Disabled'}
                  </Text>
                  <Button
                    variant="outline"
                    onPress={() => setPreferredAutoProgressionEnabled((prev) => !prev)}
                  >
                    <Text className="text-foreground font-semibold">
                      {preferredAutoProgressionEnabled ? 'Disable' : 'Enable'}
                    </Text>
                  </Button>
                </View>

                {preferredAutoProgressionEnabled && (
                  <>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Input
                          placeholder="Min"
                          keyboardType="numeric"
                          value={preferredMinDraft}
                          onChangeText={(text) => setPreferredMinDraft(text.replace(/[^0-9]/g, ''))}
                        />
                      </View>
                      <Text style={{ color: colors.muted, fontWeight: '700' }}>-</Text>
                      <View style={{ flex: 1 }}>
                        <Input
                          placeholder="Max"
                          keyboardType="numeric"
                          value={preferredMaxDraft}
                          onChangeText={(text) => setPreferredMaxDraft(text.replace(/[^0-9]/g, ''))}
                        />
                      </View>
                    </View>
                    <Text style={{ fontSize: 12, color: colors.muted }}>
                      Used as this exercise's default auto-progression range.
                    </Text>

                    <Text style={{ fontSize: 12, color: colors.muted }}>
                      Saving will apply this preferred range to existing exercises in all routines.
                    </Text>
                  </>
                )}
              </>
            ) : (
              <Text style={{ fontSize: 12, color: colors.muted }}>
                Unavailable for bodyweight and assisted bodyweight exercises.
              </Text>
            )}
          </View>

          {/* Info */}
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: 8,
            padding: 12,
            gap: 4,
          }}>
            <Text style={{ fontSize: 12, color: colors.muted }}>
              These changes only affect how this exercise is tracked and won't modify your existing workout history.
            </Text>
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View
          style={{
            flexDirection: 'column',
            gap: 12,
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: insets.bottom + 16,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Pressable
            onPress={handleSave}
            disabled={isSaving}
            style={({ pressed }) => [{
              backgroundColor: isSaving ? colors.muted : colors.primary,
              borderRadius: 8,
              padding: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: pressed && !isSaving ? 0.7 : 1,
            }]}
          >
            <IconSymbol name="checkmark" size={18} color={colors.background} />
            <Text style={{ color: colors.background, fontWeight: '600', fontSize: 14 }}>
              Save Changes
            </Text>
          </Pressable>
          <Pressable
            onPress={handleReset}
            disabled={isResetting || !currentCustomization}
            style={({ pressed }) => [{
              backgroundColor: 'transparent',
              borderRadius: 8,
              padding: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              borderWidth: 1,
              borderColor: (isResetting || !currentCustomization) ? colors.muted : colors.error,
              opacity: (pressed && !(isResetting || !currentCustomization)) ? 0.7 : 1,
            }]}
          >
            <IconSymbol name="arrow.counterclockwise" size={18} color={(isResetting || !currentCustomization) ? colors.muted : colors.error} />
            <Text style={{ color: (isResetting || !currentCustomization) ? colors.muted : colors.error, fontWeight: '600', fontSize: 14 }}>
              Reset to Defaults
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
