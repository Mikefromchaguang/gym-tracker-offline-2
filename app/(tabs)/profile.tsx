import { View, Text, Pressable, ScrollView, Platform } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Haptics from 'expo-haptics';
import { useAchievements } from '@/lib/achievement-context';

export default function ProfileScreen() {
  const colors = useColors();
  const { unlocked, all } = useAchievements();

  const handleNavigateToExercises = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push('/_hidden/exercises');
  };

  const handleNavigateToDataManagement = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push('/settings');
  };

  const handleNavigateToPreferences = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push('/_hidden/preferences');
  };

  const handleNavigateToHistory = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push('/_hidden/history');
  };

  const handleNavigateToAchievements = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push('/_hidden/achievements');
  };

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 gap-4">
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }} className="mb-4">
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text className="text-3xl font-bold text-foreground">Profile</Text>
              <Text className="text-sm text-muted mt-1">Your workouts, achievements, and data</Text>
            </View>
          </View>

          {/* Exercises Button */}
          <Pressable
            onPress={handleNavigateToExercises}
            style={({ pressed }) => [
              {
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 16,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IconSymbol size={24} name="dumbbell" color={colors.background} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: '600', color: colors.foreground }}>
                  Exercises
                </Text>
                <Text style={{ fontSize: 14, color: colors.muted, marginTop: 2 }}>
                  View and manage your exercise library
                </Text>
              </View>
              <IconSymbol size={20} name="chevron.right" color={colors.muted} />
            </View>
          </Pressable>

          {/* History Button */}
          <Pressable
            onPress={handleNavigateToHistory}
            style={({ pressed }) => [
              {
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 16,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IconSymbol size={24} name="clock.fill" color={colors.background} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: '600', color: colors.foreground }}>History</Text>
                <Text style={{ fontSize: 14, color: colors.muted, marginTop: 2 }}>View all completed workouts</Text>
              </View>
              <IconSymbol size={20} name="chevron.right" color={colors.muted} />
            </View>
          </Pressable>

          {/* Achievements Button */}
          <Pressable
            onPress={handleNavigateToAchievements}
            style={({ pressed }) => [
              {
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 16,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IconSymbol size={24} name="checkmark.circle.fill" color={colors.background} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: '600', color: colors.foreground }}>Achievements</Text>
                <Text style={{ fontSize: 14, color: colors.muted, marginTop: 2 }}>
                  {unlocked.length} unlocked
                </Text>
              </View>
              <IconSymbol size={20} name="chevron.right" color={colors.muted} />
            </View>
          </Pressable>

          {/* Preferences Button */}
          <Pressable
            onPress={handleNavigateToPreferences}
            style={({ pressed }) => [
              {
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 16,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IconSymbol size={24} name="gearshape" color={colors.background} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: '600', color: colors.foreground }}>Preferences</Text>
                <Text style={{ fontSize: 14, color: colors.muted, marginTop: 2 }}>
                  Units, default rest time, and more
                </Text>
              </View>
              <IconSymbol size={20} name="chevron.right" color={colors.muted} />
            </View>
          </Pressable>

          {/* Settings Button */}
          <Pressable
            onPress={handleNavigateToDataManagement}
            style={({ pressed }) => [
              {
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 16,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: colors.error + '20',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IconSymbol size={24} name="gearshape.fill" color={colors.error} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: '600', color: colors.foreground }}>
                  Data Management
                </Text>
                <Text style={{ fontSize: 14, color: colors.muted, marginTop: 2 }}>
                  Backup, restore, and delete your data
                </Text>
              </View>
              <IconSymbol size={20} name="chevron.right" color={colors.muted} />
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
