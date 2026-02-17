/**
 * Active Workout Banner - Persistent banner showing ongoing workout
 * Displays at bottom of screen when workout is active
 */

import { View, Text, Pressable, Alert } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useGym } from '@/lib/gym-context';
import { useColors } from '@/hooks/use-colors';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Banner height constant - used for page padding
export const ACTIVE_WORKOUT_BANNER_HEIGHT = 72;

export function ActiveWorkoutBanner() {
  const { isWorkoutActive, activeWorkoutName, activeWorkoutTemplateId, activeWorkoutTemplateName, clearWorkoutActive, stopTimer } = useGym();
  const colors = useColors();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const handleContinue = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    // Navigate with template context if available
    if (activeWorkoutTemplateId && activeWorkoutTemplateName) {
      router.push({
        pathname: '/_hidden/active-workout',
        params: {
          templateId: activeWorkoutTemplateId,
          templateName: activeWorkoutTemplateName,
        },
      });
    } else {
      router.push('/_hidden/active-workout');
    }
  };

  const handleEnd = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    Alert.alert(
      'Discard Workout',
      'Are you sure you want to discard this workout? All progress will be lost.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            // Same behavior as red X button - discard workout
            await stopTimer();
            await clearWorkoutActive();
            router.push('/(tabs)');
          },
        },
      ]
    );
  };

  // Hide banner if not active OR if on active workout page
  const isOnWorkoutPage = pathname === '/(tabs)/active-workout' || pathname === '/active-workout' || pathname?.includes('active-workout');
  if (!isWorkoutActive || isOnWorkoutPage) return null;

  return (
    <View
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: ACTIVE_WORKOUT_BANNER_HEIGHT + insets.bottom,
        backgroundColor: colors.primary,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: Math.max(12, insets.bottom), // Respect system nav bar
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 8,
        zIndex: 1000,
      }}
    >
      {/* Workout info */}
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.background, fontSize: 16, fontWeight: '600' }}>
          {activeWorkoutName || 'Workout in Progress'}
        </Text>
      </View>

      {/* Action buttons */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={handleContinue}
          style={({ pressed }) => ({
            backgroundColor: colors.background,
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 8,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>
            Continue
          </Text>
        </Pressable>

        <Pressable
          onPress={handleEnd}
          style={({ pressed }) => ({
            backgroundColor: 'rgba(255,255,255,0.2)',
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 8,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text style={{ color: colors.background, fontSize: 13, fontWeight: '600' }}>
            End
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
