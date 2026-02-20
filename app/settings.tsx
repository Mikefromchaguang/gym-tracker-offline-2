/**
 * Settings Tab - App configuration
 */

import { ScrollView, Text, View, Alert, TextInput, Modal, Pressable } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useGym } from '@/lib/gym-context';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/use-colors';
import { useCallback, useState, useMemo } from 'react';
import { exportAllData, saveBackupToFile, parseBackupFile, importSelectedCategories, type BackupData, type BackupSummary, type ImportCategoryOptions } from '@/lib/backup';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

interface ImportCategory {
  id: keyof ImportCategoryOptions;
  title: string;
  description: string;
  warning?: string;
  icon: string;
  getCount: (summary: BackupSummary) => string;
}

const IMPORT_CATEGORIES: ImportCategory[] = [
  {
    id: 'workoutHistory',
    title: 'Workout History',
    description: 'Completed workouts, achievements, and exercise volume records.',
    warning: 'Will replace your current workout history and reset achievements.',
    icon: '🏋️',
    getCount: (s) => {
      const parts = [];
      if (s.counts.workouts > 0) parts.push(`${s.counts.workouts} workouts`);
      if (s.counts.achievements > 0) parts.push(`${s.counts.achievements} achievements`);
      return parts.length > 0 ? parts.join(', ') : 'No data';
    },
  },
  {
    id: 'templates',
    title: 'Routines',
    description: 'Saved workout routines, week planner schedules, and their configurations.',
    warning: 'Will replace all your current routines and week planner data.',
    icon: '📋',
    getCount: (s) => {
      const parts = [];
      if (s.counts.templates > 0) parts.push(`${s.counts.templates} routines`);
      if (s.counts.weekPlans > 0) parts.push(`${s.counts.weekPlans} planners`);
      return parts.length > 0 ? parts.join(', ') : 'No data';
    },
  },
  {
    id: 'bodyWeight',
    title: 'Body Weight',
    description: 'Body weight log entries and tracking history.',
    warning: 'Will replace your body weight history.',
    icon: '⚖️',
    getCount: (s) => s.counts.bodyWeightLogs > 0 ? `${s.counts.bodyWeightLogs} entries` : 'No data',
  },
  {
    id: 'exercises',
    title: 'Exercises',
    description: 'Custom exercises and modifications to built-in exercises.',
    warning: 'Will replace your custom exercises and exercise modifications.',
    icon: '🎯',
    getCount: (s) => {
      const parts = [];
      if (s.counts.customExercises > 0) parts.push(`${s.counts.customExercises} custom`);
      if (s.counts.predefinedCustomizations > 0) parts.push(`${s.counts.predefinedCustomizations} modified`);
      return parts.length > 0 ? parts.join(', ') : 'No data';
    },
  },
  {
    id: 'settings',
    title: 'Settings',
    description: 'App preferences, weight unit, theme, rest time, and chart settings.',
    warning: 'Will replace your current app settings.',
    icon: '⚙️',
    getCount: (s) => s.hasSettings || s.hasUIPreferences ? 'Settings found' : 'No data',
  },
];

