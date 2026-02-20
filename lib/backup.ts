/**
 * Backup and restore functionality for gym tracker data
 * Exports/imports all app data as JSON format
 * Uses native share sheet for easy file access on Android/iOS
 */

import {
  TemplateStorage,
  WeekPlanStorage,
  WorkoutStorage,
  SettingsStorage,
  CustomExerciseStorage,
  BodyWeightStorage,
  ExerciseVolumeStorage,
  ActiveWorkoutStorage,
  PredefinedExerciseCustomizationStorage,
  STORAGE_KEYS,
} from './storage';
import { WorkoutTemplate, CompletedWorkout, AppSettings, ExerciseMetadata, BodyWeightLog, MuscleGroup, ExerciseVolumeLog } from './types';
import type { WeekPlan } from './types';
import { MUSCLE_GROUP_MIGRATION_MAP } from './muscle-groups';
import { RestDayStorage, type RestDay } from './rest-day-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export interface BackupData {
  version: string;
  exportedAt: number;
  templates: WorkoutTemplate[];
  weekPlans?: WeekPlan[];
  activeWeekPlanId?: string | null;
  workouts: CompletedWorkout[];
  settings: AppSettings;
  customExercises: ExerciseMetadata[];
  bodyWeightLogs: BodyWeightLog[];
  exerciseVolumeLogs?: ExerciseVolumeLog[]; // Optional for backward compatibility

  // Additional app data
  predefinedExerciseCustomizations?: Record<
    string,
    {
      primaryMuscle?: MuscleGroup;
      secondaryMuscles?: MuscleGroup[];
      muscleContributions?: Record<MuscleGroup, number>;
      exerciseType?: any;
      type?: any;
    }
  >;
  activeWorkoutState?: {
    name: string;
    startTime: number;
    templateId?: string;
    templateName?: string;
    exercises?: any[];
    bodyweight?: number;
    disabledTimers?: string[];
  } | null;
  restDays?: RestDay[];

  // UI/analytics preferences
  uiPreferences?: {
    selectedMusclesForSpider?: MuscleGroup[];
    bodyWeightChartSettings?: any;
  };

  // Forward-compatible dump of app-owned AsyncStorage values
  appStorage?: Record<string, string>;
}

const APP_PREF_KEYS = {
  SELECTED_MUSCLES: 'selectedMusclesForSpider',
  BODY_WEIGHT_CHART_SETTINGS: 'bodyWeightChartSettings',
} as const;

function isAppOwnedAsyncStorageKey(key: string): boolean {
  if (Object.values(STORAGE_KEYS).includes(key as any)) return true;
  if (key === APP_PREF_KEYS.SELECTED_MUSCLES) return true;
  if (key === APP_PREF_KEYS.BODY_WEIGHT_CHART_SETTINGS) return true;
  // Rest days + migration flags use '@gym_' prefixes
  if (key.startsWith('gym_tracker_')) return true;
  if (key.startsWith('@gym_tracker_')) return true;
  if (key.startsWith('@gym_')) return true;
  return false;
}

/**
 * Export all app data as JSON string
 */
