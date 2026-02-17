/**
 * Active Workout Screen - Track exercises in real-time
 * Single scrollable view with per-exercise rest timers
 */

import { ScrollView, Text, View, Pressable, Alert, Modal, TextInput, FlatList, StyleSheet, LayoutAnimation, UIManager, BackHandler } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { ScreenContainer } from '@/components/screen-container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RestTimerPopup } from '@/components/rest-timer-popup';
import { PRCelebrationModal } from '@/components/pr-celebration-modal';
import { CreateExerciseModal } from '@/components/create-exercise-modal';
import { GroupedExercisePicker } from '@/components/grouped-exercise-picker';
import { AddSupersetModal, type AddSupersetModalResult } from '@/components/add-superset-modal';
import { ExerciseQuickActionsSheet } from '@/components/exercise-quick-actions-sheet';
import { ExerciseDetailModal } from '@/components/exercise-detail-modal';
import { useGym } from '@/lib/gym-context';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { CompletedWorkout, CompletedExercise, CompletedSet, Exercise, PREDEFINED_EXERCISES, PREDEFINED_EXERCISES_WITH_MUSCLES, getExerciseMuscles, getEffectiveExerciseMuscles, MuscleGroup, ExerciseType, ExerciseMetadata } from '@/lib/types';
import { generateCustomExerciseId } from '@/lib/exercise-id-migration';
import { PRIMARY_MUSCLE_GROUPS, getMuscleGroupDisplayName } from '@/lib/muscle-groups';
import { generateId, BodyWeightStorage, FailureSetStorage } from '@/lib/storage';
import { formatTime } from '@/lib/utils-gym';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { convertWeight, formatWeight, formatVolume, lbsToKg } from '@/lib/unit-conversion';
import { calculateExerciseVolume, calculateTemplateExerciseVolume } from '@/lib/volume-calculation';
import { groupExercisesForDisplay, moveDisplayItem, mergeExercisesToSuperset, splitSupersetToExercises, isExerciseInSuperset } from '@/lib/superset';
import { MergeSupersetModal } from '@/components/merge-superset-modal';

interface WorkoutExercise extends Exercise {
  completedSets: CompletedSet[];
  /** Snapshot of the original template-configured set prescription (used for target volume). */
  plannedSets?: CompletedSet[];
}

