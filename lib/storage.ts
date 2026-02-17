/**
 * Local storage service using AsyncStorage
 * Handles all data persistence for the gym tracker app
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { WorkoutTemplate, CompletedWorkout, AppSettings, WeightUnit, ExerciseMetadata, BodyWeightLog, ExerciseVolumeLog, MuscleGroup, ExerciseType, FailureSetData } from './types';

export const STORAGE_KEYS = {
  TEMPLATES: 'gym_tracker_templates',
  WORKOUTS: 'gym_tracker_workouts',
  SETTINGS: 'gym_tracker_settings',
  CUSTOM_EXERCISES: 'gym_tracker_custom_exercises',
  PREDEFINED_EXERCISE_CUSTOMIZATIONS: 'gym_tracker_predefined_exercise_customizations',
  BODY_WEIGHT: 'gym_tracker_body_weight',
  ACTIVE_WORKOUT: 'gym_tracker_active_workout',
  EXERCISE_VOLUME: 'gym_tracker_exercise_volume',
  ACHIEVEMENTS: 'gym_tracker_achievements',
  EXERCISE_DETAIL_CHART_PREFS: 'gym_tracker_exercise_detail_chart_prefs',
  FAILURE_SET_DATA: 'gym_tracker_failure_set_data',
};

export type ExerciseDetailChartSettings = {
  showRollingAverage: boolean;
  rollingAverageWindow: number;
  showTrendline: boolean;
};

export type ExerciseDetailChartPrefs = {
  timePeriod: 'week' | 'month' | '6months' | 'all';
  volumeAggregation: 'best_set' | 'avg_set' | 'total_volume' | 'heaviest_weight' | 'weekly_volume';
  overlays: ExerciseDetailChartSettings;
};

const DEFAULT_SETTINGS: AppSettings = {
  weightUnit: 'kg',
  theme: 'auto',
  defaultRestTime: 90, // Default 90 seconds rest time
  bodyMapGender: 'male', // Default to male body map
  weekStartDay: 0, // Default to Sunday (0 = Sunday, 1 = Monday, etc.)
  lastUpdated: Date.now(),
};

/**
 * Templates Storage
 */
export const TemplateStorage = {
  async getAll(): Promise<WorkoutTemplate[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.TEMPLATES);
      if (!data) return [];
      
      const templates: WorkoutTemplate[] = JSON.parse(data);
      
      // Migrate old templates without setDetails
      let needsSave = false;
      const migratedTemplates = templates.map(template => {
        const migratedExercises = template.exercises.map(ex => {
          // Check if setDetails needs migration
          const hasValidSetDetails = ex.setDetails && 
                                    Array.isArray(ex.setDetails) && 
                                    ex.setDetails.length > 0;
          
          if (!hasValidSetDetails) {
            needsSave = true;
            console.log(`[Migration] Converting exercise "${ex.name}" - sets: ${ex.sets}, reps: ${ex.reps}, weight: ${ex.weight}`);
            
            // Ensure we have a valid sets count
            const setsCount = (typeof ex.sets === 'number' && ex.sets > 0) ? ex.sets : 1;
            
            const newSetDetails = Array.from({ length: setsCount }, () => ({
              reps: ex.reps || 0,
              weight: ex.weight || 0,
              unit: ex.unit || 'kg',
            }));
            
            console.log(`[Migration] Created ${newSetDetails.length} setDetails:`, newSetDetails);
            
            return {
              ...ex,
              setDetails: newSetDetails,
            };
          }
          return ex;
        });
        return {
          ...template,
          exercises: migratedExercises,
        };
      });
      
      // Save migrated templates back to storage
      if (needsSave) {
        console.log('[TemplateStorage.getAll] Migrating old templates to include setDetails');
        await AsyncStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(migratedTemplates));
      }
      
      console.log('[TemplateStorage.getAll] Returning', migratedTemplates.length, 'templates');
      if (migratedTemplates.length > 0 && migratedTemplates[0].exercises.length > 0) {
        console.log('[TemplateStorage.getAll] First template first exercise setDetails:', migratedTemplates[0].exercises[0].setDetails);
      }
      
      return migratedTemplates;
    } catch (error) {
      console.error('Error loading templates:', error);
      return [];
    }
  },

  async getById(id: string): Promise<WorkoutTemplate | null> {
    try {
      const templates = await this.getAll();
      return templates.find((t) => t.id === id) || null;
    } catch (error) {
      console.error('Error loading template:', error);
      return null;
    }
  },

  async save(template: WorkoutTemplate): Promise<void> {
    try {
      console.log('[TemplateStorage.save] Saving template:', template.name);
      console.log('[TemplateStorage.save] Template exercises count:', template.exercises.length);
      if (template.exercises.length > 0) {
        console.log('[TemplateStorage.save] First exercise:', template.exercises[0].name);
        console.log('[TemplateStorage.save] First exercise setDetails:', template.exercises[0].setDetails);
        console.log('[TemplateStorage.save] First exercise sets:', template.exercises[0].sets);
      }
      
      const templates = await this.getAll();
      const index = templates.findIndex((t) => t.id === template.id);

      if (index >= 0) {
        templates[index] = template;
      } else {
        templates.push(template);
      }

      const jsonString = JSON.stringify(templates);
      console.log('[TemplateStorage.save] JSON string length:', jsonString.length);
      console.log('[TemplateStorage.save] First 500 chars:', jsonString.substring(0, 500));
      
      await AsyncStorage.setItem(STORAGE_KEYS.TEMPLATES, jsonString);
    } catch (error) {
      console.error('Error saving template:', error);
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      const templates = await this.getAll();
      const filtered = templates.filter((t) => t.id !== id);
      await AsyncStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error deleting template:', error);
      throw error;
    }
  },

  async duplicate(id: string): Promise<WorkoutTemplate | null> {
    try {
      const template = await this.getById(id);
      if (!template) return null;

      const newTemplate: WorkoutTemplate = {
        ...template,
        id: generateId(),
        name: `${template.name} (Copy)`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await this.save(newTemplate);
      return newTemplate;
    } catch (error) {
      console.error('Error duplicating template:', error);
      return null;
    }
  },
};

