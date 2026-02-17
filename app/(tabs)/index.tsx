/**
 * Home Screen - Start workouts and manage templates
 */

import { ScrollView, Text, View, Pressable, Alert, RefreshControl, Modal } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '@/components/screen-container';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TemplateCard } from '@/components/template-card';
import { useGym } from '@/lib/gym-context';
import { useRouter } from 'expo-router';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { useBodyweight } from '@/hooks/use-bodyweight';
import { BodyWeightStorage } from '@/lib/storage';
import { TextInput } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { convertWeight, formatWeight, formatVolume, convertWeightBetweenUnits, KG_TO_LBS, LBS_TO_KG } from '@/lib/unit-conversion';
import { calculateSetVolume } from '@/lib/volume-calculation';
import { DailyQuote } from '@/components/daily-quote';
import { WorkoutTemplate } from '@/lib/types';
import { exportTemplate, importTemplate } from '@/lib/template-transfer';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

export default function HomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { templates, workouts, deleteTemplate, reorderTemplates, settings, customExercises, addTemplate, addCustomExercise, isWorkoutActive, duplicateTemplate, stopTimer, clearWorkoutActive } = useGym();
  const { bodyWeightKg } = useBodyweight(); // For volume calculations (always in kg)
  const [refreshing, setRefreshing] = useState(false);
  const [bodyWeight, setBodyWeight] = useState<string>('');
  const [isEditingWeight, setIsEditingWeight] = useState(false);
  const [showWeightHistory, setShowWeightHistory] = useState(false);
  const [showAddWeightModal, setShowAddWeightModal] = useState(false);
  const [showEditWeightModal, setShowEditWeightModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<{ weight: number; date: string; timestamp: number } | null>(null);
  const [manualWeight, setManualWeight] = useState<string>('');
  const [manualDate, setManualDate] = useState<string>('');
  const [weightHistory, setWeightHistory] = useState<Array<{ date: string; weight: number; timestamp: number }>>([]);
  const [localTemplates, setLocalTemplates] = useState<WorkoutTemplate[]>([]);

  // Sync templates from context to local state
  useEffect(() => {
    setLocalTemplates(templates);
  }, [templates]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadTodayWeight();
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  const loadTodayWeight = useCallback(async () => {
    const log = await BodyWeightStorage.getTodayWeight();
    if (log !== null) {
      // Convert from stored unit to display unit
      const { convertWeightBetweenUnits } = await import('@/lib/unit-conversion');
      const displayWeight = convertWeightBetweenUnits(log.weight, log.unit, settings.weightUnit);
      setBodyWeight(displayWeight.toString());
    } else {
      setBodyWeight('');
    }
  }, [settings.weightUnit]);

  const loadWeightHistory = useCallback(async () => {
    const logs = await BodyWeightStorage.getAll();
    // Convert all weights to current unit
    const { convertWeightBetweenUnits } = await import('@/lib/unit-conversion');
    const converted = logs.map(log => {
      // Convert from stored unit to display unit
      const weight = convertWeightBetweenUnits(log.weight, log.unit, settings.weightUnit);
      return { date: log.date, weight, timestamp: log.timestamp };
    });
    
    // Sort by date descending (newest first)
    const sorted = converted.sort((a, b) => b.date.localeCompare(a.date));
    
    setWeightHistory(sorted);
  }, [settings.weightUnit]);

  useEffect(() => {
    const initializeBodyWeight = async () => {
      await BodyWeightStorage.ensureDailyEntries();
      await loadTodayWeight();
      await loadWeightHistory();
    };
    initializeBodyWeight();
  }, [loadTodayWeight, loadWeightHistory]);

  const handleSaveBodyWeight = async () => {
    const weight = parseFloat(bodyWeight);
    if (isNaN(weight) || weight <= 0) {
      Alert.alert('Invalid Weight', 'Please enter a valid weight');
      return;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      await BodyWeightStorage.save({
        date: today,
        weight,
        unit: settings.weightUnit,
        timestamp: Date.now(),
      });
      await loadTodayWeight();
      await loadWeightHistory();
      setIsEditingWeight(false);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save body weight');
    }
  };

  const handleAddManualWeight = async () => {
    const weight = parseFloat(manualWeight);
    if (isNaN(weight) || weight <= 0) {
      Alert.alert('Invalid Weight', 'Please enter a valid weight');
      return;
    }
    if (!manualDate) {
      Alert.alert('Invalid Date', 'Please select a date');
      return;
    }

    try {
      await BodyWeightStorage.save({
        date: manualDate,
        weight,
        unit: settings.weightUnit,
        timestamp: new Date(manualDate).getTime(),
      });
      await loadTodayWeight();
      await loadWeightHistory();
      setShowAddWeightModal(false);
      setManualWeight('');
      setManualDate('');
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to add body weight entry');
    }
  };

  const handleEditWeight = (entry: { weight: number; date: string; timestamp: number }) => {
    setEditingEntry(entry);
    setManualWeight(entry.weight.toString());
    setManualDate(entry.date);
    setShowEditWeightModal(true);
  };

  const handleSaveEditWeight = async () => {
    if (!editingEntry) return;
    
    const weight = parseFloat(manualWeight);
    if (isNaN(weight) || weight <= 0) {
      Alert.alert('Invalid Weight', 'Please enter a valid weight');
      return;
    }
    if (!manualDate) {
      Alert.alert('Invalid Date', 'Please select a date');
      return;
    }

    try {
      await BodyWeightStorage.update(editingEntry.timestamp, {
        date: manualDate,
        weight,
        unit: settings.weightUnit,
        timestamp: editingEntry.timestamp,
      });
      await loadTodayWeight();
      await loadWeightHistory();
      setShowEditWeightModal(false);
      setEditingEntry(null);
      setManualWeight('');
      setManualDate('');
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update body weight entry');
    }
  };

  const handleDeleteWeight = async (timestamp: number) => {
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this weight entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await BodyWeightStorage.delete(timestamp);
              await loadTodayWeight();
              await loadWeightHistory();
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete body weight entry');
            }
          },
        },
      ]
    );
  };

  const handleStartQuickWorkout = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    // Check if workout is already active
    if (isWorkoutActive) {
      Alert.alert(
        'Workout in Progress',
        'You already have an active workout. You can continue it, or end it and start a new one.',
        [
          { text: 'OK', style: 'cancel' },
          {
            text: 'Continue Workout',
            onPress: () => router.push('/_hidden/active-workout'),
          },
          {
            text: 'End & Start New',
            style: 'destructive',
            onPress: async () => {
              await stopTimer();
              await clearWorkoutActive();
              // Wait a tick to ensure state propagates before navigation
              await new Promise(resolve => setTimeout(resolve, 0));
              router.push('/_hidden/active-workout');
            },
          },
        ]
      );
      return;
    }
    
    // Open empty workout (quick workout)
    router.push('/_hidden/active-workout');
  };

  const handleCreateTemplate = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push('/_hidden/templates/create');
  };

  const handleSelectTemplate = (templateId: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    // Check if workout is already active
    if (isWorkoutActive) {
      Alert.alert(
        'Workout in Progress',
        'You already have an active workout. You can continue it, or end it and start a new one.',
        [
          { text: 'OK', style: 'cancel' },
          {
            text: 'Continue Workout',
            onPress: () => router.push('/_hidden/active-workout'),
          },
          {
            text: 'End & Start New',
            style: 'destructive',
            onPress: async () => {
              const template = templates.find(t => t.id === templateId);
              await stopTimer();
              await clearWorkoutActive();
              // Wait a tick to ensure state propagates before navigation
              await new Promise(resolve => setTimeout(resolve, 0));
              router.push({
                pathname: '/_hidden/active-workout',
                params: {
                  templateId,
                  templateName: template?.name || 'Workout',
                },
              });
            },
          },
        ]
      );
      return;
    }
    
    const template = templates.find(t => t.id === templateId);
      router.push({
        pathname: '/_hidden/active-workout',
      params: { 
        templateId,
        templateName: template?.name || 'Workout'
      },
    });
  };

  const handleEditTemplate = (templateId: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push({
      pathname: '/_hidden/templates/create',
      params: { templateId },
    });
  };

  const handleDeleteTemplate = (templateId: string, templateName: string) => {
    Alert.alert(
      'Delete Template',
      `Are you sure you want to delete "${templateName}"?`,
      [
        { text: 'Cancel', onPress: () => {} },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              await deleteTemplate(templateId);
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete template');
            }
          },
        },
      ]
    );
  };

  const handleDuplicateTemplate = async (templateId: string) => {
    try {
      const duplicated = await duplicateTemplate(templateId);
      if (duplicated) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } else {
        Alert.alert('Error', 'Template not found');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to duplicate template');
    }
  };

  const handleExportTemplate = async (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) {
      Alert.alert('Error', 'Template not found');
      return;
    }

    // Show confirmation dialog
    Alert.alert(
      'Export Template',
      `Are you sure you want to export "${template.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Export',
          onPress: async () => {
            try {
              const result = await exportTemplate(template, customExercises);

              if (result.success) {
                const message = Platform.OS === 'web' 
                  ? `Template exported: ${result.filePath}`
                  : Platform.OS === 'android'
                  ? `Template saved to selected location`
                  : `Template ready to save - choose location in share sheet`;
                Alert.alert('Export Successful', message);
                if (Platform.OS !== 'web') {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
              } else {
                Alert.alert('Error', result.error || 'Failed to export template');
              }
            } catch (error) {
              console.error('Export error:', error);
              Alert.alert('Error', 'Failed to export template');
            }
          },
        },
      ]
    );
  };

  const handleImportTemplate = async () => {
    try {
      // Show security warning
      Alert.alert(
        'Security Warning',
        '⚠️ Only import template files from trusted sources. Malicious files could contain harmful data. Make sure you have verified the file before importing.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'I Understand, Continue',
            onPress: async () => {
              try {
                const result = await DocumentPicker.getDocumentAsync({
                  type: 'application/json',
                  copyToCacheDirectory: true,
                });

                if (result.canceled) return;

                const fileUri = result.assets[0].uri;
                const fileContent = await FileSystem.readAsStringAsync(fileUri);

                const importResult = await importTemplate(fileContent, templates, customExercises);

                if (importResult.success && importResult.template) {
                  // Add custom exercises first
                  if (importResult.customExercises) {
                    for (const customEx of importResult.customExercises) {
                      await addCustomExercise(customEx);
                    }
                  }

                  // Add template
                  await addTemplate(importResult.template);

                  // Navigate to edit the imported template
                  router.push({
                    pathname: '/_hidden/templates/create',
                    params: { templateId: importResult.template.id },
                  });

                  if (Platform.OS !== 'web') {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  }
                } else {
                  Alert.alert('Import Failed', importResult.error || 'Invalid template file');
                }
              } catch (error) {
                console.error('Import error:', error);
                Alert.alert('Error', 'Failed to import template');
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Import error:', error);
      Alert.alert('Error', 'Failed to import template');
    }
  };

  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return;
    const reordered = [...localTemplates];
    const [removed] = reordered.splice(index, 1);
    reordered.splice(index - 1, 0, removed);
    setLocalTemplates(reordered);
    reorderTemplates(reordered);
  }, [localTemplates, reorderTemplates]);

  const handleMoveDown = useCallback((index: number) => {
    if (index === localTemplates.length - 1) return;
    const reordered = [...localTemplates];
    const [removed] = reordered.splice(index, 1);
    reordered.splice(index + 1, 0, removed);
    setLocalTemplates(reordered);
    reorderTemplates(reordered);
  }, [localTemplates, reorderTemplates]);

  // Calculate today's stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayWorkouts = workouts.filter((w) => new Date(w.startTime).getTime() >= today.getTime());
  const todayVolume = todayWorkouts.reduce((sum, w) => {
    return (
      sum +
      w.exercises.reduce((exSum, ex) => {
        return exSum + ex.sets
          .filter(set => set.completed !== false && set.setType !== 'warmup') // Exclude warmup sets
          .reduce((setSum, set) => setSum + calculateSetVolume(set, ex.type, bodyWeightKg), 0);
      }, 0)
    );
  }, 0);

  return (
    <ScreenContainer className="p-4">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={true}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View className="gap-6 pb-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Swole Revolution</Text>
            <Text className="text-base text-muted">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          </View>

          {/* Daily Quote */}
          <DailyQuote />

          {/* Today's Stats */}
          <View className="gap-2">
            <Text className="text-lg font-semibold text-foreground">Today</Text>
            <View className="flex-row gap-2">
            <Card className="flex-1">
              <CardContent className="items-center gap-1 pt-4">
                <Text className="text-2xl font-bold text-primary">{todayWorkouts.length}</Text>
                <Text className="text-xs text-muted">Workouts</Text>
              </CardContent>
            </Card>
            <Card className="flex-1">
              <CardContent className="items-center gap-1 pt-4">
                <Text className="text-2xl font-bold text-primary">{Math.round(convertWeight(todayVolume, settings.weightUnit))}</Text>
                <Text className="text-xs text-muted">Volume ({settings.weightUnit})</Text>
              </CardContent>
            </Card>
            </View>
          </View>

          {/* Body Weight Logger */}
          <Card>
            <CardHeader>
              <View className="flex-row items-center justify-between">
                <CardTitle className="text-base">Today's Body Weight</CardTitle>
                <Pressable
                  onPress={() => {
                    loadWeightHistory();
                    setShowWeightHistory(true);
                    if (Platform.OS !== 'web') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                  }}
                  style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                >
                  <Text className="text-sm text-primary">History</Text>
                </Pressable>
              </View>
            </CardHeader>
            <CardContent className="gap-3">
              {bodyWeight && !isEditingWeight ? (
                <Pressable
                  onPress={() => {
                    if (Platform.OS !== 'web') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                    setIsEditingWeight(true);
                  }}
                  style={({ pressed }) => [{
                    alignItems: 'center',
                    paddingVertical: 8,
                    opacity: pressed ? 0.7 : 1,
                  }]}
                >
                  <Text className="text-4xl font-bold text-primary">
                    {parseFloat(bodyWeight).toFixed(1)} {settings.weightUnit}
                  </Text>
                  <Text className="text-sm text-muted mt-2">Tap to edit</Text>
                </Pressable>
              ) : (
                <View className="flex-row items-center gap-2">
                  <TextInput
                    className="flex-1 h-12 px-4 rounded-lg border border-border bg-surface text-foreground text-base"
                    placeholder={`Enter weight (${settings.weightUnit})`}
                    placeholderTextColor={colors.muted}
                    keyboardType="decimal-pad"
                    value={bodyWeight}
                    onChangeText={setBodyWeight}
                    onFocus={() => setIsEditingWeight(true)}
                  />
                  <Pressable
                    onPress={handleSaveBodyWeight}
                    style={({ pressed }) => [{
                      backgroundColor: colors.primary,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderRadius: 8,
                      opacity: pressed ? 0.8 : 1,
                    }]}
                  >
                    <Text className="text-sm font-semibold text-background">Save</Text>
                  </Pressable>
                </View>
              )}
            </CardContent>
          </Card>

          {/* Quick Workout Button */}
          <Button size="lg" onPress={handleStartQuickWorkout} className="w-full">
            <IconSymbol size={20} name="play.fill" color={colors.background} />
            <Text className="text-base font-semibold text-background">Quick Workout</Text>
          </Button>

          {/* Templates Section */}
          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-semibold text-foreground">Workout Templates</Text>
              <View className="flex-row items-center gap-3">
                <Pressable
                  onPress={handleImportTemplate}
                  style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                >
                  <View className="flex-row items-center gap-1">
                    <IconSymbol size={18} name="square.and.arrow.down" color={colors.primary} />
                    <Text className="text-sm font-semibold text-primary">Import</Text>
                  </View>
                </Pressable>
                <Pressable
                  onPress={handleCreateTemplate}
                  style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                >
                  <View className="flex-row items-center gap-1">
                    <IconSymbol size={20} name="plus.circle.fill" color={colors.primary} />
                    <Text className="text-sm font-semibold text-primary">New</Text>
                  </View>
                </Pressable>
              </View>
            </View>

            {localTemplates.length > 0 ? (
              <View className="gap-2">
                {localTemplates.map((template, index) => (
                  <Animated.View
                    key={template.id}
                    layout={Platform.OS === 'web' ? undefined : LinearTransition.duration(120)}
                  >
                    <TemplateCard
                      template={template}
                      index={index}
                      totalCount={localTemplates.length}
                      onMoveUp={handleMoveUp}
                      onMoveDown={handleMoveDown}
                      onEdit={handleEditTemplate}
                      onDelete={handleDeleteTemplate}
                      onStartWorkout={handleSelectTemplate}
                      onExport={handleExportTemplate}
                      onDuplicate={handleDuplicateTemplate}
                    />
                  </Animated.View>
                ))}
              </View>
            ) : (
              <Card>
                <CardContent className="items-center gap-2 py-8">
                  <IconSymbol size={32} name="plus.circle" color={colors.muted} />
                  <Text className="text-center text-muted">
                    No templates yet. Create one to get started!
                  </Text>
                </CardContent>
              </Card>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Body Weight History Modal */}
      <Modal
        visible={showWeightHistory}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWeightHistory(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ 
            backgroundColor: colors.background, 
            borderTopLeftRadius: 16, 
            borderTopRightRadius: 16, 
            maxHeight: '70%',
            paddingBottom: Math.max(insets.bottom, 16)
          }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: 18, fontWeight: '600', color: colors.foreground }}>Weight History</Text>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <Pressable
                  onPress={() => {
                    setManualDate(new Date().toISOString().split('T')[0]);
                    setManualWeight('');
                    setShowAddWeightModal(true);
                  }}
                  style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, padding: 4 }]}
                >
                  <IconSymbol size={24} name="plus.circle.fill" color={colors.primary} />
                </Pressable>
                <Pressable
                  onPress={() => setShowWeightHistory(false)}
                  style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, padding: 4 }]}
                >
                  <Text style={{ fontSize: 16, color: colors.primary }}>Close</Text>
                </Pressable>
              </View>
            </View>

            {/* History List */}
            <ScrollView style={{ flexGrow: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
              {weightHistory.length > 0 ? (
                <View style={{ padding: 16, gap: 12 }}>
                  {weightHistory.map((entry, index) => (
                    <View
                      key={index}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: 12,
                        backgroundColor: colors.surface,
                        borderRadius: 8,
                      }}
                    >
                      <Text style={{ fontSize: 14, color: colors.muted }}>
                        {new Date(entry.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.foreground }}>
                          {entry.weight.toFixed(1)} {settings.weightUnit}
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <Pressable
                            onPress={() => handleEditWeight(entry)}
                            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, padding: 4 }]}
                          >
                            <IconSymbol size={20} name="pencil" color={colors.primary} />
                          </Pressable>
                          <Pressable
                            onPress={() => handleDeleteWeight(entry.timestamp)}
                            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, padding: 4 }]}
                          >
                            <IconSymbol size={20} name="trash" color={colors.error} />
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={{ padding: 32, alignItems: 'center' }}>
                  <Text style={{ color: colors.muted, textAlign: 'center' }}>No weight history yet</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Weight Modal */}
      <Modal
        visible={showAddWeightModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddWeightModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: colors.background, borderRadius: 16, padding: 20, width: '100%', maxWidth: 400 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.foreground, marginBottom: 16 }}>Add Weight Entry</Text>
            
            <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 8 }}>Date</Text>
            <TextInput
              style={{
                backgroundColor: colors.surface,
                borderRadius: 8,
                padding: 12,
                fontSize: 16,
                color: colors.foreground,
                marginBottom: 16,
              }}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.muted}
              value={manualDate}
              onChangeText={setManualDate}
            />

            <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 8 }}>Weight ({settings.weightUnit})</Text>
            <TextInput
              style={{
                backgroundColor: colors.surface,
                borderRadius: 8,
                padding: 12,
                fontSize: 16,
                color: colors.foreground,
                marginBottom: 20,
              }}
              placeholder="Enter weight"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              value={manualWeight}
              onChangeText={setManualWeight}
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={() => setShowAddWeightModal(false)}
                style={({ pressed }) => [{
                  flex: 1,
                  backgroundColor: colors.surface,
                  borderRadius: 8,
                  padding: 12,
                  alignItems: 'center',
                  opacity: pressed ? 0.6 : 1,
                }]}
              >
                <Text style={{ color: colors.foreground, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleAddManualWeight}
                style={({ pressed }) => [{
                  flex: 1,
                  backgroundColor: colors.primary,
                  borderRadius: 8,
                  padding: 12,
                  alignItems: 'center',
                  opacity: pressed ? 0.8 : 1,
                }]}
              >
                <Text style={{ color: colors.background, fontWeight: '600' }}>Add</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Weight Modal */}
      <Modal
        visible={showEditWeightModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditWeightModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: colors.background, borderRadius: 16, padding: 20, width: '100%', maxWidth: 400 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.foreground, marginBottom: 16 }}>Edit Weight Entry</Text>
            
            <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 8 }}>Date</Text>
            <TextInput
              style={{
                backgroundColor: colors.surface,
                borderRadius: 8,
                padding: 12,
                fontSize: 16,
                color: colors.foreground,
                marginBottom: 16,
              }}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.muted}
              value={manualDate}
              onChangeText={setManualDate}
            />

            <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 8 }}>Weight ({settings.weightUnit})</Text>
            <TextInput
              style={{
                backgroundColor: colors.surface,
                borderRadius: 8,
                padding: 12,
                fontSize: 16,
                color: colors.foreground,
                marginBottom: 20,
              }}
              placeholder="Enter weight"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              value={manualWeight}
              onChangeText={setManualWeight}
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={() => setShowEditWeightModal(false)}
                style={({ pressed }) => [{
                  flex: 1,
                  backgroundColor: colors.surface,
                  borderRadius: 8,
                  padding: 12,
                  alignItems: 'center',
                  opacity: pressed ? 0.6 : 1,
                }]}
              >
                <Text style={{ color: colors.foreground, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveEditWeight}
                style={({ pressed }) => [{
                  flex: 1,
                  backgroundColor: colors.primary,
                  borderRadius: 8,
                  padding: 12,
                  alignItems: 'center',
                  opacity: pressed ? 0.8 : 1,
                }]}
              >
                <Text style={{ color: colors.background, fontWeight: '600' }}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