export async function exportAllData(): Promise<string> {
  try {
    const [
      templates,
      weekPlans,
      activeWeekPlanId,
      workouts,
      settings,
      customExercises,
      bodyWeightLogs,
      exerciseVolumeLogs,
      predefinedExerciseCustomizations,
      activeWorkoutState,
      restDays,
    ] = await Promise.all([
      TemplateStorage.getAll(),
      WeekPlanStorage.getAll(),
      WeekPlanStorage.getActivePlanId(),
      WorkoutStorage.getAll(),
      SettingsStorage.get(),
      CustomExerciseStorage.getAll(),
      BodyWeightStorage.getAll(),
      ExerciseVolumeStorage.getAll(),
      PredefinedExerciseCustomizationStorage.getAll(),
      ActiveWorkoutStorage.get(),
      RestDayStorage.getAll(),
    ]);

    const [selectedMusclesRaw, bodyWeightChartSettingsRaw] = await Promise.all([
      AsyncStorage.getItem(APP_PREF_KEYS.SELECTED_MUSCLES),
      AsyncStorage.getItem(APP_PREF_KEYS.BODY_WEIGHT_CHART_SETTINGS),
    ]);

    const uiPreferences: BackupData['uiPreferences'] = {
      selectedMusclesForSpider: selectedMusclesRaw ? JSON.parse(selectedMusclesRaw) : undefined,
      bodyWeightChartSettings: bodyWeightChartSettingsRaw ? JSON.parse(bodyWeightChartSettingsRaw) : undefined,
    };

    // Dump app-owned AsyncStorage keys for forward compatibility
    const allKeys = await AsyncStorage.getAllKeys();
    const appKeys = allKeys.filter(isAppOwnedAsyncStorageKey);
    const kvPairs = await AsyncStorage.multiGet(appKeys);
    const appStorage: Record<string, string> = {};
    for (const [k, v] of kvPairs) {
      if (k && typeof v === 'string') appStorage[k] = v;
    }

    const backupData: BackupData = {
      version: '2.1.0',
      exportedAt: Date.now(),
      templates,
      weekPlans,
      activeWeekPlanId,
      workouts,
      settings,
      customExercises,
      bodyWeightLogs,
      exerciseVolumeLogs,
      predefinedExerciseCustomizations,
      activeWorkoutState,
      restDays,
      uiPreferences,
      appStorage,
    };

    return JSON.stringify(backupData, null, 2);
  } catch (error) {
    console.error('Error exporting data:', error);
    throw new Error('Failed to export data');
  }
}

/**
 * Import backup data and restore all app data
 */
