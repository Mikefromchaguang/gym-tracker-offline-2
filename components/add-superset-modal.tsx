import React, { useMemo, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/use-colors';
import { GroupedExercisePicker } from '@/components/grouped-exercise-picker';
import { IconSymbol } from '@/components/ui/icon-symbol';

type Slot = 'A' | 'B';

type ExercisePickerItem = {
  name: string;
  primaryMuscle?: string;
  secondaryMuscles?: string[];
  isCustom?: boolean;
  isModified?: boolean;
  hasData?: boolean;
};

export interface AddSupersetModalResult {
  exerciseAName: string;
  exerciseBName: string;
  restTimeSeconds: number;
}

export interface AddSupersetModalProps {
  visible: boolean;
  onClose: () => void;
  exercises: ExercisePickerItem[];
  defaultRestTimeSeconds: number;
  onSubmit: (result: AddSupersetModalResult) => void;
  onCreateNewExercise?: (slot: Slot) => void;
}

export function AddSupersetModal({
  visible,
  onClose,
  exercises,
  defaultRestTimeSeconds,
  onSubmit,
  onCreateNewExercise,
}: AddSupersetModalProps) {
  const colors = useColors();

  const [step, setStep] = useState<'pickA' | 'pickB' | 'config'>('pickA');
  const [searchQuery, setSearchQuery] = useState('');
  const [exerciseAName, setExerciseAName] = useState<string | null>(null);
  const [exerciseBName, setExerciseBName] = useState<string | null>(null);
  const [restTimeText, setRestTimeText] = useState(String(defaultRestTimeSeconds));

  const title = useMemo(() => {
    if (step === 'pickA') return 'Pick first exercise';
    if (step === 'pickB') return 'Pick second exercise';
    return 'Superset';
  }, [step]);

  const canSubmit = Boolean(exerciseAName && exerciseBName);

  const closeAndReset = () => {
    setStep('pickA');
    setSearchQuery('');
    setExerciseAName(null);
    setExerciseBName(null);
    setRestTimeText(String(defaultRestTimeSeconds));
    onClose();
  };

  const handleBack = () => {
    if (step === 'config') {
      setStep('pickB');
      return;
    }
    if (step === 'pickB') {
      setStep('pickA');
      return;
    }
    closeAndReset();
  };

  const handleSelectExercise = (name: string) => {
    if (step === 'pickA') {
      setExerciseAName(name);
      setSearchQuery('');
      setStep('pickB');
      return;
    }

    if (step === 'pickB') {
      setExerciseBName(name);
      setSearchQuery('');
      setStep('config');
      return;
    }
  };

  const handleCreateNew = () => {
    if (!onCreateNewExercise) return;
    const slot: Slot = step === 'pickB' ? 'B' : 'A';
    onCreateNewExercise(slot);
    // Keep current selections; parent can reopen modal after creation if desired.
    onClose();
  };

  const handleDone = () => {
    if (!exerciseAName || !exerciseBName) return;
    const parsed = parseInt(restTimeText, 10);
    const restTimeSeconds = Number.isFinite(parsed) ? Math.max(0, parsed) : defaultRestTimeSeconds;

    onSubmit({
      exerciseAName,
      exerciseBName,
      restTimeSeconds,
    });

    closeAndReset();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={closeAndReset}
    >
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, padding: 4 }]}
          >
            <IconSymbol name={step === 'pickA' ? 'xmark.circle.fill' : 'chevron.left'} size={22} color={colors.muted} />
          </Pressable>
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: '700' }}>{title}</Text>
          <View style={{ width: 30 }} />
        </View>

        {step === 'config' ? (
          <View style={{ padding: 16, gap: 16 }}>
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>
                Exercises
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text style={{ color: '#3B82F6', fontWeight: '700' }}>{exerciseAName}</Text>
                <Text style={{ color: colors.muted }}>+</Text>
                <Text style={{ color: '#F59E0B', fontWeight: '700' }}>{exerciseBName}</Text>
              </View>
            </View>

            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>
                Rest Timer (seconds)
              </Text>
              <TextInput
                value={restTimeText}
                onChangeText={setRestTimeText}
                keyboardType="number-pad"
                placeholder={String(defaultRestTimeSeconds)}
                placeholderTextColor={colors.muted}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: colors.foreground,
                  backgroundColor: colors.surface,
                  fontSize: 15,
                }}
              />
            </View>

            <Pressable
              onPress={handleDone}
              disabled={!canSubmit}
              style={({ pressed }) => [
                {
                  backgroundColor: canSubmit ? colors.primary : colors.border,
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={{ color: colors.background, fontSize: 16, fontWeight: '800' }}>Done</Text>
            </Pressable>
          </View>
        ) : (
          <GroupedExercisePicker
            exercises={exercises}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSelectExercise={handleSelectExercise}
            onCreateNew={handleCreateNew}
            showCreateButton={Boolean(onCreateNewExercise)}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
