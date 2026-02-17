/**
 * Danger Zone Screen - Selective data deletion
 * Allows users to delete specific categories of data
 */

import { View, Text, Pressable, Modal, ScrollView, TextInput } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useRouter } from 'expo-router';
import { useState, useMemo } from 'react';
import { useGym } from '@/lib/gym-context';
import { useColors } from '@/hooks/use-colors';
import { clearSelectedCategories, clearAllData } from '@/lib/storage';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface DataCategory {
  id: 'workoutHistory' | 'templates' | 'bodyWeight' | 'exercises' | 'settings';
  title: string;
  description: string;
  warning?: string;
  icon: string;
}

const DATA_CATEGORIES: DataCategory[] = [
  {
    id: 'workoutHistory',
    title: 'Workout History',
    description: 'All completed workouts, achievements, and exercise volume records.',
    warning: 'Achievements will be reset and must be re-earned.',
    icon: '🏋️',
  },
  {
    id: 'templates',
    title: 'Templates',
    description: 'All saved workout templates and their configurations.',
    warning: 'You will need to recreate your workout routines.',
    icon: '📋',
  },
  {
    id: 'bodyWeight',
    title: 'Body Weight',
    description: 'All body weight log entries and tracking history.',
    icon: '⚖️',
  },
  {
    id: 'exercises',
    title: 'Exercises',
    description: 'Custom exercises you created and any modifications to built-in exercises (muscle targets, exercise types).',
    warning: 'Modified exercises will revert to defaults.',
    icon: '🎯',
  },
  {
    id: 'settings',
    title: 'Settings',
    description: 'App preferences including weight unit, theme, default rest time, and chart display settings.',
    icon: '⚙️',
  },
];