export async function importBackupData(jsonString: string): Promise<void> {
  try {
    console.log('[Backup] Starting import process...');
    const backupData: BackupData = JSON.parse(jsonString);

    // Validate backup structure
    if (!backupData.version || !backupData.templates || !backupData.workouts) {
      throw new Error('Invalid backup file format');
    }

    console.log('[Backup] Backup validation passed. Data counts:', {
      templates: backupData.templates.length,
      weekPlans: backupData.weekPlans?.length || 0,
      workouts: backupData.workouts.length,
      customExercises: backupData.customExercises?.length || 0,
      bodyWeightLogs: backupData.bodyWeightLogs?.length || 0,
      exerciseVolumeLogs: backupData.exerciseVolumeLogs?.length || 0,
      predefinedExerciseCustomizations: backupData.predefinedExerciseCustomizations
        ? Object.keys(backupData.predefinedExerciseCustomizations).length
        : 0,
      restDays: backupData.restDays?.length || 0,
    });

    // Clear existing data first
    console.log('[Backup] Clearing existing data...');
    await clearAllDataForImport();

    // Restore templates (with muscle group migration)
    console.log('[Backup] Restoring templates...');
    for (const template of backupData.templates) {
      const migratedTemplate = migrateMuscleGroupsInTemplate(template);
      await TemplateStorage.save(migratedTemplate);
    }
    console.log(`[Backup] Restored ${backupData.templates.length} templates`);

    // Restore week plans
    if (backupData.weekPlans) {
      console.log('[Backup] Restoring week plans...');
      for (const plan of backupData.weekPlans) {
        await WeekPlanStorage.save(plan);
      }
      await WeekPlanStorage.setActivePlanId(backupData.activeWeekPlanId ?? backupData.weekPlans[0]?.id ?? null);
      console.log(`[Backup] Restored ${backupData.weekPlans.length} week plans`);
    }

    // Restore workouts (migrate muscle groups if present)
    console.log('[Backup] Restoring workouts...');
    for (const workout of backupData.workouts) {
      await WorkoutStorage.save(migrateMuscleGroupsInWorkout(workout));
    }
    console.log(`[Backup] Restored ${backupData.workouts.length} workouts`);

    // Restore settings (if present in backup)
    if (backupData.settings) {
      console.log('[Backup] Restoring settings...');
      await SettingsStorage.update(backupData.settings);
    }

    // Restore custom exercises (with muscle group migration)
    if (backupData.customExercises) {
      console.log('[Backup] Restoring custom exercises...');
      for (const exercise of backupData.customExercises) {
        const migratedExercise = migrateMuscleGroupsInCustomExercise(exercise);
        await CustomExerciseStorage.save(migratedExercise);
      }
      console.log(`[Backup] Restored ${backupData.customExercises.length} custom exercises`);
    }

    // Restore body weight logs
    if (backupData.bodyWeightLogs) {
      console.log('[Backup] Restoring body weight logs...');
      for (const log of backupData.bodyWeightLogs) {
        await BodyWeightStorage.save(log);
      }
      console.log(`[Backup] Restored ${backupData.bodyWeightLogs.length} body weight logs`);
    }

    // Restore exercise volume logs
    if (backupData.exerciseVolumeLogs) {
      console.log('[Backup] Restoring exercise volume logs...');
      for (const log of backupData.exerciseVolumeLogs) {
        await ExerciseVolumeStorage.save(log);
      }
      console.log(`[Backup] Restored ${backupData.exerciseVolumeLogs.length} exercise volume logs`);
    }

    // Restore predefined exercise customizations
    if (backupData.predefinedExerciseCustomizations) {
      console.log('[Backup] Restoring predefined exercise customizations...');
      const migrated = migrateMuscleGroupsInPredefinedCustomizations(backupData.predefinedExerciseCustomizations);
      // Persist as a single object for efficiency
      await AsyncStorage.setItem(STORAGE_KEYS.PREDEFINED_EXERCISE_CUSTOMIZATIONS, JSON.stringify(migrated));
      console.log(`[Backup] Restored ${Object.keys(migrated).length} predefined customizations`);
    }

    // Restore rest day logs
    if (backupData.restDays) {
      console.log('[Backup] Restoring rest days...');
      for (const day of backupData.restDays) {
        await RestDayStorage.logRestDay(day.date, day.note);
      }
      console.log(`[Backup] Restored ${backupData.restDays.length} rest days`);
    }

    // Restore active workout snapshot (if any)
    if (typeof backupData.activeWorkoutState !== 'undefined') {
      console.log('[Backup] Restoring active workout snapshot...');
      if (backupData.activeWorkoutState) {
        await ActiveWorkoutStorage.set(backupData.activeWorkoutState);
      } else {
        await ActiveWorkoutStorage.clear();
      }
    }

    // Restore UI preferences
    if (backupData.uiPreferences?.selectedMusclesForSpider) {
      await AsyncStorage.setItem(
        APP_PREF_KEYS.SELECTED_MUSCLES,
        JSON.stringify(backupData.uiPreferences.selectedMusclesForSpider)
      );
    }
    if (typeof backupData.uiPreferences?.bodyWeightChartSettings !== 'undefined') {
      await AsyncStorage.setItem(
        APP_PREF_KEYS.BODY_WEIGHT_CHART_SETTINGS,
        JSON.stringify(backupData.uiPreferences.bodyWeightChartSettings)
      );
    }

    // Restore forward-compatible AsyncStorage dump (non-destructively)
    if (backupData.appStorage) {
      console.log('[Backup] Restoring appStorage key/value dump...');
      const coreKeys = new Set(Object.values(STORAGE_KEYS));
      const entries = Object.entries(backupData.appStorage).filter(
        ([k, v]) => isAppOwnedAsyncStorageKey(k) && typeof v === 'string' && !coreKeys.has(k)
      );
      if (entries.length > 0) {
        await AsyncStorage.multiSet(entries);
      }
      console.log(`[Backup] Restored ${entries.length} appStorage keys`);
    }

    console.log('[Backup] Import completed successfully!');
  } catch (error) {
    console.error('[Backup] Error importing data:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to import backup: ${error.message}`);
    }
    throw new Error('Failed to import backup data');
  }
}

