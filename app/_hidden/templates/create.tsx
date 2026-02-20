/**
 * Template Creation/Editing Screen - Configure workout templates
 * Includes drag-and-drop reordering and simple exercise picker modal
 */

import { Text, View, Pressable, Alert, StyleSheet, Modal, TextInput, FlatList, ScrollView, LayoutAnimation, UIManager, useWindowDimensions } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { LinearTransition } from 'react-native-reanimated';
import Body from 'react-native-body-highlighter';

import { ScreenContainer } from '@/components/screen-container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useGym } from '@/lib/gym-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { usePreventRemove } from '@react-navigation/native';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Exercise, getExerciseMuscles, getEffectiveExerciseMuscles, WorkoutTemplate, CompletedSet, PREDEFINED_EXERCISES, PREDEFINED_EXERCISES_WITH_MUSCLES, MuscleGroup, ExerciseType, ExerciseMetadata } from '@/lib/types';
import { generateCustomExerciseId } from '@/lib/exercise-id-migration';
import { PRIMARY_MUSCLE_GROUPS, getMuscleGroupDisplayName } from '@/lib/muscle-groups';
import { generateId, BodyWeightStorage } from '@/lib/storage';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { useBodyweight } from '@/hooks/use-bodyweight';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { convertWeight, formatWeight, formatVolume } from '@/lib/unit-conversion';
import { calculateExerciseVolume, calculateTemplateExerciseVolume } from '@/lib/volume-calculation';
import { getExerciseContributions } from '@/lib/muscle-contribution';
import { getIncreaseWeightSuggestion } from '@/lib/auto-progression';
import { CreateExerciseModal } from '@/components/create-exercise-modal';
import { GroupedExercisePicker } from '@/components/grouped-exercise-picker';
import { AddSupersetModal, type AddSupersetModalResult } from '@/components/add-superset-modal';
import { ExerciseQuickActionsSheet } from '@/components/exercise-quick-actions-sheet';
import { ExerciseDetailModal } from '@/components/exercise-detail-modal';
import { MergeSupersetModal } from '@/components/merge-superset-modal';
import { groupExercisesForDisplay, moveDisplayItem, mergeExercisesToSuperset, splitSupersetToExercises, isExerciseInSuperset, type ExerciseDisplayItem } from '@/lib/superset';

// Mapping from our muscle groups to body-highlighter muscle names
const ROUTINE_MUSCLE_MAP: Partial<Record<MuscleGroup, string[]>> = {
  'chest': ['chest'],
  'upper-back': ['upper-back'],
  'lower-back': ['lower-back'],
  'lats': ['back-deltoids'],
  // Deltoid split (front/side share the front-shoulder slug; rear uses back-shoulder slug)
  'deltoids-front': ['deltoids'],
  'deltoids-side': ['deltoids'],
  'deltoids-rear': ['back-deltoids'],
  // Legacy (pre-split) fallback
  'deltoids': ['deltoids'],
  'biceps': ['biceps'],
  'triceps': ['triceps'],
  'forearms': ['forearm'],
  'abs': ['abs'],
  'obliques': ['obliques'],
  'quadriceps': ['quadriceps'],
  'hamstring': ['hamstring'],
  'gluteal': ['gluteal'],
  'calves': ['calves'],
  'trapezius': ['trapezius'],
  'adductors': ['adductors'],
  'tibialis': ['tibialis-anterior'],
  'neck': ['neck'],
};

interface TemplateExerciseWithSets {
  id: string;
  exerciseId?: string; // Unique identifier for the exercise (ID-based or name-based)
  name: string;
  sets: CompletedSet[];
  reps: number;
  weight?: number;
  unit: 'kg' | 'lbs';
  type: ExerciseType;
  notes?: string;
  restTimer?: number;
  timerEnabled?: boolean; // Whether rest timer is enabled for this exercise
  autoProgressionEnabled?: boolean;
  autoProgressionMinReps?: number;
  autoProgressionMaxReps?: number;
  autoProgressionUseDefaultRange?: boolean;
  primaryMuscle?: string;
  secondaryMuscles?: string[];
  tempId?: string;

  // Optional grouping metadata (e.g. supersets)
  groupType?: 'superset';
  groupId?: string;
  groupPosition?: 0 | 1;
}