export default function DangerZoneScreen() {
  const router = useRouter();
  const colors = useColors();
  const { refreshData } = useGym();
  const insets = useSafeAreaInsets();
  
  const [selected, setSelected] = useState<Set<DataCategory['id']>>(new Set());
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const allSelected = selected.size === DATA_CATEGORIES.length;
  const noneSelected = selected.size === 0;
  const requiresTyping = allSelected;

  const selectedCategories = useMemo(() => {
    return DATA_CATEGORIES.filter(cat => selected.has(cat.id));
  }, [selected]);

  const toggleCategory = (id: DataCategory['id']) => {
    setSelected(prev => {
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

  const selectAll = () => {
    setSelected(new Set(DATA_CATEGORIES.map(c => c.id)));
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const selectNone = () => {
    setSelected(new Set());
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleDelete = async () => {
    if (requiresTyping && confirmText.toUpperCase() !== 'DELETE') {
      return;
    }

    setIsDeleting(true);
    if (Platform.OS !== 'web') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }

    try {
      if (allSelected) {
        await clearAllData();
      } else {
        await clearSelectedCategories({
          workoutHistory: selected.has('workoutHistory'),
          templates: selected.has('templates'),
          bodyWeight: selected.has('bodyWeight'),
          exercises: selected.has('exercises'),
          settings: selected.has('settings'),
        });
      }

      await refreshData();

      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setShowConfirmModal(false);
      setConfirmText('');
      setSelected(new Set());
      router.back();
    } catch (error) {
      console.error('Error deleting data:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ScreenContainer className="bg-background">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 24, gap: 20, paddingBottom: insets.bottom + 100 }}
      >
        {/* Header */}
        <View className="gap-2">
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <IconSymbol name="chevron.left" size={28} color={colors.foreground} />
          </Pressable>
          <Text className="text-3xl font-bold text-foreground">Danger Zone</Text>
          <Text className="text-base text-muted">
            Select the data you want to permanently delete. These actions cannot be undone.
          </Text>
        </View>

        {/* Quick Actions */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable
            onPress={selectAll}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderRadius: 8,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ textAlign: 'center', color: colors.foreground, fontWeight: '600', fontSize: 14 }}>
              Select All
            </Text>
          </Pressable>
          <Pressable
            onPress={selectNone}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderRadius: 8,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ textAlign: 'center', color: colors.foreground, fontWeight: '600', fontSize: 14 }}>
              Clear Selection
            </Text>
          </Pressable>
        </View>

        {/* Category Checkboxes */}
        <View style={{ gap: 12 }}>
          {DATA_CATEGORIES.map((category) => {
            const isSelected = selected.has(category.id);
            return (
              <Pressable
                key={category.id}
                onPress={() => toggleCategory(category.id)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: 16,
                  borderRadius: 12,
                  backgroundColor: isSelected ? `${colors.error}15` : colors.surface,
                  borderWidth: 2,
                  borderColor: isSelected ? colors.error : colors.border,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                {/* Checkbox */}
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    borderWidth: 2,
                    borderColor: isSelected ? colors.error : colors.muted,
                    backgroundColor: isSelected ? colors.error : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 2,
                  }}
                >
                  {isSelected && (
                    <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' }}>✓</Text>
                  )}
                </View>

                {/* Content */}
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 18 }}>{category.icon}</Text>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: colors.foreground }}>
                      {category.title}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 14, color: colors.muted, lineHeight: 20 }}>
                    {category.description}
                  </Text>
                  {category.warning && (
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 4 }}>
                      <Text style={{ fontSize: 12, color: colors.warning || '#F59E0B' }}>⚠️</Text>
                      <Text style={{ fontSize: 12, color: colors.warning || '#F59E0B', flex: 1 }}>
                        {category.warning}
                      </Text>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Fixed Delete Button */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: 24,
          paddingBottom: insets.bottom + 24,
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Pressable
          onPress={() => setShowConfirmModal(true)}
          disabled={noneSelected}
          style={({ pressed }) => ({
            backgroundColor: noneSelected ? colors.muted : '#DC2626',
            paddingVertical: 16,
            borderRadius: 12,
            opacity: pressed && !noneSelected ? 0.8 : 1,
          })}
        >
          <Text style={{ textAlign: 'center', color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>
            {noneSelected ? 'Select data to delete' : `Delete ${selected.size} ${selected.size === 1 ? 'Category' : 'Categories'}`}
          </Text>
        </Pressable>
      </View>

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowConfirmModal(false);
          setConfirmText('');
        }}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
          onPress={() => {
            setShowConfirmModal(false);
            setConfirmText('');
          }}
        >
          <Pressable
            style={{
              backgroundColor: colors.background,
              borderRadius: 16,
              padding: 24,
              width: '90%',
              maxWidth: 400,
              gap: 16,
              maxHeight: '80%',
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.foreground }}>
              {allSelected ? 'Delete All Data?' : 'Delete Selected Data?'}
            </Text>

            <Text style={{ fontSize: 15, color: colors.muted, lineHeight: 22 }}>
              You are about to permanently delete:
            </Text>

            <ScrollView style={{ maxHeight: 150 }}>
              <View style={{ gap: 8 }}>
                {selectedCategories.map((cat) => (
                  <View key={cat.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 16 }}>{cat.icon}</Text>
                    <Text style={{ fontSize: 15, color: colors.foreground, fontWeight: '500' }}>
                      {cat.title}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>

            <Text style={{ fontSize: 15, color: '#DC2626', fontWeight: '600' }}>
              {allSelected ? 'THIS WILL COMPLETELY RESET THE APP.' : 'This action cannot be undone.'}
            </Text>

            {requiresTyping && (
              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 14, color: colors.muted }}>
                  Type DELETE to confirm:
                </Text>
                <TextInput
                  value={confirmText}
                  onChangeText={setConfirmText}
                  placeholder="DELETE"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="characters"
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    fontSize: 16,
                    color: colors.foreground,
                    textAlign: 'center',
                    fontWeight: '600',
                  }}
                />
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={() => {
                  setShowConfirmModal(false);
                  setConfirmText('');
                }}
                style={({ pressed }) => ({
                  flex: 1,
                  backgroundColor: colors.surface,
                  paddingVertical: 14,
                  borderRadius: 12,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ textAlign: 'center', color: colors.foreground, fontWeight: '600' }}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleDelete}
                disabled={isDeleting || (requiresTyping && confirmText.toUpperCase() !== 'DELETE')}
                style={({ pressed }) => ({
                  flex: 1,
                  backgroundColor: (requiresTyping && confirmText.toUpperCase() !== 'DELETE') ? colors.muted : '#DC2626',
                  paddingVertical: 14,
                  borderRadius: 12,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text style={{ textAlign: 'center', color: '#FFFFFF', fontWeight: '600' }}>
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}