/**
 * Workouts Storage
 */
export const WorkoutStorage = {
  async getAll(): Promise<CompletedWorkout[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.WORKOUTS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading workouts:', error);
      return [];
    }
  },

  async getById(id: string): Promise<CompletedWorkout | null> {
    try {
      const workouts = await this.getAll();
      return workouts.find((w) => w.id === id) || null;
    } catch (error) {
      console.error('Error loading workout:', error);
      return null;
    }
  },

  async getByDate(date: Date): Promise<CompletedWorkout[]> {
    try {
      const workouts = await this.getAll();
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      return workouts.filter(
        (w) => w.startTime >= startOfDay.getTime() && w.startTime <= endOfDay.getTime()
      );
    } catch (error) {
      console.error('Error loading workouts by date:', error);
      return [];
    }
  },

  async getTodayWorkouts(): Promise<CompletedWorkout[]> {
    return this.getByDate(new Date());
  },

  async save(workout: CompletedWorkout): Promise<void> {
    try {
      const workouts = await this.getAll();
      const index = workouts.findIndex((w) => w.id === workout.id);

      if (index >= 0) {
        workouts[index] = workout;
      } else {
        workouts.push(workout);
      }

      await AsyncStorage.setItem(STORAGE_KEYS.WORKOUTS, JSON.stringify(workouts));
    } catch (error) {
      console.error('Error saving workout:', error);
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      const workouts = await this.getAll();
      const filtered = workouts.filter((w) => w.id !== id);
      await AsyncStorage.setItem(STORAGE_KEYS.WORKOUTS, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error deleting workout:', error);
      throw error;
    }
  },
};

/**
 * Settings Storage
 */
export const SettingsStorage = {
  async get(): Promise<AppSettings> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? JSON.parse(data) : DEFAULT_SETTINGS;
    } catch (error) {
      console.error('Error loading settings:', error);
      return DEFAULT_SETTINGS;
    }
  },

  async update(settings: Partial<AppSettings>): Promise<AppSettings> {
    try {
      const current = await this.get();
      const updated = {
        ...current,
        ...settings,
        lastUpdated: Date.now(),
      };
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
      return updated;
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  },

  async setWeightUnit(unit: WeightUnit): Promise<void> {
    await this.update({ weightUnit: unit });
  },

  async setTheme(theme: 'light' | 'dark' | 'auto'): Promise<void> {
    await this.update({ theme });
  },
};

/**
 * Custom Exercises Storage
 */
