import { Text, View, Pressable, Platform, Modal, Dimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { useBodyweight } from '@/hooks/use-bodyweight';
import { useGym } from '@/lib/gym-context';
import { calculateTemplateExerciseVolume } from '@/lib/volume-calculation';
import { convertWeight } from '@/lib/unit-conversion';
import { CompletedSet, WorkoutTemplate } from '@/lib/types';

interface TemplateCardProps {
  template: WorkoutTemplate;
  index: number;
  totalCount: number;
  isScheduledToday?: boolean;
  onMoveUp?: (index: number) => void;
  onMoveDown?: (index: number) => void;
  onEdit: (templateId: string) => void;
  onDelete: (templateId: string, templateName: string) => void;
  onStartWorkout: (templateId: string) => void;
  onExport: (templateId: string) => void;
  onDuplicate: (templateId: string) => void;
}

export function TemplateCard({
  template,
  index,
  totalCount,
  isScheduledToday = false,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
  onStartWorkout,
  onExport,
  onDuplicate,
}: TemplateCardProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { bodyWeightKg: currentBodyweight } = useBodyweight();
  const { settings } = useGym();
  const isFirst = index === 0;
  const isLast = index === totalCount - 1;
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [menuHeight, setMenuHeight] = useState(0);

  // Calculate total volume and sets for the template (using exact pattern from create.tsx)
  const { totalVolume, totalSets } = useMemo(() => {
    let volume = 0;
    let sets = 0;
    
    template.exercises.forEach((exercise) => {
      const exerciseType = exercise.type || 'weighted';
      const configuredSets: CompletedSet[] = (exercise.setDetails && exercise.setDetails.length > 0)
        ? exercise.setDetails.map((setConfig, i) => ({
            setNumber: i + 1,
            reps: setConfig.reps,
            weight: setConfig.weight,
            unit: setConfig.unit,
            setType: setConfig.setType,
            timestamp: 0,
          }))
        : Array.from({ length: exercise.sets }, (_, i) => ({
            setNumber: i + 1,
            reps: exercise.reps,
            weight: exercise.weight ?? 0,
            unit: exercise.unit,
            setType: 'working',
            timestamp: 0,
          }));

      sets += configuredSets.length;
      volume += calculateTemplateExerciseVolume(configuredSets, exerciseType, currentBodyweight);
    });
    
    return { totalVolume: volume, totalSets: sets };
  }, [template.exercises, currentBodyweight]);

  const computedMenuTop = useMemo(() => {
    const windowHeight = Dimensions.get('window').height;
    const margin = 8;
    const safeTop = insets.top + margin;
    const safeBottom = windowHeight - insets.bottom - margin;

    // Reasonable fallback until we measure via onLayout
    const estimatedMenuHeight = 240;
    const effectiveMenuHeight = menuHeight > 0 ? menuHeight : estimatedMenuHeight;

    const desiredTop = (menuPosition?.y ?? safeTop);
    const maxTop = safeBottom - effectiveMenuHeight;

    // If menu is taller than available space, pin to safe top
    if (maxTop < safeTop) return safeTop;

    return Math.min(Math.max(desiredTop, safeTop), maxTop);
  }, [insets.bottom, insets.top, menuHeight, menuPosition?.y]);

  const handleMoveUp = () => {
    if (!isFirst && onMoveUp) {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onMoveUp(index);
    }
  };

  const handleMoveDown = () => {
    if (!isLast && onMoveDown) {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onMoveDown(index);
    }
  };

  const handleMenuPress = (event: any) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const { pageX, pageY } = event.nativeEvent;
    setMenuPosition({ x: pageX, y: pageY });
    setMenuHeight(0);
    setShowMenu(true);
  };

  const closeMenu = () => {
    setShowMenu(false);
    setMenuPosition(null);
  };

  const handleExport = () => {
    closeMenu();
    onExport(template.id);
  };

  const handleDuplicate = () => {
    closeMenu();
    onDuplicate(template.id);
  };

  const handleEdit = () => {
    closeMenu();
    onEdit(template.id);
  };

  const handleDelete = () => {
    closeMenu();
    onDelete(template.id, template.name);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <View className="flex-row items-center justify-between">
            {/* Reorder arrows on the left */}
            {(onMoveUp || onMoveDown) && (
              <View style={{ flexDirection: 'column', marginRight: 8, marginLeft: -4 }}>
                <Pressable
                  onPress={handleMoveUp}
                  disabled={isFirst}
                  style={({ pressed }) => ({
                    padding: 4,
                    opacity: isFirst ? 0.3 : pressed ? 0.6 : 1,
                  })}
                >
                  <IconSymbol size={16} name="chevron.left" color={isFirst ? colors.muted : colors.foreground} />
                </Pressable>
                <Pressable
                  onPress={handleMoveDown}
                  disabled={isLast}
                  style={({ pressed }) => ({
                    padding: 4,
                    opacity: isLast ? 0.3 : pressed ? 0.6 : 1,
                  })}
                >
                  <IconSymbol size={16} name="chevron.right" color={isLast ? colors.muted : colors.foreground} />
                </Pressable>
              </View>
            )}
            
            <View className="flex-1">
              <View className="flex-row items-center gap-2 flex-wrap">
                <CardTitle className="text-base">{template.name}</CardTitle>
                {isScheduledToday ? (
                  <View className="bg-primary px-2 py-1 rounded-full">
                    <Text className="text-xs font-semibold text-background">Today</Text>
                  </View>
                ) : null}
              </View>
              <CardDescription>
                {template.exercises.length} exercises • {totalSets} sets • {isNaN(totalVolume) ? '0' : Math.round(convertWeight(totalVolume, settings.weightUnit))} {settings.weightUnit}
              </CardDescription>
            </View>
            
            {/* Edit + menu */}
            <View className="flex-row gap-2">
              <Pressable
                onPress={handleMenuPress}
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
          {/* Exercise preview */}
          <View className="gap-1">
            {template.exercises.slice(0, 3).map((ex, idx) => (
              <Text key={idx} className="text-xs text-muted">
                • {ex.name}
              </Text>
            ))}
            {template.exercises.length > 3 && (
              <Text className="text-xs text-muted">
                +{template.exercises.length - 3} more
              </Text>
            )}
          </View>

          {/* Action buttons */}
          <View className="flex-row gap-2 pt-2">
            <Pressable
              onPress={() => onStartWorkout(template.id)}
              style={({ pressed }) => [
                {
                  flex: 1,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  backgroundColor: pressed ? colors.primary : colors.primary,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: colors.primary,
                  alignItems: 'center',
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text className="text-xs font-semibold text-background">Start Workout</Text>
            </Pressable>
          </View>
        </CardContent>
      </Card>

      {/* Template Menu Modal */}
      <Modal visible={showMenu} transparent animationType="fade">
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
          onPress={closeMenu}
        >
          <View style={{
            position: 'absolute',
            top: computedMenuTop,
            right: 16, // Align to right edge with padding
            backgroundColor: colors.background,
            borderRadius: 12,
            padding: 8,
            minWidth: 200,
            maxWidth: Dimensions.get('window').width - 32, // Ensure it fits on screen
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 5,
          }}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (h && h !== menuHeight) setMenuHeight(h);
          }}>
            <Pressable
              onPress={handleEdit}
              style={({ pressed }) => [{
                paddingVertical: 12,
                paddingHorizontal: 16,
                backgroundColor: pressed ? colors.surface : colors.background,
                borderRadius: 8,
              }]}
            >
              <Text style={{ color: colors.foreground, fontSize: 16 }}>Edit</Text>
            </Pressable>
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
            <Pressable
              onPress={handleDuplicate}
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
              onPress={handleExport}
              style={({ pressed }) => [{
                paddingVertical: 12,
                paddingHorizontal: 16,
                backgroundColor: pressed ? colors.surface : colors.background,
                borderRadius: 8,
              }]}
            >
              <Text style={{ color: colors.foreground, fontSize: 16 }}>Export</Text>
            </Pressable>
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
            <Pressable
              onPress={handleDelete}
              style={({ pressed }) => [{
                paddingVertical: 12,
                paddingHorizontal: 16,
                backgroundColor: pressed ? colors.surface : colors.background,
                borderRadius: 8,
              }]}
            >
              <Text style={{ color: colors.error, fontSize: 16 }}>Delete</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
