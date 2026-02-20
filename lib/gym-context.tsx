/**
 * Global context for gym tracker app state
 */

import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef, useState } from 'react';
import { AppState, Vibration, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  WorkoutTemplate,
  CompletedWorkout,
  AppSettings,
  WeightUnit,
  ExerciseMetadata,
  Exercise,
  CompletedSet,
  ExerciseType,
  WeekPlan,
} from './types';
import { calculateSetVolume } from './volume-calculation';
import { generateId, TemplateStorage, WeekPlanStorage, WorkoutStorage, SettingsStorage, CustomExerciseStorage, PredefinedExerciseCustomizationStorage, BodyWeightStorage, ActiveWorkoutStorage, STORAGE_KEYS } from './storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { runMuscleGroupMigration } from './migrate-muscle-groups';
import { runExerciseIdMigration } from './exercise-id-migration';
import { runDeltoidSplitMigration } from './deltoid-split-migration';

// WorkoutExercise type for active workout
interface WorkoutExercise extends Exercise {
  completedSets: CompletedSet[];
  /** Snapshot of the original template-configured set prescription (used for target volume). */
  plannedSets?: CompletedSet[];
}

// Timer state interface
export interface RestTimerState {
  isRunning: boolean;
  remainingSeconds: number;
  totalSeconds: number;
  exerciseName: string;
  setNumber: number;
  exerciseId: string;
  endTime: number | null; // Timestamp when timer should end (for background support)
}

interface GymContextState {
  templates: WorkoutTemplate[];
  weekPlans: WeekPlan[];
  activeWeekPlanId: string | null;
  workouts: CompletedWorkout[];
  settings: AppSettings;
  customExercises: ExerciseMetadata[];
  predefinedExerciseCustomizations: Record<string, { primaryMuscle?: any; secondaryMuscles?: any[]; muscleContributions?: Record<string, number>; exerciseType?: ExerciseType; type?: ExerciseType }>;
  isLoading: boolean;
  error: string | null;
  // Active workout session state
  isWorkoutActive: boolean;
  activeWorkoutName: string | null;
  activeWorkoutStartTime: number | null;
  activeWorkoutTemplateId?: string | null;
  activeWorkoutTemplateName?: string | null;
  // Active workout data (persists across navigation)
  activeWorkoutExercises: WorkoutExercise[];
  activeWorkoutBodyweight: number;
  activeWorkoutDisabledTimers: Set<string>;
  activeWorkoutCollapsedDisplayKeys: Set<string>;
}

type GymContextAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_TEMPLATES'; payload: WorkoutTemplate[] }
  | { type: 'SET_WEEK_PLANS'; payload: WeekPlan[] }
  | { type: 'SET_ACTIVE_WEEK_PLAN_ID'; payload: string | null }
  | { type: 'SET_WORKOUTS'; payload: CompletedWorkout[] }
  | { type: 'SET_SETTINGS'; payload: AppSettings }
  | { type: 'SET_CUSTOM_EXERCISES'; payload: ExerciseMetadata[] }
  | { type: 'SET_PREDEFINED_EXERCISE_CUSTOMIZATIONS'; payload: Record<string, { primaryMuscle?: any; secondaryMuscles?: any[]; muscleContributions?: Record<string, number>; exerciseType?: ExerciseType; type?: ExerciseType }> }
  | { type: 'ADD_TEMPLATE'; payload: WorkoutTemplate }
  | { type: 'ADD_WEEK_PLAN'; payload: WeekPlan }
  | { type: 'UPDATE_WEEK_PLAN'; payload: WeekPlan }
  | { type: 'DELETE_WEEK_PLAN'; payload: string }
  | { type: 'UPDATE_TEMPLATE'; payload: WorkoutTemplate }
  | { type: 'DELETE_TEMPLATE'; payload: string }
  | { type: 'ADD_WORKOUT'; payload: CompletedWorkout }
  | { type: 'UPDATE_WORKOUT'; payload: CompletedWorkout }
  | { type: 'DELETE_WORKOUT'; payload: string }
  | { type: 'ADD_CUSTOM_EXERCISE'; payload: ExerciseMetadata }
  | { type: 'DELETE_CUSTOM_EXERCISE'; payload: string }
  | { type: 'SET_WORKOUT_ACTIVE'; payload: { name: string; startTime: number; templateId?: string; templateName?: string } }
  | { type: 'CLEAR_WORKOUT_ACTIVE' }
  | {
      type: 'UPDATE_ACTIVE_WORKOUT_DATA';
      payload: {
        exercises: WorkoutExercise[];
        bodyweight: number;
        disabledTimers: Set<string>;
        collapsedDisplayKeys?: Set<string>;
      };
    };

interface GymContextValue extends GymContextState {
  // Template operations
  addTemplate: (template: WorkoutTemplate) => Promise<void>;
  updateTemplate: (template: WorkoutTemplate) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  duplicateTemplate: (id: string) => Promise<WorkoutTemplate | null>;
  reorderTemplates: (templates: WorkoutTemplate[]) => Promise<void>;

  // Week plan operations
  addWeekPlan: (plan: WeekPlan) => Promise<void>;
  updateWeekPlan: (plan: WeekPlan) => Promise<void>;
  deleteWeekPlan: (id: string) => Promise<void>;
  reorderWeekPlans: (plans: WeekPlan[]) => Promise<void>;
  setActiveWeekPlan: (id: string | null) => Promise<void>;

  // Workout operations
  addWorkout: (workout: CompletedWorkout) => Promise<void>;
  updateWorkout: (workout: CompletedWorkout) => Promise<void>;
  deleteWorkout: (id: string) => Promise<void>;
  getTodayWorkouts: () => Promise<CompletedWorkout[]>;
  getWorkoutById: (id: string) => Promise<CompletedWorkout | null>;

  // Settings operations
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
  setWeightUnit: (unit: WeightUnit) => Promise<void>;