export const CustomExerciseStorage = {
  async getAll(): Promise<ExerciseMetadata[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CUSTOM_EXERCISES);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading custom exercises:', error);
      return [];
    }
  },

  async save(exercise: ExerciseMetadata): Promise<void> {
    try {
      const exercises = await this.getAll();
      const index = exercises.findIndex((ex) => ex.name === exercise.name);

      if (index >= 0) {
        exercises[index] = exercise;
      } else {
        exercises.push(exercise);
      }

      await AsyncStorage.setItem(STORAGE_KEYS.CUSTOM_EXERCISES, JSON.stringify(exercises));
    } catch (error) {
      console.error('Error saving custom exercise:', error);
      throw error;
    }
  },

  async delete(name: string): Promise<void> {
    try {
      const exercises = await this.getAll();
      const filtered = exercises.filter((ex) => ex.name !== name);
      await AsyncStorage.setItem(STORAGE_KEYS.CUSTOM_EXERCISES, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error deleting custom exercise:', error);
      throw error;
    }
  },

  /**
   * Update an exercise and sync changes to all templates using it
   * @param oldName - The original exercise name (before edit)
   * @param updatedExercise - The updated exercise metadata
   */
  async updateAndSync(oldName: string, updatedExercise: ExerciseMetadata): Promise<void> {
    try {
      // Save the updated exercise
      await this.save(updatedExercise);

      // Get all templates
      const templates = await TemplateStorage.getAll();
      let templatesUpdated = false;

      // Update each template that contains this exercise
      const updatedTemplates = templates.map(template => {
        const updatedExercises = template.exercises.map(exercise => {
          // Match by old name (in case name was changed)
          if (exercise.name === oldName) {
            templatesUpdated = true;
            console.log(`[CustomExerciseStorage] Syncing exercise "${oldName}" -> "${updatedExercise.name}" in template "${template.name}"`);
            
            // Update exercise metadata while preserving template-specific data (sets, reps, weights, notes, rest timer)
            return {
              ...exercise,
              name: updatedExercise.name,
              type: updatedExercise.exerciseType || updatedExercise.type || exercise.type,
              primaryMuscle: updatedExercise.primaryMuscle,
              secondaryMuscles: updatedExercise.secondaryMuscles,
            };
          }
          return exercise;
        });

        return {
          ...template,
          exercises: updatedExercises,
          updatedAt: Date.now(),
        };
      });

      // Save all updated templates if any changes were made
      if (templatesUpdated) {
        await AsyncStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(updatedTemplates));
        console.log(`[CustomExerciseStorage] Synced exercise "${oldName}" to all templates`);
      }
    } catch (error) {
      console.error('Error updating and syncing custom exercise:', error);
      throw error;
    }
  },
};

/**
 * Body Weight Log Storage
 */
