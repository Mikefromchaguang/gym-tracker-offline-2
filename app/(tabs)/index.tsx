/**
 * Home Screen - Start workouts and manage routines
 */

import {
  ScrollView,
  Text,
  View,
  Pressable,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  Platform,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
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
import * as Haptics from 'expo-haptics';
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
  const { width: windowWidth } = useWindowDimensions();
  const { templates, weekPlans, activeWeekPlanId, setActiveWeekPlan, addWeekPlan, deleteWeekPlan, workouts, deleteTemplate, reorderTemplates, settings, customExercises, addTemplate, addCustomExercise, isWorkoutActive, duplicateTemplate, stopTimer, clearWorkoutActive } = useGym();
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
  const [currentRoutineIndex, setCurrentRoutineIndex] = useState(0);
  const [currentPlanIndex, setCurrentPlanIndex] = useState(0);
  const [showWeekPlanMenu, setShowWeekPlanMenu] = useState(false);
  const [selectedWeekPlanId, setSelectedWeekPlanId] = useState<string | null>(null);

  const routineCardSpacing = 12;
  const routineCardWidth = useMemo(() => {
    // ScreenContainer uses p-4 (16px each side) so content width is windowWidth - 32.
    const containerWidth = Math.max(0, windowWidth - 32);
    const computed = Math.round(containerWidth * 0.86); // show a small peek of the next card
    return Math.max(260, Math.min(420, computed));
  }, [windowWidth]);

  const routineSnapInterval = useMemo(
    () => routineCardWidth + routineCardSpacing,
    [routineCardWidth]
  );

  const activeWeekPlan = useMemo(() => {
    if (weekPlans.length === 0) return null;
    return weekPlans.find((p) => p.id === activeWeekPlanId) || weekPlans[0];
  }, [weekPlans, activeWeekPlanId]);

  const selectedWeekPlan = useMemo(() => {
    if (!selectedWeekPlanId) return null;
    return weekPlans.find((p) => p.id === selectedWeekPlanId) ?? null;
  }, [weekPlans, selectedWeekPlanId]);

  const todayRoutineIds = useMemo(() => {
    if (!activeWeekPlan) return new Set<string>();
    const today = new Date().getDay();
    const day = activeWeekPlan.days.find((d) => d.dayIndex === today);
    return new Set(day?.routineIds || []);
  }, [activeWeekPlan]);

  // Sync templates from context to local state
  useEffect(() => {
    setLocalTemplates(templates);
  }, [templates]);

  useEffect(() => {
    setCurrentRoutineIndex((idx) => {
      const maxIndex = Math.max(0, localTemplates.length - 1);
      return Math.min(idx, maxIndex);
    });
  }, [localTemplates.length]);

  useEffect(() => {
    setCurrentPlanIndex((idx) => {
      const maxIndex = Math.max(0, weekPlans.length - 1);
      return Math.min(idx, maxIndex);
    });
  }, [weekPlans.length]);

  const handleRoutineScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const rawIndex = routineSnapInterval > 0 ? Math.round(x / routineSnapInterval) : 0;
      const maxIndex = Math.max(0, localTemplates.length - 1);
      setCurrentRoutineIndex(Math.max(0, Math.min(rawIndex, maxIndex)));
    },
    [routineSnapInterval, localTemplates.length]
  );

  const handlePlanScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const rawIndex = routineSnapInterval > 0 ? Math.round(x / routineSnapInterval) : 0;
      const maxIndex = Math.max(0, weekPlans.length - 1);
      setCurrentPlanIndex(Math.max(0, Math.min(rawIndex, maxIndex)));
    },
    [routineSnapInterval, weekPlans.length]
  );

  const handleOpenPlans = useCallback(() => {
    router.push('/_hidden/week-plans');
  }, [router]);

  const getNextWeekPlanCopyName = useCallback((name: string) => {
    const existing = new Set(weekPlans.map((p) => p.name.trim().toLowerCase()));
    let candidate = `${name} (Copy)`;
    let i = 2;
    while (existing.has(candidate.trim().toLowerCase())) {
      candidate = `${name} (Copy ${i})`;
      i += 1;
    }
    return candidate;
  }, [weekPlans]);

  const openWeekPlanMenu = useCallback((planId: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedWeekPlanId(planId);
    setShowWeekPlanMenu(true);
  }, []);

  const closeWeekPlanMenu = useCallback(() => {
    setShowWeekPlanMenu(false);
    setSelectedWeekPlanId(null);
  }, []);

  const handleDuplicateWeekPlan = useCallback(async () => {
    if (!selectedWeekPlan) return;
    try {
      const now = Date.now();
      await addWeekPlan({
        id: `week_plan_${now}_${Math.random().toString(36).slice(2, 8)}`,
        name: getNextWeekPlanCopyName(selectedWeekPlan.name),
        days: selectedWeekPlan.days.map((day) => ({
          dayIndex: day.dayIndex,
          routineIds: [...day.routineIds],
        })),
        createdAt: now,
        updatedAt: now,
      });
      closeWeekPlanMenu();
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to duplicate week planner');
    }
  }, [selectedWeekPlan, addWeekPlan, getNextWeekPlanCopyName, closeWeekPlanMenu]);

  const handleDeleteWeekPlan = useCallback(() => {
    if (!selectedWeekPlan) return;
    Alert.alert(
      'Delete Week Planner',
      `Are you sure you want to delete "${selectedWeekPlan.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteWeekPlan(selectedWeekPlan.id);
              closeWeekPlanMenu();
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete week planner');
            }
          },
        },
      ]
    );
  }, [selectedWeekPlan, deleteWeekPlan, closeWeekPlanMenu]);

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
              // Wait for state propagation before navigating to prevent race condition
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
              // Wait for state propagation before navigating to prevent race condition
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
      'Delete Routine',
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
              Alert.alert('Error', 'Failed to delete routine');
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
        Alert.alert('Error', 'Routine not found');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to duplicate routine');
    }
  };

  const handleExportTemplate = async (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) {
      Alert.alert('Error', 'Routine not found');
      return;
    }

    // Show confirmation dialog
    Alert.alert(
      'Export Routine',
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
                  ? `Routine exported: ${result.filePath}`
                  : Platform.OS === 'android'
                  ? `Routine saved to selected location`
                  : `Routine ready to save - choose location in share sheet`;
                Alert.alert('Export Successful', message);
                if (Platform.OS !== 'web') {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
              } else {
                Alert.alert('Error', result.error || 'Failed to export routine');
              }
            } catch (error) {
              console.error('Export error:', error);
              Alert.alert('Error', 'Failed to export routine');
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
        '⚠️ Only import routine files from trusted sources. Malicious files could contain harmful data. Make sure you have verified the file before importing.',
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
                  Alert.alert('Import Failed', importResult.error || 'Invalid routine file');
                }
              } catch (error) {
                console.error('Import error:', error);
                Alert.alert('Error', 'Failed to import routine');
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Import error:', error);
      Alert.alert('Error', 'Failed to import routine');
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

          {/* Routines Section */}
          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-end gap-2">
                <Text className="text-lg font-semibold text-foreground">Workout Routines</Text>
                {localTemplates.length > 1 ? (
                  <Text className="text-sm text-muted">
                    {currentRoutineIndex + 1} / {localTemplates.length}
                  </Text>
                ) : null}
              </View>
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
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToInterval={routineSnapInterval}
                snapToAlignment="start"
                disableIntervalMomentum
                nestedScrollEnabled
                onMomentumScrollEnd={handleRoutineScrollEnd}
                contentContainerStyle={{ paddingRight: 4 }}
              >
                {localTemplates.map((template, index) => (
                  <View
                    key={template.id}
                    style={{ width: routineCardWidth, marginRight: index === localTemplates.length - 1 ? 0 : routineCardSpacing }}
                  >
                    <Animated.View
                      layout={Platform.OS === 'web' ? undefined : LinearTransition.duration(120)}
                    >
                      <TemplateCard
                        template={template}
                        index={index}
                        totalCount={localTemplates.length}
                        isScheduledToday={todayRoutineIds.has(template.id)}
                        onMoveUp={handleMoveUp}
                        onMoveDown={handleMoveDown}
                        onEdit={handleEditTemplate}
                        onDelete={handleDeleteTemplate}
                        onStartWorkout={handleSelectTemplate}
                        onExport={handleExportTemplate}
                        onDuplicate={handleDuplicateTemplate}
                      />
                    </Animated.View>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Card>
                <CardContent className="items-center gap-2 py-8">
                  <IconSymbol size={32} name="plus.circle" color={colors.muted} />
                  <Text className="text-center text-muted">
                    No routines yet. Create one to get started!
                  </Text>
                </CardContent>
              </Card>
            )}
          </View>

          {/* Week Planner Section */}
          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-end gap-2">
                <Text className="text-lg font-semibold text-foreground">Week Planner</Text>
                {weekPlans.length > 1 ? (
                  <Text className="text-sm text-muted">
                    {currentPlanIndex + 1} / {weekPlans.length}
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={handleOpenPlans}
                style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
              >
                <View className="flex-row items-center gap-1">
                  <IconSymbol size={18} name="calendar" color={colors.primary} />
                  <Text className="text-sm font-semibold text-primary">Open</Text>
                </View>
              </Pressable>
            </View>

            {weekPlans.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToInterval={routineSnapInterval}
                snapToAlignment="start"
                disableIntervalMomentum
                nestedScrollEnabled
                onMomentumScrollEnd={handlePlanScrollEnd}
                contentContainerStyle={{ paddingRight: 4 }}
              >
                {weekPlans.map((plan, index) => {
                  const totalSessions = plan.days.reduce((acc, d) => acc + d.routineIds.length, 0);
                  const todayCount = plan.days.find((d) => d.dayIndex === new Date().getDay())?.routineIds.length || 0;
                  const isActive = activeWeekPlan?.id === plan.id;

                  return (
                    <View
                      key={plan.id}
                      style={{ width: routineCardWidth, marginRight: index === weekPlans.length - 1 ? 0 : routineCardSpacing }}
                    >
                      <Card>
                        <CardHeader>
                          <View className="flex-row items-center justify-between">
                            <View className="flex-1">
                              <CardTitle className="text-base">{plan.name}</CardTitle>
                              <CardDescription>
                                {totalSessions} sessions • Today: {todayCount}
                              </CardDescription>
                            </View>
                            <View className="flex-row items-center gap-2">
                              {isActive ? (
                                <View className="bg-orange-500 px-2 py-1 rounded-full">
                                  <Text className="text-xs font-semibold text-background">Active</Text>
                                </View>
                              ) : null}
                              <Pressable
                                onPress={() => openWeekPlanMenu(plan.id)}
                                style={({ pressed }) => [{
                                  padding: 6,
                                  borderRadius: 999,
                                  backgroundColor: colors.surface,
                                  borderWidth: 1,
                                  borderColor: colors.border,
                                  opacity: pressed ? 0.7 : 1,
                                }]}
                              >
                                <IconSymbol size={18} name="ellipsis.circle" color={colors.muted} />
                              </Pressable>
                            </View>
                          </View>
                        </CardHeader>
                        <CardContent className="gap-2">
                          <Text className="text-xs text-muted">
                            {plan.days
                              .filter((d) => d.routineIds.length > 0)
                              .slice(0, 3)
                              .map((d) => `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.dayIndex]} ${d.routineIds.length}`)
                              .join(' • ') || 'No routines assigned'}
                          </Text>

                          <View className="flex-row gap-2 pt-2">
                            {!isActive ? (
                              <Pressable
                                onPress={() => setActiveWeekPlan(plan.id)}
                                style={({ pressed }) => [{
                                  flex: 1,
                                  paddingVertical: 8,
                                  paddingHorizontal: 12,
                                  backgroundColor: colors.surface,
                                  borderRadius: 6,
                                  borderWidth: 1,
                                  borderColor: colors.border,
                                  alignItems: 'center',
                                  opacity: pressed ? 0.8 : 1,
                                }]}
                              >
                                <Text className="text-xs font-semibold text-foreground">Set Active</Text>
                              </Pressable>
                            ) : null}
                            <Pressable
                              onPress={() => router.push({ pathname: '/_hidden/week-plans/edit', params: { planId: plan.id } })}
                              style={({ pressed }) => [{
                                flex: 1,
                                paddingVertical: 8,
                                paddingHorizontal: 12,
                                backgroundColor: colors.primary,
                                borderRadius: 6,
                                borderWidth: 1,
                                borderColor: colors.primary,
                                alignItems: 'center',
                                opacity: pressed ? 0.8 : 1,
                              }]}
                            >
                              <Text className="text-xs font-semibold text-background">Edit Plan</Text>
                            </Pressable>
                          </View>
                        </CardContent>
                      </Card>
                    </View>
                  );
                })}
              </ScrollView>
            ) : (
              <Card>
                <CardContent className="items-center gap-2 py-8">
                  <IconSymbol size={32} name="calendar" color={colors.muted} />
                  <Text className="text-center text-muted">
                    No week planner yet. Create one to organize your routines.
                  </Text>
                  <Pressable
                    onPress={handleOpenPlans}
                    style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                  >
                    <Text className="text-sm font-semibold text-primary">Create Plan</Text>
                  </Pressable>
                </CardContent>
              </Card>
            )}
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={showWeekPlanMenu}
        transparent
        animationType="fade"
        onRequestClose={closeWeekPlanMenu}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 16 }}
          onPress={closeWeekPlanMenu}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.background,
              borderRadius: 12,
              padding: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 4,
              elevation: 5,
            }}
          >
            <Pressable
              onPress={handleDuplicateWeekPlan}
              style={({ pressed }) => [{
                paddingVertical: 12,
                paddingHorizontal: 16,
                backgroundColor: pressed ? colors.surface : colors.background,
                borderRadius: 8,
              }]}
            >
              <Text style={{ color: colors.foreground, fontSize: 16 }}>Duplicate</Text>
            </Pressable>
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
            <Pressable
              onPress={handleDeleteWeekPlan}
              style={({ pressed }) => [{
                paddingVertical: 12,
                paddingHorizontal: 16,
                backgroundColor: pressed ? colors.surface : colors.background,
                borderRadius: 8,
              }]}
            >
              <Text style={{ color: colors.error, fontSize: 16 }}>Delete</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

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