// ============================================================================
// Selective Import API
// ============================================================================

export interface ImportCategoryOptions {
  workoutHistory: boolean;  // workouts, achievements, exercise volume logs
  templates: boolean;
  bodyWeight: boolean;
  exercises: boolean;        // custom exercises + predefined customizations
  settings: boolean;         // app settings + UI preferences
}

export interface BackupSummary {
  version: string;
  exportedAt: number;
  counts: {
    workouts: number;
    achievements: number;       // parsed from appStorage if present
    exerciseVolumeLogs: number;
    templates: number;
    weekPlans: number;
    bodyWeightLogs: number;
    customExercises: number;
    predefinedCustomizations: number;
  };
  hasSettings: boolean;
  hasUIPreferences: boolean;
}

/**
 * Parse a backup file and return summary information for the UI
 * Does NOT import anything - just validates and extracts counts
 */
export function parseBackupFile(jsonString: string): { backup: BackupData; summary: BackupSummary } {
  try {
    const backup: BackupData = JSON.parse(jsonString);

    // Validate minimal backup structure
    if (!backup.version) {
      throw new Error('Invalid backup file: missing version');
    }

    // Parse achievements count from appStorage if available
    let achievementsCount = 0;
    if (backup.appStorage?.[STORAGE_KEYS.ACHIEVEMENTS]) {
      try {
        const achievements = JSON.parse(backup.appStorage[STORAGE_KEYS.ACHIEVEMENTS]);
        if (Array.isArray(achievements)) {
          achievementsCount = achievements.length;
        }
      } catch {
        // Ignore parse errors
      }
    }

    const summary: BackupSummary = {
      version: backup.version,
      exportedAt: backup.exportedAt || 0,
      counts: {
        workouts: backup.workouts?.length || 0,
        achievements: achievementsCount,
        exerciseVolumeLogs: backup.exerciseVolumeLogs?.length || 0,
        templates: backup.templates?.length || 0,
        weekPlans: backup.weekPlans?.length || 0,
        bodyWeightLogs: backup.bodyWeightLogs?.length || 0,
        customExercises: backup.customExercises?.length || 0,
        predefinedCustomizations: backup.predefinedExerciseCustomizations
          ? Object.keys(backup.predefinedExerciseCustomizations).length
          : 0,
      },
      hasSettings: !!backup.settings,
      hasUIPreferences: !!(backup.uiPreferences?.selectedMusclesForSpider || backup.uiPreferences?.bodyWeightChartSettings),
    };

    return { backup, summary };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse backup file: ${error.message}`);
    }
    throw new Error('Failed to parse backup file');
  }
}

/**
 * Import selected categories from a parsed backup
 * Only clears and imports the categories that are selected
 */
export async function importSelectedCategories(
  backup: BackupData,
  options: ImportCategoryOptions
): Promise<void> {
  try {
    console.log('[Backup] Starting selective import...', options);

    // Import Workout History (workouts + achievements + volume logs)
    if (options.workoutHistory) {
      console.log('[Backup] Importing workout history...');
      
      // Clear existing
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.WORKOUTS,
        STORAGE_KEYS.ACHIEVEMENTS,
        STORAGE_KEYS.EXERCISE_VOLUME,
      ]);

      // Import workouts
      if (backup.workouts) {
        for (const workout of backup.workouts) {
          await WorkoutStorage.save(migrateMuscleGroupsInWorkout(workout));
        }
        console.log(`[Backup] Imported ${backup.workouts.length} workouts`);
      }

      // Import achievements from appStorage
      if (backup.appStorage?.[STORAGE_KEYS.ACHIEVEMENTS]) {
        await AsyncStorage.setItem(STORAGE_KEYS.ACHIEVEMENTS, backup.appStorage[STORAGE_KEYS.ACHIEVEMENTS]);
        console.log('[Backup] Imported achievements');
      }

      // Import exercise volume logs
      if (backup.exerciseVolumeLogs) {
        for (const log of backup.exerciseVolumeLogs) {
          await ExerciseVolumeStorage.save(log);
        }
        console.log(`[Backup] Imported ${backup.exerciseVolumeLogs.length} volume logs`);
      }
    }

    // Import Templates
    if (options.templates) {
      console.log('[Backup] Importing templates...');
      
      // Clear existing
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.TEMPLATES,
        STORAGE_KEYS.WEEK_PLANS,
        STORAGE_KEYS.ACTIVE_WEEK_PLAN_ID,
      ]);

      // Import
      if (backup.templates) {
        for (const template of backup.templates) {
          const migratedTemplate = migrateMuscleGroupsInTemplate(template);
          await TemplateStorage.save(migratedTemplate);
        }
        console.log(`[Backup] Imported ${backup.templates.length} templates`);
      }

      // Import week plans + active selection
      if (backup.weekPlans) {
        for (const plan of backup.weekPlans) {
          await WeekPlanStorage.save(plan);
        }
        await WeekPlanStorage.setActivePlanId(backup.activeWeekPlanId ?? backup.weekPlans[0]?.id ?? null);
        console.log(`[Backup] Imported ${backup.weekPlans.length} week plans`);
      }
    }

    // Import Body Weight
    if (options.bodyWeight) {
      console.log('[Backup] Importing body weight logs...');
      
      // Clear existing
      await AsyncStorage.removeItem(STORAGE_KEYS.BODY_WEIGHT);

      // Import
      if (backup.bodyWeightLogs) {
        for (const log of backup.bodyWeightLogs) {
          await BodyWeightStorage.save(log);
        }
        console.log(`[Backup] Imported ${backup.bodyWeightLogs.length} body weight logs`);
      }
    }

    // Import Exercises (custom + predefined customizations)
    if (options.exercises) {
      console.log('[Backup] Importing exercises...');
      
      // Clear existing
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.CUSTOM_EXERCISES,
        STORAGE_KEYS.PREDEFINED_EXERCISE_CUSTOMIZATIONS,
      ]);

      // Import custom exercises
      if (backup.customExercises) {
        for (const exercise of backup.customExercises) {
          const migratedExercise = migrateMuscleGroupsInCustomExercise(exercise);
          await CustomExerciseStorage.save(migratedExercise);
        }
        console.log(`[Backup] Imported ${backup.customExercises.length} custom exercises`);
      }

      // Import predefined exercise customizations
      if (backup.predefinedExerciseCustomizations) {
        const migrated = migrateMuscleGroupsInPredefinedCustomizations(backup.predefinedExerciseCustomizations);
        await AsyncStorage.setItem(STORAGE_KEYS.PREDEFINED_EXERCISE_CUSTOMIZATIONS, JSON.stringify(migrated));
        console.log(`[Backup] Imported ${Object.keys(migrated).length} predefined customizations`);
      }
    }

    // Import Settings (app settings + UI preferences)
    if (options.settings) {
      console.log('[Backup] Importing settings...');
      
      // Clear existing
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.SETTINGS,
        STORAGE_KEYS.EXERCISE_DETAIL_CHART_PREFS,
        APP_PREF_KEYS.SELECTED_MUSCLES,
        APP_PREF_KEYS.BODY_WEIGHT_CHART_SETTINGS,
        'spiderChartLastWeek',
      ]);

      // Import app settings
      if (backup.settings) {
        await SettingsStorage.update(backup.settings);
        console.log('[Backup] Imported app settings');
      }

      // Import UI preferences
      if (backup.uiPreferences?.selectedMusclesForSpider) {
        await AsyncStorage.setItem(
          APP_PREF_KEYS.SELECTED_MUSCLES,
          JSON.stringify(backup.uiPreferences.selectedMusclesForSpider)
        );
      }
      if (typeof backup.uiPreferences?.bodyWeightChartSettings !== 'undefined') {
        await AsyncStorage.setItem(
          APP_PREF_KEYS.BODY_WEIGHT_CHART_SETTINGS,
          JSON.stringify(backup.uiPreferences.bodyWeightChartSettings)
        );
      }

      // Import exercise detail chart prefs from appStorage if available
      if (backup.appStorage?.[STORAGE_KEYS.EXERCISE_DETAIL_CHART_PREFS]) {
        await AsyncStorage.setItem(
          STORAGE_KEYS.EXERCISE_DETAIL_CHART_PREFS,
          backup.appStorage[STORAGE_KEYS.EXERCISE_DETAIL_CHART_PREFS]
        );
      }

      console.log('[Backup] Imported settings and UI preferences');
    }

    console.log('[Backup] Selective import completed successfully!');
  } catch (error) {
    console.error('[Backup] Error during selective import:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to import: ${error.message}`);
    }
    throw new Error('Failed to import selected data');
  }
}

