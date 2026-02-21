/**
 * Routine Details Screen - View and manage routine
 */

import { ScrollView, Text, View, FlatList, Alert, Pressable } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useGym } from '@/lib/gym-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { WorkoutTemplate } from '@/lib/types';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';

export default function TemplateDetailsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { templates, deleteTemplate, duplicateTemplate } = useGym();
  const { id } = useLocalSearchParams();

  const [template, setTemplate] = useState<WorkoutTemplate | null>(null);

  useEffect(() => {
    if (id && typeof id === 'string') {
      const found = templates.find((t) => t.id === id);
      setTemplate(found || null);
    }
  }, [id, templates]);

  const handleEdit = () => {
    if (!template) return;
    router.push(`/_hidden/templates/create?templateId=${template.id}`);
  };

  const handleDuplicate = async () => {
    if (!template) return;
    try {
      await duplicateTemplate(template.id);
      Alert.alert('Success', 'Routine duplicated');
      router.back();
    } catch (error) {
      Alert.alert('Error', 'Failed to duplicate routine');
    }
  };

  const handleDelete = () => {
    if (!template) return;

    Alert.alert(
      'Delete Routine',
      'Are you sure you want to delete this routine?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTemplate(template.id);
              router.back();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete routine');
            }
          },
        },
      ]
    );
  };

  const handleStartWorkout = () => {
    if (!template) return;
    router.push(`/_hidden/active-workout?templateId=${template.id}&templateName=${template.name}`);
  };

  if (!template) {
    return (
      <ScreenContainer className="items-center justify-center gap-4">
        <Text className="text-lg font-semibold text-foreground">Routine not found</Text>
        <Button onPress={() => router.back()}>Go Back</Button>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="gap-4">
          {/* Header */}
          <View className="flex-row items-center justify-between">
            <Text className="text-2xl font-bold text-foreground">{template.name}</Text>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
            >
              <IconSymbol size={24} name="xmark.circle.fill" color={colors.muted} />
            </Pressable>
          </View>

          {/* Start Workout Button */}
          <Button
            size="lg"
            onPress={handleStartWorkout}
            className="w-full"
          >
            <IconSymbol size={20} name="play.fill" color={colors.background} />
            <Text className="text-base font-semibold text-background">Start Workout</Text>
          </Button>

          {/* Exercises */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">
              Exercises ({template.exercises.length})
            </Text>
            {template.exercises.length > 0 ? (
              <FlatList
                data={template.exercises}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <Card className="mb-3">
                    <CardHeader>
                      <CardTitle className="text-base">{item.name}</CardTitle>
                      <CardDescription>
                        {item.sets} sets × {item.reps} reps
                        {item.weight && ` @ ${item.weight} ${item.unit}`}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                )}
                scrollEnabled={false}
              />
            ) : (
              <Text className="text-sm text-muted text-center py-4">
                No exercises in this routine
              </Text>
            )}
          </View>

          {/* Action Buttons */}
          <View className="gap-2 mt-4">
            <Button
              variant="secondary"
              size="lg"
              onPress={handleEdit}
              className="w-full"
            >
              <IconSymbol size={20} name="pencil" color={colors.foreground} />
              <Text className="text-base font-semibold text-foreground">Edit</Text>
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onPress={handleDuplicate}
              className="w-full"
            >
              <IconSymbol size={20} name="list.bullet" color={colors.foreground} />
              <Text className="text-base font-semibold text-foreground">Duplicate</Text>
            </Button>
            <Button
              variant="destructive"
              size="lg"
              onPress={handleDelete}
              className="w-full"
            >
              <IconSymbol size={20} name="trash" color={colors.background} />
              <Text className="text-base font-semibold text-background">Delete</Text>
            </Button>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