export const BodyWeightStorage = {
  async getAll(): Promise<BodyWeightLog[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.BODY_WEIGHT);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading body weight logs:', error);
      return [];
    }
  },

  /**
   * Ensures there is a body weight entry for every day from the first entry to today.
   * Backfills missing days with the most recent known weight.
   * If no entries exist, creates an initial entry with default 70kg.
   * Should be called on app launch.
   */
  async ensureDailyEntries(): Promise<void> {
    try {
      const logs = await this.getAll();
      
      // If no entries exist, create initial entry with default 70kg
      if (logs.length === 0) {
        const today = new Date().toISOString().split('T')[0];
        const initialEntry: BodyWeightLog = {
          date: today,
          weight: 70,
          unit: 'kg',
          timestamp: Date.now(),
        };
        await AsyncStorage.setItem(STORAGE_KEYS.BODY_WEIGHT, JSON.stringify([initialEntry]));
        return;
      }

      // Sort by date to find the earliest entry
      const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
      const firstDate = new Date(sorted[0].date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Create a map of existing entries by date
      const existingByDate = new Map<string, BodyWeightLog>();
      logs.forEach(log => existingByDate.set(log.date, log));

      // Iterate through each day from first entry to today
      const newEntries: BodyWeightLog[] = [];
      let lastKnownWeight = sorted[0].weight;
      let lastKnownUnit = sorted[0].unit;

      for (let d = new Date(firstDate); d <= today; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        
        if (existingByDate.has(dateStr)) {
          // Update last known weight from existing entry
          const existing = existingByDate.get(dateStr)!;
          lastKnownWeight = existing.weight;
          lastKnownUnit = existing.unit;
        } else {
          // Create missing entry with last known weight
          newEntries.push({
            date: dateStr,
            weight: lastKnownWeight,
            unit: lastKnownUnit,
            timestamp: new Date(dateStr).getTime(),
          });
        }
      }

      // Save new entries if any were created
      if (newEntries.length > 0) {
        const allLogs = [...logs, ...newEntries];
        allLogs.sort((a, b) => b.timestamp - a.timestamp);
        await AsyncStorage.setItem(STORAGE_KEYS.BODY_WEIGHT, JSON.stringify(allLogs));
      }
    } catch (error) {
      console.error('Error ensuring daily body weight entries:', error);
      throw error;
    }
  },

  async getTodayWeight(): Promise<BodyWeightLog | null> {
    try {
      const logs = await this.getAll();
      // Return the most recent bodyweight entry (logs are sorted newest first)
      return logs.length > 0 ? logs[0] : null;
    } catch (error) {
      console.error('Error getting today weight:', error);
      return null;
    }
  },

  async getWeightForDate(date: Date): Promise<BodyWeightLog | null> {
    try {
      const logs = await this.getAll();
      const dateStr = date.toISOString().split('T')[0];
      
      // Find the most recent bodyweight entry on or before the given date
      const relevantLogs = logs.filter(log => log.date <= dateStr);
      relevantLogs.sort((a, b) => b.date.localeCompare(a.date)); // Sort by date descending
      
      return relevantLogs.length > 0 ? relevantLogs[0] : null;
    } catch (error) {
      console.error('Error getting weight for date:', error);
      return null;
    }
  },

  async save(log: BodyWeightLog): Promise<void> {
    try {
      const logs = await this.getAll();
      
      // Find existing entry for this date and update it
      const existingIndex = logs.findIndex((l) => l.date === log.date);
      
      if (existingIndex >= 0) {
        // Update existing entry for this date
        logs[existingIndex] = log;
      } else {
        // Create new entry if date doesn't exist
        logs.push(log);
      }

      // Sort by timestamp descending (newest first)
      logs.sort((a, b) => b.timestamp - a.timestamp);

      await AsyncStorage.setItem(STORAGE_KEYS.BODY_WEIGHT, JSON.stringify(logs));
    } catch (error) {
      console.error('Error saving body weight log:', error);
      throw error;
    }
  },

  async update(timestamp: number, updatedLog: BodyWeightLog): Promise<void> {
    try {
      const logs = await this.getAll();
      const index = logs.findIndex((l) => l.timestamp === timestamp);

      if (index >= 0) {
        logs[index] = updatedLog;
        // Sort by timestamp descending
        logs.sort((a, b) => b.timestamp - a.timestamp);
        await AsyncStorage.setItem(STORAGE_KEYS.BODY_WEIGHT, JSON.stringify(logs));
      }
    } catch (error) {
      console.error('Error updating body weight log:', error);
      throw error;
    }
  },

  async delete(timestamp: number): Promise<void> {
    try {
      const logs = await this.getAll();
      const filtered = logs.filter((log) => log.timestamp !== timestamp);
      await AsyncStorage.setItem(STORAGE_KEYS.BODY_WEIGHT, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error deleting body weight log:', error);
      throw error;
    }
  },
};

/**
 * Active Workout State Storage
 */
export const ActiveWorkoutStorage = {
  async get(): Promise<{
    name: string;
    startTime: number;
    templateId?: string;
    templateName?: string;
    // Optional snapshot of active workout data (for restore after app restart)
    exercises?: any[];
    bodyweight?: number;
    disabledTimers?: string[];
    collapsedDisplayKeys?: string[];
  } | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_WORKOUT);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting active workout state:', error);
      return null;
    }
  },

  async set(state: {
    name: string;
    startTime: number;
    templateId?: string;
    templateName?: string;
    exercises?: any[];
    bodyweight?: number;
    disabledTimers?: string[];
    collapsedDisplayKeys?: string[];
  }): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_WORKOUT, JSON.stringify(state));
    } catch (error) {
      console.error('Error saving active workout state:', error);
      throw error;
    }
  },

  async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_WORKOUT);
    } catch (error) {
      console.error('Error clearing active workout state:', error);
      throw error;
    }
  },
};

/**
 * Exercise Detail - Volume Chart Preferences
 * Stores user preferences for the Exercise Details "Volume Progression" chart.
 */
