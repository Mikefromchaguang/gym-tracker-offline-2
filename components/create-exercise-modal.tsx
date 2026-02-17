/**
 * CreateExerciseModal - Unified modal for creating and editing exercises
 * Used across: active workout, template creation, exercises page, and exercise detail
 */

import { Modal, View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MuscleContributionEditor } from '@/components/muscle-contribution-editor';
import { PrimarySecondaryMusclePicker } from '@/components/primary-secondary-muscle-picker';
import { useColors } from '@/hooks/use-colors';
import { MuscleGroup, ExerciseType, PREDEFINED_EXERCISES_WITH_MUSCLES } from '@/lib/types';
import { PRIMARY_MUSCLE_GROUPS } from '@/lib/muscle-groups';
import { calculateDefaultContributions } from '@/lib/muscle-contribution';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

function isValidMuscleGroup(muscle: unknown): muscle is MuscleGroup {
  return typeof muscle === 'string' && (PRIMARY_MUSCLE_GROUPS as readonly string[]).includes(muscle);
}

interface ExerciseData {
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  type: ExerciseType;
  muscleContributions: Record<MuscleGroup, number>;
}

interface CreateExerciseModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (exercise: ExerciseData) => Promise<void>;
  mode: 'create' | 'edit';
  existingExercise?: ExerciseData;
}

