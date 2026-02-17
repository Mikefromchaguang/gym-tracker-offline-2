import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Platform, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { useGym } from "@/lib/gym-context";
import { ACTIVE_WORKOUT_BANNER_HEIGHT } from "@/components/active-workout-banner";
import { usePathname } from "expo-router";

export default function TabLayout() {
  const colors = useColors();
  const { isWorkoutActive } = useGym();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  // Use minimal padding on Android (4px base + inset), more on web/iOS
  const bottomPadding = Platform.OS === "web" ? 8 : (Platform.OS === "android" ? 4 + insets.bottom : Math.max(insets.bottom, 8));
  const tabBarHeight = 50 + bottomPadding;
  
  // Add extra bottom padding when workout is active AND not on active workout page
  const isOnActiveWorkout = pathname === '/(tabs)/active-workout' || pathname === '/active-workout' || pathname?.includes('active-workout');
  const contentBottomPadding = (isWorkoutActive && !isOnActiveWorkout) ? ACTIVE_WORKOUT_BANNER_HEIGHT : 0;

  return (
    <View style={{ flex: 1, paddingBottom: contentBottomPadding }}>
      <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          paddingTop: 4,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
        },
      }}
    >
      {/* Main Tab Screens */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="dumbbell" color={color} />,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: "Analytics",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="chart.bar.fill" color={color} />,
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="list.bullet" color={color} />,
        }}
      />

      {/* Hidden routes - these exist but should not appear in the tab bar */}
      <Tabs.Screen
        name="achievements"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="exercises/[exerciseName]"
        options={{
          href: null, // Hide from tab bar
        }}
      />


    </Tabs>
    </View>
  );
}