/**
 * Migrate muscle group names from old format to new format
 */
function migrateMuscleGroup(oldMuscle: string): MuscleGroup {
  // If it's already in new format (lowercase), return as is
  if (MUSCLE_GROUP_MIGRATION_MAP[oldMuscle as keyof typeof MUSCLE_GROUP_MIGRATION_MAP]) {
    return MUSCLE_GROUP_MIGRATION_MAP[oldMuscle as keyof typeof MUSCLE_GROUP_MIGRATION_MAP] as MuscleGroup;
  }
  // If it's already a valid new muscle group, return as is
  return oldMuscle as MuscleGroup;
}

/**
 * Migrate muscle groups in a template
 */
function migrateMuscleGroupsInTemplate(template: WorkoutTemplate): WorkoutTemplate {
  return {
    ...template,
    exercises: template.exercises.map(exercise => ({
      ...exercise,
      primaryMuscle: exercise.primaryMuscle ? migrateMuscleGroup(exercise.primaryMuscle) : undefined,
      secondaryMuscles: exercise.secondaryMuscles?.map(m => migrateMuscleGroup(m)),
    })),
  };
}

/**
 * Migrate muscle groups in a custom exercise
 */
function migrateMuscleGroupsInCustomExercise(exercise: ExerciseMetadata): ExerciseMetadata {
  return {
    ...exercise,
    primaryMuscle: migrateMuscleGroup(exercise.primaryMuscle),
    secondaryMuscles: exercise.secondaryMuscles?.map((m: string) => migrateMuscleGroup(m)),
  };
}