export const ExerciseDetailChartPrefsStorage = {
  async get(): Promise<ExerciseDetailChartPrefs | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.EXERCISE_DETAIL_CHART_PREFS);
      return data ? (JSON.parse(data) as ExerciseDetailChartPrefs) : null;
    } catch (error) {
      console.error('Error getting exercise detail chart prefs:', error);
      return null;
    }
  },

  async set(prefs: ExerciseDetailChartPrefs): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.EXERCISE_DETAIL_CHART_PREFS, JSON.stringify(prefs));
    } catch (error) {
      console.error('Error saving exercise detail chart prefs:', error);
      throw error;
    }
  },

  async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.EXERCISE_DETAIL_CHART_PREFS);
    } catch (error) {
      console.error('Error clearing exercise detail chart prefs:', error);
      throw error;
    }
  },
};

/**
 * Exercise Volume Log Storage
 */
export const ExerciseVolumeStorage = {
  inferSource(log: ExerciseVolumeLog): 'workout' | 'manual' {
    const src = (log as any).source;
    if (src === 'workout' || src === 'manual') return src;
    // Heuristic for legacy manual entries created before `source` existed.
    return log.reps === 0 && log.weight === 0 ? 'manual' : 'workout';
  },

  normalize(log: ExerciseVolumeLog): ExerciseVolumeLog {
    const source = this.inferSource(log);
    return { ...log, source };
  },

  /**
   * Get all volume logs for a specific exercise
   */
  async getForExercise(exerciseId: string): Promise<ExerciseVolumeLog[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.EXERCISE_VOLUME);
      if (!data) return [];
      
      const allLogs: ExerciseVolumeLog[] = JSON.parse(data);
      return allLogs
        .filter(log => log.exerciseId === exerciseId)
        .map((l) => this.normalize(l))
        .sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Error loading exercise volume logs:', error);
      return [];
    }
  },

  /**
   * Get all volume logs (for all exercises)
   */
  async getAll(): Promise<ExerciseVolumeLog[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.EXERCISE_VOLUME);
      const all = data ? (JSON.parse(data) as ExerciseVolumeLog[]) : [];
      return all.map((l) => this.normalize(l));
    } catch (error) {
      console.error('Error loading all exercise volume logs:', error);
      return [];
    }
  },

  /**
   * Save or update a volume entry for a specific exercise and date
   * If an entry exists for this exercise and date, only update if new volume is higher
   */
  async saveOrUpdate(log: ExerciseVolumeLog): Promise<void> {
    try {
      const normalized = { ...log, source: 'workout' as const };
      const allLogs = await this.getAll();

      // If a manual entry exists for this exercise+date, keep it (manual overrides computed logs).
      const hasManual = allLogs.some((l) =>
        l.exerciseId === normalized.exerciseId &&
        l.date === normalized.date &&
        this.inferSource(l) === 'manual'
      );
      if (hasManual) {
        return;
      }
      
      // Find existing entry for this exercise and date
      const existingIndex = allLogs.findIndex(
        l => l.exerciseId === normalized.exerciseId && l.date === normalized.date && this.inferSource(l) === 'workout'
      );
      
      if (existingIndex >= 0) {
        // Only update if new volume is higher
        if (normalized.volume > allLogs[existingIndex].volume) {
          allLogs[existingIndex] = normalized;
        }
      } else {
        // Create new entry if date doesn't exist
        allLogs.push(normalized);
      }

      // Sort by timestamp descending (newest first)
      allLogs.sort((a, b) => b.timestamp - a.timestamp);

      await AsyncStorage.setItem(STORAGE_KEYS.EXERCISE_VOLUME, JSON.stringify(allLogs));
    } catch (error) {
      console.error('Error saving exercise volume log:', error);
      throw error;
    }
  },

  /**
   * Manually add or update a volume entry (for manual entry via history modal)
   * This will overwrite existing entry for the date regardless of volume
   */
  async save(log: ExerciseVolumeLog): Promise<void> {
    try {
      const normalized = { ...log, source: 'manual' as const };
      const allLogs = await this.getAll();
      
      // Find existing entry for this exercise and date
      const existingIndex = allLogs.findIndex(
        l => l.exerciseId === normalized.exerciseId && l.date === normalized.date
      );
      
      if (existingIndex >= 0) {
        // Update existing entry
        allLogs[existingIndex] = normalized;
      } else {
        // Create new entry
        allLogs.push(normalized);
      }

      // Sort by timestamp descending (newest first)
      allLogs.sort((a, b) => b.timestamp - a.timestamp);

      await AsyncStorage.setItem(STORAGE_KEYS.EXERCISE_VOLUME, JSON.stringify(allLogs));
    } catch (error) {
      console.error('Error saving exercise volume log:', error);
      throw error;
    }
  },

  /**
   * Overwrite the computed (workout-sourced) daily best entry for an exercise+date.
   * Will not overwrite a manual entry for the same exercise+date.
   */
  async upsertWorkoutDailyBest(log: ExerciseVolumeLog): Promise<void> {
    const normalized = { ...log, source: 'workout' as const };
    const allLogs = await this.getAll();

    const hasManual = allLogs.some((l) =>
      l.exerciseId === normalized.exerciseId &&
      l.date === normalized.date &&
      this.inferSource(l) === 'manual'
    );
    if (hasManual) return;

    const existingIndex = allLogs.findIndex(
      (l) => l.exerciseId === normalized.exerciseId && l.date === normalized.date && this.inferSource(l) === 'workout'
    );

    if (existingIndex >= 0) allLogs[existingIndex] = normalized;
    else allLogs.push(normalized);

    allLogs.sort((a, b) => b.timestamp - a.timestamp);
    await AsyncStorage.setItem(STORAGE_KEYS.EXERCISE_VOLUME, JSON.stringify(allLogs));
  },

  /**
   * Delete the computed (workout-sourced) daily best entry for an exercise+date.
   * Will not delete manual entries.
   */
  async deleteWorkoutDailyBest(exerciseId: string, date: string): Promise<void> {
    const allLogs = await this.getAll();
    const filtered = allLogs.filter((l) => {
      if (l.exerciseId !== exerciseId) return true;
      if (l.date !== date) return true;
      return this.inferSource(l) !== 'workout';
    });
    await AsyncStorage.setItem(STORAGE_KEYS.EXERCISE_VOLUME, JSON.stringify(filtered));
  },

  /**
   * Update an existing volume entry by timestamp
   */
  async update(timestamp: number, updatedLog: ExerciseVolumeLog): Promise<void> {
    try {
      const allLogs = await this.getAll();
      const index = allLogs.findIndex(l => l.timestamp === timestamp);

      if (index >= 0) {
        allLogs[index] = updatedLog;
        // Sort by timestamp descending
        allLogs.sort((a, b) => b.timestamp - a.timestamp);
        await AsyncStorage.setItem(STORAGE_KEYS.EXERCISE_VOLUME, JSON.stringify(allLogs));
      }
    } catch (error) {
      console.error('Error updating exercise volume log:', error);
      throw error;
    }
  },

  /**
   * Delete a volume entry by timestamp
   */
  async delete(timestamp: number): Promise<void> {
    try {
      const allLogs = await this.getAll();
      const filtered = allLogs.filter(log => log.timestamp !== timestamp);
      await AsyncStorage.setItem(STORAGE_KEYS.EXERCISE_VOLUME, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error deleting exercise volume log:', error);
      throw error;
    }
  },
};

