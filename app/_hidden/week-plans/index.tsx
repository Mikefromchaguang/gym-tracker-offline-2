import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { useGym } from '@/lib/gym-context';
import * as Haptics from 'expo-haptics';

const DAY_ABBREVS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function WeekPlansScreen() {
  const router = useRouter();
  const colors = useColors();
  const { weekPlans, activeWeekPlanId, setActiveWeekPlan, deleteWeekPlan } = useGym();

  const handleDeletePlan = (id: string, name: string) => {
    Alert.alert(
      'Delete Plan',
      `Delete "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteWeekPlan(id);
          },
        },
      ]
    );
  };

  return (
    <ScreenContainer className="p-4 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="gap-4">
          <View className="gap-2">
            <Pressable onPress={() => router.back()} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
              <IconSymbol name="chevron.left" size={28} color={colors.foreground} />
            </Pressable>
            <View className="flex-row items-center justify-between">
              <Text className="text-3xl font-bold text-foreground">Week Planner</Text>
              <Pressable
                onPress={() => router.push('/_hidden/week-plans/edit')}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <View className="flex-row items-center gap-1">
                  <IconSymbol name="plus.circle.fill" size={20} color={colors.primary} />
                  <Text className="text-sm font-semibold text-primary">New</Text>
                </View>
              </Pressable>
            </View>
            <Text className="text-sm text-muted">Organize routines by day and mark one active plan for Home</Text>
          </View>

          {weekPlans.length === 0 ? (
            <Card>
              <CardContent className="items-center gap-2 py-10">
                <IconSymbol size={30} name="calendar" color={colors.muted} />
                <Text className="text-muted text-center">No week planner yet.</Text>
                <Pressable onPress={() => router.push('/_hidden/week-plans/edit')}>
                  <Text className="text-primary font-semibold">Create your first plan</Text>
                </Pressable>
              </CardContent>
            </Card>
          ) : (
            <View className="gap-3">
              {weekPlans.map((plan) => {
                const isActive = plan.id === activeWeekPlanId;
                const totalSessions = plan.days.reduce((acc, d) => acc + d.routineIds.length, 0);
                const todayCount = plan.days.find((d) => d.dayIndex === new Date().getDay())?.routineIds.length || 0;
                const summary = plan.days
                  .filter((d) => d.routineIds.length > 0)
                  .slice(0, 4)
                  .map((d) => `${DAY_ABBREVS[d.dayIndex]} ${d.routineIds.length}`)
                  .join(' • ');

                return (
                  <Card key={plan.id}>
                    <CardHeader>
                      <View className="flex-row items-center justify-between gap-3">
                        <View className="flex-1">
                          <CardTitle>{plan.name}</CardTitle>
                          <CardDescription>{totalSessions} sessions • Today {todayCount}</CardDescription>
                        </View>
                        {isActive ? (
                          <View className="bg-primary px-2 py-1 rounded-full">
                            <Text className="text-xs font-semibold text-background">Active</Text>
                          </View>
                        ) : null}
                      </View>
                    </CardHeader>
                    <CardContent className="gap-3">
                      <Text className="text-xs text-muted">{summary || 'No assigned days yet'}</Text>

                      <View className="flex-row gap-2">
                        {!isActive ? (
                          <Pressable
                            onPress={async () => {
                              await setActiveWeekPlan(plan.id);
                              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                            style={({ pressed }) => [{
                              flex: 1,
                              paddingVertical: 9,
                              borderRadius: 8,
                              borderWidth: 1,
                              borderColor: colors.border,
                              backgroundColor: colors.surface,
                              alignItems: 'center',
                              opacity: pressed ? 0.7 : 1,
                            }]}
                          >
                            <Text className="text-xs font-semibold text-foreground">Set Active</Text>
                          </Pressable>
                        ) : null}
                        <Pressable
                          onPress={() => router.push({ pathname: '/_hidden/week-plans/edit', params: { planId: plan.id } })}
                          style={({ pressed }) => [{
                            flex: 1,
                            paddingVertical: 9,
                            borderRadius: 8,
                            backgroundColor: colors.primary,
                            alignItems: 'center',
                            opacity: pressed ? 0.8 : 1,
                          }]}
                        >
                          <Text className="text-xs font-semibold text-background">Edit</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handleDeletePlan(plan.id, plan.name)}
                          style={({ pressed }) => [{
                            paddingVertical: 9,
                            paddingHorizontal: 10,
                            borderRadius: 8,
                            backgroundColor: colors.error + '20',
                            alignItems: 'center',
                            opacity: pressed ? 0.7 : 1,
                          }]}
                        >
                          <IconSymbol name="trash" size={16} color={colors.error} />
                        </Pressable>
                      </View>
                    </CardContent>
                  </Card>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