function migrateMuscleContributions(contributions: Record<string, number> | undefined): Record<MuscleGroup, number> | undefined {
  if (!contributions) return undefined;
  const migrated: Record<string, number> = {};
  for (const [key, value] of Object.entries(contributions)) {
    migrated[migrateMuscleGroup(key)] = value;
  }
  return migrated as Record<MuscleGroup, number>;
}

function migrateMuscleGroupsInWorkout(workout: CompletedWorkout): CompletedWorkout {
  return {
    ...workout,
    exercises: workout.exercises.map(ex => ({
      ...ex,
      primaryMuscle: ex.primaryMuscle ? migrateMuscleGroup(ex.primaryMuscle) : undefined,
      secondaryMuscles: ex.secondaryMuscles?.map(m => migrateMuscleGroup(m)),
      muscleContributions: migrateMuscleContributions(ex.muscleContributions as any),
    })),
  };
}

function migrateMuscleGroupsInPredefinedCustomizations(
  customizations: NonNullable<BackupData['predefinedExerciseCustomizations']>
): NonNullable<BackupData['predefinedExerciseCustomizations']> {
  const migrated: NonNullable<BackupData['predefinedExerciseCustomizations']> = {};
  for (const [exerciseName, customization] of Object.entries(customizations)) {
    migrated[exerciseName] = {
      ...customization,
      primaryMuscle: customization.primaryMuscle ? migrateMuscleGroup(customization.primaryMuscle) : undefined,
      secondaryMuscles: customization.secondaryMuscles?.map(m => migrateMuscleGroup(m)),
      muscleContributions: migrateMuscleContributions(customization.muscleContributions as any),
    };
  }
  return migrated;
}

