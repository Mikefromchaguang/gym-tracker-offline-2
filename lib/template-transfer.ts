/**
 * Template Export/Import Utilities
 * Handles exporting and importing workout templates with custom exercises
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { WorkoutTemplate, ExerciseMetadata, MuscleGroup } from './types';
import { PRIMARY_MUSCLE_GROUPS } from './muscle-groups';

export interface TemplateExportData {
  fileType: 'gym-tracker-template';
  version: string;
  exportDate: string;
  template: WorkoutTemplate;
  customExercises: ExerciseMetadata[];
}

export interface TemplateImportResult {
  success: boolean;
  template?: WorkoutTemplate;
  customExercises?: ExerciseMetadata[];
  error?: string;
}

const CURRENT_VERSION = '1.0';
const MAX_FILE_SIZE = 1024 * 1024; // 1MB

/**
 * Export a template with its custom exercises to a JSON file
 */
export async function exportTemplate(
  template: WorkoutTemplate,
  allCustomExercises: ExerciseMetadata[]
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  try {
    // Find custom exercises used in this template
    const templateExerciseNames = template.exercises.map(e => e.name);
    const customExercisesInTemplate = allCustomExercises.filter(ce =>
      templateExerciseNames.includes(ce.name)
    );

    // Create export data
    const exportData: TemplateExportData = {
      fileType: 'gym-tracker-template',
      version: CURRENT_VERSION,
      exportDate: new Date().toISOString().split('T')[0],
      template,
      customExercises: customExercisesInTemplate,
    };

    const jsonData = JSON.stringify(exportData, null, 2);

    // Generate filename
    const sanitizedName = template.name.replace(/[^a-z0-9]/gi, '-');
    const date = new Date().toISOString().split('T')[0];
    const filename = `Template-${sanitizedName}-${date}.json`;

    if (Platform.OS === 'web') {
      // For web, create a blob and trigger download
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return { success: true, filePath: filename };
    } else if (Platform.OS === 'android') {
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
        
        // Write the template data
        await FileSystem.writeAsStringAsync(fileUri, jsonData, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        
        return { success: true, filePath: filename };
      } catch (error) {
        console.error('Error saving to Downloads:', error);
        // Fallback to share sheet if SAF fails
        const filepath = `${FileSystem.cacheDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(filepath, jsonData);
        await Sharing.shareAsync(filepath, {
          mimeType: 'application/json',
          dialogTitle: 'Save Template',
        });
        return { success: true, filePath: filename };
      }
    } else {
      // iOS: Use share sheet (iOS doesn't allow direct Downloads folder access)
      const filepath = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(filepath, jsonData);
      
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(filepath, {
          mimeType: 'application/json',
          dialogTitle: 'Save Template',
          UTI: 'public.json',
        });
        return { success: true, filePath: filename };
      } else {
        throw new Error('Sharing not available');
      }
    }
  } catch (error) {
    console.error('Template export error:', error);
    return { success: false, error: 'Failed to export template' };
  }
}

/**
 * Validate imported template data
 */
function validateTemplateData(data: any): { valid: boolean; error?: string } {
  // Check file type
  if (data.fileType !== 'gym-tracker-template') {
    return { valid: false, error: 'Invalid file type' };
  }

  // Check version (for now, only support 1.0)
  if (!data.version || data.version !== '1.0') {
    return { valid: false, error: 'Unsupported template version' };
  }

  // Check template structure
  if (!data.template || typeof data.template !== 'object') {
    return { valid: false, error: 'Invalid template data' };
  }

  const template = data.template;

  // Check required template fields
  if (!template.name || typeof template.name !== 'string') {
    return { valid: false, error: 'Template name is required' };
  }

  if (!Array.isArray(template.exercises)) {
    return { valid: false, error: 'Template exercises must be an array' };
  }

  if (template.exercises.length === 0) {
    return { valid: false, error: 'Template must have at least one exercise' };
  }

  // Validate each exercise
  for (const exercise of template.exercises) {
    if (!exercise.name || typeof exercise.name !== 'string') {
      return { valid: false, error: 'Exercise name is required' };
    }

    if (!exercise.type || !['weighted', 'bodyweight', 'assisted-bodyweight', 'weighted-bodyweight'].includes(exercise.type)) {
      return { valid: false, error: `Invalid exercise type: ${exercise.type}` };
    }

    if (!Array.isArray(exercise.setDetails)) {
      return { valid: false, error: 'Exercise setDetails must be an array' };
    }
  }

  // Validate custom exercises
  if (data.customExercises && !Array.isArray(data.customExercises)) {
    return { valid: false, error: 'Custom exercises must be an array' };
  }

  if (data.customExercises) {
    for (const customEx of data.customExercises) {
      if (!customEx.name || typeof customEx.name !== 'string') {
        return { valid: false, error: 'Custom exercise name is required' };
      }

      if (!customEx.primaryMuscle || !PRIMARY_MUSCLE_GROUPS.includes(customEx.primaryMuscle as MuscleGroup)) {
        return { valid: false, error: `Invalid primary muscle: ${customEx.primaryMuscle}` };
      }

      if (customEx.secondaryMuscles && !Array.isArray(customEx.secondaryMuscles)) {
        return { valid: false, error: 'Secondary muscles must be an array' };
      }
    }
  }

  return { valid: true };
}

/**
 * Import a template from JSON file content
 */
export async function importTemplate(
  fileContent: string,
  existingTemplates: WorkoutTemplate[],
  existingCustomExercises: ExerciseMetadata[]
): Promise<TemplateImportResult> {
  try {
    // Check file size
    if (fileContent.length > MAX_FILE_SIZE) {
      return { success: false, error: 'File is too large (max 1MB)' };
    }

    // Parse JSON
    let data: any;
    try {
      data = JSON.parse(fileContent);
    } catch (e) {
      return { success: false, error: 'Invalid JSON file' };
    }

    // Validate data
    const validation = validateTemplateData(data);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const importedTemplate: WorkoutTemplate = data.template;
    const importedCustomExercises: ExerciseMetadata[] = data.customExercises || [];

    // Handle duplicate template name
    let finalTemplateName = importedTemplate.name;
    let counter = 2;
    while (existingTemplates.some(t => t.name === finalTemplateName)) {
      finalTemplateName = `${importedTemplate.name} (${counter})`;
      counter++;
    }
    importedTemplate.name = finalTemplateName;

    // Generate new template ID
    importedTemplate.id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Handle custom exercise conflicts
    // Only import exercises that don't already exist (by name)
    // If an exercise with the same name exists, use the existing one regardless of definition differences
    const customExercisesToAdd: ExerciseMetadata[] = [];
    for (const importedEx of importedCustomExercises) {
      const existingEx = existingCustomExercises.find(e => e.name === importedEx.name);
      
      if (!existingEx) {
        // Exercise doesn't exist, import it
        customExercisesToAdd.push(importedEx);
      }
      // If exercise exists (even with different definition), skip import and use existing
    }

    return {
      success: true,
      template: importedTemplate,
      customExercises: customExercisesToAdd,
    };
  } catch (error) {
    console.error('Template import error:', error);
    return { success: false, error: 'Failed to import template' };
  }
}