/**
 * Predefined Exercise Customizations Storage
 * Stores customized muscle groups and contributions for predefined exercises
 */
export const PredefinedExerciseCustomizationStorage = {
  async getAll(): Promise<Record<string, { primaryMuscle?: MuscleGroup; secondaryMuscles?: MuscleGroup[]; muscleContributions?: Record<MuscleGroup, number>; exerciseType?: ExerciseType; type?: ExerciseType }>> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PREDEFINED_EXERCISE_CUSTOMIZATIONS);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Error loading predefined exercise customizations:', error);
      return {};
    }
  },

  async save(exerciseName: string, customization: { primaryMuscle?: MuscleGroup; secondaryMuscles?: MuscleGroup[]; muscleContributions?: Record<MuscleGroup, number>; exerciseType?: ExerciseType; type?: ExerciseType }): Promise<void> {
    try {
      const customizations = await this.getAll();
      customizations[exerciseName] = customization;
      await AsyncStorage.setItem(STORAGE_KEYS.PREDEFINED_EXERCISE_CUSTOMIZATIONS, JSON.stringify(customizations));
    } catch (error) {
      console.error('Error saving predefined exercise customization:', error);
      throw error;
    }
  },

  async delete(exerciseName: string): Promise<void> {
    try {
      const customizations = await this.getAll();
      delete customizations[exerciseName];
      await AsyncStorage.setItem(STORAGE_KEYS.PREDEFINED_EXERCISE_CUSTOMIZATIONS, JSON.stringify(customizations));
    } catch (error) {
      console.error('Error deleting predefined exercise customization:', error);
      throw error;
    }
  },

  async reset(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PREDEFINED_EXERCISE_CUSTOMIZATIONS, JSON.stringify({}));
    } catch (error) {
      console.error('Error resetting predefined exercise customizations:', error);
      throw error;
    }
  },
};