  // Custom exercise operations
  addCustomExercise: (exercise: ExerciseMetadata) => Promise<void>;
  updateCustomExercise: (oldName: string, exercise: ExerciseMetadata) => Promise<void>;
  deleteCustomExercise: (name: string) => Promise<void>;

  // Predefined exercise customization operations
  updatePredefinedExerciseCustomization: (exerciseName: string, customization: { primaryMuscle?: any; secondaryMuscles?: any[]; muscleContributions?: Record<string, number>; exerciseType?: ExerciseType; type?: ExerciseType }) => Promise<void>;
  deletePredefinedExerciseCustomization: (exerciseName: string) => Promise<void>;

  // Rest timer operations
  timerState: RestTimerState;
  startTimer: (exerciseName: string, exerciseId: string, setNumber: number, durationSeconds: number) => Promise<void>;
  stopTimer: () => Promise<void>;
  adjustTimer: (secondsToAdd: number) => void;

  // Workout session operations
  setWorkoutActive: (name: string, startTime: number, templateId?: string, templateName?: string) => void;
  clearWorkoutActive: () => Promise<void>;
  updateActiveWorkoutData: (exercises: WorkoutExercise[], bodyweight: number, disabledTimers: Set<string>, collapsedDisplayKeys?: Set<string>) => void;

  // Utility
  refreshData: () => Promise<void>;
  getMostRecentExerciseData: (exerciseName: string) => Promise<{ reps: number; weight: number } | null>;
  getExercisePRData: (exerciseName: string, bodyWeight?: number, exerciseType?: ExerciseType) => { prWeight: number; prReps: number; estimated1RM: number; bestSetWeight: number; bestSetReps: number };
  detectWorkoutPRs: (workout: CompletedWorkout, bodyWeight?: number) => Array<{ exerciseName: string; prType: 'heaviest_weight' | 'highest_volume'; value: number }>;
}

const GymContext = createContext<GymContextValue | undefined>(undefined);

const initialState: GymContextState = {
  templates: [],
  weekPlans: [],
  activeWeekPlanId: null,
  workouts: [],
  settings: {
    weightUnit: 'kg',
    theme: 'auto',
    defaultRestTime: 90, // Default 90 seconds rest time
    bodyMapGender: 'male', // Default to male body map
    weekStartDay: 1, // Default Monday (0 = Sunday, 1 = Monday, etc.)
    showQuotes: true, // Show inspirational quotes by default
    lastUpdated: Date.now(),
  },
  customExercises: [],
  predefinedExerciseCustomizations: {},
  isLoading: true,
  activeWorkoutExercises: [],
  activeWorkoutBodyweight: 70,
  activeWorkoutDisabledTimers: new Set(),
  activeWorkoutCollapsedDisplayKeys: new Set(),
  error: null,
  isWorkoutActive: false,
  activeWorkoutName: null,
  activeWorkoutStartTime: null,
  activeWorkoutTemplateId: null,
  activeWorkoutTemplateName: null,
};

function gymReducer(state: GymContextState, action: GymContextAction): GymContextState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_TEMPLATES':
      return { ...state, templates: action.payload };
    case 'SET_WEEK_PLANS':
      return { ...state, weekPlans: action.payload };
    case 'SET_ACTIVE_WEEK_PLAN_ID':
      return { ...state, activeWeekPlanId: action.payload };
    case 'SET_WORKOUTS':
      return { ...state, workouts: action.payload };
    case 'SET_SETTINGS':
      return { ...state, settings: action.payload };
    case 'SET_CUSTOM_EXERCISES':
      return { ...state, customExercises: action.payload };
    case 'ADD_CUSTOM_EXERCISE':
      return { ...state, customExercises: [...state.customExercises, action.payload] };
    case 'DELETE_CUSTOM_EXERCISE':
      return {
        ...state,
        customExercises: state.customExercises.filter((ex) => ex.name !== action.payload),
      };
    case 'SET_PREDEFINED_EXERCISE_CUSTOMIZATIONS':
      return { ...state, predefinedExerciseCustomizations: action.payload };
    case 'ADD_TEMPLATE':
      return { ...state, templates: [...state.templates, action.payload] };
    case 'ADD_WEEK_PLAN':
      return { ...state, weekPlans: [...state.weekPlans, action.payload] };
    case 'UPDATE_WEEK_PLAN':
      return {
        ...state,
        weekPlans: state.weekPlans.map((p) => (p.id === action.payload.id ? action.payload : p)),
      };
    case 'DELETE_WEEK_PLAN':
      return {
        ...state,
        weekPlans: state.weekPlans.filter((p) => p.id !== action.payload),
        activeWeekPlanId: state.activeWeekPlanId === action.payload ? null : state.activeWeekPlanId,
      };
    case 'UPDATE_TEMPLATE':
      return {
        ...state,
        templates: state.templates.map((t) =>
          t.id === action.payload.id ? action.payload : t
        ),
      };
    case 'DELETE_TEMPLATE':
      return {
        ...state,
        templates: state.templates.filter((t) => t.id !== action.payload),
      };
    case 'ADD_WORKOUT':
      return { ...state, workouts: [...state.workouts, action.payload] };
    case 'UPDATE_WORKOUT':
      return {
        ...state,
        workouts: state.workouts.map((w) =>
          w.id === action.payload.id ? action.payload : w
        ),
      };
    case 'DELETE_WORKOUT':
      return {
        ...state,
        workouts: state.workouts.filter((w) => w.id !== action.payload),
      };
    case 'SET_WORKOUT_ACTIVE':
      return {
        ...state,
        isWorkoutActive: true,
        activeWorkoutName: action.payload.name,
        activeWorkoutStartTime: action.payload.startTime,
        activeWorkoutTemplateId: action.payload.templateId || null,
        activeWorkoutTemplateName: action.payload.templateName || null,
        // Important: starting a new workout should never carry over data from a previous session.
        // The active workout screen will populate these via updateActiveWorkoutData.
        activeWorkoutExercises: [],
        activeWorkoutDisabledTimers: new Set(),
        activeWorkoutCollapsedDisplayKeys: new Set(),
      };

    case 'CLEAR_WORKOUT_ACTIVE':
      return {
        ...state,
        isWorkoutActive: false,
        activeWorkoutName: null,
        activeWorkoutStartTime: null,
        activeWorkoutTemplateId: null,
        activeWorkoutTemplateName: null,
        activeWorkoutExercises: [],
        activeWorkoutBodyweight: 70,
        activeWorkoutDisabledTimers: new Set(),
        activeWorkoutCollapsedDisplayKeys: new Set(),
      };
    
    case 'UPDATE_ACTIVE_WORKOUT_DATA':
      return {
        ...state,
        activeWorkoutExercises: action.payload.exercises,
        activeWorkoutBodyweight: action.payload.bodyweight,
        activeWorkoutDisabledTimers: action.payload.disabledTimers,
        activeWorkoutCollapsedDisplayKeys: action.payload.collapsedDisplayKeys ?? state.activeWorkoutCollapsedDisplayKeys,
      };
    default:
      return state;
  }
}