export default function SettingsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { refreshData } = useGym();

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Import selection modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [parsedBackup, setParsedBackup] = useState<BackupData | null>(null);
  const [backupSummary, setBackupSummary] = useState<BackupSummary | null>(null);
  const [selectedImport, setSelectedImport] = useState<Set<keyof ImportCategoryOptions>>(new Set());

  const handleExportData = useCallback(async () => {
    setIsExporting(true);
    try {
      const jsonData = await exportAllData();
      const filepath = await saveBackupToFile(jsonData);

      if (filepath) {
        Alert.alert(
          'Export Successful',
          `Your data has been exported and saved as:\n${filepath}\n\nYou can import this file later to restore your data.`
        );
      } else {
        Alert.alert('Export Failed', 'Could not save backup file');
      }
    } catch (error) {
      Alert.alert('Export Error', 'Failed to export data. Please try again.');
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  }, []);

  const handleImportData = useCallback(async () => {
    // Show security warning first
    Alert.alert(
      'Security Warning',
      '⚠️ Only import backup files from trusted sources. Malicious files could contain harmful data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'I Understand, Continue',
          onPress: async () => {
            await selectAndParseBackupFile();
          },
        },
      ]
    );
  }, []);

  const selectAndParseBackupFile = useCallback(async () => {
    try {
      if (Platform.OS === 'web') {
        // For web, use file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e: any) => {
          const file = e.target.files?.[0];
          if (!file) return;

          try {
            const text = await file.text();
            const { backup, summary } = parseBackupFile(text);
            setParsedBackup(backup);
            setBackupSummary(summary);
            // Default to selecting categories that have data
            const defaultSelected = new Set<keyof ImportCategoryOptions>();
            if (summary.counts.workouts > 0 || summary.counts.achievements > 0) defaultSelected.add('workoutHistory');
            if (summary.counts.templates > 0) defaultSelected.add('templates');
            if (summary.counts.bodyWeightLogs > 0) defaultSelected.add('bodyWeight');
            if (summary.counts.customExercises > 0 || summary.counts.predefinedCustomizations > 0) defaultSelected.add('exercises');
            if (summary.hasSettings || summary.hasUIPreferences) defaultSelected.add('settings');
            setSelectedImport(defaultSelected);
            setShowImportModal(true);
          } catch (error) {
            Alert.alert('Import Error', 'Failed to parse backup file. The file may be corrupted or invalid.');
            console.error('Parse error:', error);
          }
        };
        input.click();
      } else {
        // For native, use DocumentPicker
        const result = await DocumentPicker.getDocumentAsync({
          type: 'application/json',
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          try {
            const fileContent = await FileSystem.readAsStringAsync(result.assets[0].uri);
            const { backup, summary } = parseBackupFile(fileContent);
            setParsedBackup(backup);
            setBackupSummary(summary);
            // Default to selecting categories that have data
            const defaultSelected = new Set<keyof ImportCategoryOptions>();
            if (summary.counts.workouts > 0 || summary.counts.achievements > 0) defaultSelected.add('workoutHistory');
            if (summary.counts.templates > 0) defaultSelected.add('templates');
            if (summary.counts.bodyWeightLogs > 0) defaultSelected.add('bodyWeight');
            if (summary.counts.customExercises > 0 || summary.counts.predefinedCustomizations > 0) defaultSelected.add('exercises');
            if (summary.hasSettings || summary.hasUIPreferences) defaultSelected.add('settings');
            setSelectedImport(defaultSelected);
            setShowImportModal(true);
          } catch (error) {
            Alert.alert('Import Error', 'Failed to parse backup file. The file may be corrupted or invalid.');
            console.error('Parse error:', error);
          }
        }
      }
    } catch (error: any) {
      if (error.message !== 'User canceled document picker') {
        Alert.alert('Error', 'Failed to select backup file');
        console.error('File picker error:', error);
      }
    }
  }, []);

  const toggleImportCategory = (id: keyof ImportCategoryOptions) => {
    setSelectedImport(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleConfirmImport = useCallback(async () => {
    if (!parsedBackup || selectedImport.size === 0) return;

    setIsImporting(true);
    if (Platform.OS !== 'web') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }

    try {
      await importSelectedCategories(parsedBackup, {
        workoutHistory: selectedImport.has('workoutHistory'),
        templates: selectedImport.has('templates'),
        bodyWeight: selectedImport.has('bodyWeight'),
        exercises: selectedImport.has('exercises'),
        settings: selectedImport.has('settings'),
      });

      await refreshData();

      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setShowImportModal(false);
      setParsedBackup(null);
      setBackupSummary(null);
      setSelectedImport(new Set());

      Alert.alert(
        'Import Successful',
        'Your selected data has been restored. Please restart the app for all changes to take effect.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Import Error', 'Failed to import data. Please try again.');
      console.error('Import error:', error);
    } finally {
      setIsImporting(false);
    }
  }, [parsedBackup, selectedImport, refreshData]);

  const closeImportModal = useCallback(() => {
    setShowImportModal(false);
    setParsedBackup(null);
    setBackupSummary(null);
    setSelectedImport(new Set());
  }, []);

  const backupDateString = useMemo(() => {
    if (!backupSummary?.exportedAt) return '';
    return new Date(backupSummary.exportedAt).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [backupSummary]);

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="gap-6 pb-6">
          {/* Header */}
          <Text className="text-2xl font-bold text-foreground">Data Management</Text>

          {/* Backup & Restore */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Backup & Restore</Text>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Backup Data</CardTitle>
                <CardDescription>
                    Save all your locally stored data (workouts, routines, exercises, settings, body weight, analytics preferences, etc.) to a file
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onPress={handleExportData}
                  disabled={isExporting}
                  className="w-full"
                >
                  {isExporting ? 'Exporting...' : 'Export All Data'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Restore Data</CardTitle>
                <CardDescription>
                  Restore your data from a previously exported backup file. You can choose which categories to import.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onPress={handleImportData}
                  disabled={isImporting}
                  variant="secondary"
                  className="w-full"
                >
                  {isImporting ? 'Importing...' : 'Import Backup File'}
                </Button>
              </CardContent>
            </Card>
          </View>

          {/* Danger Zone */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-error">Danger Zone</Text>
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-error">Delete Data</CardTitle>
                <CardDescription>
                  Selectively delete specific categories of data. These actions cannot be undone.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="destructive"
                  onPress={() => router.push('/settings/danger-zone')}
                  className="w-full"
                >
                  Manage Data Deletion
                </Button>
              </CardContent>
            </Card>
          </View>
        </View>
      </ScrollView>

      {/* Import Selection Modal */}
      <Modal
        visible={showImportModal}
        transparent
        animationType="fade"
        onRequestClose={closeImportModal}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
          onPress={closeImportModal}
        >
          <Pressable
            style={{
              backgroundColor: colors.background,
              borderRadius: 16,
              padding: 24,
              width: '95%',
              maxWidth: 420,
              gap: 16,
              maxHeight: '90%',
            }}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: colors.foreground }}>
                Select Data to Import
              </Text>
              {backupDateString && (
                <Text style={{ fontSize: 13, color: colors.muted }}>
                  Backup from: {backupDateString}
                </Text>
              )}
            </View>

            {/* Warning */}
            <View style={{ 
              backgroundColor: `${colors.warning || '#F59E0B'}15`,
              borderRadius: 8,
              padding: 12,
              flexDirection: 'row',
              gap: 8,
            }}>
              <Text style={{ fontSize: 14 }}>⚠️</Text>
              <Text style={{ fontSize: 13, color: colors.warning || '#F59E0B', flex: 1, lineHeight: 18 }}>
                Selected categories will REPLACE your current data. Unselected categories will not be affected.
              </Text>
            </View>

            {/* Category List */}
            <ScrollView style={{ maxHeight: 350 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 10 }}>
                {IMPORT_CATEGORIES.map((category) => {
                  const isSelected = selectedImport.has(category.id);
                  const countText = backupSummary ? category.getCount(backupSummary) : '';
                  const hasData = countText !== 'No data';

                  return (
                    <Pressable
                      key={category.id}
                      onPress={() => hasData && toggleImportCategory(category.id)}
                      disabled={!hasData}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        gap: 12,
                        padding: 14,
                        borderRadius: 10,
                        backgroundColor: !hasData ? colors.surface : isSelected ? `${colors.primary}15` : colors.surface,
                        borderWidth: 2,
                        borderColor: !hasData ? colors.border : isSelected ? colors.primary : colors.border,
                        opacity: !hasData ? 0.5 : pressed ? 0.8 : 1,
                      })}
                    >
                      {/* Checkbox */}
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 5,
                          borderWidth: 2,
                          borderColor: !hasData ? colors.muted : isSelected ? colors.primary : colors.muted,
                          backgroundColor: isSelected && hasData ? colors.primary : 'transparent',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginTop: 1,
                        }}
                      >
                        {isSelected && hasData && (
                          <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' }}>✓</Text>
                        )}
                      </View>

                      {/* Content */}
                      <View style={{ flex: 1, gap: 2 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontSize: 16 }}>{category.icon}</Text>
                          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.foreground }}>
                            {category.title}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 12, color: colors.muted }}>
                          {countText}
                        </Text>
                        {isSelected && hasData && category.warning && (
                          <Text style={{ fontSize: 11, color: colors.warning || '#F59E0B', marginTop: 2 }}>
                            ⚠️ {category.warning}
                          </Text>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            {/* Actions */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={closeImportModal}
                style={({ pressed }) => ({
                  flex: 1,
                  backgroundColor: colors.surface,
                  paddingVertical: 14,
                  borderRadius: 10,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ textAlign: 'center', color: colors.foreground, fontWeight: '600' }}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmImport}
                disabled={isImporting || selectedImport.size === 0}
                style={({ pressed }) => ({
                  flex: 1,
                  backgroundColor: selectedImport.size === 0 ? colors.muted : colors.primary,
                  paddingVertical: 14,
                  borderRadius: 10,
                  opacity: pressed && selectedImport.size > 0 ? 0.8 : 1,
                })}
              >
                <Text style={{ textAlign: 'center', color: '#FFFFFF', fontWeight: '600' }}>
                  {isImporting ? 'Importing...' : `Import ${selectedImport.size > 0 ? `(${selectedImport.size})` : ''}`}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}