export default function TemplateCreateScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { addTemplate, updateTemplate, templates, workouts, settings, customExercises, addCustomExercise, getMostRecentExerciseData, getExercisePRData, predefinedExerciseCustomizations } = useGym();
  const { templateId, newExerciseName } = useLocalSearchParams();

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const [templateName, setTemplateName] = useState('');
  const [exercises, setExercises] = useState<TemplateExerciseWithSets[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Exercise picker modal state
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');

  // Superset creation modal state
  const [showSupersetModal, setShowSupersetModal] = useState(false);

  // Create Exercise modal state
  const [showCreateExercise, setShowCreateExercise] = useState(false);

  // Save as New Template modal state
  const [showSaveAsNewModal, setShowSaveAsNewModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

  const [showReplaceExercisePicker, setShowReplaceExercisePicker] = useState(false);
  const [replacingExerciseId, setReplacingExerciseId] = useState<string | null>(null);

  // Exercise details quick actions + modal
  const [showExerciseQuickActions, setShowExerciseQuickActions] = useState(false);
  const [exerciseQuickActionsName, setExerciseQuickActionsName] = useState<string | null>(null);
  const [exerciseQuickActionsId, setExerciseQuickActionsId] = useState<string | null>(null);
  const [showExerciseDetailsModal, setShowExerciseDetailsModal] = useState(false);
  const [exerciseDetailsName, setExerciseDetailsName] = useState<string | null>(null);

  // Set menu state (changed from long-press to tap)
  const [showSetMenu, setShowSetMenu] = useState<{ exerciseIndex: number; setIndex: number } | null>(null);
  const [setMenuPosition, setSetMenuPosition] = useState<{ x: number; y: number } | null>(null);

  // Merge superset modal state
  const [showMergeSupersetModal, setShowMergeSupersetModal] = useState(false);
  const [mergeSupersetSourceId, setMergeSupersetSourceId] = useState<string | null>(null);

  // Collapsed state for exercise/superset cards (keyed by ExerciseDisplayItem.key)
  const [collapsedDisplayKeys, setCollapsedDisplayKeys] = useState<Set<string>>(new Set());

  // Header swipe state (Summary <-> Muscles)
  const [headerPageIndex, setHeaderPageIndex] = useState(0);
  const headerPageWidth = Math.max(1, windowWidth - 32); // ScreenContainer has `p-4`
  const [headerCardHeight, setHeaderCardHeight] = useState<number | null>(null);
  const headerScrollRef = useRef<ScrollView>(null);

  // Re-measure header height if width changes (e.g., rotation)
  useEffect(() => {
    setHeaderCardHeight(null);
  }, [headerPageWidth]);

  // Prevent occasional snap-back by enforcing the current page offset after re-renders.
  useEffect(() => {
    headerScrollRef.current?.scrollTo({ x: headerPageIndex * headerPageWidth, animated: false });
  }, [headerPageIndex, headerPageWidth]);

  const toggleCollapsedDisplayKey = useCallback((key: string) => {
    setCollapsedDisplayKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const displayItems = useMemo(() => groupExercisesForDisplay(exercises), [exercises]);

  const syncTemplateExerciseToLastSession = useCallback(
    (exerciseId: string) => {
      setExercises((prev) => {
        const target = prev.find((ex) => ex.id === exerciseId);
        if (!target) return prev;

        const mostRecentWorkout = [...workouts]
          .sort((a, b) => b.endTime - a.endTime)
          .find((w) => w.exercises.some((ex) => ex.name === target.name && ex.sets.length > 0));

        const sourceSets = mostRecentWorkout?.exercises.find((ex) => ex.name === target.name)?.sets ?? [];
        if (sourceSets.length === 0) {
          Alert.alert('No previous session found', `Couldn't find any logged sets for ${target.name}.`);
          return prev;
        }

        return prev.map((ex) => {
          if (ex.id !== exerciseId) return ex;
          return {
            ...ex,
            sets: ex.sets.map((set, idx) => {
              const src = sourceSets[idx];
              if (!src) return set;
              return {
                ...set,
                reps: src.reps ?? set.reps,
                weight: src.weight ?? set.weight,
              };
            }),
          };
        });
      });

      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    [workouts]
  );

  // Available exercises for merge superset modal (non-superset exercises only)
  const availableExercisesForMerge = useMemo(() => {
    return exercises
      .map((ex, index) => ({ ex, index }))
      .filter(({ ex }) => !isExerciseInSuperset(ex))
      .map(({ ex, index }) => ({
        id: ex.id,
        index,
        name: ex.name,
        setCount: ex.sets.length,
      }));
  }, [exercises]);

  // Source exercise info for merge modal
  const mergeSupersetSourceExercise = useMemo(() => {
    if (!mergeSupersetSourceId) return null;
    const ex = exercises.find((e) => e.id === mergeSupersetSourceId);
    if (!ex) return null;
    return { id: ex.id, name: ex.name };
  }, [mergeSupersetSourceId, exercises]);

  const openExerciseQuickActions = useCallback((exerciseId: string) => {
    const ex = exercises.find((e) => e.id === exerciseId);
    if (!ex) return;
    setExerciseQuickActionsId(exerciseId);
    setExerciseQuickActionsName(ex.name);
    setShowExerciseQuickActions(true);
  }, [exercises]);

  const openExerciseDetails = useCallback((name: string) => {
    setExerciseDetailsName(name);
    setShowExerciseDetailsModal(true);
  }, []);

  const quickActionsMeta = useMemo(() => {
    if (!exerciseQuickActionsId) return null;
    const ex = exercises.find((e) => e.id === exerciseQuickActionsId);
    if (!ex) return null;

    const isSuperset = ex.groupType === 'superset' && typeof ex.groupId === 'string';
    const mate = isSuperset
      ? exercises.find((m) => m.id !== ex.id && m.groupType === 'superset' && m.groupId === ex.groupId)
      : undefined;

    const restTimerSeconds = ex.restTimer ?? mate?.restTimer ?? settings.defaultRestTime ?? 180;
    const restTimerEnabled = isSuperset
      ? ex.timerEnabled !== false && (!mate || mate.timerEnabled !== false)
      : ex.timerEnabled !== false;
    const autoProgressionEnabled = settings.autoProgressionEnabled && ex.autoProgressionEnabled !== false;

    return {
      ex,
      mate,
      isSuperset,
      restTimerSeconds,
      restTimerEnabled,
      autoProgressionEnabled,
    };
  }, [exerciseQuickActionsId, exercises, settings.defaultRestTime, settings.autoProgressionEnabled]);

  // Use centralized muscle groups
  const MUSCLE_GROUPS: MuscleGroup[] = PRIMARY_MUSCLE_GROUPS;
  
  // Bodyweight for volume calculations (in kg for calculations)
  const { bodyWeightKg: currentBodyweight } = useBodyweight();

  // All available exercises (predefined + custom)
  const exercisesWithData = useMemo(() => {
    const names = new Set<string>();
    workouts.forEach((workout) => {
      workout.exercises.forEach((exercise) => {
        if (exercise.sets && exercise.sets.length > 0) {
          names.add(exercise.name);
        }
      });
    });
    return names;
  }, [workouts]);

  const allExercises = useMemo(() => {
    const predefined = PREDEFINED_EXERCISES_WITH_MUSCLES.map((ex) => {
      const effective = getEffectiveExerciseMuscles(
        ex.name,
        predefinedExerciseCustomizations,
        false,
        undefined
      );
      return {
        name: ex.name,
        primaryMuscle: effective?.primaryMuscle ?? ex.primaryMuscle,
        secondaryMuscles: effective?.secondaryMuscles ?? ex.secondaryMuscles,
        isCustom: false,
        isModified: !!predefinedExerciseCustomizations[ex.name],
        hasData: exercisesWithData.has(ex.name),
      };
    });
    const custom = customExercises.map(ex => ({
      name: ex.name,
      primaryMuscle: ex.primaryMuscle,
      secondaryMuscles: ex.secondaryMuscles,
      isCustom: true,
      isModified: false,
      hasData: exercisesWithData.has(ex.name),
    }));
    return [...predefined, ...custom];
  }, [customExercises, exercisesWithData, predefinedExerciseCustomizations]);

  // Filtered exercises based on search
  const filteredExercises = useMemo(() => {
    if (!exerciseSearch.trim()) return allExercises;
    const search = exerciseSearch.toLowerCase();
    return allExercises.filter(ex => 
      ex.name.toLowerCase().includes(search) ||
      ex.primaryMuscle?.toLowerCase().includes(search) ||
      ex.secondaryMuscles?.some(m => m.toLowerCase().includes(search))
    );
  }, [allExercises, exerciseSearch]);

  // Load template if editing
  useEffect(() => {
    if (templateId && typeof templateId === 'string') {
      const template = templates.find((t) => t.id === templateId);
      if (template) {
        setTemplateName(template.name);
        
        // Convert Exercise[] to TemplateExerciseWithSets[]
        const exercisesWithSets: TemplateExerciseWithSets[] = template.exercises.map((ex) => {
          // If setDetails exists, convert to CompletedSet[]; otherwise create from defaults
          const completedSets: CompletedSet[] = ex.setDetails && ex.setDetails.length > 0
            ? ex.setDetails.map((setConfig, i) => ({
                setNumber: i + 1,
                reps: setConfig.reps,
                weight: setConfig.weight,
                unit: setConfig.unit,
                setType: setConfig.setType,
                timestamp: Date.now(),
                completed: false,
              }))
            : Array.from({ length: ex.sets }, (_, i) => ({
                setNumber: i + 1,
                reps: ex.reps,
                weight: ex.weight || 0,
                unit: ex.unit,
                setType: 'working',
                timestamp: Date.now(),
                completed: false,
              }));

          return {
            id: ex.id,
            name: ex.name,
            sets: completedSets,
            reps: ex.reps,
            weight: ex.weight,
            unit: ex.unit,
            type: ex.type,
            notes: ex.notes,
            restTimer: ex.restTimer,
            timerEnabled: ex.timerEnabled,
            autoProgressionEnabled: ex.autoProgressionEnabled,
            autoProgressionMinReps: ex.autoProgressionMinReps,
            autoProgressionMaxReps: ex.autoProgressionMaxReps,
            autoProgressionUseDefaultRange: ex.autoProgressionUseDefaultRange,
            primaryMuscle: ex.primaryMuscle as string | undefined,
            secondaryMuscles: ex.secondaryMuscles as string[] | undefined,
            groupType: ex.groupType,
            groupId: ex.groupId,
            groupPosition: ex.groupPosition,
          };
        });
        
                setExercises(exercisesWithSets);
                // Match active workout behavior: start with all cards collapsed when opening an existing routine
                setCollapsedDisplayKeys(new Set(groupExercisesForDisplay(exercisesWithSets).map((item) => item.key)));
      }
    } else {
      // Reset state when creating new template
      setTemplateName('');
      setExercises([]);
              setCollapsedDisplayKeys(new Set());
    }
  }, [templateId, templates]);

  // Handle new exercise created from create-exercise screen
  useEffect(() => {
    if (newExerciseName && typeof newExerciseName === 'string') {
      handleAddExerciseToTemplate(newExerciseName);
      router.setParams({ newExerciseName: undefined });
    }
  }, [newExerciseName]);

  // Track unsaved changes
  useEffect(() => {
    if (templateName.trim() || exercises.length > 0) {
      setHasUnsavedChanges(true);
    } else {
      setHasUnsavedChanges(false);
    }
  }, [templateName, exercises]);

  // Sync exercise metadata when customExercises or predefinedExerciseCustomizations change
  // This ensures that if the user edits an exercise's type/muscles while creating a template,
  // the changes are reflected immediately
  useEffect(() => {
    if (exercises.length === 0) return;
    
    setExercises(prevExercises => {
      let hasChanges = false;
      const updatedExercises = prevExercises.map(ex => {
        // Look up current metadata for this exercise
        const customEx = customExercises.find(ce => ce.name.toLowerCase() === ex.name.toLowerCase());
        const muscleMeta = getEffectiveExerciseMuscles(
          ex.name,
          predefinedExerciseCustomizations,
          !!customEx,
          customEx
        );
        
        if (!muscleMeta) return ex;
        
        const newType = muscleMeta.type || muscleMeta.exerciseType || ex.type;
        const newPrimaryMuscle = muscleMeta.primaryMuscle;
        const newSecondaryMuscles = muscleMeta.secondaryMuscles;
        
        // Check if anything changed
        if (
          ex.type === newType &&
          ex.primaryMuscle === newPrimaryMuscle &&
          JSON.stringify(ex.secondaryMuscles) === JSON.stringify(newSecondaryMuscles)
        ) {
          return ex; // No changes
        }
        
        hasChanges = true;
        return {
          ...ex,
          type: newType,
          primaryMuscle: newPrimaryMuscle,
          secondaryMuscles: newSecondaryMuscles,
        };
      });
      
      return hasChanges ? updatedExercises : prevExercises;
    });
  }, [customExercises, predefinedExerciseCustomizations]);

  // Warn before navigation if unsaved changes
  usePreventRemove(hasUnsavedChanges, ({ data }) => {
    Alert.alert(
      'Discard changes?',
      'You have unsaved changes. Are you sure you want to discard them?',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => {} },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            // First disable the prevention, then navigate
            setHasUnsavedChanges(false);
            // Use setTimeout to ensure state updates before navigation
            setTimeout(() => {
              router.back();
            }, 0);
          },
        },
      ]
    );
  });

  const buildTemplateExerciseWithSets = useCallback(async (
    exerciseName: string,
    opts?: { restTimerSeconds?: number; groupType?: 'superset'; groupId?: string; groupPosition?: 0 | 1 }
  ): Promise<TemplateExerciseWithSets> => {
    // Fetch historical data for this exercise
    const historicalData = await getMostRecentExerciseData(exerciseName);

    const customEx = customExercises.find(ex => ex.name.toLowerCase() === exerciseName.toLowerCase());
    const muscleMeta = getEffectiveExerciseMuscles(
      exerciseName,
      predefinedExerciseCustomizations,
      !!customEx,
      customEx
    );
    
    // Get exercise type
    const predefinedEx = PREDEFINED_EXERCISES_WITH_MUSCLES.find(e => e.name.toLowerCase() === exerciseName.toLowerCase());
    const exerciseType = customEx?.type || customEx?.exerciseType || predefinedEx?.exerciseType || 'weighted';
    
    // Get exercise ID: use predefined ID if available, or custom exercise ID, or generate a new custom ID
    const exerciseId = predefinedEx?.id || (customEx as any)?.exerciseId || generateCustomExerciseId();

    // For bodyweight exercises, fetch and store current bodyweight
    let defaultWeight = historicalData?.weight || 0;
    if (exerciseType === 'bodyweight') {
      const { convertWeightBetweenUnits } = await import('@/lib/unit-conversion');
      const bwLog = await BodyWeightStorage.getTodayWeight();
      if (bwLog) {
        defaultWeight = convertWeightBetweenUnits(bwLog.weight, bwLog.unit, settings.weightUnit);
      }
    }

    return {
      id: generateId(),
      exerciseId,
      name: exerciseName,
      sets: [
        {
          setNumber: 1,
          reps: historicalData?.reps || 8,
          weight: defaultWeight,
          unit: settings.weightUnit,
          timestamp: Date.now(),
          completed: false,
          isRepsPlaceholder: true,
          isWeightPlaceholder: true,
        },
      ],
      reps: historicalData?.reps || 8,
      weight: defaultWeight,
      unit: settings.weightUnit,
      type: exerciseType,
      restTimer: opts?.restTimerSeconds ?? settings.defaultRestTime,
      autoProgressionEnabled: true,
      autoProgressionMinReps: settings.defaultAutoProgressionMinReps,
      autoProgressionMaxReps: settings.defaultAutoProgressionMaxReps,
      autoProgressionUseDefaultRange: true,
      primaryMuscle: muscleMeta?.primaryMuscle as any,
      secondaryMuscles: muscleMeta?.secondaryMuscles as any,
      groupType: opts?.groupType,
      groupId: opts?.groupId,
      groupPosition: opts?.groupPosition,
    };
  }, [
    customExercises,
    predefinedExerciseCustomizations,
    getMostRecentExerciseData,
    settings.weightUnit,
    settings.defaultRestTime,
    settings.defaultAutoProgressionMinReps,
    settings.defaultAutoProgressionMaxReps,
  ]);

  const handleAddExerciseToTemplate = useCallback(async (exerciseName: string) => {
    const newExercise = await buildTemplateExerciseWithSets(exerciseName);

    setExercises([...exercises, newExercise]);
    setShowExercisePicker(false);
    setExerciseSearch('');

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [exercises, buildTemplateExerciseWithSets]);

  const handleSubmitSuperset = useCallback(async (result: AddSupersetModalResult) => {
    const a = result.exerciseAName;
    const b = result.exerciseBName;

    if (a.toLowerCase() === b.toLowerCase()) {
      Alert.alert('Invalid superset', 'Please choose two different exercises.');
      return;
    }

    const groupId = generateId();
    const exA = await buildTemplateExerciseWithSets(a, {
      restTimerSeconds: result.restTimeSeconds,
      groupType: 'superset',
      groupId,
      groupPosition: 0,
    });
    const exB = await buildTemplateExerciseWithSets(b, {
      restTimerSeconds: result.restTimeSeconds,
      groupType: 'superset',
      groupId,
      groupPosition: 1,
    });

    setExercises(prev => [...prev, exA, exB]);

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [exercises, buildTemplateExerciseWithSets]);

  const handleAddSet = useCallback(async (exerciseIndex: number) => {
    const base = exercises[exerciseIndex];
    if (!base) return;

    const shouldSyncSuperset = base.groupType === 'superset' && typeof base.groupId === 'string';
    const mateIndex = shouldSyncSuperset
      ? exercises.findIndex((ex, idx) => idx !== exerciseIndex && ex.groupType === 'superset' && ex.groupId === base.groupId)
      : -1;
    const indicesToUpdate = mateIndex >= 0 ? [exerciseIndex, mateIndex] : [exerciseIndex];

    const needsBodyweight = indicesToUpdate.some((idx) => exercises[idx]?.type === 'bodyweight');

    let defaultBodyweight = 0;
    if (needsBodyweight) {
      const { convertWeightBetweenUnits } = await import('@/lib/unit-conversion');
      const bwLog = await BodyWeightStorage.getTodayWeight();
      if (bwLog) {
        defaultBodyweight = convertWeightBetweenUnits(bwLog.weight, bwLog.unit, settings.weightUnit);
      }
    }

    setExercises((prev) =>
      prev.map((ex, idx) => {
        if (!indicesToUpdate.includes(idx)) return ex;

        const lastSet = ex.sets[ex.sets.length - 1];
        const isBodyweight = ex.type === 'bodyweight';
        return {
          ...ex,
          sets: [
            ...ex.sets,
            {
              setNumber: ex.sets.length + 1,
              reps: lastSet?.reps || 0,
              weight: isBodyweight ? defaultBodyweight : (lastSet?.weight || 0),
              unit: lastSet?.unit || settings.weightUnit,
              timestamp: Date.now(),
              completed: false,
              isRepsPlaceholder: false,
              isWeightPlaceholder: false,
            } as CompletedSet,
          ],
        };
      })
    );

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [exercises, settings.weightUnit]);

  const handleUpdateSet = useCallback(
    (exerciseIndex: number, setIndex: number, updates: Partial<CompletedSet>) => {
      // Convert weight from display unit to kg for storage
      const finalUpdates = { ...updates };
      if ('weight' in updates && updates.weight !== undefined && settings.weightUnit === 'lbs') {
        finalUpdates.weight = updates.weight / 2.20462; // Convert lbs to kg
      }
      // Clear placeholder flags when user enters a value
      if ('reps' in updates) {
        finalUpdates.isRepsPlaceholder = false;
      }
      if ('weight' in updates) {
        finalUpdates.isWeightPlaceholder = false;
      }
      setExercises((prev) =>
        prev.map((ex, exIdx) => {
          if (exIdx === exerciseIndex) {
            return {
              ...ex,
              sets: ex.sets.map((set, setIdx) =>
                setIdx === setIndex ? { ...set, ...finalUpdates } : set
              ),
            };
          }
          return ex;
        })
      );
    },
    [settings.weightUnit]
  );

  const handleDeleteSet = useCallback((exerciseIndex: number, setIndex: number) => {
    setExercises((prev) => {
      const base = prev[exerciseIndex];
      if (!base) return prev;

      const shouldSyncSuperset = base.groupType === 'superset' && typeof base.groupId === 'string';
      const mateIndex = shouldSyncSuperset
        ? prev.findIndex((ex, idx) => idx !== exerciseIndex && ex.groupType === 'superset' && ex.groupId === base.groupId)
        : -1;
      const indicesToUpdate = mateIndex >= 0 ? [exerciseIndex, mateIndex] : [exerciseIndex];

      return prev.map((ex, exIdx) => {
        if (!indicesToUpdate.includes(exIdx)) return ex;
        return {
          ...ex,
          sets: ex.sets
            .filter((_, sIdx) => sIdx !== setIndex)
            .map((s, sIdx) => ({ ...s, setNumber: sIdx + 1 })),
        };
      });
    });

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const handleDeleteExercise = useCallback((exerciseId: string) => {
    Alert.alert('Remove Exercise?', 'Are you sure you want to remove this exercise from your routine?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          const base = exercises.find((ex) => ex.id === exerciseId);
          setCollapsedDisplayKeys((prev) => {
            const next = new Set(prev);
            if (base?.groupType === 'superset' && typeof base.groupId === 'string') {
              next.delete(base.groupId);
            } else if (base?.id) {
              next.delete(base.id);
            }
            return next;
          });
          setExercises((prev) => {
            const base = prev.find((ex) => ex.id === exerciseId);
            if (base?.groupType === 'superset' && typeof base.groupId === 'string') {
              return prev.filter((ex) => !(ex.groupType === 'superset' && ex.groupId === base.groupId));
            }
            return prev.filter((ex) => ex.id !== exerciseId);
          });
        },
      },
    ]);
  }, [exercises]);

  const handleReplaceExercise = useCallback((exerciseId: string, newExerciseName: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id === exerciseId) {
          const customEx = customExercises.find(ce => ce.name.toLowerCase() === newExerciseName.toLowerCase());
          const muscleMeta = getEffectiveExerciseMuscles(
            newExerciseName,
            predefinedExerciseCustomizations,
            !!customEx,
            customEx
          );
          return {
            ...ex,
            name: newExerciseName,
            primaryMuscle: muscleMeta?.primaryMuscle,
            secondaryMuscles: muscleMeta?.secondaryMuscles,
            type: muscleMeta?.exerciseType || 'weighted',
          };
        }
        return ex;
      })
    );
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, []);

  const handleUpdateExercise = useCallback(
    (exerciseId: string, updates: Partial<TemplateExerciseWithSets>) => {
      setExercises((prev) =>
        prev.map((ex) => (ex.id === exerciseId ? { ...ex, ...updates } : ex))
      );
    },
    []
  );

  const handleApplyAutoProgressionWeightIncrease = useCallback((exerciseId: string) => {
    const increment = settings.defaultAutoProgressionWeightIncrement ?? 0;
    if (increment <= 0) {
      Alert.alert('Invalid increment', 'Set a default weight increment in Preferences first.');
      return;
    }

    const exercise = exercises.find((ex) => ex.id === exerciseId);
    if (!exercise) return;

    const minReps = exercise.autoProgressionUseDefaultRange === false
      ? (exercise.autoProgressionMinReps ?? settings.defaultAutoProgressionMinReps ?? 8)
      : (exercise.autoProgressionMinReps ?? settings.defaultAutoProgressionMinReps ?? 8);

    Alert.alert(
      'Increase weight?',
      `Increase all sets by ${increment}${settings.weightUnit} and reset reps to ${minReps}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          onPress: () => {
            setExercises((prev) =>
              prev.map((ex) => {
                if (ex.id !== exerciseId) return ex;
                const nextSets = ex.sets.map((set) => ({
                  ...set,
                  reps: minReps,
                  weight: Math.round(((set.weight || 0) + increment) * 100) / 100,
                  isRepsPlaceholder: false,
                  isWeightPlaceholder: false,
                }));
                return {
                  ...ex,
                  sets: nextSets,
                  reps: minReps,
                  weight: nextSets[0]?.weight ?? ex.weight,
                };
              })
            );
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
          },
        },
      ]
    );
  }, [
    settings.defaultAutoProgressionWeightIncrement,
    settings.defaultAutoProgressionMinReps,
    settings.weightUnit,
    exercises,
  ]);

  const handleMoveDisplayItemUp = useCallback((displayIndex: number) => {
    if (displayIndex === 0) return;
    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext({
        duration: 140,
        update: { type: LayoutAnimation.Types.easeInEaseOut },
        create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
        delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      });
    }
    setExercises((prev) => {
      const items = groupExercisesForDisplay(prev);
      return moveDisplayItem(prev, items, displayIndex, displayIndex - 1);
    });
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const handleMoveDisplayItemDown = useCallback((displayIndex: number) => {
    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext({
        duration: 140,
        update: { type: LayoutAnimation.Types.easeInEaseOut },
        create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
        delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      });
    }
    setExercises((prev) => {
      const items = groupExercisesForDisplay(prev);
      if (displayIndex === items.length - 1) return [...prev];
      return moveDisplayItem(prev, items, displayIndex, displayIndex + 1);
    });
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const handleRepsAdjust = useCallback((exerciseIndex: number, setIndex: number, delta: number) => {
    setExercises((prev) =>
      prev.map((ex, exIdx) => {
        if (exIdx === exerciseIndex) {
          return {
            ...ex,
            sets: ex.sets.map((set, setIdx) => {
              if (setIdx === setIndex) {
                const newReps = Math.max(0, (set.reps || 0) + delta);
                return { ...set, reps: newReps };
              }
              return set;
            }),
          };
        }
        return ex;
      })
    );
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const handleToggleSetType = useCallback((exerciseIndex: number, setIndex: number) => {
    setExercises((prev) =>
      prev.map((ex, exIdx) => {
        if (exIdx === exerciseIndex) {
          return {
            ...ex,
            sets: ex.sets.map((set, setIdx) => {
              if (setIdx === setIndex) {
                const currentType = set.setType || 'working';
                const newType = currentType === 'working' ? 'warmup' : 'working';
                return { ...set, setType: newType };
              }
              return set;
            }),
          };
        }
        return ex;
      })
    );
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const handleUpdateSupersetGroup = useCallback((groupId: string, updates: Partial<TemplateExerciseWithSets>) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.groupType === 'superset' && ex.groupId === groupId ? { ...ex, ...updates } : ex
      )
    );
  }, []);

  // Helper: get set count from a TemplateExerciseWithSets
  const getTemplateExerciseSetCount = useCallback((ex: TemplateExerciseWithSets) => ex.sets.length, []);

  // Helper: pad sets to a target count for a TemplateExerciseWithSets
  const padTemplateExerciseSets = useCallback((ex: TemplateExerciseWithSets, targetCount: number): TemplateExerciseWithSets => {
    const currentCount = ex.sets.length;
    if (currentCount >= targetCount) return ex;

    const newSets: CompletedSet[] = [...ex.sets];
    for (let i = currentCount; i < targetCount; i++) {
      newSets.push({
        setNumber: i + 1,
        reps: 0,
        weight: 0,
        unit: settings.weightUnit,
        completed: false,
        timestamp: Date.now(),
        isRepsPlaceholder: true,
        isWeightPlaceholder: true,
      });
    }
    return { ...ex, sets: newSets };
  }, [settings.weightUnit]);

  // Handler: Initiate adding an exercise to a superset
  const handleAddToSuperset = useCallback((exerciseId: string) => {
    setMergeSupersetSourceId(exerciseId);
    setShowMergeSupersetModal(true);
  }, []);

  // Handler: Merge with an existing exercise in the template
  const handleMergeWithExisting = useCallback((targetIndex: number, restTimeSeconds: number) => {
    if (!mergeSupersetSourceId) return;

    const sourceIndex = exercises.findIndex((e) => e.id === mergeSupersetSourceId);
    if (sourceIndex === -1) return;

    const groupId = generateId();

    // Preserve collapse state: if BOTH source and target were collapsed, keep the resulting superset collapsed.
    const sourceId = exercises[sourceIndex]?.id;
    const targetId = exercises[targetIndex]?.id;
    setCollapsedDisplayKeys((prev) => {
      const next = new Set(prev);
      const shouldCollapse = !!sourceId && !!targetId && next.has(sourceId) && next.has(targetId);
      if (sourceId) next.delete(sourceId);
      if (targetId) next.delete(targetId);
      if (shouldCollapse) next.add(groupId);
      return next;
    });

    setExercises((prev) => {
      // Apply rest timer to both exercises before merging
      const updated = prev.map((ex, i) => {
        if (i === sourceIndex || i === targetIndex) {
          return { ...ex, restTimer: restTimeSeconds, timerEnabled: true };
        }
        return ex;
      });

      return mergeExercisesToSuperset(
        updated,
        sourceIndex,
        targetIndex,
        groupId,
        getTemplateExerciseSetCount,
        padTemplateExerciseSets
      );
    });

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [mergeSupersetSourceId, exercises, getTemplateExerciseSetCount, padTemplateExerciseSets]);

  // Handler: Add a new exercise and merge with it
  const handleMergeWithNewExercise = useCallback((exerciseName: string, restTimeSeconds: number) => {
    if (!mergeSupersetSourceId) return;

    const sourceIndex = exercises.findIndex((e) => e.id === mergeSupersetSourceId);
    if (sourceIndex === -1) return;

    const groupId = generateId();

    // New exercise should be expanded by default; ensure the new superset isn't auto-collapsed.
    const sourceId = exercises[sourceIndex]?.id;
    setCollapsedDisplayKeys((prev) => {
      const next = new Set(prev);
      if (sourceId) next.delete(sourceId);
      next.delete(groupId);
      return next;
    });

    // Build the new exercise
    const customEx = customExercises.find(e => e.name.toLowerCase() === exerciseName.toLowerCase());
    const muscleMeta = getEffectiveExerciseMuscles(
      exerciseName,
      predefinedExerciseCustomizations,
      !!customEx,
      customEx
    );

    const newExercise: TemplateExerciseWithSets = {
      id: generateId(),
      name: exerciseName,
      sets: [],
      reps: 10,
      unit: settings.weightUnit,
      type: muscleMeta?.exerciseType || 'weighted',
      primaryMuscle: muscleMeta?.primaryMuscle,
      secondaryMuscles: muscleMeta?.secondaryMuscles,
      restTimer: restTimeSeconds,
      timerEnabled: true,
      groupType: 'superset',
      groupId,
      groupPosition: 1,
    };

    setExercises((prev) => {
      const sourceEx = prev[sourceIndex];
      if (!sourceEx) return prev;

      // Apply superset metadata to source exercise
      const updatedSource: TemplateExerciseWithSets = {
        ...sourceEx,
        groupType: 'superset',
        groupId,
        groupPosition: 0,
        restTimer: restTimeSeconds,
        timerEnabled: true,
      };

      // Pad new exercise to match source set count if needed
      const sourceSetCount = sourceEx.sets.length;
      const paddedNew = padTemplateExerciseSets(newExercise, sourceSetCount);

      // Replace source and insert new exercise adjacent
      const result: TemplateExerciseWithSets[] = [];
      for (let i = 0; i < prev.length; i++) {
        if (i === sourceIndex) {
          result.push(updatedSource, paddedNew);
        } else {
          result.push(prev[i]);
        }
      }
      return result;
    });

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [mergeSupersetSourceId, exercises, customExercises, predefinedExerciseCustomizations, settings.weightUnit, padTemplateExerciseSets]);

  // Handler: Split a superset into individual exercises
  const handleSplitSuperset = useCallback((exerciseId: string) => {
    const ex = exercises.find((e) => e.id === exerciseId);
    if (!ex || !ex.groupId) return;

    const groupId = ex.groupId;
    const memberIds = exercises
      .filter((e) => e.groupType === 'superset' && e.groupId === groupId)
      .map((e) => e.id);

    Alert.alert(
      'Split Superset?',
      'This will separate the exercises into individual cards, preserving all set data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Split',
          onPress: () => {
            setCollapsedDisplayKeys((prev) => {
              const next = new Set(prev);
              const wasCollapsed = next.has(groupId);
              next.delete(groupId);
              if (wasCollapsed) {
                memberIds.forEach((id) => next.add(id));
              }
              return next;
            });
            setExercises((prev) => splitSupersetToExercises(prev, ex.groupId!));
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          },
        },
      ]
    );
  }, [exercises]);

  // Create Exercise inline (no navigation away)
  const handleCreateExercise = useCallback(async (exerciseData: { name: string; primaryMuscle: MuscleGroup; secondaryMuscles: MuscleGroup[]; type: ExerciseType; muscleContributions: Record<MuscleGroup, number> }) => {
    const allNames = [...PREDEFINED_EXERCISES, ...customExercises.map(e => e.name)];
    if (allNames.some(n => n.toLowerCase() === exerciseData.name.toLowerCase())) {
      throw new Error('An exercise with this name already exists');
    }
    
    // Generate a unique ID for the custom exercise
    const customExerciseId = generateCustomExerciseId();
    
    const newExercise: ExerciseMetadata = {
      id: customExerciseId,
      name: exerciseData.name,
      primaryMuscle: exerciseData.primaryMuscle,
      secondaryMuscles: exerciseData.secondaryMuscles,
      exerciseType: exerciseData.type,
      type: exerciseData.type, // Alias for convenience
      muscleContributions: exerciseData.muscleContributions,
    };
    await addCustomExercise(newExercise);
    
    // Add to template immediately
    // For bodyweight exercises, load user's current bodyweight
    const isBodyweight = exerciseData.type === 'bodyweight';
    let defaultWeight = 0;
    if (isBodyweight) {
      const { convertWeightBetweenUnits } = await import('@/lib/unit-conversion');
      const bwLog = await BodyWeightStorage.getTodayWeight();
      if (bwLog) {
        defaultWeight = convertWeightBetweenUnits(bwLog.weight, bwLog.unit, settings.weightUnit);
      }
    }
    
    const exerciseToAdd: TemplateExerciseWithSets = {
      id: generateId(),
      exerciseId: customExerciseId,
      name: exerciseData.name,
      sets: [{ setNumber: 1, reps: 0, weight: defaultWeight, unit: settings.weightUnit, timestamp: Date.now(), completed: false }],
      reps: 0,
      unit: settings.weightUnit,
      type: exerciseData.type,
      autoProgressionEnabled: true,
      autoProgressionMinReps: settings.defaultAutoProgressionMinReps,
      autoProgressionMaxReps: settings.defaultAutoProgressionMaxReps,
      autoProgressionUseDefaultRange: true,
      primaryMuscle: exerciseData.primaryMuscle,
      secondaryMuscles: exerciseData.secondaryMuscles,
    };
    setExercises(prev => [...prev, exerciseToAdd]);
  }, [
    customExercises,
    addCustomExercise,
    settings.weightUnit,
    settings.defaultAutoProgressionMinReps,
    settings.defaultAutoProgressionMaxReps,
  ]);



  const handleSaveTemplate = useCallback(async () => {
    if (!templateName.trim()) {
      Alert.alert('Error', 'Please enter a routine name');
      return;
    }

    const duplicateName = templates.some(
      (t) => t.name.toLowerCase() === templateName.toLowerCase() && t.id !== templateId
    );
    if (duplicateName) {
      Alert.alert('Error', 'A routine with this name already exists');
      return;
    }

    if (exercises.length === 0) {
      Alert.alert('Error', 'Please add at least one exercise');
      return;
    }

    try {
      setIsLoading(true);

      // Validate: all exercises must have at least one set
      const exercisesWithoutSets = exercises.filter(ex => !ex.sets || ex.sets.length === 0);
      if (exercisesWithoutSets.length > 0) {
        Alert.alert(
          'Cannot Save Routine',
          `The following exercises have no sets: ${exercisesWithoutSets.map(ex => ex.name).join(', ')}. Please add at least one set to each exercise.`
        );
        setIsLoading(false);
        return;
      }

      const cleanExercises: Exercise[] = exercises.map((ex) => {
        // Convert CompletedSet[] to TemplateSetConfig[]
        const setDetails = ex.sets.map(set => ({
          reps: set.reps,
          weight: set.weight,
          unit: set.unit,
          setType: set.setType,
        }));

        console.log(`[Template Save] Exercise "${ex.name}":`);
        console.log(`  - Original sets array:`, ex.sets);
        console.log(`  - Converted setDetails:`, setDetails);

        // Get exercise type from custom exercises or predefined exercises
        const customEx = customExercises.find(e => e.name === ex.name);
        const predefinedEx = PREDEFINED_EXERCISES_WITH_MUSCLES.find(e => e.name === ex.name);
        const exerciseType = customEx?.type || customEx?.exerciseType || predefinedEx?.exerciseType || 'weighted';
        // Get exercise ID: prefer existing exerciseId, then predefined ID, then custom exercise ID
        const exerciseId = ex.exerciseId || predefinedEx?.id || (customEx as any)?.exerciseId || generateCustomExerciseId();

        const cleanEx = {
          id: ex.id,
          exerciseId,
          name: ex.name,
          sets: ex.sets.length, // Total count
          reps: ex.sets[0]?.reps || 10, // First set's reps as default
          weight: ex.sets[0]?.weight, // First set's weight as default
          unit: ex.unit,
          type: exerciseType,
          notes: ex.notes,
          restTimer: ex.restTimer,
          timerEnabled: ex.timerEnabled,
          autoProgressionEnabled: ex.autoProgressionEnabled,
          autoProgressionMinReps: ex.autoProgressionMinReps,
          autoProgressionMaxReps: ex.autoProgressionMaxReps,
          autoProgressionUseDefaultRange: ex.autoProgressionUseDefaultRange,
          groupType: ex.groupType,
          groupId: ex.groupId,
          groupPosition: ex.groupPosition,
          primaryMuscle: ex.primaryMuscle as MuscleGroup | undefined,
          secondaryMuscles: ex.secondaryMuscles as MuscleGroup[] | undefined,
          setDetails, // Store individual set configurations
        };

        console.log(`  - Final Exercise object:`, cleanEx);
        return cleanEx;
      });

      console.log('[Template Save] All clean exercises:', cleanExercises);
      console.log('[Template Save] First exercise setDetails:', cleanExercises[0]?.setDetails);
      console.log('[Template Save] JSON stringified:', JSON.stringify(cleanExercises[0]));

      if (templateId && typeof templateId === 'string') {
        const template = templates.find((t) => t.id === templateId);
        if (template) {
          const updatedTemplate = {
            ...template,
            name: templateName,
            exercises: cleanExercises,
            updatedAt: Date.now(),
          };
          console.log('[Template Save] Updating template:', updatedTemplate);
          await updateTemplate(updatedTemplate);
        }
      } else {
        const newTemplate = {
          id: generateId(),
          name: templateName,
          exercises: cleanExercises,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        console.log('[Template Save] Creating new template:', newTemplate);
        await addTemplate(newTemplate);
      }

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Alert.alert('Success', 'Routine saved successfully');
      setHasUnsavedChanges(false);
      router.back();
    } catch (error) {
      Alert.alert('Error', 'Failed to save routine');
    } finally {
      setIsLoading(false);
    }
  }, [templateName, exercises, templateId, templates, addTemplate, updateTemplate, router]);

  const handleSaveAsNewTemplate = useCallback(async () => {
    if (exercises.length === 0) {
      Alert.alert('Error', 'Please add at least one exercise');
      return;
    }

    // Show modal to prompt for new template name
    setNewTemplateName(`Copy of ${templateName}`);
    setShowSaveAsNewModal(true);
  }, [exercises, templateName]);

  const handleConfirmSaveAsNew = useCallback(async () => {
    const newName = newTemplateName.trim();
    
    if (!newName) {
      Alert.alert('Error', 'Please enter a routine name');
      return;
    }

    try {
      setIsLoading(true);
      setShowSaveAsNewModal(false);

      // Validate: all exercises must have at least one set
      const exercisesWithoutSets = exercises.filter(ex => !ex.sets || ex.sets.length === 0);
      if (exercisesWithoutSets.length > 0) {
        Alert.alert(
          'Cannot Save Routine',
          `The following exercises have no sets: ${exercisesWithoutSets.map(ex => ex.name).join(', ')}. Please add at least one set to each exercise.`
        );
        setIsLoading(false);
        return;
      }

      // Prepare exercises with setDetails preserved (same logic as handleSaveTemplate)
      const cleanExercises: Exercise[] = exercises.map((ex) => {
        // Convert CompletedSet[] to TemplateSetConfig[]
        const setDetails = ex.sets.map(set => ({
          reps: set.reps,
          weight: set.weight,
          unit: set.unit,
          setType: set.setType,
        }));

        // Get exercise type from custom exercises or predefined exercises
        const customEx = customExercises.find(e => e.name === ex.name);
        const predefinedEx = PREDEFINED_EXERCISES_WITH_MUSCLES.find(e => e.name === ex.name);
        const exerciseType = customEx?.type || customEx?.exerciseType || predefinedEx?.exerciseType || 'weighted';
        // Get exercise ID: prefer existing exerciseId, then predefined ID, then custom exercise ID
        const exerciseId = ex.exerciseId || predefinedEx?.id || (customEx as any)?.exerciseId || generateCustomExerciseId();

        return {
          id: ex.id,
          exerciseId,
          name: ex.name,
          sets: ex.sets.length, // Total count
          reps: ex.sets[0]?.reps || 10, // First set's reps as default
          weight: ex.sets[0]?.weight, // First set's weight as default
          unit: ex.unit,
          type: exerciseType,
          notes: ex.notes,
          restTimer: ex.restTimer,
          timerEnabled: ex.timerEnabled,
          autoProgressionEnabled: ex.autoProgressionEnabled,
          autoProgressionMinReps: ex.autoProgressionMinReps,
          autoProgressionMaxReps: ex.autoProgressionMaxReps,
          autoProgressionUseDefaultRange: ex.autoProgressionUseDefaultRange,
          groupType: ex.groupType,
          groupId: ex.groupId,
          groupPosition: ex.groupPosition,
          primaryMuscle: ex.primaryMuscle as MuscleGroup | undefined,
          secondaryMuscles: ex.secondaryMuscles as MuscleGroup[] | undefined,
          setDetails, // Store individual set configurations
        };
      });

      // Always create a new template with new ID
      const newTemplate = {
        id: generateId(),
        name: newName,
        exercises: cleanExercises,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      console.log('[Template Save] Creating new template from existing:', newTemplate);
      await addTemplate(newTemplate);

      Alert.alert('Success', 'New routine saved successfully');
      setHasUnsavedChanges(false);
      router.back();
    } catch (error) {
      Alert.alert('Error', 'Failed to save new routine');
    } finally {
      setIsLoading(false);
    }
  }, [newTemplateName, exercises, customExercises, addTemplate, router]);

  // Old Alert.prompt version - replaced with modal
  const handleSaveAsNewTemplate_OLD = useCallback(async () => {
    if (exercises.length === 0) {
      Alert.alert('Error', 'Please add at least one exercise');
      return;
    }

    // This doesn't work on Android/web
    Alert.prompt(
      'Save as New Routine',
      'Enter a name for the new routine:',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Save',
          onPress: async (newName?: string) => {
            if (!newName || !newName.trim()) {
              Alert.alert('Error', 'Please enter a routine name');
              return;
            }

            try {
              setIsLoading(true);

              // Validate: all exercises must have at least one set
              const exercisesWithoutSets = exercises.filter(ex => !ex.sets || ex.sets.length === 0);
              if (exercisesWithoutSets.length > 0) {
                Alert.alert(
                  'Cannot Save Routine',
                  `The following exercises have no sets: ${exercisesWithoutSets.map(ex => ex.name).join(', ')}. Please add at least one set to each exercise.`
                );
                setIsLoading(false);
                return;
              }

              // Prepare exercises with setDetails preserved (same logic as handleSaveTemplate)
              const cleanExercises: Exercise[] = exercises.map((ex) => {
                // Convert CompletedSet[] to TemplateSetConfig[]
                const setDetails = ex.sets.map(set => ({
                  reps: set.reps,
                  weight: set.weight,
                  unit: set.unit,
                  setType: set.setType,
                }));

                // Get exercise type from custom exercises or predefined exercises
                const customEx = customExercises.find(e => e.name === ex.name);
                const predefinedEx = PREDEFINED_EXERCISES_WITH_MUSCLES.find(e => e.name === ex.name);
                const exerciseType = customEx?.type || customEx?.exerciseType || predefinedEx?.exerciseType || 'weighted';
                // Get exercise ID: prefer existing exerciseId, then predefined ID, then custom exercise ID
                const exerciseId = ex.exerciseId || predefinedEx?.id || (customEx as any)?.exerciseId || generateCustomExerciseId();

                return {
                  id: ex.id,
                  exerciseId,
                  name: ex.name,
                  sets: ex.sets.length, // Total count
                  reps: ex.sets[0]?.reps || 10, // First set's reps as default
                  weight: ex.sets[0]?.weight, // First set's weight as default
                  unit: ex.unit,
                  type: exerciseType,
                  notes: ex.notes,
                  restTimer: ex.restTimer,
                  timerEnabled: ex.timerEnabled,
                  autoProgressionEnabled: ex.autoProgressionEnabled,
                  autoProgressionMinReps: ex.autoProgressionMinReps,
                  autoProgressionMaxReps: ex.autoProgressionMaxReps,
                  autoProgressionUseDefaultRange: ex.autoProgressionUseDefaultRange,
                  groupType: ex.groupType,
                  groupId: ex.groupId,
                  groupPosition: ex.groupPosition,
                  primaryMuscle: ex.primaryMuscle as MuscleGroup | undefined,
                  secondaryMuscles: ex.secondaryMuscles as MuscleGroup[] | undefined,
                  setDetails, // Store individual set configurations
                };
              });

              // Always create a new template with new ID
              const newTemplate = {
                id: generateId(),
                name: newName.trim(),
                exercises: cleanExercises,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              };
              console.log('[Template Save] Creating new template from existing:', newTemplate);
              await addTemplate(newTemplate);

              Alert.alert('Success', 'New routine saved successfully');
              setHasUnsavedChanges(false);
              router.back();
            } catch (error) {
              Alert.alert('Error', 'Failed to save new routine');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
      'plain-text',
      `Copy of ${templateName}` // Pre-fill with "Copy of [original name]"
    );
  }, [templateName, exercises, customExercises, addTemplate, router]);

  const renderSetRow = useCallback((exerciseIndex: number, set: CompletedSet, setIndex: number, exerciseType?: string) => {
    const unit = settings.weightUnit;
    const isBodyweight = exerciseType === 'bodyweight';
    const isWeightedBodyweight = exerciseType === 'weighted-bodyweight';
    const showWeightInput = !isBodyweight; // Show for weighted, assisted-bodyweight, and weighted-bodyweight
    const isWarmup = set.setType === 'warmup';
    return (
      <View key={setIndex} style={[styles.setRow, { borderBottomColor: colors.border, opacity: isWarmup ? 0.7 : 1 }]}>
        {/* Set number - tap to open menu */}
        <Pressable
          onPress={(event) => {
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            const { pageX, pageY } = event.nativeEvent;
            setSetMenuPosition({ x: pageX, y: pageY });
            setShowSetMenu({ exerciseIndex, setIndex });
          }}
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flexDirection: 'row', alignItems: 'center', gap: 4 }]}
        >
          <Text style={[styles.setNumber, { color: isWarmup ? '#F59E0B' : colors.foreground }]}>
            {isWarmup ? 'W' : setIndex + 1}
          </Text>
        </Pressable>

        {/* Weight input (hidden only for pure bodyweight exercises, shown for assisted) */}
        {showWeightInput && (
          <>
            <TextInput
              value={set.isWeightPlaceholder ? '' : String(Math.round(convertWeight(set.weight || 0, settings.weightUnit)))}
              placeholder={String(Math.round(convertWeight(set.weight || 0, settings.weightUnit)))}
              placeholderTextColor={colors.muted}
              onChangeText={(val) => {
                const displayValue = parseFloat(val) || 0;
                handleUpdateSet(exerciseIndex, setIndex, { weight: displayValue });
              }}
              keyboardType="decimal-pad"
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
            />
            <Text style={[styles.unitLabel, { color: colors.muted }]}>{settings.weightUnit}</Text>
          </>
        )}

        {/* Reps section with +/- buttons */}
        <Pressable
          onPress={() => handleRepsAdjust(exerciseIndex, setIndex, -1)}
          style={({ pressed }) => [styles.adjustBtn, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[styles.adjustText, { color: colors.primary }]}>−</Text>
        </Pressable>

        <TextInput
          value={set.isRepsPlaceholder ? '' : (set.reps?.toString() || '0')}
          placeholder={set.reps?.toString() || '0'}
          placeholderTextColor={colors.muted}
          onChangeText={(val) => handleUpdateSet(exerciseIndex, setIndex, { reps: parseInt(val, 10) || 0 })}
          keyboardType="numeric"
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
        />

        <Pressable
          onPress={() => handleRepsAdjust(exerciseIndex, setIndex, 1)}
          style={({ pressed }) => [styles.adjustBtn, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[styles.adjustText, { color: colors.primary }]}>+</Text>
        </Pressable>

        <Text style={[styles.unitLabel, { color: colors.muted }]}>Reps</Text>
      </View>
    );
  }, [colors, settings.weightUnit, handleUpdateSet, handleDeleteSet, handleRepsAdjust, setShowSetMenu, setSetMenuPosition]);

  const renderMiniSetRow = useCallback((
    exerciseIndex: number,
    set: CompletedSet,
    setIndex: number,
    exerciseType: string,
    label: string,
    labelColor: string
  ) => {
    const isBodyweight = exerciseType === 'bodyweight';
    const showWeightInput = !isBodyweight;

    return (
      <View style={[styles.setRow, { borderBottomColor: colors.border, paddingLeft: 0 }]} key={`${label}-${setIndex}`}>
        <Text style={{ width: 18, color: labelColor, fontWeight: '800' }}>{label}</Text>

        {showWeightInput && (
          <>
            <TextInput
              value={set.isWeightPlaceholder ? '' : String(Math.round(convertWeight(set.weight || 0, settings.weightUnit)))}
              placeholder={String(Math.round(convertWeight(set.weight || 0, settings.weightUnit)))}
              placeholderTextColor={colors.muted}
              onChangeText={(val) => {
                const displayValue = parseFloat(val) || 0;
                handleUpdateSet(exerciseIndex, setIndex, { weight: displayValue });
              }}
              keyboardType="decimal-pad"
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
            />
            <Text style={[styles.unitLabel, { color: colors.muted }]}>{settings.weightUnit}</Text>
          </>
        )}

        <Pressable
          onPress={() => handleRepsAdjust(exerciseIndex, setIndex, -1)}
          style={({ pressed }) => [styles.adjustBtn, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[styles.adjustText, { color: colors.primary }]}>−</Text>
        </Pressable>

        <TextInput
          value={set.isRepsPlaceholder ? '' : (set.reps?.toString() || '0')}
          placeholder={set.reps?.toString() || '0'}
          placeholderTextColor={colors.muted}
          onChangeText={(val) => handleUpdateSet(exerciseIndex, setIndex, { reps: parseInt(val, 10) || 0 })}
          keyboardType="numeric"
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
        />

        <Pressable
          onPress={() => handleRepsAdjust(exerciseIndex, setIndex, 1)}
          style={({ pressed }) => [styles.adjustBtn, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[styles.adjustText, { color: colors.primary }]}>+</Text>
        </Pressable>

        <Text style={[styles.unitLabel, { color: colors.muted }]}>Reps</Text>
      </View>
    );
  }, [colors, settings.weightUnit, handleUpdateSet, handleRepsAdjust]);

  const renderExerciseItem = useCallback(
    ({ item, index }: { item: ExerciseDisplayItem; index: number }) => {
      const displayIndex = index;
      const reorderLayout = Platform.OS === 'web' ? undefined : LinearTransition.duration(120);
      const isCollapsed = collapsedDisplayKeys.has(item.key);

      if (item.kind === 'single') {
        const exerciseIndex = item.indices[0];
        const ex = exercises[exerciseIndex];
        if (!ex) return null;

        return (
          <Animated.View style={styles.exerciseContainer} layout={reorderLayout}>
            <Card>
              <CardHeader>
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2 flex-1">
                    <View style={{ flexDirection: 'column', marginRight: 4, marginLeft: -4 }}>
                      <Pressable
                        onPress={() => handleMoveDisplayItemUp(displayIndex)}
                        disabled={displayIndex === 0}
                        style={({ pressed }) => ({
                          padding: 4,
                          opacity: displayIndex === 0 ? 0.3 : pressed ? 0.6 : 1,
                        })}
                      >
                        <IconSymbol size={16} name="chevron.up" color={displayIndex === 0 ? colors.muted : colors.foreground} />
                      </Pressable>
                      <Pressable
                        onPress={() => handleMoveDisplayItemDown(displayIndex)}
                        disabled={displayIndex === displayItems.length - 1}
                        style={({ pressed }) => ({
                          padding: 4,
                          opacity: displayIndex === displayItems.length - 1 ? 0.3 : pressed ? 0.6 : 1,
                        })}
                      >
                        <IconSymbol size={16} name="chevron.down" color={displayIndex === displayItems.length - 1 ? colors.muted : colors.foreground} />
                      </Pressable>
                    </View>

                    <View className="flex-1">
                      <View className="flex-row items-center">
                        <Pressable
                          onPress={() => openExerciseQuickActions(ex.id)}
                          hitSlop={8}
                          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flex: 1, minWidth: 0 }]}
                        >
                          <Text
                            className="text-lg font-bold text-foreground"
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {ex.name}
                          </Text>
                        </Pressable>
                        <View style={{ width: 124, marginLeft: 8 }} className="flex-row items-center justify-end">
                          <View style={{ width: 50, alignItems: 'flex-end', marginRight: 6 }}>
                            {getIncreaseWeightSuggestion(ex.sets, {
                              enabled: settings.autoProgressionEnabled && ex.autoProgressionEnabled !== false,
                              minReps:
                                ex.autoProgressionUseDefaultRange === false
                                  ? ex.autoProgressionMinReps
                                  : (ex.autoProgressionMinReps ?? settings.defaultAutoProgressionMinReps),
                              maxReps:
                                ex.autoProgressionUseDefaultRange === false
                                  ? ex.autoProgressionMaxReps
                                  : (ex.autoProgressionMaxReps ?? settings.defaultAutoProgressionMaxReps),
                            }) ? (
                              <Pressable
                                onPress={() => handleApplyAutoProgressionWeightIncrease(ex.id)}
                                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                              >
                                <View className="bg-orange-500 px-2 py-1 rounded-full">
                                  <Text className="text-[10px] font-semibold text-background">↑ wt</Text>
                                </View>
                              </Pressable>
                            ) : null}
                          </View>
                          <Text className="text-sm text-muted">
                            {(() => {
                              const totalVolume = calculateTemplateExerciseVolume(
                                ex.sets,
                                ex.type || 'weighted',
                                currentBodyweight
                              );
                              return `${Math.round(convertWeight(totalVolume, settings.weightUnit))} ${settings.weightUnit}`;
                            })()}
                          </Text>
                        </View>
                      </View>
                      <View className="flex-row items-center gap-2 flex-wrap">
                        {(() => {
                          const prData = getExercisePRData(ex.name, currentBodyweight, ex.type);
                          const isBodyweight = ex.type === 'bodyweight';
                          const hasPR = !isBodyweight && prData.prWeight > 0;

                          return (
                            <>
                              <Text className="text-xs text-muted">
                                PR: {hasPR ? `${Math.round(convertWeight(prData.prWeight, settings.weightUnit))} ${settings.weightUnit}` : '--'}
                              </Text>
                              {!isBodyweight && (
                                <>
                                  <Text className="text-xs text-muted">•</Text>
                                  <Text className="text-xs text-muted">
                                    1RM: {prData.estimated1RM > 0 ? `${Math.round(convertWeight(prData.estimated1RM, settings.weightUnit))} ${settings.weightUnit}` : '--'}
                                  </Text>
                                </>
                              )}
                              <Text className="text-xs text-muted">•</Text>
                              <Text className="text-xs text-muted">
                                Best: {prData.bestSetWeight > 0 || prData.bestSetReps > 0 ? (
                                  isBodyweight
                                    ? `${prData.bestSetReps} reps`
                                    : `${Math.round(convertWeight(prData.bestSetWeight, settings.weightUnit))} ${settings.weightUnit} × ${prData.bestSetReps}`
                                ) : '--'}
                              </Text>
                              {ex.type === 'doubled' && (
                                <>
                                  <Text className="text-xs text-muted">•</Text>
                                  <Text className="text-xs text-muted">Enter for one side only</Text>
                                </>
                              )}
                            </>
                          );
                        })()}
                      </View>
                    </View>
                  </View>

                  <Pressable
                    onPress={() => toggleCollapsedDisplayKey(item.key)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={isCollapsed ? 'Expand exercise card' : 'Collapse exercise card'}
                    style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.6 : 1 })}
                  >
                    <IconSymbol
                      size={18}
                      name={isCollapsed ? 'chevron.right' : 'chevron.down'}
                      color={colors.muted}
                    />
                  </Pressable>
                </View>
              </CardHeader>

              {!isCollapsed && (
                <CardContent className="gap-3">
                  {ex.sets.length > 0 ? (
                    <View className="gap-1">
                      {ex.sets.map((set, setIndex) => {
                        const exerciseType = ex.type || 'weighted';
                        return renderSetRow(exerciseIndex, set, setIndex, exerciseType);
                      })}
                    </View>
                  ) : (
                    <Text className="text-xs text-muted text-center py-2">No sets added yet</Text>
                  )}

                  <Button variant="secondary" size="sm" onPress={() => handleAddSet(exerciseIndex)} className="w-full">
                    <IconSymbol size={16} name="plus" color={colors.foreground} />
                    <Text className="text-sm font-semibold text-foreground">Add Set</Text>
                  </Button>
                </CardContent>
              )}
            </Card>
          </Animated.View>
        );
      }

      const [aIndex, bIndex] = item.indices;
      const exA = exercises[aIndex];
      const exB = exercises[bIndex];
      if (!exA || !exB) return null;

      const maxSetCount = Math.max(exA.sets.length, exB.sets.length);
      const supersetVolume =
        calculateTemplateExerciseVolume(exA.sets, exA.type || 'weighted', currentBodyweight) +
        calculateTemplateExerciseVolume(exB.sets, exB.type || 'weighted', currentBodyweight);

      return (
        <Animated.View style={styles.exerciseContainer} layout={reorderLayout}>
          <Card>
            <CardHeader>
              <View className="flex-row items-start justify-between">
                <View className="flex-row items-start gap-2 flex-1">
                  <View style={{ flexDirection: 'column', marginRight: 4, marginLeft: -4 }}>
                    <Pressable
                      onPress={() => handleMoveDisplayItemUp(displayIndex)}
                      disabled={displayIndex === 0}
                      style={({ pressed }) => ({
                        padding: 4,
                        opacity: displayIndex === 0 ? 0.3 : pressed ? 0.6 : 1,
                      })}
                    >
                      <IconSymbol size={16} name="chevron.up" color={displayIndex === 0 ? colors.muted : colors.foreground} />
                    </Pressable>
                    <Pressable
                      onPress={() => handleMoveDisplayItemDown(displayIndex)}
                      disabled={displayIndex === displayItems.length - 1}
                      style={({ pressed }) => ({
                        padding: 4,
                        opacity: displayIndex === displayItems.length - 1 ? 0.3 : pressed ? 0.6 : 1,
                      })}
                    >
                      <IconSymbol size={16} name="chevron.down" color={displayIndex === displayItems.length - 1 ? colors.muted : colors.foreground} />
                    </Pressable>
                  </View>

                  <View className="flex-1">
                    <View className="flex-row items-center">
                      <Text style={{ color: '#3B82F6', fontWeight: '800' }}>A</Text>
                      <Pressable
                        onPress={() => openExerciseQuickActions(exA.id)}
                        hitSlop={8}
                        style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flex: 1, minWidth: 0, marginLeft: 4 }]}
                      >
                        <Text
                          className="text-lg font-bold text-foreground"
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {exA.name}
                        </Text>
                      </Pressable>
                      <View style={{ width: 124, marginLeft: 8 }} className="flex-row items-center justify-end">
                        <View style={{ width: 50, alignItems: 'flex-end', marginRight: 6 }}>
                          {getIncreaseWeightSuggestion(exA.sets, {
                            enabled: settings.autoProgressionEnabled && exA.autoProgressionEnabled !== false,
                            minReps:
                              exA.autoProgressionUseDefaultRange === false
                                ? exA.autoProgressionMinReps
                                : (exA.autoProgressionMinReps ?? settings.defaultAutoProgressionMinReps),
                            maxReps:
                              exA.autoProgressionUseDefaultRange === false
                                ? exA.autoProgressionMaxReps
                                : (exA.autoProgressionMaxReps ?? settings.defaultAutoProgressionMaxReps),
                          }) ? (
                            <Pressable
                              onPress={() => handleApplyAutoProgressionWeightIncrease(exA.id)}
                              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                            >
                              <View className="bg-orange-500 px-2 py-1 rounded-full">
                                <Text className="text-[10px] font-semibold text-background">↑ wt</Text>
                              </View>
                            </Pressable>
                          ) : null}
                        </View>
                        <Text className="text-sm text-muted">
                          {(() => {
                            const totalVolume = calculateTemplateExerciseVolume(
                              exA.sets,
                              exA.type || 'weighted',
                              currentBodyweight
                            );
                            return `${Math.round(convertWeight(totalVolume, settings.weightUnit))} ${settings.weightUnit}`;
                          })()}
                        </Text>
                      </View>
                    </View>
                    <Text
                      className="text-xs text-muted"
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      style={{ marginLeft: 18, marginTop: -1 }}
                    >
                      {(() => {
                        const prData = getExercisePRData(exA.name, currentBodyweight, exA.type);
                        const isBodyweight = exA.type === 'bodyweight';
                        const hasPR = !isBodyweight && prData.prWeight > 0;

                        const prText = `PR: ${hasPR ? `${Math.round(convertWeight(prData.prWeight, settings.weightUnit))} ${settings.weightUnit}` : '--'}`;
                        const oneRmText = !isBodyweight
                          ? `1RM: ${prData.estimated1RM > 0 ? `${Math.round(convertWeight(prData.estimated1RM, settings.weightUnit))} ${settings.weightUnit}` : '--'}`
                          : null;
                        const bestText = `Best: ${prData.bestSetWeight > 0 || prData.bestSetReps > 0
                          ? (
                            isBodyweight
                              ? `${prData.bestSetReps} reps`
                              : `${Math.round(convertWeight(prData.bestSetWeight, settings.weightUnit))} ${settings.weightUnit} × ${prData.bestSetReps}`
                          )
                          : '--'
                        }`;
                        const doubledNote = exA.type === 'doubled' ? 'One side only' : null;

                        return [prText, oneRmText, bestText, doubledNote].filter(Boolean).join(' • ');
                      })()}
                    </Text>

                    <View className="flex-row items-center" style={{ marginTop: 1 }}>
                      <Text style={{ color: '#F59E0B', fontWeight: '800' }}>B</Text>
                      <Pressable
                        onPress={() => openExerciseQuickActions(exB.id)}
                        hitSlop={8}
                        style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flex: 1, minWidth: 0, marginLeft: 4 }]}
                      >
                        <Text
                          className="text-lg font-bold text-foreground"
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {exB.name}
                        </Text>
                      </Pressable>
                      <View style={{ width: 124, marginLeft: 8 }} className="flex-row items-center justify-end">
                        <View style={{ width: 50, alignItems: 'flex-end', marginRight: 6 }}>
                          {getIncreaseWeightSuggestion(exB.sets, {
                            enabled: settings.autoProgressionEnabled && exB.autoProgressionEnabled !== false,
                            minReps:
                              exB.autoProgressionUseDefaultRange === false
                                ? exB.autoProgressionMinReps
                                : (exB.autoProgressionMinReps ?? settings.defaultAutoProgressionMinReps),
                            maxReps:
                              exB.autoProgressionUseDefaultRange === false
                                ? exB.autoProgressionMaxReps
                                : (exB.autoProgressionMaxReps ?? settings.defaultAutoProgressionMaxReps),
                          }) ? (
                            <Pressable
                              onPress={() => handleApplyAutoProgressionWeightIncrease(exB.id)}
                              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                            >
                              <View className="bg-orange-500 px-2 py-1 rounded-full">
                                <Text className="text-[10px] font-semibold text-background">↑ wt</Text>
                              </View>
                            </Pressable>
                          ) : null}
                        </View>
                        <Text className="text-sm text-muted">
                          {(() => {
                            const totalVolume = calculateTemplateExerciseVolume(
                              exB.sets,
                              exB.type || 'weighted',
                              currentBodyweight
                            );
                            return `${Math.round(convertWeight(totalVolume, settings.weightUnit))} ${settings.weightUnit}`;
                          })()}
                        </Text>
                      </View>
                    </View>
                    <Text
                      className="text-xs text-muted"
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      style={{ marginLeft: 18, marginTop: -1 }}
                    >
                      {(() => {
                        const prData = getExercisePRData(exB.name, currentBodyweight, exB.type);
                        const isBodyweight = exB.type === 'bodyweight';
                        const hasPR = !isBodyweight && prData.prWeight > 0;

                        const prText = `PR: ${hasPR ? `${Math.round(convertWeight(prData.prWeight, settings.weightUnit))} ${settings.weightUnit}` : '--'}`;
                        const oneRmText = !isBodyweight
                          ? `1RM: ${prData.estimated1RM > 0 ? `${Math.round(convertWeight(prData.estimated1RM, settings.weightUnit))} ${settings.weightUnit}` : '--'}`
                          : null;
                        const bestText = `Best: ${prData.bestSetWeight > 0 || prData.bestSetReps > 0
                          ? (
                            isBodyweight
                              ? `${prData.bestSetReps} reps`
                              : `${Math.round(convertWeight(prData.bestSetWeight, settings.weightUnit))} ${settings.weightUnit} × ${prData.bestSetReps}`
                          )
                          : '--'
                        }`;
                        const doubledNote = exB.type === 'doubled' ? 'One side only' : null;

                        return [prText, oneRmText, bestText, doubledNote].filter(Boolean).join(' • ');
                      })()}
                    </Text>
                  </View>
                </View>

                <Pressable
                  onPress={() => toggleCollapsedDisplayKey(item.key)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={isCollapsed ? 'Expand superset card' : 'Collapse superset card'}
                  style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.6 : 1 })}
                >
                  <IconSymbol
                    size={18}
                    name={isCollapsed ? 'chevron.right' : 'chevron.down'}
                    color={colors.muted}
                  />
                </Pressable>
              </View>
            </CardHeader>

            {!isCollapsed && (
              <CardContent className="gap-3">
                {maxSetCount > 0 ? (
                  <View className="gap-2">
                    {Array.from({ length: maxSetCount }).map((_, setIndex) => {
                      const setA = exA.sets[setIndex];
                      const setB = exB.sets[setIndex];

                      if (!setA || !setB) {
                        return (
                          <View key={setIndex} style={{ paddingVertical: 8 }}>
                            <Text style={{ color: '#EF4444', fontSize: 12 }}>
                              Superset sets are out of sync. Add/remove a set to re-sync.
                            </Text>
                          </View>
                        );
                      }

                      return (
                        <View key={setIndex} style={{ gap: 6 }}>
                          <Pressable
                            onPress={(event) => {
                              if (Platform.OS !== 'web') {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              }
                              const { pageX, pageY } = event.nativeEvent;
                              setSetMenuPosition({ x: pageX, y: pageY });
                              setShowSetMenu({ exerciseIndex: aIndex, setIndex });
                            }}
                            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                          >
                            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>Set {setIndex + 1}</Text>
                          </Pressable>

                          {renderMiniSetRow(aIndex, setA, setIndex, exA.type || 'weighted', 'A', '#3B82F6')}
                          {renderMiniSetRow(bIndex, setB, setIndex, exB.type || 'weighted', 'B', '#F59E0B')}
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <Text className="text-xs text-muted text-center py-2">No sets added yet</Text>
                )}

                <Button variant="secondary" size="sm" onPress={() => handleAddSet(aIndex)} className="w-full">
                  <IconSymbol size={16} name="plus" color={colors.foreground} />
                  <Text className="text-sm font-semibold text-foreground">Add Set</Text>
                </Button>
              </CardContent>
            )}
          </Card>
        </Animated.View>
      );
    },
    [
      exercises,
      displayItems.length,
      collapsedDisplayKeys,
      colors,
      currentBodyweight,
      settings.weightUnit,
      settings.defaultRestTime,
      getExercisePRData,
      handleMoveDisplayItemUp,
      handleMoveDisplayItemDown,
      handleUpdateExercise,
      handleUpdateSupersetGroup,
      handleAddSet,
      renderSetRow,
      renderMiniSetRow,
      toggleCollapsedDisplayKey,
    ]
  );

  // Calculate total template volume
  const totalTemplateVolume = useMemo(() => {
    return exercises.reduce((total, exercise) => {
      const exerciseType = exercise.type || 'weighted';
      const exerciseVolume = calculateTemplateExerciseVolume(
        exercise.sets,
        exerciseType,
        currentBodyweight
      );
      return total + exerciseVolume;
    }, 0);
  }, [exercises, currentBodyweight]);

  const routineSummary = useMemo(() => {
    const totalSets = exercises.reduce((sum, ex) => sum + (ex.sets?.length ?? 0), 0);
    const totalReps = exercises.reduce(
      (sum, ex) => sum + (ex.sets?.reduce((inner, s) => inner + (s.reps ?? 0), 0) ?? 0),
      0
    );
    const totalExercises = exercises.length;

    return {
      totalExercises,
      totalSets,
      totalReps,
      totalVolumeDisplay: isNaN(totalTemplateVolume)
        ? 0
        : Math.round(convertWeight(totalTemplateVolume, settings.weightUnit)),
      unit: settings.weightUnit,
    };
  }, [exercises, totalTemplateVolume, settings.weightUnit]);

  const routineMuscleData = useMemo(() => {
    const used = new Set<MuscleGroup>();

    for (const ex of exercises) {
      const name = (ex.name ?? '').trim();
      if (!name) continue;

      let muscleMeta: ExerciseMetadata | null = null;

      if (ex.primaryMuscle) {
        muscleMeta = {
          name,
          primaryMuscle: ex.primaryMuscle as MuscleGroup,
          secondaryMuscles: (ex.secondaryMuscles || []) as MuscleGroup[],
        } as any;
      } else {
        const customEx = customExercises.find((ce) => ce.name.toLowerCase() === name.toLowerCase());
        const isCustom = !getExerciseMuscles(name);
        muscleMeta = getEffectiveExerciseMuscles(name, predefinedExerciseCustomizations as any, isCustom, customEx) as any;
      }

      if (!muscleMeta) continue;
      used.add(muscleMeta.primaryMuscle);
      for (const m of muscleMeta.secondaryMuscles || []) used.add(m);
    }

    const bodyData: Array<{ slug: string; intensity: number }> = [];
    for (const muscle of Object.keys(ROUTINE_MUSCLE_MAP) as MuscleGroup[]) {
      const bodyMuscles = ROUTINE_MUSCLE_MAP[muscle];
      if (!bodyMuscles) continue;
      if (!used.has(muscle)) continue;
      bodyMuscles.forEach((slug) => bodyData.push({ slug, intensity: 1 }));
    }

    return bodyData;
  }, [exercises, customExercises, predefinedExerciseCustomizations]);

  const routineMuscleBreakdown = useMemo(() => {
    type BreakdownRow = {
      muscle: MuscleGroup;
      name: string;
      primarySets: number;
      secondarySets: number;
      primaryVolume: number;
      secondaryVolume: number;
    };

    const byMuscle = new Map<MuscleGroup, Omit<BreakdownRow, 'muscle' | 'name'>>();

    const ensure = (muscle: MuscleGroup) => {
      if (!byMuscle.has(muscle)) {
        byMuscle.set(muscle, {
          primarySets: 0,
          secondarySets: 0,
          primaryVolume: 0,
          secondaryVolume: 0,
        });
      }
      return byMuscle.get(muscle)!;
    };

    for (const ex of exercises) {
      const exName = (ex.name ?? '').trim();
      if (!exName) continue;

      let muscleMeta: ExerciseMetadata | null = null;
      if (ex.primaryMuscle) {
        muscleMeta = {
          name: exName,
          primaryMuscle: ex.primaryMuscle as MuscleGroup,
          secondaryMuscles: (ex.secondaryMuscles || []) as MuscleGroup[],
          muscleContributions: (predefinedExerciseCustomizations as any)?.[exName]?.muscleContributions,
        } as any;
      } else {
        const customEx = customExercises.find((ce) => ce.name.toLowerCase() === exName.toLowerCase());
        const isCustom = !getExerciseMuscles(exName);
        muscleMeta = getEffectiveExerciseMuscles(exName, predefinedExerciseCustomizations as any, isCustom, customEx) as any;
      }

      if (!muscleMeta) continue;

      const exerciseType = (ex.type || 'weighted') as ExerciseType;
      const contributions = getExerciseContributions(muscleMeta);
      const primary = muscleMeta.primaryMuscle;
      const secondaries = (muscleMeta.secondaryMuscles || []).filter(Boolean);

      // For template configs, count all working sets with reps; ignore warmups.
      const workingSets = (ex.sets || []).filter((s) => s?.setType !== 'warmup' && !!s?.reps);
      if (workingSets.length === 0) continue;

      const totalExerciseVolume = calculateTemplateExerciseVolume(workingSets, exerciseType, currentBodyweight);
      const primaryContrib = contributions[primary] ?? 100;

      // Sets: primary gets full set count; secondary gets fractional sets based on contribution %.
      const primaryStats = ensure(primary);
      primaryStats.primarySets += workingSets.length;
      primaryStats.primaryVolume += totalExerciseVolume * (primaryContrib / 100);

      for (const muscle of secondaries) {
        const secContrib = contributions[muscle] ?? 0;
        if (secContrib <= 0) continue;
        const secStats = ensure(muscle);
        secStats.secondarySets += workingSets.length * (secContrib / 100);
        secStats.secondaryVolume += totalExerciseVolume * (secContrib / 100);
      }
    }

    const rows: BreakdownRow[] = Array.from(byMuscle.entries())
      .map(([muscle, stats]) => ({
        muscle,
        name: getMuscleGroupDisplayName(muscle),
        ...stats,
      }))
      .filter((r) => (r.primarySets + r.secondarySets) > 0 || (r.primaryVolume + r.secondaryVolume) > 0)
      .sort((a, b) => (b.primaryVolume + b.secondaryVolume) - (a.primaryVolume + a.secondaryVolume));

    return rows;
  }, [currentBodyweight, customExercises, exercises, predefinedExerciseCustomizations]);

  // Static header - doesn't include template name input to avoid keyboard issues
  const ListHeaderComponent = useCallback(() => (
    <View className="gap-4 pb-4">
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: 'hidden',
          height: headerCardHeight ?? undefined,
        }}
      >
        <ScrollView
          ref={headerScrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
          directionalLockEnabled
          scrollEventThrottle={16}
          onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
            const x = e.nativeEvent.contentOffset.x;
            const idx = headerPageWidth > 0 ? Math.round(x / headerPageWidth) : 0;
            setHeaderPageIndex(Math.max(0, Math.min(1, idx)));
          }}
        >
          {/* Page 1: Body map + summary */}
          <View
            style={{ width: headerPageWidth, padding: 12, paddingBottom: 26 }}
            onLayout={(e) => {
              const measured = e.nativeEvent.layout.height;
              if (headerCardHeight == null && measured && measured > 0) {
                setHeaderCardHeight(measured);
              }
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {/* Body map */}
              <View
                style={{
                  backgroundColor: colors.background,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingVertical: 6,
                  paddingHorizontal: 6,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <Body
                    data={routineMuscleData}
                    colors={['#FF4D4D']}
                    scale={0.42}
                    side="front"
                    gender={(settings.bodyMapGender as any) || 'male'}
                  />
                  <Body
                    data={routineMuscleData}
                    colors={['#FF4D4D']}
                    scale={0.42}
                    side="back"
                    gender={(settings.bodyMapGender as any) || 'male'}
                  />
                </View>
              </View>

              {/* Summary stats (vertical list) */}
              <View style={{ flex: 1, gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                  <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '700' }}>
                    Volume ({routineSummary.unit})
                  </Text>
                  <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: '800' }}>
                    {routineSummary.totalVolumeDisplay}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                  <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '700' }}>Exercises</Text>
                  <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: '800' }}>
                    {routineSummary.totalExercises}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                  <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '700' }}>Sets</Text>
                  <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: '800' }}>
                    {routineSummary.totalSets}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                  <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '700' }}>Reps</Text>
                  <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: '800' }}>
                    {routineSummary.totalReps}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Page 2: Muscle breakdown */}
          <View style={{ width: headerPageWidth, padding: 12, paddingBottom: 26, height: headerCardHeight ?? undefined }}>
            {routineMuscleBreakdown.length === 0 ? (
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                Add exercises to see muscle breakdown.
              </Text>
            ) : (
              <ScrollView
                nestedScrollEnabled
                showsVerticalScrollIndicator={true}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 8 }}
              >
                {routineMuscleBreakdown.map((row) => {
                  const totalSets = row.primarySets + row.secondarySets;
                  const totalVolume = row.primaryVolume + row.secondaryVolume;

                  const totalSetsText = totalSets % 1 === 0 ? `${totalSets}` : totalSets.toFixed(1);
                  const primaryVolDisplay = Math.max(0, row.primaryVolume);
                  const secondaryVolDisplay = Math.max(0, row.secondaryVolume);
                  const splitDenom = primaryVolDisplay + secondaryVolDisplay;
                  const primaryPct = splitDenom > 0 ? (primaryVolDisplay / splitDenom) * 100 : 0;
                  const secondaryPct = splitDenom > 0 ? (secondaryVolDisplay / splitDenom) * 100 : 0;

                  // One-line row layout (modeled after Analytics Current Week Sets)
                  const rowGap = 8;
                  const labelWidth = 80;
                  // Wider than Analytics because we show both volume + sets
                  const statsWidth = 138;
                  const innerContentWidth = Math.max(1, headerPageWidth - 24); // Page has padding: 12 left + 12 right
                  const barSlotWidth = Math.max(40, innerContentWidth - labelWidth - statsWidth - rowGap * 2);
                  const barHeight = 16;

                  // Neutral greys in the routine editor (no heatmap coloring needed here)
                  const primaryColor = '#6B7280'; // Gray-500
                  const secondaryColor = '#9CA3AF'; // Gray-400

                  return (
                    <View
                      key={row.muscle}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: rowGap, paddingVertical: 8 }}
                    >
                      <Text
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        style={{ color: colors.foreground, fontSize: 12, fontWeight: '500', width: labelWidth }}
                      >
                        {row.name}
                      </Text>

                      <View style={{ width: barSlotWidth, height: barHeight, justifyContent: 'center' }}>
                        <View
                          style={{
                            height: barHeight,
                            borderRadius: 4,
                            overflow: 'hidden',
                            flexDirection: 'row',
                            backgroundColor: colors.border,
                            opacity: splitDenom > 0 ? 1 : 0.5,
                          }}
                        >
                          {splitDenom > 0 ? (
                            <>
                              <View style={{ width: `${primaryPct}%`, backgroundColor: primaryColor, opacity: 1 }} />
                              <View style={{ width: `${secondaryPct}%`, backgroundColor: secondaryColor, opacity: 1 }} />
                            </>
                          ) : null}
                        </View>
                      </View>

                      <View style={{ width: statsWidth, alignItems: 'flex-end' }}>
                        <Text
                          numberOfLines={1}
                          style={{ color: colors.foreground, fontSize: 11, fontWeight: '600' }}
                        >
                          {formatVolume(totalVolume, settings.weightUnit)}, {totalSetsText} sets
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </ScrollView>

        {/* Page indicator (kept within body-map-defined height) */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 10,
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          {[0, 1].map((i) => (
            <View
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: headerPageIndex === i ? colors.foreground : colors.border,
              }}
            />
          ))}
        </View>
      </View>


    </View>
  ), [colors, headerCardHeight, headerPageIndex, headerPageWidth, routineMuscleBreakdown, routineMuscleData, routineSummary, settings.bodyMapGender, settings.weightUnit]);

  const ListFooterComponent = useCallback(() => (
    <View className="gap-4 pt-4 pb-6">
      {exercises.length === 0 && (
        <View className="items-center justify-center py-8">
          <Text className="text-base text-muted text-center">
            No exercises added yet. Add one to get started!
          </Text>
        </View>
      )}

      {/* Add Exercise / Add Superset */}
      <View className="flex-row gap-3">
        <Button
          variant="secondary"
          size="lg"
          onPress={() => setShowExercisePicker(true)}
          containerClassName="flex-1"
          className="w-full"
        >
          <IconSymbol size={20} name="plus" color={colors.foreground} />
          <Text className="text-base font-semibold text-foreground">Add Exercise</Text>
        </Button>

        <Button
          variant="secondary"
          size="lg"
          onPress={() => setShowSupersetModal(true)}
          containerClassName="flex-1"
          className="w-full"
        >
          <IconSymbol size={20} name="list.bullet" color={colors.foreground} />
          <Text className="text-base font-semibold text-foreground">Add Superset</Text>
        </Button>
      </View>

      {/* Save Buttons */}
      {templateId ? (
        // When editing: show both Update and Save as New
        <>
          <Button
            size="lg"
            onPress={handleSaveTemplate}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? 'Updating...' : 'Update Routine'}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onPress={handleSaveAsNewTemplate}
            disabled={isLoading}
            className="w-full"
          >
            <Text className="text-base font-semibold text-foreground">Save as New Routine</Text>
          </Button>
        </>
      ) : (
        // When creating: show only Save
        <Button
          size="lg"
          onPress={handleSaveTemplate}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? 'Saving...' : 'Save Routine'}
        </Button>
      )}
    </View>
  ), [exercises.length, colors, handleSaveTemplate, handleSaveAsNewTemplate, isLoading, templateId]);

  const renderExercisePickerItem = useCallback(({ item }: { item: { name: string; primaryMuscle?: string; secondaryMuscles?: string[] } }) => (
    <Pressable
      onPress={() => handleAddExerciseToTemplate(item.name)}
      style={({ pressed }) => [
        styles.exercisePickerItem,
        { backgroundColor: pressed ? colors.surface : colors.background, borderBottomColor: colors.border },
      ]}
    >
      <Text style={[styles.exercisePickerName, { color: colors.foreground }]}>{item.name}</Text>
      <Text style={[styles.exercisePickerMuscle, { color: colors.muted }]}>
        {item.primaryMuscle || 'Custom'}
      </Text>
    </Pressable>
  ), [colors, handleAddExerciseToTemplate]);

  return (
    <ScreenContainer className="p-4">
      {/* Page Header */}
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-2xl font-bold text-foreground">
          {templateId ? 'Edit Routine' : 'Create Routine'}
        </Text>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
        >
          <IconSymbol size={26} name="xmark.circle.fill" color={colors.error} />
        </Pressable>
      </View>

      {/* Routine Name Input - outside list to prevent keyboard closing */}
      <View className="gap-2 mb-4">
        <Text className="text-sm font-semibold text-foreground">Routine Name</Text>
        <TextInput
          placeholder="e.g., Push Day, Leg Day"
          placeholderTextColor={colors.muted}
          value={templateName}
          onChangeText={setTemplateName}
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            color: colors.foreground,
            borderWidth: 1,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontSize: 16,
          }}
        />
      </View>

      <FlatList
        data={displayItems}
        keyExtractor={(item) => item.key}
        renderItem={renderExerciseItem}
        ListHeaderComponent={ListHeaderComponent}
        ListFooterComponent={ListFooterComponent}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={true}
      />

      {/* Exercise Picker Modal */}
      <Modal
        visible={showExercisePicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowExercisePicker(false)}
      >
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            <GroupedExercisePicker
              exercises={allExercises}
              searchQuery={exerciseSearch}
              onSearchChange={setExerciseSearch}
              onSelectExercise={handleAddExerciseToTemplate}
              onCreateNew={() => {
                setShowExercisePicker(false);
                setExerciseSearch('');
                setShowCreateExercise(true);
              }}
              showCreateButton={true}
            />
          </View>
        </SafeAreaView>
      </Modal>

      <AddSupersetModal
        visible={showSupersetModal}
        onClose={() => setShowSupersetModal(false)}
        exercises={allExercises}
        defaultRestTimeSeconds={settings.defaultRestTime}
        onSubmit={handleSubmitSuperset}
        onCreateNewExercise={() => {
          setShowSupersetModal(false);
          setExerciseSearch('');
          setShowCreateExercise(true);
        }}
      />

      {/* Create Exercise Modal */}
      <CreateExerciseModal
        visible={showCreateExercise}
        onClose={() => setShowCreateExercise(false)}
        onSave={handleCreateExercise}
        mode="create"
      />

      {/* Merge Superset Modal */}
      <MergeSupersetModal
        visible={showMergeSupersetModal}
        onClose={() => {
          setShowMergeSupersetModal(false);
          setMergeSupersetSourceId(null);
        }}
        sourceExercise={mergeSupersetSourceExercise}
        availableExercises={availableExercisesForMerge}
        allExercises={allExercises}
        defaultRestTimeSeconds={settings.defaultRestTime ?? 180}
        onSelectExisting={(targetIndex, restTimeSeconds) => {
          handleMergeWithExisting(targetIndex, restTimeSeconds);
          setShowMergeSupersetModal(false);
          setMergeSupersetSourceId(null);
        }}
        onAddNewExercise={(exerciseName, restTimeSeconds) => {
          handleMergeWithNewExercise(exerciseName, restTimeSeconds);
          setShowMergeSupersetModal(false);
          setMergeSupersetSourceId(null);
        }}
        onCreateNewExercise={() => {
          setShowMergeSupersetModal(false);
          setShowCreateExercise(true);
        }}
      />

      <ExerciseQuickActionsSheet
        visible={showExerciseQuickActions}
        exerciseName={exerciseQuickActionsName}
        restTimeSeconds={quickActionsMeta?.restTimerSeconds}
        defaultRestTimeSeconds={settings.defaultRestTime ?? 180}
        restTimerEnabled={quickActionsMeta?.restTimerEnabled}
        autoProgressionEnabled={quickActionsMeta?.autoProgressionEnabled ?? false}
        autoProgressionMinReps={
          quickActionsMeta
            ? (quickActionsMeta.ex.autoProgressionUseDefaultRange === false
              ? (quickActionsMeta.ex.autoProgressionMinReps ?? null)
              : (quickActionsMeta.ex.autoProgressionMinReps ?? settings.defaultAutoProgressionMinReps ?? null))
            : null
        }
        autoProgressionMaxReps={
          quickActionsMeta
            ? (quickActionsMeta.ex.autoProgressionUseDefaultRange === false
              ? (quickActionsMeta.ex.autoProgressionMaxReps ?? null)
              : (quickActionsMeta.ex.autoProgressionMaxReps ?? settings.defaultAutoProgressionMaxReps ?? null))
            : null
        }
        isInSuperset={quickActionsMeta?.isSuperset}
        onClose={() => {
          setShowExerciseQuickActions(false);
          setExerciseQuickActionsName(null);
          setExerciseQuickActionsId(null);
        }}
        onSeeDetails={(name) => {
          openExerciseDetails(name);
        }}
        onSyncToLastSession={() => {
          if (!exerciseQuickActionsId) return;
          syncTemplateExerciseToLastSession(exerciseQuickActionsId);
        }}
        onReplaceExercise={() => {
          if (!exerciseQuickActionsId) return;
          setReplacingExerciseId(exerciseQuickActionsId);
          setShowReplaceExercisePicker(true);
        }}
        onRemoveExercise={() => {
          if (!exerciseQuickActionsId) return;
          handleDeleteExercise(exerciseQuickActionsId);
        }}
        onChangeRestTimeSeconds={(seconds) => {
          const meta = quickActionsMeta;
          if (!meta) return;
          if (meta.isSuperset && meta.ex.groupId) {
            handleUpdateSupersetGroup(meta.ex.groupId, { restTimer: seconds });
          } else {
            handleUpdateExercise(meta.ex.id, { restTimer: seconds });
          }
        }}
        onToggleRestTimerEnabled={() => {
          const meta = quickActionsMeta;
          if (!meta) return;
          const nextEnabled = !meta.restTimerEnabled;
          if (meta.isSuperset && meta.ex.groupId) {
            handleUpdateSupersetGroup(meta.ex.groupId, { timerEnabled: nextEnabled });
          } else {
            handleUpdateExercise(meta.ex.id, { timerEnabled: nextEnabled });
          }
        }}
        onChangeAutoProgressionMinReps={(reps) => {
          const meta = quickActionsMeta;
          if (!meta) return;
          const nextMin = reps ?? undefined;
          handleUpdateExercise(meta.ex.id, {
            autoProgressionMinReps: nextMin,
            autoProgressionUseDefaultRange: false,
          });
        }}
        onChangeAutoProgressionMaxReps={(reps) => {
          const meta = quickActionsMeta;
          if (!meta) return;
          const nextMax = reps ?? undefined;
          handleUpdateExercise(meta.ex.id, {
            autoProgressionMaxReps: nextMax,
            autoProgressionUseDefaultRange: false,
          });
        }}
        onToggleAutoProgressionEnabled={() => {
          const meta = quickActionsMeta;
          if (!meta) return;
          const nextEnabled = !meta.autoProgressionEnabled;
          if (nextEnabled) {
            const fallbackMin = settings.defaultAutoProgressionMinReps ?? 8;
            const fallbackMax = settings.defaultAutoProgressionMaxReps ?? 12;
            handleUpdateExercise(meta.ex.id, {
              autoProgressionEnabled: true,
              autoProgressionMinReps:
                meta.ex.autoProgressionUseDefaultRange === false
                  ? meta.ex.autoProgressionMinReps
                  : (meta.ex.autoProgressionMinReps ?? fallbackMin),
              autoProgressionMaxReps:
                meta.ex.autoProgressionUseDefaultRange === false
                  ? meta.ex.autoProgressionMaxReps
                  : (meta.ex.autoProgressionMaxReps ?? fallbackMax),
              autoProgressionUseDefaultRange: meta.ex.autoProgressionUseDefaultRange === false ? false : true,
            });
          } else {
            handleUpdateExercise(meta.ex.id, { autoProgressionEnabled: false });
          }
        }}
        onAddToSuperset={() => {
          if (!exerciseQuickActionsId) return;
          handleAddToSuperset(exerciseQuickActionsId);
        }}
        onSplitSuperset={() => {
          if (!exerciseQuickActionsId) return;
          handleSplitSuperset(exerciseQuickActionsId);
        }}
      />

      <ExerciseDetailModal
        visible={showExerciseDetailsModal}
        exerciseName={exerciseDetailsName}
        onClose={() => {
          setShowExerciseDetailsModal(false);
        }}
      />

      {/* Set Menu Modal */}
      <Modal visible={showSetMenu !== null} transparent animationType="fade">
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
          onPress={() => {
            setShowSetMenu(null);
            setSetMenuPosition(null);
          }}
        >
          <View style={{
            position: 'absolute',
            top: setMenuPosition?.y || 100,
            left: Math.min(setMenuPosition?.x || 100, 300),
            backgroundColor: colors.background,
            borderRadius: 12,
            padding: 8,
            minWidth: 180,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 5,
          }}>
            {/* Warmup/Working toggle */}
            <Pressable
              onPress={() => {
                if (showSetMenu) {
                  handleToggleSetType(showSetMenu.exerciseIndex, showSetMenu.setIndex);
                  setShowSetMenu(null);
                  setSetMenuPosition(null);
                }
              }}
              style={({ pressed }) => [{
                paddingVertical: 12,
                paddingHorizontal: 16,
                backgroundColor: pressed ? colors.surface : colors.background,
                borderRadius: 8,
              }]}
            >
              {showSetMenu && exercises[showSetMenu.exerciseIndex]?.sets[showSetMenu.setIndex]?.setType === 'warmup' ? (
                <Text style={{ color: colors.foreground, fontSize: 16 }}>💪 Mark as Working Set</Text>
              ) : (
                <Text style={{ color: '#F59E0B', fontSize: 16 }}>🔥 Mark as Warmup</Text>
              )}
            </Pressable>
            
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
            
            <Pressable
              onPress={() => {
                if (showSetMenu) {
                  handleDeleteSet(showSetMenu.exerciseIndex, showSetMenu.setIndex);
                  setShowSetMenu(null);
                  setSetMenuPosition(null);
                }
              }}
              style={({ pressed }) => [{
                paddingVertical: 12,
                paddingHorizontal: 16,
                backgroundColor: pressed ? colors.surface : colors.background,
                borderRadius: 8,
              }]}
            >
              <Text style={{ color: colors.error, fontSize: 16 }}>Remove Set</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Replace Exercise Picker Modal */}
      <Modal visible={showReplaceExercisePicker} animationType="slide">
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Replace Exercise</Text>
              <Pressable
                onPress={() => {
                  setShowReplaceExercisePicker(false);
                  setReplacingExerciseId(null);
                  setExerciseSearch('');
                }}
                style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
              >
                <IconSymbol size={24} name="xmark.circle.fill" color={colors.error} />
              </Pressable>
            </View>

            <GroupedExercisePicker
              exercises={allExercises}
              searchQuery={exerciseSearch}
              onSearchChange={setExerciseSearch}
              onSelectExercise={(exerciseName) => {
                if (replacingExerciseId) {
                  handleReplaceExercise(replacingExerciseId, exerciseName);
                  setShowReplaceExercisePicker(false);
                  setReplacingExerciseId(null);
                  setExerciseSearch('');
                }
              }}
              onCreateNew={() => {
                setShowReplaceExercisePicker(false);
                setShowCreateExercise(true);
              }}
              showCreateButton={true}
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* Save as New Routine Modal */}
      <Modal visible={showSaveAsNewModal} transparent animationType="fade">
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
          onPress={() => setShowSaveAsNewModal(false)}
        >
          <Pressable
            style={{
              backgroundColor: colors.background,
              borderRadius: 16,
              padding: 24,
              width: '85%',
              maxWidth: 400,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={{ fontSize: 20, fontWeight: '600', color: colors.foreground, marginBottom: 8 }}>
              Save as New Routine
            </Text>
            <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 20 }}>
              Enter a name for the new routine:
            </Text>
            
            <TextInput
              value={newTemplateName}
              onChangeText={setNewTemplateName}
              placeholder="Routine name"
              placeholderTextColor={colors.muted}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 8,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 16,
                color: colors.foreground,
                marginBottom: 20,
                borderWidth: 1,
                borderColor: colors.border,
              }}
              autoFocus
              selectTextOnFocus
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={() => setShowSaveAsNewModal(false)}
                style={({ pressed }) => ([
                  {
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 8,
                    alignItems: 'center',
                    backgroundColor: pressed ? colors.surface : colors.background,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }
                ])}
              >
                <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: '600' }}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={handleConfirmSaveAsNew}
                disabled={isLoading}
                style={({ pressed }) => ([
                  {
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 8,
                    alignItems: 'center',
                    backgroundColor: pressed ? colors.primary + 'DD' : colors.primary,
                    opacity: isLoading ? 0.5 : 1,
                  }
                ])}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
                  {isLoading ? 'Saving...' : 'Save'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  listContent: {
    flexGrow: 1,
  },
  exerciseContainer: {
    marginBottom: 16,
  },
  exerciseActive: {
    opacity: 0.9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  dragHandle: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    gap: 6,
  },
  setNumber: {
    width: 24,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  adjustBtn: {
    width: 32,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1,
  },
  adjustText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  input: {
    width: 60,
    height: 40,
    borderRadius: 6,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '500',
    paddingHorizontal: 4,
  },
  unitLabel: {
    fontSize: 12,
    fontWeight: '500',
    minWidth: 28,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  searchContainer: {
    padding: 16,
    paddingTop: 8,
  },
  searchInput: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  createExerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  createExerciseBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  exerciseList: {
    paddingBottom: 32,
  },
  exercisePickerItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  exercisePickerName: {
    fontSize: 16,
    fontWeight: '500',
  },
  exercisePickerMuscle: {
    fontSize: 13,
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});
