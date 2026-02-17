import { View, Text, Pressable, ScrollView } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAchievements } from '@/lib/achievement-context';

export default function AchievementsScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { unlocked, all } = useAchievements();

  const unlockedList = unlocked
    .slice()
    .sort((a, b) => b.unlockedAt - a.unlockedAt)
    .map((u) => ({
      unlocked: u,
      def: all.find((d) => d.id === u.id),
    }))
    .filter((x) => !!x.def);

  const unlockedCount = unlockedList.length;

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ padding: 24, gap: 16, paddingBottom: insets.bottom + 24 }}>
        <View className="gap-2">
          <Pressable onPress={() => router.back()} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <IconSymbol name="chevron.left" size={28} color={colors.foreground} />
          </Pressable>
          <Text className="text-3xl font-bold text-foreground">Achievements</Text>
          <Text className="text-base text-muted">
            {unlockedCount} unlocked
          </Text>
        </View>

        {unlockedCount === 0 ? (
          <View style={{ padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }}>
            <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: '700' }}>No achievements yet</Text>
            <Text style={{ color: colors.muted, marginTop: 6, lineHeight: 18 }}>
              Log workouts and keep building streaks to unlock achievements.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {unlockedList.map(({ unlocked: u, def }) => {
              const date = new Date(u.unlockedAt);
              const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              return (
                <View
                  key={u.id}
                  style={{
                    padding: 16,
                    borderRadius: 16,
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: '800' }}>{def!.title}</Text>
                      <Text style={{ color: colors.muted, marginTop: 4 }}>{def!.description}</Text>
                    </View>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{dateStr}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ padding: 14, borderRadius: 14, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }}>
          <Text style={{ color: colors.muted, fontSize: 13 }}>
            Tip: deleting workouts from History will also affect achievement progress.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