/**
 * Clear all data before importing (internal use)
 */
async function clearAllDataForImport(): Promise<void> {
  try {
    await Promise.all([
      TemplateStorage.getAll().then(async (templates) => {
        for (const template of templates) {
          await TemplateStorage.delete(template.id);
        }
      }),
      WorkoutStorage.getAll().then(async (workouts) => {
        for (const workout of workouts) {
          await WorkoutStorage.delete(workout.id);
        }
      }),
      // Clear settings so restore is complete
      AsyncStorage.removeItem(STORAGE_KEYS.SETTINGS),
      CustomExerciseStorage.getAll().then(async (exercises) => {
        for (const exercise of exercises) {
          await CustomExerciseStorage.delete(exercise.name);
        }
      }),
      BodyWeightStorage.getAll().then(async (logs) => {
        for (const log of logs) {
          await BodyWeightStorage.delete(log.timestamp);
        }
      }),
      ExerciseVolumeStorage.getAll().then(async (logs) => {
        for (const log of logs) {
          await ExerciseVolumeStorage.delete(log.timestamp);
        }
      }),
      // Clear additional storage
      AsyncStorage.removeItem(STORAGE_KEYS.PREDEFINED_EXERCISE_CUSTOMIZATIONS),
      AsyncStorage.removeItem(STORAGE_KEYS.WEEK_PLANS),
      AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_WEEK_PLAN_ID),
      ActiveWorkoutStorage.clear(),
      RestDayStorage.clearAll(),
      // Clear UI prefs
      AsyncStorage.removeItem(APP_PREF_KEYS.SELECTED_MUSCLES),
      AsyncStorage.removeItem(APP_PREF_KEYS.BODY_WEIGHT_CHART_SETTINGS),
    ]);
  } catch (error) {
    console.error('Error clearing data for import:', error);
    throw error;
  }
}

/**
 * Generate filename for backup
 */
export function generateBackupFilename(): string {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
  return `gym-tracker-backup-${dateStr}-${timeStr}.json`;
}

/**
 * Save backup to file and open share sheet
 * Uses native share sheet so user can save to Downloads, Drive, etc.
 */
export async function saveBackupToFile(jsonData: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      // For web, create a blob and trigger download
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = generateBackupFilename();
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return generateBackupFilename();
    } else {
      // For Android/iOS, save directly to Downloads folder
      const filename = generateBackupFilename();
      
      if (Platform.OS === 'android') {
        // Android: Use SAF (Storage Access Framework) to save to Downloads
        try {
          const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          
          if (!permissions.granted) {
            throw new Error('Storage permission denied');
          }
          
          // Create file in the selected directory (user can choose Downloads)
          const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            filename,
            'application/json'
          );
          
          // Write the backup data
          await FileSystem.writeAsStringAsync(fileUri, jsonData, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          
          return filename;
        } catch (error) {
          console.error('Error saving to Downloads:', error);
          // Fallback to share sheet if SAF fails
          const filepath = `${FileSystem.cacheDirectory}${filename}`;
          await FileSystem.writeAsStringAsync(filepath, jsonData);
          await Sharing.shareAsync(filepath, {
            mimeType: 'application/json',
            dialogTitle: 'Save Gym Tracker Backup',
          });
          return filename;
        }
      } else {
        // iOS: Use share sheet (iOS doesn't allow direct Downloads folder access)
        const filepath = `${FileSystem.cacheDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(filepath, jsonData);
        
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(filepath, {
            mimeType: 'application/json',
            dialogTitle: 'Save Gym Tracker Backup',
            UTI: 'public.json',
          });
        }
        return filename;
      }
    }
  } catch (error) {
    console.error('Error saving backup to file:', error);
    return null;
  }
}
