/**
 * Grouped Exercise Picker - Displays exercises organized by muscle group
 * Used in active workouts and template creation screens
 */

import { ScrollView, Text, View, Pressable, TextInput } from 'react-native';
import { useMemo, useCallback } from 'react';
import { MuscleGroup } from '@/lib/types';
import { PRIMARY_MUSCLE_GROUPS, getMuscleGroupDisplayName } from '@/lib/muscle-groups';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface Exercise {
  name: string;
  primaryMuscle?: string;
  secondaryMuscles?: string[];
  isCustom?: boolean;
  isModified?: boolean;
  hasData?: boolean;
}

interface GroupedExercisePickerProps {
  exercises: Exercise[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectExercise: (exerciseName: string) => void;
  onCreateNew: () => void;
  showCreateButton?: boolean;
}

export function GroupedExercisePicker({
  exercises,
  searchQuery,
  onSearchChange,
  onSelectExercise,
  onCreateNew,
  showCreateButton = true,
}: GroupedExercisePickerProps) {
  const colors = useColors();

  // Filter exercises based on search
  const filteredExercises = useMemo(() => {
    if (!searchQuery.trim()) return exercises;
    const search = searchQuery.toLowerCase();
    return exercises.filter(ex =>
      ex.name.toLowerCase().includes(search) ||
      ex.primaryMuscle?.toLowerCase().includes(search) ||
      ex.secondaryMuscles?.some(m => m.toLowerCase().includes(search))
    );
  }, [exercises, searchQuery]);

  // Group filtered exercises by primary muscle
  const exercisesByMuscle = useMemo(() => {
    const grouped: Record<string, Exercise[]> = {};
    filteredExercises.forEach(ex => {
      const muscle = ex.primaryMuscle || 'Other';
      if (!grouped[muscle]) grouped[muscle] = [];
      grouped[muscle].push(ex);
    });
    return grouped;
  }, [filteredExercises]);

  const handleExercisePress = useCallback(
    (exerciseName: string) => {
      onSelectExercise(exerciseName);
    },
    [onSelectExercise]
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Search Input */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <TextInput
          placeholder="Search by name or muscle group..."
          placeholderTextColor={colors.muted}
          value={searchQuery}
          onChangeText={onSearchChange}
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            color: colors.foreground,
            fontSize: 14,
          }}
        />
      </View>

      {/* Create New Exercise Button */}
      {showCreateButton && (
        <Pressable
          onPress={onCreateNew}
          style={({ pressed }) => [
            {
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginHorizontal: 16,
              marginVertical: 12,
              paddingVertical: 12,
              borderRadius: 8,
              gap: 8,
              backgroundColor: colors.primary,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <IconSymbol size={18} name="plus" color={colors.background} />
          <Text style={{ color: colors.background, fontSize: 15, fontWeight: '600' }}>Create New Exercise</Text>
        </Pressable>
      )}

      {/* Grouped Exercise List */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 32 }}>
        {Object.entries(exercisesByMuscle).length === 0 ? (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 32 }}>
            <Text style={{ color: colors.muted, fontSize: 16 }}>No exercises found</Text>
          </View>
        ) : (
          Object.entries(exercisesByMuscle).map(([muscle, muscleExercises]) => (
            <Card key={muscle} style={{ marginBottom: 16 }}>
              <CardHeader style={{ paddingBottom: 8 }}>
                <CardTitle>{getMuscleGroupDisplayName(muscle as MuscleGroup)}</CardTitle>
              </CardHeader>
              <CardContent style={{ gap: 0 }}>
                {muscleExercises.map((exercise, index) => (
                  <Pressable
                    key={exercise.name}
                    onPress={() => handleExercisePress(exercise.name)}
                    style={({ pressed }) => [
                      {
                        paddingVertical: 12,
                        paddingHorizontal: 0,
                        borderBottomWidth: index !== muscleExercises.length - 1 ? 1 : 0,
                        borderBottomColor: colors.border,
                        backgroundColor: pressed ? colors.surface : colors.background,
                      },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Text style={{ fontSize: 15, fontWeight: '500', color: colors.foreground, flex: 1 }}>
                        {exercise.name}
                      </Text>
                      {exercise.isCustom && (
                        <View style={{ backgroundColor: '#FF9500', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                          <Text style={{ fontSize: 11, fontWeight: '600', color: colors.background }}>Custom</Text>
                        </View>
                      )}
                      {exercise.isModified && (
                        <View style={{ backgroundColor: '#3B82F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                          <Text style={{ fontSize: 11, fontWeight: '600', color: colors.background }}>Modified</Text>
                        </View>
                      )}
                      {exercise.hasData && (
                        <View style={{ backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                          <Text style={{ fontSize: 11, fontWeight: '600', color: colors.background }}>Data</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ fontSize: 12, color: colors.muted }}>
                      Primary: {getMuscleGroupDisplayName(exercise.primaryMuscle as MuscleGroup)}
                      {exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0 && (
                        <>, Secondary: {exercise.secondaryMuscles.map((m) => getMuscleGroupDisplayName(m as MuscleGroup)).join(', ')}</>
                      )}
                    </Text>
                  </Pressable>
                ))}
              </CardContent>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}