export function GymProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(gymReducer, initialState);

  // Keep a synchronous ref for active-workout status/meta to avoid races where
  // `updateActiveWorkoutData` re-persists after `clearWorkoutActive`.
  const isWorkoutActiveSyncRef = useRef<boolean>(state.isWorkoutActive);
  const activeWorkoutMetaRef = useRef<{
    name: string;
    startTime: number;
    templateId?: string;
    templateName?: string;
  }>({
    name: state.activeWorkoutName || 'Workout',
    startTime: state.activeWorkoutStartTime || Date.now(),
    templateId: state.activeWorkoutTemplateId || undefined,
    templateName: state.activeWorkoutTemplateName || undefined,
  });

  useEffect(() => {
    isWorkoutActiveSyncRef.current = state.isWorkoutActive;
    activeWorkoutMetaRef.current = {
      name: state.activeWorkoutName || 'Workout',
      startTime: state.activeWorkoutStartTime || Date.now(),
      templateId: state.activeWorkoutTemplateId || undefined,
      templateName: state.activeWorkoutTemplateName || undefined,
    };
  }, [
    state.isWorkoutActive,
    state.activeWorkoutName,
    state.activeWorkoutStartTime,
    state.activeWorkoutTemplateId,
    state.activeWorkoutTemplateName,
  ]);

  // Rest timer state
  const [timerState, setTimerState] = useState<RestTimerState>({
    isRunning: false,
    remainingSeconds: 0,
    totalSeconds: 0,
    exerciseName: '',
    setNumber: 0,
    exerciseId: '',
    endTime: null,
  });
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const notificationIdRef = useRef<string | null>(null);

  // Load initial data and run migration if needed
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Run muscle group migration first (only runs once)
        await runMuscleGroupMigration();
        // Run exercise ID migration (only runs once)
        await runExerciseIdMigration();
        // Split deltoids into front/side/rear (only runs once)
        await runDeltoidSplitMigration();
      } catch (error) {
        console.error('[GymContext] Migration failed:', error);
        // Continue even if migration fails - app should still work
      }
      
      // Load data after migration
      await refreshData();
    };
    
    initializeApp();
  }, []);

  // Background timer support - check if timer finished while app was backgrounded
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && timerState.endTime) {
        const now = Date.now();
        if (now >= timerState.endTime) {
          // Timer finished while app was in background
          stopTimer();
        } else {
          // Update remaining time
          const remaining = Math.ceil((timerState.endTime - now) / 1000);
          setTimerState((prev) => ({ ...prev, remainingSeconds: remaining }));
        }
      }
    });
    return () => subscription.remove();
  }, [timerState.endTime]);

  // Timer countdown effect
  useEffect(() => {
    if (timerState.isRunning && timerState.remainingSeconds > 0) {
      timerIntervalRef.current = setInterval(() => {
        setTimerState((prev) => {
          const newRemaining = prev.remainingSeconds - 1;
          if (newRemaining <= 0) {
            // Timer finished - vibrate for 1 second
            if (Platform.OS !== 'web') {
              Vibration.vibrate(1000);
            }
            stopTimer();
            return prev;
          }
          return { ...prev, remainingSeconds: newRemaining };
        });
      }, 1000) as unknown as NodeJS.Timeout;
    } else if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [timerState.isRunning, timerState.remainingSeconds]);

  // Start rest timer
  const startTimer = useCallback(async (exerciseName: string, exerciseId: string, setNumber: number, durationSeconds: number) => {
    // Stop any existing timer
    await stopTimer();

    const endTime = Date.now() + durationSeconds * 1000;

    // Schedule background notification
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Rest Complete',
          body: `Ready for next set of ${exerciseName}`,
          sound: true, // Use system default notification sound
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(endTime),
        },
      });
      notificationIdRef.current = notificationId;
    } catch (error) {
      console.warn('Failed to schedule notification:', error);
    }

    setTimerState({
      isRunning: true,
      remainingSeconds: durationSeconds,
      totalSeconds: durationSeconds,
      exerciseName,
      setNumber,
      exerciseId,
      endTime,
    });
  }, []);

  // Stop rest timer
  const stopTimer = useCallback(async () => {
    // Cancel pending notification
    if (notificationIdRef.current) {
      try {
        await Notifications.cancelScheduledNotificationAsync(notificationIdRef.current);
      } catch (error) {
        console.warn('Failed to cancel notification:', error);
      }
      notificationIdRef.current = null;
    }

    // Clear interval
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    setTimerState({
      isRunning: false,
      remainingSeconds: 0,
      totalSeconds: 0,
      exerciseName: '',
      setNumber: 0,
      exerciseId: '',
      endTime: null,
    });
  }, []);

  // Adjust timer (add/subtract seconds)
  const adjustTimer = useCallback((secondsToAdd: number) => {
    setTimerState((prev) => {
      if (!prev.isRunning) return prev;
      const newRemaining = Math.max(0, prev.remainingSeconds + secondsToAdd);
      const newEndTime = Date.now() + newRemaining * 1000;
      return {
        ...prev,
        remainingSeconds: newRemaining,
        endTime: newEndTime,
      };
    });
  }, []);

  const refreshData = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      const [templates, weekPlans, activeWeekPlanId, workouts, settings, customExercises, predefinedCustomizations, activeWorkoutState] = await Promise.all([
        TemplateStorage.getAll(),
        WeekPlanStorage.getAll(),
        WeekPlanStorage.getActivePlanId(),
        WorkoutStorage.getAll(),
        SettingsStorage.get(),
        CustomExerciseStorage.getAll(),
        PredefinedExerciseCustomizationStorage.getAll(),
        ActiveWorkoutStorage.get(),
      ]);

      dispatch({ type: 'SET_TEMPLATES', payload: templates });
      dispatch({ type: 'SET_WEEK_PLANS', payload: weekPlans });
      dispatch({ type: 'SET_ACTIVE_WEEK_PLAN_ID', payload: activeWeekPlanId });
      dispatch({ type: 'SET_WORKOUTS', payload: workouts });
      dispatch({ type: 'SET_SETTINGS', payload: settings });
      dispatch({ type: 'SET_CUSTOM_EXERCISES', payload: customExercises });
      dispatch({ type: 'SET_PREDEFINED_EXERCISE_CUSTOMIZATIONS', payload: predefinedCustomizations });
      
      // Restore workout active state if it exists
      if (activeWorkoutState) {
        dispatch({
          type: 'SET_WORKOUT_ACTIVE',
          payload: {
            name: activeWorkoutState.name,
            startTime: activeWorkoutState.startTime,
            templateId: activeWorkoutState.templateId,
            templateName: activeWorkoutState.templateName,
          },
        });

        // Restore active workout snapshot if present (backward compatible)
        const restoredDisabledTimers = Array.isArray((activeWorkoutState as any).disabledTimers)
          ? new Set<string>((activeWorkoutState as any).disabledTimers)
          : new Set<string>();
        const restoredCollapsedDisplayKeys = Array.isArray((activeWorkoutState as any).collapsedDisplayKeys)
          ? new Set<string>((activeWorkoutState as any).collapsedDisplayKeys)
          : new Set<string>();
        const restoredExercises = Array.isArray((activeWorkoutState as any).exercises)
          ? ((activeWorkoutState as any).exercises as WorkoutExercise[])
          : [];
        const restoredBodyweight = typeof (activeWorkoutState as any).bodyweight === 'number'
          ? ((activeWorkoutState as any).bodyweight as number)
          : 70;

        if (restoredExercises.length > 0 || restoredDisabledTimers.size > 0 || restoredCollapsedDisplayKeys.size > 0) {
          dispatch({
            type: 'UPDATE_ACTIVE_WORKOUT_DATA',
            payload: {
              exercises: restoredExercises,
              bodyweight: restoredBodyweight,
              disabledTimers: restoredDisabledTimers,
              collapsedDisplayKeys: restoredCollapsedDisplayKeys,
            },
          });
        }
      }
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const addTemplate = useCallback(async (template: WorkoutTemplate) => {
    try {
      const newTemplate = {
        ...template,
        id: template.id || generateId(),
        createdAt: template.createdAt || Date.now(),
        updatedAt: Date.now(),
      };
      await TemplateStorage.save(newTemplate);
      dispatch({ type: 'ADD_TEMPLATE', payload: newTemplate });
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to add template',
      });
      throw error;
    }
  }, []);

  const updateTemplate = useCallback(async (template: WorkoutTemplate) => {
    try {
      const updated = { ...template, updatedAt: Date.now() };
      await TemplateStorage.save(updated);
      dispatch({ type: 'UPDATE_TEMPLATE', payload: updated });
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to update template',
      });
      throw error;
    }
  }, []);

  const deleteTemplate = useCallback(async (id: string) => {
    try {
      await TemplateStorage.delete(id);
      dispatch({ type: 'DELETE_TEMPLATE', payload: id });
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to delete template',
      });
      throw error;
    }
  }, []);

  const reorderTemplates = useCallback(async (templates: WorkoutTemplate[]) => {
    try {
      // Save the reordered templates array directly
      await AsyncStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(templates));
      // Update state with new order
      dispatch({ type: 'SET_TEMPLATES', payload: templates });
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to reorder templates',
      });
      throw error;
    }
  }, []);

  const addWeekPlan = useCallback(async (plan: WeekPlan) => {
    try {
      const newPlan: WeekPlan = {
        ...plan,
        id: plan.id || generateId(),
        createdAt: plan.createdAt || Date.now(),
        updatedAt: Date.now(),
      };
      await WeekPlanStorage.save(newPlan);
      dispatch({ type: 'ADD_WEEK_PLAN', payload: newPlan });

      if (!state.activeWeekPlanId) {
        await WeekPlanStorage.setActivePlanId(newPlan.id);
        dispatch({ type: 'SET_ACTIVE_WEEK_PLAN_ID', payload: newPlan.id });
      }
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to add week plan',
      });
      throw error;
    }
  }, [state.activeWeekPlanId]);

  const updateWeekPlan = useCallback(async (plan: WeekPlan) => {
    try {
      const updated = { ...plan, updatedAt: Date.now() };
      await WeekPlanStorage.save(updated);
      dispatch({ type: 'UPDATE_WEEK_PLAN', payload: updated });
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to update week plan',
      });
      throw error;
    }
  }, []);

  const deleteWeekPlan = useCallback(async (id: string) => {
    try {
      await WeekPlanStorage.delete(id);
      dispatch({ type: 'DELETE_WEEK_PLAN', payload: id });
      const activeId = await WeekPlanStorage.getActivePlanId();
      dispatch({ type: 'SET_ACTIVE_WEEK_PLAN_ID', payload: activeId });
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to delete week plan',
      });
      throw error;
    }
  }, []);

  const reorderWeekPlans = useCallback(async (plans: WeekPlan[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.WEEK_PLANS, JSON.stringify(plans));
      dispatch({ type: 'SET_WEEK_PLANS', payload: plans });
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to reorder week plans',
      });
      throw error;
    }
  }, []);

  const setActiveWeekPlan = useCallback(async (id: string | null) => {
    try {
      await WeekPlanStorage.setActivePlanId(id);
      dispatch({ type: 'SET_ACTIVE_WEEK_PLAN_ID', payload: id });
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to select week plan',
      });
      throw error;
    }
  }, []);

  const duplicateTemplate = useCallback(async (id: string) => {
    try {
      const duplicated = await TemplateStorage.duplicate(id);
      if (duplicated) {
        dispatch({ type: 'ADD_TEMPLATE', payload: duplicated });
      }
      return duplicated;
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to duplicate template',
      });
      throw error;
    }
  }, []);

  const addWorkout = useCallback(async (workout: CompletedWorkout) => {
    try {
      const newWorkout = {
        ...workout,
        id: workout.id || generateId(),
      };
      await WorkoutStorage.save(newWorkout);
      dispatch({ type: 'ADD_WORKOUT', payload: newWorkout });

      // Auto-generate volume tracking entries for each exercise
      const workoutDate = new Date(newWorkout.endTime).toISOString().split('T')[0];
      
      // Get bodyweight for volume calculations
      const { BodyWeightStorage } = await import('@/lib/storage');
      const bodyWeightLog = await BodyWeightStorage.getTodayWeight();
      let bodyWeight: number = 70;
      if (bodyWeightLog) {
        bodyWeight = bodyWeightLog.weight;
      }
      
      for (const exercise of newWorkout.exercises) {
        // Calculate highest set volume for this exercise (exclude warmup sets)
        const completedSets = exercise.sets.filter(set => set.completed === true && set.setType !== 'warmup');
        if (completedSets.length === 0) continue;

        // Find the set with highest volume using proper calculation
        const { calculateSetVolume } = await import('@/lib/volume-calculation');
        let maxVolume = 0;
        let maxSet = completedSets[0];
        for (const set of completedSets) {
          const volume = calculateSetVolume(set, exercise.type, bodyWeight as number);
          if (volume > maxVolume) {
            maxVolume = volume;
            maxSet = set;
          }
        }

        // Save volume entry (only if higher than existing)
        const { ExerciseVolumeStorage } = await import('@/lib/storage');
        await ExerciseVolumeStorage.saveOrUpdate({
          exerciseId: exercise.name,
          date: workoutDate,
          volume: maxVolume,
          reps: maxSet.reps,
          weight: maxSet.weight,
          unit: maxSet.unit,
          timestamp: newWorkout.endTime,
        });
      }
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to add workout',
      });
      throw error;
    }
  }, []);

  const rebuildDerivedWorkoutCaches = useCallback(async (
    nextWorkouts: CompletedWorkout[],
    workoutDateKey: string,
    affectedExerciseNames: string[]
  ) => {
    if (affectedExerciseNames.length === 0) return;

    const [{ BodyWeightStorage, ExerciseVolumeStorage, FailureSetStorage }, { calculateSetVolume }] = await Promise.all([
      import('@/lib/storage'),
      import('@/lib/volume-calculation'),
    ]);

    // Bodyweight for that day (used for bodyweight variants)
    const bodyWeightLog = await BodyWeightStorage.getWeightForDate(new Date(workoutDateKey));
    let bodyWeightKg = 70;
    if (bodyWeightLog) {
      bodyWeightKg = bodyWeightLog.unit === 'lbs' ? lbsToKg(bodyWeightLog.weight) : bodyWeightLog.weight;
    }

    // Daily best set volume per exercise for that day
    const workoutsOnDay = nextWorkouts.filter(
      (w) => new Date(w.endTime).toISOString().split('T')[0] === workoutDateKey
    );

    for (const exerciseName of affectedExerciseNames) {
      let bestVolume = 0;
      let bestSet: { reps: number; weight: number; unit: any; timestamp: number } | null = null;

      for (const w of workoutsOnDay) {
        for (const ex of w.exercises) {
          if (ex.name !== exerciseName) continue;

          for (const set of ex.sets) {
            if (set.completed === false || set.setType === 'warmup') continue;
            const volume = calculateSetVolume(set, ex.type, bodyWeightKg);
            if (volume > bestVolume) {
              bestVolume = volume;
              bestSet = {
                reps: set.reps,
                weight: set.weight,
                unit: set.unit,
                timestamp: set.timestamp || w.endTime,
              };
            }
          }
        }
      }

      if (bestSet && bestVolume > 0) {
        await ExerciseVolumeStorage.upsertWorkoutDailyBest({
          exerciseId: exerciseName,
          date: workoutDateKey,
          volume: bestVolume,
          reps: bestSet.reps,
          weight: bestSet.weight,
          unit: bestSet.unit,
          timestamp: bestSet.timestamp,
        });
      } else {
        await ExerciseVolumeStorage.deleteWorkoutDailyBest(exerciseName, workoutDateKey);
      }
    }

    // Failure sets are stored per exercise across all history; rebuild per affected exercise.
    for (const exerciseName of affectedExerciseNames) {
      const points = nextWorkouts.flatMap((w) =>
        w.exercises
          .filter((ex) => ex.name === exerciseName)
          .flatMap((ex) =>
            ex.sets
              .filter((s) => s.setType === 'failure' && s.completed !== false)
              .map((s) => ({
                reps: s.reps,
                weight: s.weight, // stored format is kg
                timestamp: s.timestamp || w.endTime,
                workoutId: w.id,
              }))
          )
      );

      // Apply the same deduplication logic deterministically (chronological).
      points.sort((a, b) => a.timestamp - b.timestamp);
      let deduped: typeof points = [];
      for (const p of points) {
        deduped = FailureSetStorage.deduplicateData(deduped as any, p as any) as any;
        deduped.push(p);
      }

      deduped.sort((a, b) => a.reps - b.reps);
      await FailureSetStorage.replaceForExercise(exerciseName, deduped as any);
    }
  }, []);

  const updateWorkout = useCallback(async (workout: CompletedWorkout) => {
    try {
      const prevWorkout = state.workouts.find((w) => w.id === workout.id);
      const prevDateKey = prevWorkout
        ? new Date(prevWorkout.endTime).toISOString().split('T')[0]
        : undefined;
      const nextDateKey = new Date(workout.endTime).toISOString().split('T')[0];

      const affectedExerciseNames = Array.from(
        new Set([
          ...(prevWorkout?.exercises.map((e) => e.name) ?? []),
          ...workout.exercises.map((e) => e.name),
        ])
      );

      await WorkoutStorage.save(workout);
      dispatch({ type: 'UPDATE_WORKOUT', payload: workout });

      const nextWorkouts = state.workouts.map((w) => (w.id === workout.id ? workout : w));
      await rebuildDerivedWorkoutCaches(nextWorkouts, nextDateKey, affectedExerciseNames);
      if (prevDateKey && prevDateKey !== nextDateKey) {
        await rebuildDerivedWorkoutCaches(nextWorkouts, prevDateKey, affectedExerciseNames);
      }
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to update workout',
      });
      throw error;
    }
  }, [rebuildDerivedWorkoutCaches, state.workouts]);

  const deleteWorkout = useCallback(async (id: string) => {
    try {
      const prevWorkout = state.workouts.find((w) => w.id === id);
      const prevDateKey = prevWorkout
        ? new Date(prevWorkout.endTime).toISOString().split('T')[0]
        : undefined;
      const affectedExerciseNames = Array.from(
        new Set(prevWorkout?.exercises.map((e) => e.name) ?? [])
      );

      await WorkoutStorage.delete(id);
      dispatch({ type: 'DELETE_WORKOUT', payload: id });

      const nextWorkouts = state.workouts.filter((w) => w.id !== id);
      if (prevDateKey) {
        await rebuildDerivedWorkoutCaches(nextWorkouts, prevDateKey, affectedExerciseNames);
      }
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to delete workout',
      });
      throw error;
    }
  }, [rebuildDerivedWorkoutCaches, state.workouts]);

  const getTodayWorkouts = useCallback(async () => {
    return WorkoutStorage.getTodayWorkouts();
  }, []);

  const getWorkoutById = useCallback(async (id: string) => {
    return WorkoutStorage.getById(id);
  }, []);

  const updateSettings = useCallback(async (settings: Partial<AppSettings>) => {
    try {
      const updated = await SettingsStorage.update(settings);
      dispatch({ type: 'SET_SETTINGS', payload: updated });
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to update settings',
      });
      throw error;
    }
  }, []);

  const setWeightUnit = useCallback(async (unit: WeightUnit) => {
    try {
      await SettingsStorage.setWeightUnit(unit);
      dispatch({
        type: 'SET_SETTINGS',
        payload: { ...state.settings, weightUnit: unit },
      });
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to update weight unit',
      });
      throw error;
    }
  }, [state.settings]);

  const addCustomExercise = useCallback(async (exercise: ExerciseMetadata) => {
    try {
      await CustomExerciseStorage.save(exercise);
      dispatch({ type: 'ADD_CUSTOM_EXERCISE', payload: exercise });
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to add custom exercise',
      });
      throw error;
    }
  }, []);

  const updateCustomExercise = useCallback(async (oldName: string, exercise: ExerciseMetadata) => {
    try {
      // Update exercise and sync changes to all templates
      await CustomExerciseStorage.updateAndSync(oldName, exercise);
      
      // Update local state
      dispatch({ type: 'DELETE_CUSTOM_EXERCISE', payload: oldName });
      dispatch({ type: 'ADD_CUSTOM_EXERCISE', payload: exercise });
      
      // Refresh all data to pick up template changes
      await refreshData();
    } catch (error) {
      console.error('Failed to update custom exercise:', error);
      throw error;
    }
  }, [refreshData]);

  const deleteCustomExercise = useCallback(async (name: string) => {
    try {
      await CustomExerciseStorage.delete(name);
      dispatch({ type: 'DELETE_CUSTOM_EXERCISE', payload: name });
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to delete custom exercise',
      });
      throw error;
    }
  }, []);

  const updatePredefinedExerciseCustomization = useCallback(async (exerciseName: string, customization: { primaryMuscle?: any; secondaryMuscles?: any[]; muscleContributions?: Record<string, number>; exerciseType?: ExerciseType; type?: ExerciseType }) => {
    try {
      await PredefinedExerciseCustomizationStorage.save(exerciseName, customization);
      const updated = await PredefinedExerciseCustomizationStorage.getAll();
      dispatch({ type: 'SET_PREDEFINED_EXERCISE_CUSTOMIZATIONS', payload: updated });
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to update exercise customization',
      });
      throw error;
    }
  }, []);

  const deletePredefinedExerciseCustomization = useCallback(async (exerciseName: string) => {
    try {
      await PredefinedExerciseCustomizationStorage.delete(exerciseName);
      const updated = await PredefinedExerciseCustomizationStorage.getAll();
      dispatch({ type: 'SET_PREDEFINED_EXERCISE_CUSTOMIZATIONS', payload: updated });
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to delete exercise customization',
      });
      throw error;
    }
  }, []);

  const getMostRecentExerciseData = useCallback(async (exerciseName: string): Promise<{ reps: number; weight: number } | null> => {
    try {
      const workouts = await WorkoutStorage.getAll();
      // Sort by endTime descending (most recent first)
      const sortedWorkouts = workouts.sort((a, b) => b.endTime - a.endTime);
      
      // Find the most recent workout that includes this exercise
      for (const workout of sortedWorkouts) {
        const exercise = workout.exercises.find(ex => ex.name === exerciseName);
        if (exercise && exercise.sets.length > 0) {
          // Return the first set's data as the most representative
          const firstSet = exercise.sets[0];
          return {
            reps: firstSet.reps || 0,
            weight: firstSet.weight || 0,
          };
        }
      }
      
      return null; // No history found
    } catch (error) {
      console.error('Failed to get recent exercise data:', error);
      return null;
    }
  }, []);

  const getExercisePRData = useCallback((exerciseName: string, bodyWeight: number = 70, exerciseType?: ExerciseType): { prWeight: number; prReps: number; estimated1RM: number; bestSetWeight: number; bestSetReps: number } => {
    /**
     * Get the effective resistance/weight based on exercise type
     * - weighted: just the weight
     * - bodyweight: bodyweight (no external weight)
     * - weighted-bodyweight: bodyweight + added weight
     * - assisted-bodyweight: bodyweight - assistance (the actual resistance)
     * - doubled: just the weight (volume is doubled separately)
     */
    const getEffectiveWeight = (setWeight: number, exType: ExerciseType | undefined): number => {
      switch (exType) {
        case 'bodyweight':
          return bodyWeight;
        case 'weighted-bodyweight':
          return bodyWeight + setWeight;
        case 'assisted-bodyweight':
          return Math.max(0, bodyWeight - setWeight);
        case 'weighted':
        case 'doubled':
        default:
          return setWeight;
      }
    };

    // Get all sets for this exercise from workout history, preserving exercise type
    const allSetsWithType = state.workouts.flatMap((workout) =>
      workout.exercises
        .filter((ex) => ex.name === exerciseName)
        .flatMap((ex) => ex.sets.map(set => ({ set, type: ex.type })))
    );

    if (allSetsWithType.length === 0) {
      return { prWeight: 0, prReps: 0, estimated1RM: 0, bestSetWeight: 0, bestSetReps: 0 };
    }

    // PR weight (heaviest effective weight ever lifted, accounting for exercise type)
    const prWeight = Math.max(...allSetsWithType.map((s) => 
      getEffectiveWeight(s.set.weight || 0, exerciseType || s.type)
    ));

    // PR reps (most reps ever done in a single set)
    const prReps = Math.max(...allSetsWithType.map((s) => s.set.reps || 0));

    // Estimated 1RM using Epley formula with effective weight
    const estimated1RM = Math.max(
      ...allSetsWithType.map((s) => {
        const effectiveWeight = getEffectiveWeight(s.set.weight || 0, exerciseType || s.type);
        return effectiveWeight * (1 + (s.set.reps || 0) / 30);
      })
    );

    // Best Set (highest volume using effective weight × reps)
    const bestSetData = allSetsWithType.reduce((best, current) => {
      const currentEffective = getEffectiveWeight(current.set.weight || 0, exerciseType || current.type);
      const bestEffective = getEffectiveWeight(best.set.weight || 0, exerciseType || best.type);
      const currentVolume = currentEffective * (current.set.reps || 0);
      const bestVolume = bestEffective * (best.set.reps || 0);
      return currentVolume > bestVolume ? current : best;
    }, allSetsWithType[0]);

    const bestSetEffectiveWeight = getEffectiveWeight(bestSetData.set.weight || 0, exerciseType || bestSetData.type);

    return { 
      prWeight, 
      prReps, 
      estimated1RM, 
      bestSetWeight: bestSetEffectiveWeight, 
      bestSetReps: bestSetData.set.reps || 0 
    };
  }, [state.workouts]);

  const detectWorkoutPRs = useCallback((workout: CompletedWorkout, bodyWeight: number = 70): Array<{ exerciseName: string; prType: 'heaviest_weight' | 'highest_volume'; value: number }> => {
    const prs: Array<{ exerciseName: string; prType: 'heaviest_weight' | 'highest_volume'; value: number }> = [];

    /**
     * Get the effective resistance/weight for PR comparison based on exercise type
     * - weighted: just the weight
     * - bodyweight: bodyweight (no external weight)
     * - weighted-bodyweight: bodyweight + added weight
     * - assisted-bodyweight: bodyweight - assistance (the actual resistance)
     * - doubled: just the weight (volume is doubled separately)
     */
    const getEffectiveWeight = (setWeight: number, exerciseType: ExerciseType | undefined): number => {
      switch (exerciseType) {
        case 'bodyweight':
          return bodyWeight;
        case 'weighted-bodyweight':
          return bodyWeight + setWeight;
        case 'assisted-bodyweight':
          return Math.max(0, bodyWeight - setWeight);
        case 'weighted':
        case 'doubled':
        default:
          return setWeight;
      }
    };

    // For each exercise in the completed workout
    workout.exercises.forEach((exercise) => {
      const exerciseType = exercise.type;
      const isPureBodyweight = exerciseType === 'bodyweight';

      // Get historical data for this exercise (excluding current workout)
      const historicalExercises = state.workouts
        .filter((w) => w.id !== workout.id) // Exclude current workout
        .flatMap((w) => w.exercises.filter((ex) => ex.name === exercise.name));

      const historicalSets = historicalExercises.flatMap((ex) => 
        ex.sets
          .filter(set => set.setType !== 'warmup') // Exclude warmup sets from PR history
          .map(set => ({ set, type: ex.type }))
      );

      // Only consider completed sets for PR detection (exclude warmup sets)
      const completedSets = exercise.sets.filter(set => set.completed !== false && set.setType !== 'warmup');
      
      // If no history, first workout with this exercise should show PRs
      if (historicalSets.length === 0) {
        // For first-time exercises, record PRs from the best completed set
        const maxEffectiveWeight = Math.max(...completedSets.map((s) => getEffectiveWeight(s.weight || 0, exerciseType)));
        const maxVolume = Math.max(...completedSets.map((s) => calculateSetVolume(s, exerciseType, bodyWeight)));
        
        // For pure bodyweight exercises, always show PRs if there are reps (weight is always bodyweight)
        // For other exercises, only show if there's effective weight > 0
        if (maxEffectiveWeight > 0 || isPureBodyweight) {
          prs.push({ exerciseName: exercise.name, prType: 'heaviest_weight', value: maxEffectiveWeight });
          prs.push({ exerciseName: exercise.name, prType: 'highest_volume', value: maxVolume });
        }
        return;
      }

      // Calculate historical PRs using exercise type from historical data
      const historicalPRWeight = Math.max(...historicalSets.map((h) => 
        getEffectiveWeight(h.set.weight || 0, h.type || exerciseType)
      ));
      const historicalPRVolume = Math.max(...historicalSets.map((h) => 
        calculateSetVolume(h.set, h.type || exerciseType, bodyWeight)
      ));

      // Check each completed set in current workout for PRs
      completedSets.forEach((set) => {
        const effectiveWeight = getEffectiveWeight(set.weight || 0, exerciseType);
        const setVolume = calculateSetVolume(set, exerciseType, bodyWeight);

        // Check for heaviest weight PR
        // For bodyweight exercises, this tracks the resistance (bodyweight itself)
        // For weighted-bodyweight, this tracks bodyweight + added weight
        if (effectiveWeight > historicalPRWeight) {
          if (!prs.find((pr) => pr.exerciseName === exercise.name && pr.prType === 'heaviest_weight')) {
            prs.push({ exerciseName: exercise.name, prType: 'heaviest_weight', value: effectiveWeight });
          }
        }

        // Check for highest volume PR using proper volume calculation
        if (setVolume > historicalPRVolume) {
          if (!prs.find((pr) => pr.exerciseName === exercise.name && pr.prType === 'highest_volume')) {
            prs.push({ exerciseName: exercise.name, prType: 'highest_volume', value: setVolume });
          }
        }
      });
    });

    return prs;
  }, [state.workouts]);

  // Workout session operations
  const setWorkoutActive = useCallback((name: string, startTime: number, templateId?: string, templateName?: string) => {
    // Update sync refs immediately (before any async effects fire)
    isWorkoutActiveSyncRef.current = true;
    activeWorkoutMetaRef.current = { name, startTime, templateId, templateName };

    dispatch({ type: 'SET_WORKOUT_ACTIVE', payload: { name, startTime, templateId, templateName } });
    // Persist to storage
    ActiveWorkoutStorage.set({
      name,
      startTime,
      templateId,
      templateName,
      // New session must not inherit any previous session snapshot.
      exercises: [],
      bodyweight: state.activeWorkoutBodyweight,
      disabledTimers: [],
      collapsedDisplayKeys: [],
    }).catch(err => {
      console.error('Failed to persist workout active state:', err);
    });
  }, [state.activeWorkoutBodyweight]);

  const clearWorkoutActive = useCallback(async () => {
    // Prevent any in-flight updateActiveWorkoutData calls from re-persisting.
    isWorkoutActiveSyncRef.current = false;

    dispatch({ type: 'CLEAR_WORKOUT_ACTIVE' });
    // Clear from storage
    try {
      await ActiveWorkoutStorage.clear();
    } catch (err) {
      console.error('Failed to clear workout active state:', err);
    }
  }, []);

  const updateActiveWorkoutData = useCallback((exercises: WorkoutExercise[], bodyweight: number, disabledTimers: Set<string>, collapsedDisplayKeys?: Set<string>) => {
    dispatch({ type: 'UPDATE_ACTIVE_WORKOUT_DATA', payload: { exercises, bodyweight, disabledTimers, collapsedDisplayKeys } });

    // Persist snapshot so active workout can be restored after app restart.
    // Important: do NOT recreate active workout storage after the workout was cleared.
    if (!isWorkoutActiveSyncRef.current) return;

    const meta = activeWorkoutMetaRef.current;

    ActiveWorkoutStorage.set({
      name: meta.name,
      startTime: meta.startTime,
      templateId: meta.templateId,
      templateName: meta.templateName,
      exercises,
      bodyweight,
      disabledTimers: Array.from(disabledTimers || []),
      collapsedDisplayKeys: Array.from(collapsedDisplayKeys || []),
    }).catch(err => {
      console.error('Failed to persist active workout data:', err);
    });
  }, []);

  const value: GymContextValue = {
    ...state,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
    reorderTemplates,
    addWeekPlan,
    updateWeekPlan,
    deleteWeekPlan,
    reorderWeekPlans,
    setActiveWeekPlan,
    addWorkout,
    updateWorkout,
    deleteWorkout,
    getTodayWorkouts,
    getWorkoutById,
    updateSettings,
    setWeightUnit,
    addCustomExercise,
    updateCustomExercise,
    deleteCustomExercise,
    updatePredefinedExerciseCustomization,
    deletePredefinedExerciseCustomization,
    timerState,
    startTimer,
    stopTimer,
    adjustTimer,
    setWorkoutActive,
    clearWorkoutActive,
    updateActiveWorkoutData,
    refreshData,
    getMostRecentExerciseData,
    detectWorkoutPRs,
    getExercisePRData,
  };

  return <GymContext.Provider value={value}>{children}</GymContext.Provider>;
}

export function useGym(): GymContextValue {
  const context = useContext(GymContext);
  if (!context) {
    throw new Error('useGym must be used within GymProvider');
  }
  return context;
}