/**
 * Failure Set Data Storage
 * Stores failure set data points for accurate rep max estimation
 * Data is keyed by exercise name (normalized to lowercase)
 */
export const FailureSetStorage = {
  /**
   * Get all failure data for a specific exercise
   */
  async getForExercise(exerciseName: string): Promise<FailureSetData[]> {
    try {
      const allData = await this.getAll();
      const key = exerciseName.toLowerCase().trim();
      return allData[key] || [];
    } catch (error) {
      console.error('Error loading failure set data:', error);
      return [];
    }
  },

  /**
   * Get all failure data keyed by exercise name
   */
  async getAll(): Promise<Record<string, FailureSetData[]>> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.FAILURE_SET_DATA);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Error loading all failure set data:', error);
      return {};
    }
  },

  /**
   * Add a failure set data point for an exercise
   * Applies deduplication logic:
   * - If new data has same weight with more reps → remove lower rep points at that weight
   * - If new data has same reps with more weight → replace old data at those reps
   * - Remove any logically inconsistent points (e.g., 5RM < 8RM)
   */
  async add(exerciseName: string, dataPoint: FailureSetData): Promise<void> {
    try {
      const allData = await this.getAll();
      const key = exerciseName.toLowerCase().trim();
      let existingData = allData[key] || [];

      // Apply deduplication logic
      existingData = this.deduplicateData(existingData, dataPoint);
      
      // Add the new data point
      existingData.push(dataPoint);
      
      // Sort by reps ascending for consistent display
      existingData.sort((a, b) => a.reps - b.reps);
      
      allData[key] = existingData;
      await AsyncStorage.setItem(STORAGE_KEYS.FAILURE_SET_DATA, JSON.stringify(allData));
    } catch (error) {
      console.error('Error adding failure set data:', error);
      throw error;
    }
  },

  /**
   * Replace all failure data points for an exercise.
   * Useful for rebuilding after editing historical workouts.
   */
  async replaceForExercise(exerciseName: string, dataPoints: FailureSetData[]): Promise<void> {
    try {
      const allData = await this.getAll();
      const key = exerciseName.toLowerCase().trim();
      if (dataPoints.length === 0) {
        delete allData[key];
      } else {
        allData[key] = dataPoints;
      }
      await AsyncStorage.setItem(STORAGE_KEYS.FAILURE_SET_DATA, JSON.stringify(allData));
    } catch (error) {
      console.error('Error replacing failure set data:', error);
      throw error;
    }
  },

  /**
   * Deduplication logic to maintain a consistent strength curve
   * Rules:
   * 1. Same weight, more reps achieved → remove lower rep points at that weight
   * 2. Same reps, more weight achieved → replace old data at those reps
   * 3. If new point creates logical inconsistency, remove conflicting older points
   */
  deduplicateData(existing: FailureSetData[], newPoint: FailureSetData): FailureSetData[] {
    return existing.filter((point) => {
      // Rule 1: Same weight - if new point has more reps at same weight, old lower-rep point is invalid
      if (Math.abs(point.weight - newPoint.weight) < 0.01) {
        // Same weight: keep only if it has MORE reps than the new point
        // (meaning it was a better performance at that weight)
        if (point.reps <= newPoint.reps) {
          return false; // Remove: new point achieves same or more reps at same weight
        }
      }
      
      // Rule 2: Same reps - newer data replaces older data at same rep count
      if (point.reps === newPoint.reps) {
        return false; // Remove: new data point replaces old at same rep count
      }
      
      // Rule 3: Logical consistency - lower reps should mean higher weight
      // If old point has FEWER reps but LESS weight than new point, it's inconsistent
      if (point.reps < newPoint.reps && point.weight < newPoint.weight) {
        return false; // Remove: illogical (fewer reps should lift MORE weight, not less)
      }
      
      // If old point has MORE reps but MORE weight than new point, it's inconsistent
      if (point.reps > newPoint.reps && point.weight > newPoint.weight) {
        return false; // Remove: illogical (more reps should lift LESS weight, not more)
      }
      
      return true; // Keep this point
    });
  },

  /**
   * Delete a specific failure data point
   */
  async delete(exerciseName: string, timestamp: number): Promise<void> {
    try {
      const allData = await this.getAll();
      const key = exerciseName.toLowerCase().trim();
      if (allData[key]) {
        allData[key] = allData[key].filter((d) => d.timestamp !== timestamp);
        if (allData[key].length === 0) {
          delete allData[key];
        }
        await AsyncStorage.setItem(STORAGE_KEYS.FAILURE_SET_DATA, JSON.stringify(allData));
      }
    } catch (error) {
      console.error('Error deleting failure set data:', error);
      throw error;
    }
  },

  /**
   * Clear all failure data for an exercise
   */
  async clearForExercise(exerciseName: string): Promise<void> {
    try {
      const allData = await this.getAll();
      const key = exerciseName.toLowerCase().trim();
      delete allData[key];
      await AsyncStorage.setItem(STORAGE_KEYS.FAILURE_SET_DATA, JSON.stringify(allData));
    } catch (error) {
      console.error('Error clearing failure set data:', error);
      throw error;
    }
  },

  /**
   * Clear all failure data
   */
  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.FAILURE_SET_DATA);
    } catch (error) {
      console.error('Error clearing all failure set data:', error);
      throw error;
    }
  },
};