export default function ActiveWorkoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { 
    addWorkout, 
    templates, 
    workouts,
    settings, 
    customExercises, 
    addCustomExercise, 
    addTemplate, 
    updateTemplate, 
    getMostRecentExerciseData, 
    getExercisePRData, 
    detectWorkoutPRs, 
    startTimer, 
    stopTimer,
    predefinedExerciseCustomizations, 
    setWorkoutActive, 
    clearWorkoutActive, 
    updateActiveWorkoutData,
    isWorkoutActive,
    activeWorkoutStartTime,
    activeWorkoutName,
    activeWorkoutExercises,
    activeWorkoutBodyweight,
    activeWorkoutDisabledTimers,
    activeWorkoutCollapsedDisplayKeys
  } = useGym();
  const { templateId, templateName, newExerciseName } = useLocalSearchParams();

  const [workoutName, setWorkoutName] = useState(
    templateName && typeof templateName === 'string' ? templateName : 'Quick Workout'
  );
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [startTime, setStartTime] = useState(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [focusCounter, setFocusCounter] = useState(0); // Force template reload on focus
  const navigation = useNavigation();
  const hasInitializedWorkout = useRef(false); // Track if we've initialized a workout on this mount
  const isFinishingWorkout = useRef(false); // Track if we're in the process of finishing (prevent re-init)
  const isWorkoutActiveRef = useRef(isWorkoutActive); // Always have latest value in listeners
  
  // Keep the ref in sync with the state
  useEffect(() => {
    isWorkoutActiveRef.current = isWorkoutActive;
  }, [isWorkoutActive]);

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);
  
  // Exercise picker modal state
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');

  // Superset creation modal state
  const [showSupersetModal, setShowSupersetModal] = useState(false);

  // Create Exercise modal state
  const [showCreateExercise, setShowCreateExercise] = useState(false);

  const [showReplaceExercisePicker, setShowReplaceExercisePicker] = useState(false);
  const [replacingExerciseIndex, setReplacingExerciseIndex] = useState<number | null>(null);

  // Exercise details quick actions + modal
  const [showExerciseQuickActions, setShowExerciseQuickActions] = useState(false);
  const [exerciseQuickActionsName, setExerciseQuickActionsName] = useState<string | null>(null);
  const [exerciseQuickActionsIndex, setExerciseQuickActionsIndex] = useState<number | null>(null);
  const [showExerciseDetailsModal, setShowExerciseDetailsModal] = useState(false);
  const [exerciseDetailsName, setExerciseDetailsName] = useState<string | null>(null);

  // Set menu state (changed from long-press to tap)
  const [showSetMenu, setShowSetMenu] = useState<{ exerciseIndex: number; setIndex: number } | null>(null);
  const [setMenuPosition, setSetMenuPosition] = useState<{ x: number; y: number } | null>(null);
  // For superset failure selection - tracks which step of the menu we're in
  const [failureSelectStep, setFailureSelectStep] = useState<'main' | 'selectExercise'>('main');
  // Store superset partner info for failure selection
  const [supersetPartnerIndex, setSupersetPartnerIndex] = useState<number | null>(null);

  // PR celebration modal state
  const [showPRModal, setShowPRModal] = useState(false);
  const [detectedPRs, setDetectedPRs] = useState<Array<{ exerciseName: string; prType: 'heaviest_weight' | 'highest_volume'; value: number }>>([]);
  const [completedWorkout, setCompletedWorkout] = useState<CompletedWorkout | null>(null);
  const [currentBodyweight, setCurrentBodyweight] = useState<number>(70); // Default 70kg, will be fetched

  // Timer disabled state (tracks which exercises have timer disabled)
  const [disabledTimers, setDisabledTimers] = useState<Set<string>>(new Set());

  // Collapsed/expanded state for exercise/superset cards (keyed by displayItem.key)
  const [collapsedDisplayKeys, setCollapsedDisplayKeys] = useState<Set<string>>(new Set());

  // Merge superset modal state
  const [showMergeSupersetModal, setShowMergeSupersetModal] = useState(false);
  const [mergeSupersetSourceIndex, setMergeSupersetSourceIndex] = useState<number | null>(null);

  // Use centralized muscle groups
  const MUSCLE_GROUPS: MuscleGroup[] = PRIMARY_MUSCLE_GROUPS;

  const displayItems = useMemo(() => groupExercisesForDisplay(exercises), [exercises]);

  const toggleCollapsedDisplayKey = useCallback((key: string) => {
    setCollapsedDisplayKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Available exercises for merge superset modal (non-superset exercises only)
  const availableExercisesForMerge = useMemo(() => {
    return exercises
      .map((ex, index) => ({ ex, index }))
      .filter(({ ex }) => !isExerciseInSuperset(ex))
      .map(({ ex, index }) => ({
        id: ex.id,
        index,
        name: ex.name,
        setCount: ex.completedSets.length,
      }));
  }, [exercises]);

  // Source exercise info for merge modal
  const mergeSupersetSourceExercise = useMemo(() => {
    if (mergeSupersetSourceIndex === null) return null;
    const ex = exercises[mergeSupersetSourceIndex];
    if (!ex) return null;
    return { id: ex.id, name: ex.name };
  }, [mergeSupersetSourceIndex, exercises]);

  const openExerciseQuickActions = useCallback((exerciseIndex: number) => {
    const ex = exercises[exerciseIndex];
    if (!ex) return;
    setExerciseQuickActionsIndex(exerciseIndex);
    setExerciseQuickActionsName(ex.name);
    setShowExerciseQuickActions(true);
  }, [exercises]);

  const openExerciseDetails = useCallback((name: string) => {
    setExerciseDetailsName(name);
    setShowExerciseDetailsModal(true);
  }, []);

  const syncExerciseToLastSession = useCallback(
    (exerciseIndex: number) => {
      setExercises((prev) => {
        const target = prev[exerciseIndex];
        if (!target) return prev;

        const mostRecentWorkout = [...workouts]
          .sort((a, b) => b.endTime - a.endTime)
          .find((w) => w.exercises.some((ex) => ex.name === target.name && ex.sets.length > 0));

        const sourceSets = mostRecentWorkout?.exercises.find((ex) => ex.name === target.name)?.sets ?? [];
        if (sourceSets.length === 0) {
          Alert.alert('No previous session found', `Couldn't find any logged sets for ${target.name}.`);
          return prev;
        }

        const updated: WorkoutExercise = {
          ...target,
          completedSets: target.completedSets.map((set, idx) => {
            const src = sourceSets[idx];
            if (!src) return set;
            if (set.completed) return set;
            return {
              ...set,
              reps: src.reps ?? set.reps,
              weight: src.weight ?? set.weight,
              isRepsPlaceholder: false,
              isWeightPlaceholder: false,
            };
          }),
        };

        const next = [...prev];
        next[exerciseIndex] = updated;
        return next;
      });

      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    [workouts]
  );

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

  // Reset state when screen is focused (ensures fresh workouts)
  useEffect(() => {
    const focusUnsubscribe = navigation.addListener('focus', () => {
      // Only reset if there's NO active workout in global context
      // Use ref to always get latest value (avoids stale closure)
      if (!isWorkoutActiveRef.current) {
        setIsInitialized(false);
        hasInitializedWorkout.current = false;
        isFinishingWorkout.current = false; // Reset finishing flag for new workout
        setStartTime(Date.now());
        setElapsedTime(0);
        setExercises([]);
        setDisabledTimers(new Set());
        setCollapsedDisplayKeys(new Set());
        setFocusCounter(prev => prev + 1);
      }
    });

    return () => {
      focusUnsubscribe();
    };
  }, [navigation]);

  // Load template exercises on mount OR restore from global state
  useEffect(() => {
    // Skip if already initialized
    if (isInitialized) return;

    // If there is an active workout with stored exercises, restore them
    if (isWorkoutActive && activeWorkoutExercises && activeWorkoutExercises.length > 0) {
      setExercises(activeWorkoutExercises);
      setCurrentBodyweight(activeWorkoutBodyweight);
      setDisabledTimers(activeWorkoutDisabledTimers);
      setCollapsedDisplayKeys(new Set(activeWorkoutCollapsedDisplayKeys || []));
      if (activeWorkoutName) {
        setWorkoutName(activeWorkoutName);
      }
      setIsInitialized(true);
      return;
    }

    // Otherwise, initialize from template or quick workout

    if (templateId && typeof templateId === 'string') {
      const template = templates.find((t) => t.id === templateId);
      if (template) {
        const exercisesWithSets: WorkoutExercise[] = template.exercises.map((ex) => {
          // Lookup exercise type from metadata (handles stale template data)
          const customEx = customExercises.find(ce => ce.name.toLowerCase() === ex.name.toLowerCase());
          const muscleMeta = getEffectiveExerciseMuscles(
            ex.name,
            predefinedExerciseCustomizations,
            !!customEx,
            customEx
          );
          const exerciseType = ex.type || muscleMeta?.type || muscleMeta?.exerciseType || 'weighted';
          
          // Create CompletedSet objects from template data
          let completedSets: CompletedSet[] = [];
          
          
          // Strategy 1: Use setDetails if available and non-empty
          if (ex.setDetails && Array.isArray(ex.setDetails) && ex.setDetails.length > 0) {
            completedSets = ex.setDetails.map((setConfig, i) => ({
              setNumber: i + 1,
              reps: setConfig.reps || 0,
              weight: setConfig.weight || 0,
              unit: setConfig.unit || 'kg',
              timestamp: Date.now(),
              completed: false,
              setType: setConfig.setType, // Preserve warmup/working set type from template
            }));
          }
          // Strategy 2: Fall back to sets count with default values
          else if (ex.sets && ex.sets > 0) {
            completedSets = Array.from({ length: ex.sets }, (_, i) => ({
              setNumber: i + 1,
              reps: ex.reps || 0,
              weight: ex.weight || 0,
              unit: ex.unit || 'kg',
              timestamp: Date.now(),
              completed: false,
            }));
          }
          // Strategy 3: Create at least one set as absolute fallback
          else {
            completedSets = [{
              setNumber: 1,
              reps: ex.reps || 0,
              weight: ex.weight || 0,
              unit: ex.unit || 'kg',
              timestamp: Date.now(),
              completed: false,
            }];
          }
          
          return {
            ...ex,
            type: exerciseType, // Ensure type is set correctly
            completedSets,
            plannedSets: completedSets.map((s) => ({
              setNumber: s.setNumber,
              reps: s.reps,
              weight: s.weight,
              unit: s.unit,
              timestamp: s.timestamp,
              completed: false,
              setType: s.setType, // Preserve warmup/working set type
            })),
          };
        });
        setExercises(exercisesWithSets);
        // New workout (template-based): start with all cards collapsed
        setCollapsedDisplayKeys(new Set(groupExercisesForDisplay(exercisesWithSets).map((item) => item.key)));
        
        // Set workout name from template
        setWorkoutName(template.name);
        
        // Initialize disabled timers from template
        const disabled = new Set<string>();
        template.exercises.forEach(ex => {
          if (ex.timerEnabled === false) {
            disabled.add(ex.id);
          }
        });
        setDisabledTimers(disabled);
        
        setIsInitialized(true);
      } else {
        setExercises([]);
        setCollapsedDisplayKeys(new Set());
        setIsInitialized(true);
      }
    } else {
      // Quick workout - start empty
      setExercises([]);
      setCollapsedDisplayKeys(new Set());
      setWorkoutName('Quick Workout');
      setIsInitialized(true);
    }
  }, [
    isInitialized,
    isWorkoutActive,
    activeWorkoutExercises,
    activeWorkoutBodyweight,
    activeWorkoutDisabledTimers,
    activeWorkoutCollapsedDisplayKeys,
    activeWorkoutName,
    templateId,
    templates,
    customExercises,
    focusCounter,
    startTime,
  ]);
  // Initialize or restore active workout (only once on mount)
  useEffect(() => {
    // Don't re-initialize if we're in the process of finishing the workout
    if (isFinishingWorkout.current) return;
    
    if (!isWorkoutActive && !hasInitializedWorkout.current) {
      // No active workout yet: start a new one (only on first mount)
      const workoutStartTime = Date.now();
      setStartTime(workoutStartTime);

      if (templateId && templateName) {
        setWorkoutActive(
          typeof templateName === 'string' ? templateName : 'Template Workout',
          workoutStartTime,
          typeof templateId === 'string' ? templateId : undefined,
          typeof templateName === 'string' ? templateName : undefined
        );
      } else {
        setWorkoutActive('Quick Workout', workoutStartTime);
      }
      hasInitializedWorkout.current = true;
    } else if (isWorkoutActive && activeWorkoutStartTime) {
      // There is an active workout already: sync local state
      setStartTime(activeWorkoutStartTime);
      if (activeWorkoutName) {
        setWorkoutName(activeWorkoutName);
      }
      hasInitializedWorkout.current = true;
    }
  }, [
    isWorkoutActive,
    activeWorkoutStartTime,
    activeWorkoutName,
    templateId,
    templateName,
    setWorkoutActive,
  ]);

  // Update workout name when exercises are loaded
  useEffect(() => {
    // Don't update if we're in the process of finishing the workout
    if (isFinishingWorkout.current) return;
    
    if (isInitialized && activeWorkoutStartTime && hasInitializedWorkout.current) {
      // Workout is already active, just update the name if needed
      // Only update if this is a template workout AND we haven't just started a new workout
      if (templateId && templateName && activeWorkoutName !== templateName) {
        setWorkoutActive(
          typeof templateName === 'string' ? templateName : 'Template Workout',
          activeWorkoutStartTime,
          typeof templateId === 'string' ? templateId : undefined,
          typeof templateName === 'string' ? templateName : undefined
        );
      }
    }
  }, [isInitialized, templateId, templateName, activeWorkoutStartTime, activeWorkoutName, setWorkoutActive]);

  // Handle new exercise created from create-exercise screen
  useEffect(() => {
    if (newExerciseName && typeof newExerciseName === 'string') {
      handleAddExerciseToWorkout(newExerciseName);
      router.setParams({ newExerciseName: undefined });
    }
  }, [newExerciseName]);

  // Fetch bodyweight on mount
  useEffect(() => {
    const fetchBodyweight = async () => {
      const bw = await BodyWeightStorage.getTodayWeight();
      if (bw) {
        // Convert bodyweight to kg for calculations (internal format)
        const bodyWeightKg = bw.unit === 'lbs' ? lbsToKg(bw.weight) : bw.weight;
        setCurrentBodyweight(bodyWeightKg);
      }
    };
    fetchBodyweight();
  }, []);

  // Sync exercise metadata when customExercises or predefinedExerciseCustomizations change
  // This ensures that if the user edits an exercise's type/muscles during the workout,
  // the changes are reflected immediately in the active workout
  useEffect(() => {
    if (!isInitialized || exercises.length === 0) return;
    
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
  }, [customExercises, predefinedExerciseCustomizations, isInitialized]);

  // Sync workout data to global context whenever it changes
  // Important: guard with isWorkoutActive to prevent re-persisting after workout is finished
  useEffect(() => {
    if (isInitialized && isWorkoutActive && exercises.length >= 0) {
      updateActiveWorkoutData(exercises, currentBodyweight, disabledTimers, collapsedDisplayKeys);
    }
  }, [exercises, currentBodyweight, disabledTimers, collapsedDisplayKeys, isInitialized, isWorkoutActive, updateActiveWorkoutData]);

  // Timer for elapsed time - calculate from activeWorkoutStartTime (global context)
  useEffect(() => {
    const timeSource = activeWorkoutStartTime || startTime;
    
    // Update immediately
    const elapsed = Math.floor((Date.now() - timeSource) / 1000);
    setElapsedTime(elapsed);
    
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - timeSource) / 1000);
      setElapsedTime(elapsed);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeWorkoutStartTime, startTime]);

  // Track unsaved changes (any logged sets)
  useEffect(() => {
    const hasLoggedSets = exercises.some(ex => ex.completedSets && ex.completedSets.length > 0);
    setHasUnsavedChanges(hasLoggedSets);
  }, [exercises]);

  // Handle Android hardware back button - navigate back to home (workout continues in background)
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Simply navigate back to home - workout continues in background with banner
      // The active workout banner will allow the user to return to the workout
      router.push('/(tabs)');
      // Return true to prevent default back behavior (which would close the app)
      return true;
    });

    return () => backHandler.remove();
  }, [router]);

  const buildWorkoutExercise = useCallback(async (
    exerciseName: string,
    opts?: { restTimerSeconds?: number; groupType?: 'superset'; groupId?: string; groupPosition?: 0 | 1 }
  ): Promise<WorkoutExercise> => {
    const historicalData = await getMostRecentExerciseData(exerciseName);

    const customEx = customExercises.find(ex => ex.name.toLowerCase() === exerciseName.toLowerCase());
    const muscleMeta = getEffectiveExerciseMuscles(
      exerciseName,
      predefinedExerciseCustomizations,
      !!customEx,
      customEx
    );

    const predefinedEx = PREDEFINED_EXERCISES_WITH_MUSCLES.find(e => e.name.toLowerCase() === exerciseName.toLowerCase());
    const exerciseType = customEx?.type || customEx?.exerciseType || muscleMeta?.exerciseType || predefinedEx?.exerciseType || 'weighted';

    // Get exercise ID: use predefined ID if available, or custom exercise ID, or generate a new custom ID
    const exerciseId = predefinedEx?.id || (customEx as any)?.exerciseId || generateCustomExerciseId();

    let defaultWeight = historicalData?.weight || 0;
    if (exerciseType === 'bodyweight') {
      const bodyWeightLog = await BodyWeightStorage.getTodayWeight();
      if (bodyWeightLog) {
        const bodyWeightKg = bodyWeightLog.unit === 'lbs' ? lbsToKg(bodyWeightLog.weight) : bodyWeightLog.weight;
        defaultWeight = bodyWeightKg;
      }
    }

    return {
      id: generateId(),
      exerciseId,
      name: exerciseName,
      sets: 3,
      reps: historicalData?.reps || 8,
      weight: defaultWeight,
      unit: settings.weightUnit,
      type: exerciseType,
      restTimer: opts?.restTimerSeconds ?? settings.defaultRestTime,
      primaryMuscle: muscleMeta?.primaryMuscle,
      secondaryMuscles: muscleMeta?.secondaryMuscles,
      groupType: opts?.groupType,
      groupId: opts?.groupId,
      groupPosition: opts?.groupPosition,
      completedSets: [
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
    };
  }, [customExercises, predefinedExerciseCustomizations, getMostRecentExerciseData, settings.weightUnit, settings.defaultRestTime]);

  const handleAddExerciseToWorkout = useCallback(async (exerciseName: string) => {
    const newExercise = await buildWorkoutExercise(exerciseName);

    setExercises([...exercises, newExercise]);
    setShowExercisePicker(false);
    setExerciseSearch('');

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [exercises, buildWorkoutExercise]);

  const handleSubmitSuperset = useCallback(async (result: AddSupersetModalResult) => {
    const a = result.exerciseAName;
    const b = result.exerciseBName;

    if (a.toLowerCase() === b.toLowerCase()) {
      Alert.alert('Invalid superset', 'Please choose two different exercises.');
      return;
    }

    const groupId = generateId();
    const exA = await buildWorkoutExercise(a, {
      restTimerSeconds: result.restTimeSeconds,
      groupType: 'superset',
      groupId,
      groupPosition: 0,
    });
    const exB = await buildWorkoutExercise(b, {
      restTimerSeconds: result.restTimeSeconds,
      groupType: 'superset',
      groupId,
      groupPosition: 1,
    });

    setExercises(prev => [...prev, exA, exB]);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [exercises, buildWorkoutExercise]);

  // Helper: get set count from a WorkoutExercise
  const getWorkoutExerciseSetCount = useCallback((ex: WorkoutExercise) => ex.completedSets.length, []);

  // Helper: pad sets to a target count for a WorkoutExercise
  const padWorkoutExerciseSets = useCallback((ex: WorkoutExercise, targetCount: number): WorkoutExercise => {
    const currentCount = ex.completedSets.length;
    if (currentCount >= targetCount) return ex;

    const newSets: CompletedSet[] = [...ex.completedSets];
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
    return { ...ex, completedSets: newSets };
  }, [settings.weightUnit]);

  // Handler: Initiate adding an exercise to a superset
  const handleAddToSuperset = useCallback((exerciseIndex: number) => {
    setMergeSupersetSourceIndex(exerciseIndex);
    setShowMergeSupersetModal(true);
  }, []);

  // Handler: Merge with an existing exercise in the workout
  const handleMergeWithExisting = useCallback((targetIndex: number, restTimeSeconds: number) => {
    if (mergeSupersetSourceIndex === null) return;

    const groupId = generateId();

    // Preserve collapse state: if BOTH cards were collapsed, keep the resulting superset collapsed.
    const sourceId = exercises[mergeSupersetSourceIndex]?.id;
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
        if (i === mergeSupersetSourceIndex || i === targetIndex) {
          return { ...ex, restTimer: restTimeSeconds, timerEnabled: true };
        }
        return ex;
      });

      return mergeExercisesToSuperset(
        updated,
        mergeSupersetSourceIndex,
        targetIndex,
        groupId,
        getWorkoutExerciseSetCount,
        padWorkoutExerciseSets
      );
    });

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [mergeSupersetSourceIndex, exercises, getWorkoutExerciseSetCount, padWorkoutExerciseSets]);

  // Handler: Add a new exercise and merge with it
  const handleMergeWithNewExercise = useCallback(async (exerciseName: string, restTimeSeconds: number) => {
    if (mergeSupersetSourceIndex === null) return;

    const groupId = generateId();

    // New exercise should be expanded by default; ensure the new superset isn't auto-collapsed.
    const sourceId = exercises[mergeSupersetSourceIndex]?.id;
    setCollapsedDisplayKeys((prev) => {
      const next = new Set(prev);
      if (sourceId) next.delete(sourceId);
      next.delete(groupId);
      return next;
    });

    // Build the new exercise
    const newExercise = await buildWorkoutExercise(exerciseName, {
      restTimerSeconds: restTimeSeconds,
      groupType: 'superset',
      groupId,
      groupPosition: 1,
    });

    setExercises((prev) => {
      const sourceEx = prev[mergeSupersetSourceIndex];
      if (!sourceEx) return prev;

      // Apply superset metadata to source exercise
      const updatedSource: WorkoutExercise = {
        ...sourceEx,
        groupType: 'superset',
        groupId,
        groupPosition: 0,
        restTimer: restTimeSeconds,
        timerEnabled: true,
      };

      // Pad new exercise to match source set count if needed
      const sourceSetCount = sourceEx.completedSets.length;
      const paddedNew = padWorkoutExerciseSets(newExercise, sourceSetCount);

      // Replace source and insert new exercise adjacent
      const result: WorkoutExercise[] = [];
      for (let i = 0; i < prev.length; i++) {
        if (i === mergeSupersetSourceIndex) {
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
  }, [mergeSupersetSourceIndex, exercises, buildWorkoutExercise, padWorkoutExerciseSets]);

  // Handler: Split a superset into individual exercises
  const handleSplitSuperset = useCallback((exerciseIndex: number) => {
    const ex = exercises[exerciseIndex];
    if (!ex || !ex.groupId) return;

    const groupId = ex.groupId;
    const memberIds = exercises.filter((e) => e.groupType === 'superset' && e.groupId === groupId).map((e) => e.id);

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

  const handleDeleteExercise = useCallback((index: number) => {
    Alert.alert('Remove Exercise?', 'Are you sure you want to remove this exercise from your workout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          const base = exercises[index];
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
            const base = prev[index];
            if (base?.groupType === 'superset' && typeof base.groupId === 'string') {
              return prev.filter((ex) => !(ex.groupType === 'superset' && ex.groupId === base.groupId));
            }
            return prev.filter((_, i) => i !== index);
          });
          if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        },
      },
    ]);
  }, [exercises]);

  const handleReplaceExercise = useCallback(async (exerciseIndex: number, newExerciseName: string) => {
    const customEx = customExercises.find(ex => ex.name.toLowerCase() === newExerciseName.toLowerCase());
    const muscleMeta = getEffectiveExerciseMuscles(
      newExerciseName,
      predefinedExerciseCustomizations,
      !!customEx,
      customEx
    );
    const newType = muscleMeta?.type || muscleMeta?.exerciseType || 'weighted';
    
    // Fetch bodyweight if needed
    let bodyWeight = 0;
    if (newType === 'bodyweight') {
      const bodyWeightLog = await BodyWeightStorage.getTodayWeight();
      if (bodyWeightLog) {
        // Convert to kg for internal calculations
        bodyWeight = bodyWeightLog.unit === 'lbs' ? lbsToKg(bodyWeightLog.weight) : bodyWeightLog.weight;
      }
    }
    
    setExercises((prev) => {
      const updated = [...prev];
      const ex = updated[exerciseIndex];
      
      // Update all sets based on new exercise type
      const updatedSets = ex.completedSets.map(set => {
        if (newType === 'bodyweight') {
          // Bodyweight: use current bodyweight
          return { ...set, weight: bodyWeight };
        } else if (newType === 'weighted' || newType === 'weighted-bodyweight' || newType === 'assisted-bodyweight' || newType === 'doubled') {
          // Weighted types: ensure weight exists (default to previous value or 20)
          return { ...set, weight: set.weight === 0 ? 20 : set.weight };
        }
        return set;
      });
      
      // Create a completely new exercise object to force React to detect the change
      updated[exerciseIndex] = {
        ...ex,
        name: newExerciseName,
        primaryMuscle: muscleMeta?.primaryMuscle,
        secondaryMuscles: muscleMeta?.secondaryMuscles,
        type: newType,
        completedSets: updatedSets,
      };
      
      return updated;
    });
    
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [customExercises, settings.weightUnit]);
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
      const bodyWeightLog = await BodyWeightStorage.getTodayWeight();
      if (bodyWeightLog) {
        defaultBodyweight = bodyWeightLog.unit === 'lbs' ? lbsToKg(bodyWeightLog.weight) : bodyWeightLog.weight;
      }
    }

    setExercises((prev) => {
      const updated = [...prev];

      indicesToUpdate.forEach((idx) => {
        const ex = updated[idx];
        if (!ex) return;
        const lastSet = ex.completedSets[ex.completedSets.length - 1];
        const isBodyweight = ex.type === 'bodyweight';
        const newSet: CompletedSet = {
          setNumber: ex.completedSets.length + 1,
          reps: lastSet?.reps || 0,
          weight: isBodyweight ? defaultBodyweight : (lastSet?.weight || 0),
          unit: lastSet?.unit || settings.weightUnit,
          completed: false,
          timestamp: Date.now(),
          isRepsPlaceholder: false,
          isWeightPlaceholder: false,
        };

        updated[idx] = {
          ...ex,
          completedSets: [...ex.completedSets, newSet],
        };
      });

      return updated;
    });

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [exercises, settings.weightUnit]);

  const handleDeleteSet = useCallback((exerciseIndex: number, setIndex: number) => {
    setExercises((prev) => {
      const updated = [...prev];
      const base = updated[exerciseIndex];
      if (!base) return updated;

      const shouldSyncSuperset = base.groupType === 'superset' && typeof base.groupId === 'string';
      const mateIndex = shouldSyncSuperset
        ? updated.findIndex((ex, idx) => idx !== exerciseIndex && ex.groupType === 'superset' && ex.groupId === base.groupId)
        : -1;
      const indicesToUpdate = mateIndex >= 0 ? [exerciseIndex, mateIndex] : [exerciseIndex];

      indicesToUpdate.forEach((idx) => {
        const ex = updated[idx];
        if (!ex) return;
        const nextSets = ex.completedSets
          .filter((_, sIdx) => sIdx !== setIndex)
          .map((s, sIdx) => ({ ...s, setNumber: sIdx + 1 }));
        updated[idx] = { ...ex, completedSets: nextSets };
      });

      return updated;
    });

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const handleUpdateSet = useCallback(
    (exerciseIndex: number, setIndex: number, field: keyof CompletedSet, value: any) => {
      setExercises((prev) => {
        const updated = [...prev];
        // Convert weight from display unit to kg for storage
        const finalValue = field === 'weight' && settings.weightUnit === 'lbs' 
          ? value / 2.20462 // Convert lbs to kg
          : value;
        updated[exerciseIndex].completedSets[setIndex] = {
          ...updated[exerciseIndex].completedSets[setIndex],
          [field]: finalValue,
          // Clear placeholder flags when user enters a value
          ...(field === 'reps' && { isRepsPlaceholder: false }),
          ...(field === 'weight' && { isWeightPlaceholder: false }),
        };
        return updated;
      });
    },
    [settings.weightUnit]
  );

  const handleToggleSetComplete = useCallback((exerciseIndex: number, setIndex: number) => {
    const base = exercises[exerciseIndex];
    if (!base) return;

    const shouldSyncSuperset = base.groupType === 'superset' && typeof base.groupId === 'string';
    const mateIndex = shouldSyncSuperset
      ? exercises.findIndex((ex, idx) => idx !== exerciseIndex && ex.groupType === 'superset' && ex.groupId === base.groupId)
      : -1;
    const mate = mateIndex >= 0 ? exercises[mateIndex] : undefined;

    const baseSet = base.completedSets[setIndex];
    const mateSet = mate?.completedSets[setIndex];
    if (!baseSet) return;

    const wasPairCompleted = mateSet ? (baseSet.completed && mateSet.completed) : baseSet.completed;
    const nextCompleted = mateSet ? !(baseSet.completed && mateSet.completed) : !baseSet.completed;
    const isCompleting = !wasPairCompleted && nextCompleted;

    setExercises((prev) => {
      const updated = [...prev];
      const basePrev = updated[exerciseIndex];
      if (!basePrev) return updated;
      const matePrevIndex = shouldSyncSuperset
        ? updated.findIndex((ex, idx) => idx !== exerciseIndex && ex.groupType === 'superset' && ex.groupId === basePrev.groupId)
        : -1;

      const updateOne = (idx: number) => {
        const ex = updated[idx];
        if (!ex) return;
        if (!ex.completedSets[setIndex]) return;
        const nextSets = ex.completedSets.map((s, sIdx) => sIdx === setIndex ? { ...s, completed: nextCompleted } : s);
        updated[idx] = { ...ex, completedSets: nextSets };
      };

      updateOne(exerciseIndex);
      if (matePrevIndex >= 0) updateOne(matePrevIndex);

      return updated;
    });

    if (isCompleting) {
      const restTime = base.restTimer ?? settings.defaultRestTime ?? 90;
      const timerEnabled = restTime > 0 && !disabledTimers.has(base.id) && (!mate || !disabledTimers.has(mate.id));
      if (timerEnabled) {
        const completedPairs = mate
          ? base.completedSets.reduce((count, s, i) => count + (s.completed && mate.completedSets[i]?.completed ? 1 : 0), 0) + 1
          : base.completedSets.filter(s => s.completed).length + 1;
        const label = mate ? `${base.name} + ${mate.name}` : base.name;
        startTimer(label, base.id, completedPairs, restTime);
      }
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [exercises, disabledTimers, settings.defaultRestTime, startTimer]);

  const handleRepsAdjust = useCallback((exerciseIndex: number, setIndex: number, delta: number) => {
    setExercises((prev) => {
      const updated = [...prev];
      const set = updated[exerciseIndex].completedSets[setIndex];
      const newReps = Math.max(0, (set.reps || 0) + delta);
      updated[exerciseIndex].completedSets[setIndex] = { ...set, reps: newReps };
      return updated;
    });
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const handleToggleSetType = useCallback((exerciseIndex: number, setIndex: number, newType: 'working' | 'warmup' | 'failure') => {
    setExercises((prev) => {
      const updated = [...prev];
      const set = updated[exerciseIndex].completedSets[setIndex];
      updated[exerciseIndex].completedSets[setIndex] = { ...set, setType: newType };
      return updated;
    });
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const handleUpdateRestTimer = useCallback((exerciseIndex: number, newDuration: number) => {
    setExercises((prev) => {
      const updated = [...prev];
      const base = updated[exerciseIndex];
      if (!base) return updated;

      const shouldSyncSuperset = base.groupType === 'superset' && typeof base.groupId === 'string';
      const mateIndex = shouldSyncSuperset
        ? updated.findIndex((ex, idx) => idx !== exerciseIndex && ex.groupType === 'superset' && ex.groupId === base.groupId)
        : -1;
      const indicesToUpdate = mateIndex >= 0 ? [exerciseIndex, mateIndex] : [exerciseIndex];

      indicesToUpdate.forEach((idx) => {
        updated[idx] = { ...updated[idx], restTimer: newDuration };
      });

      return updated;
    });
  }, []);

  const quickActionsMeta = useMemo(() => {
    if (exerciseQuickActionsIndex === null) return null;
    const ex = exercises[exerciseQuickActionsIndex];
    if (!ex) return null;
    const isSuperset = ex.groupType === 'superset' && typeof ex.groupId === 'string';
    const mate = isSuperset
      ? exercises.find((m, idx) => idx !== exerciseQuickActionsIndex && m.groupType === 'superset' && m.groupId === ex.groupId)
      : undefined;
    const restTimerSeconds = ex.restTimer ?? mate?.restTimer ?? settings.defaultRestTime ?? 90;
    const restTimerEnabled = isSuperset
      ? !disabledTimers.has(ex.id) && (!mate || !disabledTimers.has(mate.id))
      : !disabledTimers.has(ex.id);

    return {
      ex,
      mate,
      isSuperset,
      restTimerSeconds,
      restTimerEnabled,
    };
  }, [exerciseQuickActionsIndex, exercises, settings.defaultRestTime, disabledTimers]);

  const toggleRestTimerEnabledForIndex = useCallback((exerciseIndex: number) => {
    const base = exercises[exerciseIndex];
    if (!base) return;
    const isSuperset = base.groupType === 'superset' && typeof base.groupId === 'string';
    const mate = isSuperset
      ? exercises.find((m, idx) => idx !== exerciseIndex && m.groupType === 'superset' && m.groupId === base.groupId)
      : undefined;

    setDisabledTimers((prev) => {
      const next = new Set(prev);
      const ids = mate ? [base.id, mate.id] : [base.id];
      const groupEnabled = ids.every((id) => !next.has(id));
      if (groupEnabled) {
        ids.forEach((id) => next.add(id));
      } else {
        ids.forEach((id) => next.delete(id));
      }
      return next;
    });
  }, [exercises]);

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

  // Handle exercise creation from modal
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
    
    // Add to workout immediately
    // For bodyweight exercises, load user's current bodyweight
    const isBodyweight = exerciseData.type === 'bodyweight';
    let defaultWeight = 0;
    if (isBodyweight) {
      const bodyWeightLog = await BodyWeightStorage.getTodayWeight();
      if (bodyWeightLog) {
        // Convert to kg for internal calculations
        defaultWeight = bodyWeightLog.unit === 'lbs' ? lbsToKg(bodyWeightLog.weight) : bodyWeightLog.weight;
      }
    }
    
    const exerciseToAdd: WorkoutExercise = {
      id: generateId(),
      exerciseId: customExerciseId,
      name: exerciseData.name,
      sets: 0,
      reps: 0,
      unit: settings.weightUnit,
      type: exerciseData.type,
      primaryMuscle: exerciseData.primaryMuscle,
      secondaryMuscles: exerciseData.secondaryMuscles,
      completedSets: [],
      weight: defaultWeight, // Set default weight for bodyweight exercises
    };
    setExercises(prev => [...prev, exerciseToAdd]);
  }, [customExercises, addCustomExercise, settings.weightUnit]);



  const handleSaveAsNewTemplate = useCallback(async (workout: CompletedWorkout) => {
    Alert.prompt(
      'New Template Name',
      'Enter a name for this template:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async (templateName?: string) => {
            if (!templateName || !templateName.trim()) {
              Alert.alert('Error', 'Please enter a template name');
              return;
            }

            try {
              const templateExercises: Exercise[] = exercises.map((ex) => ({
                id: ex.id,
                exerciseId: ex.exerciseId,
                name: ex.name,
                sets: ex.completedSets.length,
                reps: ex.completedSets.length > 0 ? ex.completedSets[0].reps : 10,
                weight: ex.completedSets.length > 0 ? ex.completedSets[0].weight : undefined,
                unit: ex.completedSets.length > 0 ? ex.completedSets[0].unit : settings.weightUnit,
                type: ex.type,
                notes: ex.notes,
                restTimer: ex.restTimer || 180,
                timerEnabled: !disabledTimers.has(ex.id), // Save timer enabled/disabled state
                primaryMuscle: ex.primaryMuscle,
                secondaryMuscles: ex.secondaryMuscles,
              }));

              await addTemplate({
                id: generateId(),
                name: templateName.trim(),
                exercises: templateExercises,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              });

              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }

              Alert.alert('Success', 'Template saved successfully!');
              router.push({
                pathname: '/_hidden/workout-summary',
                params: {
                  workoutId: workout.id,
                  templateId: templateId || '',
                },
              });
            } catch (error) {
              Alert.alert('Error', 'Failed to save template');
            }
          },
        },
      ],
      'plain-text',
      workoutName
    );
  }, [exercises, settings.weightUnit, addTemplate, workoutName, router, templateId]);

  const handleUpdateTemplate = useCallback(async (workout: CompletedWorkout) => {
    if (!templateId || typeof templateId !== 'string') return;

    Alert.alert(
      'Update Template',
      `Update "${workoutName}" template with this workout's exercises, sets, weights, and reps?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: async () => {
            try {
              const template = templates.find((t) => t.id === templateId);
              if (!template) {
                Alert.alert('Error', 'Template not found');
                return;
              }

              const templateExercises: Exercise[] = exercises.map((ex) => ({
                id: ex.id,
                exerciseId: ex.exerciseId,
                name: ex.name,
                sets: ex.completedSets.length,
                reps: ex.completedSets.length > 0 ? ex.completedSets[0].reps : 10,
                weight: ex.completedSets.length > 0 ? ex.completedSets[0].weight : undefined,
                unit: ex.completedSets.length > 0 ? ex.completedSets[0].unit : settings.weightUnit,
                type: ex.type,
                notes: ex.notes,
                restTimer: ex.restTimer || 180,
                timerEnabled: !disabledTimers.has(ex.id), // Save timer enabled/disabled state
                primaryMuscle: ex.primaryMuscle,
                secondaryMuscles: ex.secondaryMuscles,
              }));

              await updateTemplate({
                ...template,
                exercises: templateExercises,
                updatedAt: Date.now(),
              });

              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }

              Alert.alert('Success', 'Template updated successfully!');
              router.push({
                pathname: '/_hidden/workout-summary',
                params: {
                  workoutId: workout.id,
                  templateId: templateId || '',
                },
              });
            } catch (error) {
              Alert.alert('Error', 'Failed to update template');
            }
          },
        },
      ]
    );
  }, [templateId, workoutName, templates, exercises, settings.weightUnit, updateTemplate, router]);

  const handleQuitWorkout = useCallback(() => {
    Alert.alert(
      'Discard Workout',
      'Are you sure you want to discard this workout? All progress will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }
            // Mark as finishing to prevent blur handler interference
            isFinishingWorkout.current = true;
            // Stop timer and clear workout state
            await stopTimer();
            await clearWorkoutActive();
            // Clear all workout state
            setExercises([]);
            setWorkoutName('');
            setIsInitialized(false);
            // Navigate to home - use push to ensure we don't exit the app
            router.push('/(tabs)');
          },
        },
      ]
    );
  }, [router, stopTimer, clearWorkoutActive]);

  const handlePRModalClose = useCallback(() => {
    setShowPRModal(false);
    
    if (!completedWorkout) {
      router.push('/_hidden/workout-summary');
      return;
    }
    
    // Show save-as-template dialog after PR modal
    // Navigate directly to workout summary (no template prompt)
    router.push({
      pathname: '/_hidden/workout-summary',
      params: {
        workoutId: completedWorkout.id,
        templateId: templateId || '',
      },
    });
  }, [router, completedWorkout, templateId]);

  const handleFinishWorkout = useCallback(async () => {
    // Show confirmation dialog first
    Alert.alert(
      'End Workout?',
      'Are you sure you want to finish this workout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Confirm',
          onPress: async () => {
            // Stop any running timer
            await stopTimer();

            // Check if there are any completed (checked) sets
            const hasCompletedSets = exercises.some((ex) => ex.completedSets.some((set) => set.completed));
            if (!hasCompletedSets) {
              Alert.alert('No Completed Sets', 'Please check off at least one set as complete before finishing');
              return;
            }

            // Continue with workout completion
            try {
              setIsLoading(true);

              // Get current body weight for bodyweight exercises
              const todayBodyWeight = await BodyWeightStorage.getTodayWeight();
              // Convert to kg for internal calculations
              const bodyWeightKg = todayBodyWeight 
                ? (todayBodyWeight.unit === 'lbs' ? lbsToKg(todayBodyWeight.weight) : todayBodyWeight.weight)
                : 70; // Default to 70kg if no body weight logged

              // Save ALL exercises (even with no completed sets) for template updates
              // Only completed sets are included in each exercise's sets array
              const completedExercises: CompletedExercise[] = exercises
                .map((ex) => {
                  // Get effective muscle data with customizations
                  const customEx = customExercises.find(ce => ce.name.toLowerCase() === ex.name.toLowerCase());
                  const muscleMeta = getEffectiveExerciseMuscles(
                    ex.name,
                    predefinedExerciseCustomizations,
                    !!customEx,
                    customEx
                  );

                  const finalPrimaryMuscle = muscleMeta?.primaryMuscle || ex.primaryMuscle;
                  const finalSecondaryMuscles = muscleMeta?.secondaryMuscles || ex.secondaryMuscles || [];
                  
                  // Only save contributions for the current primary and secondary muscles
                  // Filter out any old muscle contributions to prevent showing wrong muscles in analytics
                  const allCurrentMuscles = [finalPrimaryMuscle, ...finalSecondaryMuscles].filter(Boolean);
                  const filteredContributions = muscleMeta?.muscleContributions 
                    ? Object.fromEntries(
                        Object.entries(muscleMeta.muscleContributions).filter(([muscle]) => 
                          allCurrentMuscles.includes(muscle as MuscleGroup)
                        )
                      )
                    : undefined;

                  return {
                    id: ex.id,
                    exerciseId: ex.exerciseId,
                    name: ex.name,
                    // Preserve exercise metadata with customizations
                    type: ex.type,
                    groupType: ex.groupType,
                    groupId: ex.groupId,
                    groupPosition: ex.groupPosition,
                    primaryMuscle: finalPrimaryMuscle,
                    secondaryMuscles: finalSecondaryMuscles,
                    muscleContributions: filteredContributions,
                    restTimer: ex.restTimer,
                    timerEnabled: !disabledTimers.has(ex.id),
                    notes: ex.notes,
                    // Save sets with original weight values (don't transform)
                    // Volume calculations will apply the formulas when reading
                    sets: ex.completedSets,
                  };
                });
                // Note: We keep ALL exercises, even those with empty sets arrays
                // This allows "Update Template" to see all exercises
                // Volume/PR calculations will correctly handle empty sets arrays (result = 0)

              const workout: CompletedWorkout = {
                id: generateId(),
                templateId: templateId && typeof templateId === 'string' ? templateId : undefined,
                name: workoutName,
                startTime,
                endTime: Date.now(),
                exercises: completedExercises,
              };

              await addWorkout(workout);
              
              // Save failure sets to storage for rep max tracking
              for (const exercise of completedExercises) {
                const failureSets = exercise.sets.filter(s => s.setType === 'failure' && s.completed !== false);
                for (const failureSet of failureSets) {
                  // Convert weight to kg for consistent storage
                  const weightKg = settings.weightUnit === 'lbs' 
                    ? lbsToKg(failureSet.weight) 
                    : failureSet.weight;
                  
                  await FailureSetStorage.add(exercise.name, {
                    reps: failureSet.reps,
                    weight: weightKg,
                    timestamp: failureSet.timestamp || Date.now(),
                    workoutId: workout.id,
                  });
                }
              }
              
              // Mark that we're finishing the workout (prevents re-initialization)
              isFinishingWorkout.current = true;
              
              // Clear workout active state
              await clearWorkoutActive();
              // Reset local state to prevent re-activation
              setIsInitialized(false);
              setExercises([]);
              setWorkoutName('');

              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }

              setHasUnsavedChanges(false);
              // Detect PRs with bodyweight for proper volume calculation
              const prs = detectWorkoutPRs(workout, bodyWeightKg);
              if (prs.length > 0) {
                // Show PR celebration modal first
                setDetectedPRs(prs);
                setCompletedWorkout(workout);
                setShowPRModal(true);
                // Navigation will happen after user closes PR modal
                return;
              }
              
              // Navigate directly to workout summary (no template prompt)
              router.push({
                pathname: '/_hidden/workout-summary',
                params: {
                  workoutId: workout.id,
                  templateId: templateId || '',
                },
              });
            } catch (error) {
              Alert.alert('Error', 'Failed to save workout');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  }, [exercises, workoutName, startTime, templateId, addWorkout, router, stopTimer, settings.weightUnit, clearWorkoutActive, detectWorkoutPRs]);

  const renderSetRow = useCallback((exerciseIndex: number, set: CompletedSet, setIndex: number, exerciseType: ExerciseType) => {
    const unit = settings.weightUnit;
    const isBodyweight = exerciseType === 'bodyweight';
    const isAssistedBodyweight = exerciseType === 'assisted-bodyweight';
    const isWeightedBodyweight = exerciseType === 'weighted-bodyweight';
    const showWeightInput = !isBodyweight; // Show for weighted, assisted-bodyweight, and weighted-bodyweight
    const isWarmup = set.setType === 'warmup';
    const isFailure = set.setType === 'failure';
    const setTypeOpacity = isWarmup ? 0.7 : 1;
    return (
      <View key={setIndex} style={[styles.setRow, { borderBottomColor: colors.border, opacity: setTypeOpacity }]}>
        {/* Set number - tap to open menu */}
        <Pressable
          onPress={(event) => {
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            const { pageX, pageY } = event.nativeEvent;
            setSetMenuPosition({ x: pageX, y: pageY });
            setShowSetMenu({ exerciseIndex, setIndex });
            setSupersetPartnerIndex(null); // Not a superset
            setFailureSelectStep('main');
          }}
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flexDirection: 'row', alignItems: 'center', gap: 4 }]}
        >
          <Text style={[styles.setNumber, { 
            color: isWarmup 
              ? (colors.warning || '#F59E0B') 
              : isFailure 
                ? (colors.error || '#EF4444') 
                : colors.foreground 
          }]}>
            {isWarmup ? 'W' : isFailure ? 'F' : setIndex + 1}
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
                handleUpdateSet(exerciseIndex, setIndex, 'weight', displayValue);
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
          onChangeText={(val) => handleUpdateSet(exerciseIndex, setIndex, 'reps', parseInt(val, 10) || 0)}
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

        {/* Complete checkbox */}
        <Pressable
          onPress={() => handleToggleSetComplete(exerciseIndex, setIndex)}
          style={({ pressed }) => [
            styles.checkBtn,
            { 
              backgroundColor: set.completed ? colors.success : colors.surface,
              borderColor: set.completed ? colors.success : colors.border,
              opacity: pressed ? 0.6 : 1 
            }
          ]}
        >
          {set.completed && <Text style={{ color: colors.background, fontSize: 12, fontWeight: 'bold' }}>✓</Text>}
        </Pressable>
      </View>
    );
  }, [colors, settings.weightUnit, handleUpdateSet, handleDeleteSet, handleRepsAdjust, handleToggleSetComplete, setShowSetMenu, setSetMenuPosition]);

  const renderMiniSetRow = useCallback((
    exerciseIndex: number,
    set: CompletedSet,
    setIndex: number,
    exerciseType: ExerciseType,
    label: string,
    labelColor: string
  ) => {
    const isBodyweight = exerciseType === 'bodyweight';
    const showWeightInput = !isBodyweight;
    return (
      <View key={`${label}-${setIndex}`} style={[styles.setRow, { borderBottomColor: colors.border, paddingLeft: 0 }]}>
        <Text style={{ width: 18, color: labelColor, fontWeight: '800' }}>{label}</Text>

        {showWeightInput && (
          <>
            <TextInput
              value={set.isWeightPlaceholder ? '' : String(Math.round(convertWeight(set.weight || 0, settings.weightUnit)))}
              placeholder={String(Math.round(convertWeight(set.weight || 0, settings.weightUnit)))}
              placeholderTextColor={colors.muted}
              onChangeText={(val) => {
                const displayValue = parseFloat(val) || 0;
                handleUpdateSet(exerciseIndex, setIndex, 'weight', displayValue);
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
          onChangeText={(val) => handleUpdateSet(exerciseIndex, setIndex, 'reps', parseInt(val, 10) || 0)}
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

  const renderExercisePickerItem = useCallback(({ item }: { item: { name: string; primaryMuscle?: string } }) => (
    <Pressable
      onPress={() => handleAddExerciseToWorkout(item.name)}
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
  ), [colors, handleAddExerciseToWorkout]);

  return (
    <ScreenContainer className="p-4" edges={["top", "left", "right", "bottom"]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          // Ensure the last buttons can scroll above the absolute RestTimerPopup + safe-area.
          paddingBottom: 20 + Math.max(insets.bottom, 0) + 140,
        }}
        showsVerticalScrollIndicator={true}
      >
        <View className="gap-3 pb-6">
          {/* Header */}
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-1">
              <View className="flex-row items-center gap-3">
                <Text className="text-2xl font-bold text-foreground">{workoutName}</Text>
                <Text className="text-lg text-muted">
                  {(() => {
                    const totalVolume = exercises.reduce((sum, ex) => {
                      return sum + calculateExerciseVolume(
                        ex.completedSets,
                        ex.type || 'weighted',
                        currentBodyweight
                      );
                    }, 0);
                    return `${Math.round(convertWeight(totalVolume, settings.weightUnit))} ${settings.weightUnit}`;
                  })()}
                </Text>
              </View>
              <Text className="text-lg text-primary font-semibold mt-1">
                {formatTime(elapsedTime * 1000)}
              </Text>
            </View>
            <Pressable
              onPress={handleQuitWorkout}
              style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
            >
              <IconSymbol size={24} name="xmark.circle.fill" color={colors.error} />
            </Pressable>
          </View>

          {/* Exercises List */}
          {exercises.length > 0 ? (
            <View className="gap-3">
              {displayItems.map((displayItem, displayIndex) => {
                const reorderLayout = Platform.OS === 'web' ? undefined : LinearTransition.duration(120);
                const isCollapsed = collapsedDisplayKeys.has(displayItem.key);
                if (displayItem.kind === 'single') {
                  const exerciseIndex = displayItem.indices[0];
                  const exercise = exercises[exerciseIndex];
                  if (!exercise) return null;

                  return (
                    <Animated.View key={displayItem.key} layout={reorderLayout}>
                      <Card>
                        <CardHeader className="pb-2">
                          <View className="flex-row items-center justify-between">
                            {/* Reorder Arrows */}
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
                              <View className="flex-row items-center gap-2">
                                <Pressable
                                  onPress={() => openExerciseQuickActions(exerciseIndex)}
                                  hitSlop={8}
                                  style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                                >
                                  <CardTitle className="text-base">{exercise.name}</CardTitle>
                                </Pressable>
                                {(() => {
                                  const completedVolume = calculateExerciseVolume(
                                    exercise.completedSets,
                                    exercise.type || 'weighted',
                                    currentBodyweight
                                  );
                                  const targetVolume =
                                    exercise.plannedSets && exercise.plannedSets.length > 0
                                      ? calculateTemplateExerciseVolume(
                                          exercise.plannedSets,
                                          exercise.type || 'weighted',
                                          currentBodyweight
                                        )
                                      : 0;

                                  if (targetVolume > 0) {
                                    const completedDisplay = Math.round(convertWeight(completedVolume, settings.weightUnit));
                                    const targetDisplay = Math.round(convertWeight(targetVolume, settings.weightUnit));
                                    const volumeColor =
                                      completedDisplay < targetDisplay
                                        ? colors.error
                                        : completedDisplay === targetDisplay
                                          ? colors.warning
                                          : colors.success;
                                    return (
                                      <Text className="text-sm" style={{ color: volumeColor }}>
                                        {`${completedDisplay}/${targetDisplay}${settings.weightUnit}`}
                                      </Text>
                                    );
                                  }

                                  return (
                                    <Text className="text-sm" style={{ color: colors.muted }}>
                                      {`${Math.round(convertWeight(completedVolume, settings.weightUnit))} ${settings.weightUnit}`}
                                    </Text>
                                  );
                                })()}
                              </View>
                              <View className="flex-row items-center gap-2 flex-wrap">
                                {(() => {
                                  const prData = getExercisePRData(exercise.name, currentBodyweight, exercise.type);
                                  const isBodyweight = exercise.type === 'bodyweight';
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
                                      {exercise.type === 'doubled' && (
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
                            <Pressable
                              onPress={() => toggleCollapsedDisplayKey(displayItem.key)}
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
                          <CardContent className="gap-2">
                            {exercise.completedSets.map((set, setIndex) => renderSetRow(exerciseIndex, set, setIndex, exercise.type))}

                            <Button size="sm" onPress={() => handleAddSet(exerciseIndex)} className="w-full mt-2">
                              <Text className="text-sm font-semibold text-background">+ Add Set</Text>
                            </Button>
                          </CardContent>
                        )}
                      </Card>
                    </Animated.View>
                  );
                }

                // Superset
                const [aIndex, bIndex] = displayItem.indices;
                const exA = exercises[aIndex];
                const exB = exercises[bIndex];
                if (!exA || !exB) return null;

                const maxSetCount = Math.max(exA.completedSets.length, exB.completedSets.length);
                const totalVolume =
                  calculateExerciseVolume(exA.completedSets, exA.type || 'weighted', currentBodyweight) +
                  calculateExerciseVolume(exB.completedSets, exB.type || 'weighted', currentBodyweight);

                return (
                  <Animated.View key={displayItem.key} layout={reorderLayout}>
                    <Card>
                      <CardHeader className="pb-1">
                        <View className="flex-row items-start justify-between">
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
                            <View className="flex-row items-center gap-1 flex-wrap">
                              <Text style={{ color: '#3B82F6', fontWeight: '800' }}>A</Text>
                              <Pressable
                                onPress={() => openExerciseQuickActions(aIndex)}
                                hitSlop={8}
                                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                              >
                                <CardTitle className="text-base">{exA.name}</CardTitle>
                              </Pressable>
                              {(() => {
                                const completedVolume = calculateExerciseVolume(
                                  exA.completedSets,
                                  exA.type || 'weighted',
                                  currentBodyweight
                                );
                                const targetVolume =
                                  exA.plannedSets && exA.plannedSets.length > 0
                                    ? calculateTemplateExerciseVolume(
                                        exA.plannedSets,
                                        exA.type || 'weighted',
                                        currentBodyweight
                                      )
                                    : 0;

                                if (targetVolume > 0) {
                                  const completedDisplay = Math.round(convertWeight(completedVolume, settings.weightUnit));
                                  const targetDisplay = Math.round(convertWeight(targetVolume, settings.weightUnit));
                                  const volumeColor =
                                    completedDisplay < targetDisplay
                                      ? colors.error
                                      : completedDisplay === targetDisplay
                                        ? colors.warning
                                        : colors.success;
                                  return (
                                    <Text
                                      className="text-sm"
                                      style={{ color: volumeColor }}
                                    >
                                      {`${completedDisplay}/${targetDisplay}${settings.weightUnit}`}
                                    </Text>
                                  );
                                }

                                return (
                                  <Text className="text-sm text-muted">
                                    {`${Math.round(convertWeight(completedVolume, settings.weightUnit))} ${settings.weightUnit}`}
                                  </Text>
                                );
                              })()}
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

                          <View className="flex-row items-center gap-1 flex-wrap" style={{ marginTop: 1 }}>
                            <Text style={{ color: '#F59E0B', fontWeight: '800' }}>B</Text>
                            <Pressable
                              onPress={() => openExerciseQuickActions(bIndex)}
                              hitSlop={8}
                              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                            >
                              <CardTitle className="text-base">{exB.name}</CardTitle>
                            </Pressable>
                            {(() => {
                              const completedVolume = calculateExerciseVolume(
                                exB.completedSets,
                                exB.type || 'weighted',
                                currentBodyweight
                              );
                              const targetVolume =
                                exB.plannedSets && exB.plannedSets.length > 0
                                  ? calculateTemplateExerciseVolume(
                                      exB.plannedSets,
                                      exB.type || 'weighted',
                                      currentBodyweight
                                    )
                                  : 0;

                              if (targetVolume > 0) {
                                const completedDisplay = Math.round(convertWeight(completedVolume, settings.weightUnit));
                                const targetDisplay = Math.round(convertWeight(targetVolume, settings.weightUnit));
                                const volumeColor =
                                  completedDisplay < targetDisplay
                                    ? colors.error
                                    : completedDisplay === targetDisplay
                                      ? colors.warning
                                      : colors.success;
                                return (
                                  <Text
                                    className="text-sm"
                                    style={{ color: volumeColor }}
                                  >
                                    {`${completedDisplay}/${targetDisplay}${settings.weightUnit}`}
                                  </Text>
                                );
                              }

                              return (
                                <Text className="text-sm text-muted">
                                  {`${Math.round(convertWeight(completedVolume, settings.weightUnit))} ${settings.weightUnit}`}
                                </Text>
                              );
                            })()}
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

                          <Pressable
                            onPress={() => toggleCollapsedDisplayKey(displayItem.key)}
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
                    <CardContent className="gap-2">
                      {maxSetCount > 0 ? (
                        <View className="gap-2">
                          {Array.from({ length: maxSetCount }).map((_, setIndex) => {
                            const setA = exA.completedSets[setIndex];
                            const setB = exB.completedSets[setIndex];
                            if (!setA || !setB) {
                              return (
                                <View key={setIndex} style={{ paddingVertical: 8 }}>
                                  <Text style={{ color: '#EF4444', fontSize: 12 }}>
                                    Superset sets are out of sync. Add/remove a set to re-sync.
                                  </Text>
                                </View>
                              );
                            }

                            const pairCompleted = setA.completed && setB.completed;

                            return (
                              <View key={setIndex} style={{ gap: 6 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <Pressable
                                    onPress={(event) => {
                                      if (Platform.OS !== 'web') {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                      }
                                      const { pageX, pageY } = event.nativeEvent;
                                      setSetMenuPosition({ x: pageX, y: pageY });
                                      setShowSetMenu({ exerciseIndex: aIndex, setIndex });
                                      setSupersetPartnerIndex(bIndex); // Store the partner index for superset
                                      setFailureSelectStep('main');
                                    }}
                                    style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                                  >
                                    <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>Set {setIndex + 1}</Text>
                                  </Pressable>

                                  <Pressable
                                    onPress={() => handleToggleSetComplete(aIndex, setIndex)}
                                    style={({ pressed }) => [
                                      styles.checkBtn,
                                      {
                                        backgroundColor: pairCompleted ? colors.success : colors.surface,
                                        borderColor: pairCompleted ? colors.success : colors.border,
                                        opacity: pressed ? 0.6 : 1,
                                      },
                                    ]}
                                  >
                                    {pairCompleted && <Text style={{ color: colors.background, fontSize: 12, fontWeight: 'bold' }}>✓</Text>}
                                  </Pressable>
                                </View>

                                {renderMiniSetRow(aIndex, setA, setIndex, exA.type, 'A', '#3B82F6')}
                                {renderMiniSetRow(bIndex, setB, setIndex, exB.type, 'B', '#F59E0B')}
                              </View>
                            );
                          })}
                        </View>
                      ) : (
                        <Text className="text-xs text-muted text-center py-2">No sets added yet</Text>
                      )}

                      <Button size="sm" onPress={() => handleAddSet(aIndex)} className="w-full mt-2">
                        <Text className="text-sm font-semibold text-background">+ Add Set</Text>
                      </Button>
                    </CardContent>
                    )}
                  </Card>
                  </Animated.View>
                );
              })}
            </View>
          ) : (
            <View className="items-center justify-center py-8">
              <Text className="text-muted">No exercises added yet</Text>
            </View>
          )}

          {/* Bottom actions (inside scroll; not pinned) */}
          <View style={{ gap: 12, marginTop: 4 }}>
            <View className="flex-row gap-3">
              <Button size="lg" onPress={() => setShowExercisePicker(true)} containerClassName="flex-1" className="w-full">
                <Text className="text-base font-semibold text-background">+ Add Exercise</Text>
              </Button>
              <Button size="lg" onPress={() => setShowSupersetModal(true)} containerClassName="flex-1" className="w-full">
                <Text className="text-base font-semibold text-background">+ Add Superset</Text>
              </Button>
            </View>

            <Button
              size="lg"
              onPress={handleFinishWorkout}
              disabled={isLoading || exercises.every((ex) => ex.completedSets.length === 0)}
              containerClassName="w-full"
              className="w-full"
            >
              <Text className="text-base font-semibold text-background">
                {isLoading ? 'Saving...' : 'Finish Workout'}
              </Text>
            </Button>
          </View>
        </View>
      </ScrollView>

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
              onSelectExercise={handleAddExerciseToWorkout}
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
        defaultRestTimeSeconds={settings.defaultRestTime ?? 180}
        onSubmit={handleSubmitSuperset}
        onCreateNewExercise={() => {
          setShowSupersetModal(false);
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

      {/* Set Menu Modal */}
      <Modal visible={showSetMenu !== null} transparent animationType="fade">
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
          onPress={() => {
            setShowSetMenu(null);
            setSetMenuPosition(null);
            setFailureSelectStep('main');
            setSupersetPartnerIndex(null);
          }}
        >
          <Pressable 
            style={{
              position: 'absolute',
              top: setMenuPosition?.y || 100,
              left: Math.min(setMenuPosition?.x || 100, 300),
              backgroundColor: colors.background,
              borderRadius: 12,
              padding: 8,
              minWidth: 220,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 4,
              elevation: 5,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            {failureSelectStep === 'main' ? (
              <>
                {/* Set Type Options */}
                {(() => {
                  const currentSetType = showSetMenu 
                    ? (exercises[showSetMenu.exerciseIndex]?.completedSets[showSetMenu.setIndex]?.setType || 'working')
                    : 'working';
                  
                  const options: { type: 'working' | 'warmup' | 'failure'; label: string; icon: string }[] = [
                    { type: 'working', label: 'Working Set', icon: '💪' },
                    { type: 'warmup', label: 'Warmup Set', icon: '🔥' },
                    { type: 'failure', label: 'Failure Set', icon: '🎯' },
                  ];
                  
                  return options.map((option) => (
                    <Pressable
                      key={option.type}
                      onPress={() => {
                        if (showSetMenu) {
                          // For failure sets in a superset, show secondary selection
                          if (option.type === 'failure' && supersetPartnerIndex !== null) {
                            setFailureSelectStep('selectExercise');
                            return;
                          }
                          handleToggleSetType(showSetMenu.exerciseIndex, showSetMenu.setIndex, option.type);
                          setShowSetMenu(null);
                          setSetMenuPosition(null);
                          setFailureSelectStep('main');
                          setSupersetPartnerIndex(null);
                        }
                      }}
                      style={({ pressed }) => [{
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        backgroundColor: currentSetType === option.type 
                          ? colors.primary + '20' 
                          : pressed 
                            ? colors.surface 
                            : colors.background,
                        borderRadius: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                      }]}
                    >
                      <Text style={{ fontSize: 16 }}>{option.icon}</Text>
                      <Text style={{ 
                        color: currentSetType === option.type ? colors.primary : colors.foreground, 
                        fontSize: 16,
                        fontWeight: currentSetType === option.type ? '600' : '400',
                      }}>
                        {option.label}
                      </Text>
                      {currentSetType === option.type && (
                        <Text style={{ color: colors.primary, marginLeft: 'auto' }}>✓</Text>
                      )}
                      {/* Show arrow for superset failure option */}
                      {option.type === 'failure' && supersetPartnerIndex !== null && (
                        <Text style={{ color: colors.muted, marginLeft: 'auto' }}>›</Text>
                      )}
                    </Pressable>
                  ));
                })()}
                
                <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
                
                {/* Remove Set */}
                <Pressable
                  onPress={() => {
                    if (showSetMenu) {
                      handleDeleteSet(showSetMenu.exerciseIndex, showSetMenu.setIndex);
                      setShowSetMenu(null);
                      setSetMenuPosition(null);
                      setFailureSelectStep('main');
                      setSupersetPartnerIndex(null);
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
              </>
            ) : (
              /* Failure Exercise Selection for Superset */
              <>
                <View style={{ paddingVertical: 8, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 4 }}>
                  <Pressable
                    onPress={() => setFailureSelectStep('main')}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  >
                    <Text style={{ color: colors.muted, fontSize: 14 }}>‹ Back</Text>
                  </Pressable>
                  <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: '600', marginTop: 4 }}>
                    Mark as Failure:
                  </Text>
                </View>
                
                {showSetMenu && supersetPartnerIndex !== null && (() => {
                  const exA = exercises[showSetMenu.exerciseIndex];
                  const exB = exercises[supersetPartnerIndex];
                  const setIndex = showSetMenu.setIndex;
                  const setAType = exA?.completedSets[setIndex]?.setType || 'working';
                  const setBType = exB?.completedSets[setIndex]?.setType || 'working';
                  
                  return (
                    <>
                      {/* Exercise A option */}
                      <Pressable
                        onPress={() => {
                          handleToggleSetType(showSetMenu.exerciseIndex, setIndex, setAType === 'failure' ? 'working' : 'failure');
                          if (Platform.OS !== 'web') {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          }
                        }}
                        style={({ pressed }) => [{
                          paddingVertical: 12,
                          paddingHorizontal: 16,
                          backgroundColor: setAType === 'failure' 
                            ? (colors.error || '#EF4444') + '20' 
                            : pressed 
                              ? colors.surface 
                              : colors.background,
                          borderRadius: 8,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                        }]}
                      >
                        <Text style={{ color: '#3B82F6', fontWeight: '800', fontSize: 14 }}>A</Text>
                        <Text style={{ 
                          color: setAType === 'failure' ? (colors.error || '#EF4444') : colors.foreground, 
                          fontSize: 15,
                          fontWeight: setAType === 'failure' ? '600' : '400',
                          flex: 1,
                        }} numberOfLines={1}>
                          {exA?.name || 'Exercise A'}
                        </Text>
                        {setAType === 'failure' && (
                          <Text style={{ color: colors.error || '#EF4444' }}>✓</Text>
                        )}
                      </Pressable>
                      
                      {/* Exercise B option */}
                      <Pressable
                        onPress={() => {
                          handleToggleSetType(supersetPartnerIndex, setIndex, setBType === 'failure' ? 'working' : 'failure');
                          if (Platform.OS !== 'web') {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          }
                        }}
                        style={({ pressed }) => [{
                          paddingVertical: 12,
                          paddingHorizontal: 16,
                          backgroundColor: setBType === 'failure' 
                            ? (colors.error || '#EF4444') + '20' 
                            : pressed 
                              ? colors.surface 
                              : colors.background,
                          borderRadius: 8,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                        }]}
                      >
                        <Text style={{ color: '#F59E0B', fontWeight: '800', fontSize: 14 }}>B</Text>
                        <Text style={{ 
                          color: setBType === 'failure' ? (colors.error || '#EF4444') : colors.foreground, 
                          fontSize: 15,
                          fontWeight: setBType === 'failure' ? '600' : '400',
                          flex: 1,
                        }} numberOfLines={1}>
                          {exB?.name || 'Exercise B'}
                        </Text>
                        {setBType === 'failure' && (
                          <Text style={{ color: colors.error || '#EF4444' }}>✓</Text>
                        )}
                      </Pressable>
                      
                      <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
                      
                      {/* Done button */}
                      <Pressable
                        onPress={() => {
                          setShowSetMenu(null);
                          setSetMenuPosition(null);
                          setFailureSelectStep('main');
                          setSupersetPartnerIndex(null);
                        }}
                        style={({ pressed }) => [{
                          paddingVertical: 12,
                          paddingHorizontal: 16,
                          backgroundColor: colors.primary,
                          borderRadius: 8,
                          alignItems: 'center',
                          opacity: pressed ? 0.8 : 1,
                        }]}
                      >
                        <Text style={{ color: colors.background, fontSize: 15, fontWeight: '600' }}>Done</Text>
                      </Pressable>
                    </>
                  );
                })()}
              </>
            )}
          </Pressable>
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
                  setReplacingExerciseIndex(null);
                  setExerciseSearch('');
                }}
                style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
              >
                <IconSymbol size={24} name="xmark.circle.fill" color={colors.muted} />
              </Pressable>
            </View>

            <GroupedExercisePicker
              exercises={filteredExercises}
              searchQuery={exerciseSearch}
              onSearchChange={setExerciseSearch}
              onSelectExercise={(exerciseName) => {
                if (replacingExerciseIndex !== null) {
                  handleReplaceExercise(replacingExerciseIndex, exerciseName);
                  setShowReplaceExercisePicker(false);
                  setReplacingExerciseIndex(null);
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

      {/* Merge Superset Modal */}
      <MergeSupersetModal
        visible={showMergeSupersetModal}
        onClose={() => {
          setShowMergeSupersetModal(false);
          setMergeSupersetSourceIndex(null);
        }}
        sourceExercise={mergeSupersetSourceExercise}
        availableExercises={availableExercisesForMerge}
        allExercises={allExercises}
        defaultRestTimeSeconds={settings.defaultRestTime ?? 90}
        onSelectExisting={(targetIndex, restTimeSeconds) => {
          handleMergeWithExisting(targetIndex, restTimeSeconds);
          setShowMergeSupersetModal(false);
          setMergeSupersetSourceIndex(null);
        }}
        onAddNewExercise={async (exerciseName, restTimeSeconds) => {
          await handleMergeWithNewExercise(exerciseName, restTimeSeconds);
          setShowMergeSupersetModal(false);
          setMergeSupersetSourceIndex(null);
        }}
        onCreateNewExercise={() => {
          setShowMergeSupersetModal(false);
          setShowCreateExercise(true);
        }}
      />

      {/* PR Celebration Modal */}
      <PRCelebrationModal
        visible={showPRModal}
        onClose={handlePRModalClose}
        prs={detectedPRs}
      />

      <ExerciseQuickActionsSheet
        visible={showExerciseQuickActions}
        exerciseName={exerciseQuickActionsName}
        restTimeSeconds={quickActionsMeta?.restTimerSeconds}
        defaultRestTimeSeconds={settings.defaultRestTime ?? 90}
        restTimerEnabled={quickActionsMeta?.restTimerEnabled}
        isInSuperset={quickActionsMeta?.isSuperset}
        onClose={() => {
          setShowExerciseQuickActions(false);
          setExerciseQuickActionsName(null);
          setExerciseQuickActionsIndex(null);
        }}
        onSeeDetails={(name) => {
          openExerciseDetails(name);
        }}
        onSyncToLastSession={() => {
          if (exerciseQuickActionsIndex === null) return;
          syncExerciseToLastSession(exerciseQuickActionsIndex);
        }}
        onReplaceExercise={() => {
          if (exerciseQuickActionsIndex === null) return;
          setReplacingExerciseIndex(exerciseQuickActionsIndex);
          setShowReplaceExercisePicker(true);
        }}
        onRemoveExercise={() => {
          if (exerciseQuickActionsIndex === null) return;
          handleDeleteExercise(exerciseQuickActionsIndex);
        }}
        onChangeRestTimeSeconds={(seconds) => {
          if (exerciseQuickActionsIndex === null) return;
          handleUpdateRestTimer(exerciseQuickActionsIndex, seconds);
        }}
        onToggleRestTimerEnabled={() => {
          if (exerciseQuickActionsIndex === null) return;
          toggleRestTimerEnabledForIndex(exerciseQuickActionsIndex);
        }}
        onAddToSuperset={() => {
          if (exerciseQuickActionsIndex === null) return;
          handleAddToSuperset(exerciseQuickActionsIndex);
        }}
        onSplitSuperset={() => {
          if (exerciseQuickActionsIndex === null) return;
          handleSplitSuperset(exerciseQuickActionsIndex);
        }}
      />

      <ExerciseDetailModal
        visible={showExerciseDetailsModal}
        exerciseName={exerciseDetailsName}
        onClose={() => {
          setShowExerciseDetailsModal(false);
        }}
      />

      {/* Global Rest Timer Popup */}
      <RestTimerPopup />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
  checkBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1,
  },
  deleteBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
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
