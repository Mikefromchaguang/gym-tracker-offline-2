import React, { useMemo, useState } from 'react';
import { Modal, Pressable, Text, View, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/use-colors';
import { GroupedExercisePicker } from '@/components/grouped-exercise-picker';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ExerciseOption {
  id: string;
  index: number;
  name: string;
  setCount: number;
}

export interface MergeSupersetModalProps {
  visible: boolean;
  onClose: () => void;
  /** The exercise being merged (to exclude from options) */
  sourceExercise: { id: string; name: string } | null;
  /** Other exercises in the workout that can be grouped with */
  availableExercises: ExerciseOption[];
  /** All exercises for the "add new" picker */
  allExercises: Array<{
    name: string;
    primaryMuscle?: string;
    secondaryMuscles?: string[];
    isCustom?: boolean;
    isModified?: boolean;
    hasData?: boolean;
  }>;
  defaultRestTimeSeconds: number;
  /** Called when user selects an existing exercise */
  onSelectExisting: (targetIndex: number, restTimeSeconds: number) => void;
  /** Called when user wants to add a new exercise to superset with */
  onAddNewExercise: (exerciseName: string, restTimeSeconds: number) => void;
  /** Optional callback to create a new exercise */
  onCreateNewExercise?: () => void;
}

type Step = 'choose' | 'pickNew' | 'config';

export function MergeSupersetModal({
  visible,
  onClose,
  sourceExercise,
  availableExercises,
  allExercises,
  defaultRestTimeSeconds,
  onSelectExisting,
  onAddNewExercise,
  onCreateNewExercise,
}: MergeSupersetModalProps) {
  const colors = useColors();

  const [step, setStep] = useState<Step>('choose');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExistingIndex, setSelectedExistingIndex] = useState<number | null>(null);
  const [selectedNewExerciseName, setSelectedNewExerciseName] = useState<string | null>(null);
  const [restTimeText, setRestTimeText] = useState(String(defaultRestTimeSeconds));

  const title = useMemo(() => {
    if (step === 'choose') return 'Add to Superset';
    if (step === 'pickNew') return 'Pick exercise';
    return 'Configure Superset';
  }, [step]);

  const closeAndReset = () => {
    setStep('choose');
    setSearchQuery('');
    setSelectedExistingIndex(null);
    setSelectedNewExerciseName(null);
    setRestTimeText(String(defaultRestTimeSeconds));
    onClose();
  };

  const handleBack = () => {
    if (step === 'config') {
      if (selectedNewExerciseName) {
        setStep('pickNew');
      } else {
        setStep('choose');
      }
      return;
    }
    if (step === 'pickNew') {
      setStep('choose');
      setSearchQuery('');
      return;
    }
    closeAndReset();
  };

  const handleSelectExisting = (index: number) => {
    setSelectedExistingIndex(index);
    setSelectedNewExerciseName(null);
    setStep('config');
  };

  const handleSelectNew = (name: string) => {
    setSelectedNewExerciseName(name);
    setSelectedExistingIndex(null);
    setSearchQuery('');
    setStep('config');
  };

  const handleDone = () => {
    const parsed = parseInt(restTimeText, 10);
    const restTimeSeconds = Number.isFinite(parsed) ? Math.max(0, parsed) : defaultRestTimeSeconds;

    if (selectedExistingIndex !== null) {
      onSelectExisting(selectedExistingIndex, restTimeSeconds);
    } else if (selectedNewExerciseName) {
      onAddNewExercise(selectedNewExerciseName, restTimeSeconds);
    }

    closeAndReset();
  };

  // Filter out exercises that are already in a superset and the source exercise
  const eligibleExercises = useMemo(() => {
    return availableExercises.filter(ex => ex.id !== sourceExercise?.id);
  }, [availableExercises, sourceExercise]);

  const selectedTargetName = useMemo(() => {
    if (selectedNewExerciseName) return selectedNewExerciseName;
    if (selectedExistingIndex !== null) {
      const ex = availableExercises.find(e => e.index === selectedExistingIndex);
      return ex?.name ?? null;
    }
    return null;
  }, [selectedNewExerciseName, selectedExistingIndex, availableExercises]);

  if (!sourceExercise) return null;

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
            <IconSymbol name={step === 'choose' ? 'xmark.circle.fill' : 'chevron.left'} size={22} color={colors.muted} />
          </Pressable>
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: '700' }}>{title}</Text>
          <View style={{ width: 30 }} />
        </View>

        {step === 'choose' && (
          <View style={{ flex: 1, padding: 16 }}>
            <Text style={{ color: colors.muted, fontSize: 14, marginBottom: 16 }}>
              Group <Text style={{ fontWeight: '700', color: colors.foreground }}>{sourceExercise.name}</Text> with:
            </Text>

            {eligibleExercises.length > 0 && (
              <>
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 }}>
                  Existing exercises in this workout
                </Text>
                <FlatList
                  data={eligibleExercises}
                  keyExtractor={(item) => item.id}
                  style={{ maxHeight: 300, marginBottom: 16 }}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => handleSelectExisting(item.index)}
                      style={({ pressed }) => [
                        {
                          padding: 12,
                          backgroundColor: pressed ? colors.surface : colors.card,
                          borderRadius: 8,
                          marginBottom: 8,
                          borderWidth: 1,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: '600' }}>
                        {item.name}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                        {item.setCount} {item.setCount === 1 ? 'set' : 'sets'}
                      </Text>
                    </Pressable>
                  )}
                />
              </>
            )}

            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8, marginTop: eligibleExercises.length > 0 ? 8 : 0 }}>
              Or add a new exercise
            </Text>
            <Button
              variant="secondary"
              onPress={() => setStep('pickNew')}
              className="w-full"
            >
              <IconSymbol size={18} name="plus.circle" color={colors.foreground} />
              <Text className="text-base font-semibold text-foreground">Add new exercise to superset</Text>
            </Button>
          </View>
        )}

        {step === 'pickNew' && (
          <View style={{ flex: 1 }}>
            <GroupedExercisePicker
              exercises={allExercises}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSelectExercise={handleSelectNew}
              onCreateNew={() => {
                if (onCreateNewExercise) onCreateNewExercise();
              }}
              showCreateButton={!!onCreateNewExercise}
            />
          </View>
        )}

        {step === 'config' && (
          <View style={{ padding: 16, gap: 16 }}>
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>
                Exercise A
              </Text>
              <View
                style={{
                  padding: 12,
                  backgroundColor: colors.surface,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: '#3B82F6', fontWeight: '800', marginRight: 6, fontSize: 16 }}>A</Text>
                <Text style={{ color: colors.foreground, fontSize: 16 }}>{sourceExercise.name}</Text>
              </View>
            </View>

            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>
                Exercise B
              </Text>
              <View
                style={{
                  padding: 12,
                  backgroundColor: colors.surface,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: '#F59E0B', fontWeight: '800', marginRight: 6, fontSize: 16 }}>B</Text>
                <Text style={{ color: colors.foreground, fontSize: 16 }}>{selectedTargetName}</Text>
              </View>
            </View>

            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>
                Rest time (seconds)
              </Text>
              <Input
                placeholder="e.g., 90"
                value={restTimeText}
                keyboardType="numeric"
                onChangeText={(text) => {
                  const filtered = text.replace(/[^0-9]/g, '');
                  setRestTimeText(filtered);
                }}
              />
            </View>

            <Button
              size="lg"
              onPress={handleDone}
              className="w-full mt-4"
            >
              <Text className="text-base font-semibold text-background">Create Superset</Text>
            </Button>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}