/**
 * Utility Functions
 */
export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Category-Based Data Clearing Functions
// ============================================================================

/**
 * Clear Workout History category
 * Includes: completed workouts, achievements, exercise volume logs
 * These are grouped because achievements are derived from workout data
 */
export async function clearWorkoutHistory(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.WORKOUTS,
      STORAGE_KEYS.ACHIEVEMENTS,
      STORAGE_KEYS.EXERCISE_VOLUME,
    ]);
  } catch (error) {
    console.error('Error clearing workout history:', error);
    throw error;
  }
}

/**
 * Clear Templates category
 */
export async function clearTemplates(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.TEMPLATES);
  } catch (error) {
    console.error('Error clearing templates:', error);
    throw error;
  }
}

/**
 * Clear Body Weight category
 */
export async function clearBodyWeight(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.BODY_WEIGHT);
  } catch (error) {
    console.error('Error clearing body weight:', error);
    throw error;
  }
}

/**
 * Clear Exercises category
 * Includes: custom exercises and predefined exercise customizations
 */
export async function clearExercises(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.CUSTOM_EXERCISES,
      STORAGE_KEYS.PREDEFINED_EXERCISE_CUSTOMIZATIONS,
    ]);
  } catch (error) {
    console.error('Error clearing exercises:', error);
    throw error;
  }
}

/**
 * UI Preference keys that are part of the Settings category
 */
const UI_PREFERENCE_KEYS = [
  'selectedMusclesForSpider',
  'bodyWeightChartSettings',
  'spiderChartLastWeek',
];

/**
 * Clear Settings category
 * Includes: app settings and UI preferences (chart settings, spider muscles, etc.)
 */
export async function clearSettings(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.SETTINGS,
      STORAGE_KEYS.EXERCISE_DETAIL_CHART_PREFS,
      ...UI_PREFERENCE_KEYS,
    ]);
  } catch (error) {
    console.error('Error clearing settings:', error);
    throw error;
  }
}

/**
 * Clear selected categories
 */
export async function clearSelectedCategories(options: {
  workoutHistory?: boolean;
  templates?: boolean;
  bodyWeight?: boolean;
  exercises?: boolean;
  settings?: boolean;
}): Promise<void> {
  const promises: Promise<void>[] = [];
  
  if (options.workoutHistory) promises.push(clearWorkoutHistory());
  if (options.templates) promises.push(clearTemplates());
  if (options.bodyWeight) promises.push(clearBodyWeight());
  if (options.exercises) promises.push(clearExercises());
  if (options.settings) promises.push(clearSettings());
  
  await Promise.all(promises);
}

// ============================================================================
// Legacy Clear Functions (kept for backward compatibility)
// ============================================================================

/**
 * @deprecated Use clearWorkoutHistory() instead
 * Clear only workout data (keeps templates, exercises, settings, body weight)
 */
export async function clearWorkoutData(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.WORKOUTS);
  } catch (error) {
    console.error('Error clearing workout data:', error);
    throw error;
  }
}

/**
 * Clear all data (complete reset)
 */
export async function clearAllData(): Promise<void> {
  try {
    // Clear all known storage keys
    await AsyncStorage.multiRemove([
      ...Object.values(STORAGE_KEYS),
      ...UI_PREFERENCE_KEYS,
    ]);
  } catch (error) {
    console.error('Error clearing all data:', error);
    throw error;
  }
}