export function CreateExerciseModal({
  visible,
  onClose,
  onSave,
  mode,
  existingExercise,
}: CreateExerciseModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  
  const [exerciseName, setExerciseName] = useState('');
  const [primaryMuscle, setPrimaryMuscle] = useState<MuscleGroup>('chest');
  const [secondaryMuscles, setSecondaryMuscles] = useState<MuscleGroup[]>([]);
  const [exerciseType, setExerciseType] = useState<ExerciseType>('weighted');
  const [muscleContributions, setMuscleContributions] = useState<Record<MuscleGroup, number>>({} as Record<MuscleGroup, number>);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form with existing exercise data in edit mode
  useEffect(() => {
    if (visible) {
      if (mode === 'edit' && existingExercise) {
        // Sanitize legacy muscle groups that may exist in persisted data.
        const rawPrimary = (existingExercise as any)?.primaryMuscle;
        const rawSecondaries = (existingExercise as any)?.secondaryMuscles;
        const rawContributions = (existingExercise as any)?.muscleContributions;

        const sanitizedPrimary: MuscleGroup = isValidMuscleGroup(rawPrimary) ? rawPrimary : 'chest';
        const sanitizedSecondaries: MuscleGroup[] = Array.isArray(rawSecondaries)
          ? rawSecondaries.filter((m: unknown) => isValidMuscleGroup(m) && m !== sanitizedPrimary)
          : [];

        setExerciseName(existingExercise.name);
        setPrimaryMuscle(sanitizedPrimary);
        setSecondaryMuscles(sanitizedSecondaries);
        setExerciseType(existingExercise.type);

        const defaultContribs = calculateDefaultContributions(sanitizedPrimary, sanitizedSecondaries);

        if (rawContributions && typeof rawContributions === 'object') {
          const picked: Record<MuscleGroup, number> = { ...defaultContribs };
          for (const m of [sanitizedPrimary, ...sanitizedSecondaries]) {
            const v = (rawContributions as any)[m];
            if (typeof v === 'number' && Number.isFinite(v)) {
              picked[m] = v;
            }
          }
          const total = [sanitizedPrimary, ...sanitizedSecondaries].reduce((sum, m) => sum + (picked[m] || 0), 0);
          setMuscleContributions(Math.abs(total - 100) < 0.01 ? picked : defaultContribs);
        } else {
          setMuscleContributions(defaultContribs);
        }
      } else {
        // Reset form for create mode
        setExerciseName('');
        setPrimaryMuscle('chest');
        setSecondaryMuscles([]);
        setExerciseType('weighted');
        setMuscleContributions({} as Record<MuscleGroup, number>);
      }
    }
  }, [visible, mode, existingExercise]);

  // Auto-calculate muscle contributions when muscles change (only in create mode)
  useEffect(() => {
    if (mode === 'create' && primaryMuscle) {
      const defaultContributions = calculateDefaultContributions(primaryMuscle, secondaryMuscles);
      setMuscleContributions(defaultContributions);
    }
  }, [mode, primaryMuscle, secondaryMuscles]);

  const handleClose = () => {
    setExerciseName('');
    setPrimaryMuscle('chest');
    setSecondaryMuscles([]);
    setExerciseType('weighted');
    setMuscleContributions({} as Record<MuscleGroup, number>);
    onClose();
  };

  const handleResetMuscles = () => {
    Alert.alert(
      'Reset Muscles',
      'This will clear all muscle selections and set the primary muscle to Chest. You can reconfigure it afterward.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            const primary: MuscleGroup = 'chest';
            setPrimaryMuscle(primary);
            setSecondaryMuscles([]);
            setMuscleContributions(calculateDefaultContributions(primary, []));
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
          },
        },
      ]
    );
  };

  const validateContributions = (contributions: Record<MuscleGroup, number>): boolean => {
    const muscles = [primaryMuscle, ...secondaryMuscles];
    const total = muscles.reduce((sum, muscle) => sum + (contributions[muscle] || 0), 0);
    return Math.abs(total - 100) < 0.01; // Allow small floating point errors
  };

  const handleSave = async () => {
    if (!exerciseName.trim()) {
      Alert.alert('Error', 'Please enter an exercise name');
      return;
    }

    if (!primaryMuscle) {
      Alert.alert('Error', 'Please select a primary muscle');
      return;
    }

    if (!validateContributions(muscleContributions)) {
      Alert.alert('Error', 'Muscle contributions must add up to 100%');
      return;
    }

    setIsSaving(true);

    try {
      let finalName = exerciseName.trim();
      
      // If editing a predefined exercise, append (Custom) to the name
      if (mode === 'edit' && existingExercise) {
        const isDefaultExercise = PREDEFINED_EXERCISES_WITH_MUSCLES.some(
          (ex) => ex.name.toLowerCase() === existingExercise.name.toLowerCase()
        );
        if (isDefaultExercise && !finalName.includes('(Custom)')) {
          finalName = `${finalName} (Custom)`;
        }
      }

      await onSave({
        name: finalName,
        primaryMuscle,
        secondaryMuscles,
        type: exerciseType,
        muscleContributions,
      });

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      handleClose();
    } catch (error) {
      Alert.alert('Error', `Failed to ${mode === 'create' ? 'create' : 'update'} exercise`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSecondaryMusclesChange = (nextSecondary: MuscleGroup[]) => {
    const cleaned = nextSecondary.filter((m) => m !== primaryMuscle);
    setSecondaryMuscles(cleaned);
    const newContributions = calculateDefaultContributions(primaryMuscle, cleaned);
    setMuscleContributions(newContributions);
  };

  const handlePrimaryMuscleChange = (muscle: MuscleGroup) => {
    const nextSecondary = secondaryMuscles.filter((m) => m !== muscle);

    setPrimaryMuscle(muscle);
    if (nextSecondary.length !== secondaryMuscles.length) {
      setSecondaryMuscles(nextSecondary);
    }

    const newContributions = calculateDefaultContributions(muscle, nextSecondary);
    setMuscleContributions(newContributions);
  };

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
            {mode === 'create' ? 'Create Exercise' : 'Edit Exercise'}
          </Text>
          <Pressable onPress={handleClose} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
            <IconSymbol size={24} name="xmark.circle.fill" color={colors.muted} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{
            padding: 16,
            gap: 20,
            paddingBottom: insets.bottom + 16,
          }}
        >
          {/* Exercise Name */}
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>
              Exercise Name
            </Text>
            <Input
              placeholder="e.g., Dumbbell Flyes"
              value={exerciseName}
              onChangeText={setExerciseName}
            />
          </View>

          {/* Exercise Type */}
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>
              Exercise Type
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {(['weighted', 'bodyweight', 'assisted-bodyweight', 'weighted-bodyweight', 'doubled'] as ExerciseType[]).map((type) => (
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
                     type === 'weighted-bodyweight' ? 'Weighted BW' : 'Doubled'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <PrimarySecondaryMusclePicker
            primaryMuscle={primaryMuscle}
            secondaryMuscles={secondaryMuscles}
            onChangePrimary={handlePrimaryMuscleChange}
            onChangeSecondary={handleSecondaryMusclesChange}
            title="Muscles"
          />

          {/* Muscle Contribution */}
          <MuscleContributionEditor
            primaryMuscle={primaryMuscle}
            secondaryMuscles={secondaryMuscles}
            contributions={muscleContributions}
            onContributionsChange={setMuscleContributions}
            autoCalculate={mode === 'create'}
            exerciseNameOrId={exerciseName}
            onMusclesChange={(p, s) => {
              if (p) setPrimaryMuscle(p);
              setSecondaryMuscles(s);
            }}
          />

          {/* Actions */}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
            <Button
              onPress={handleClose}
              variant="outline"
              className="flex-1"
            >
              <Text className="text-foreground font-semibold">Cancel</Text>
            </Button>
            <Button
              onPress={handleSave}
              disabled={isSaving || !validateContributions(muscleContributions)}
              className="flex-1"
            >
              <Text className="text-background font-semibold">
                {isSaving ? 'Saving...' : mode === 'create' ? 'Create Exercise' : 'Save Changes'}
              </Text>
            </Button>
          </View>

          {mode === 'edit' && (
            <View style={{ marginTop: 8 }}>
              <Button onPress={handleResetMuscles} variant="outline">
                <Text className="text-foreground font-semibold">Reset muscles</Text>
              </Button>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
