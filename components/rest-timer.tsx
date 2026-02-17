/**
 * Rest Timer Component - Countdown timer for rest between sets
 */

import { View, Text, Pressable } from 'react-native';
import { useState, useEffect } from 'react';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from './ui/icon-symbol';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

interface RestTimerProps {
  duration: number; // in seconds
  onComplete?: () => void;
  onSkip?: () => void;
  isVisible: boolean;
}

export function RestTimer({ duration, onComplete, onSkip, isVisible }: RestTimerProps) {
  const colors = useColors();
  const [timeLeft, setTimeLeft] = useState(duration);
  const [isRunning, setIsRunning] = useState(true);

  useEffect(() => {
    if (!isVisible || !isRunning) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          onComplete?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isVisible, isRunning, onComplete]);

  if (!isVisible) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const displayTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <View
      className="bg-primary/10 border-2 border-primary rounded-2xl p-6 items-center gap-4"
      style={{ borderColor: colors.primary }}
    >
      <Text className="text-sm font-semibold text-muted">REST TIME</Text>
      <Text
        className="text-5xl font-bold"
        style={{ color: colors.primary }}
      >
        {displayTime}
      </Text>

      <View className="flex-row gap-3 w-full">
        <Pressable
          onPress={() => setIsRunning(!isRunning)}
          style={({ pressed }) => [
            {
              flex: 1,
              paddingVertical: 12,
              paddingHorizontal: 16,
              backgroundColor: pressed ? colors.surface : colors.background,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'center',
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <View className="flex-row items-center gap-2">
            <IconSymbol
              size={16}
              name={isRunning ? 'stop.fill' : 'play.fill'}
              color={colors.foreground}
            />
            <Text className="text-sm font-semibold text-foreground">
              {isRunning ? 'Pause' : 'Resume'}
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => {
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            onSkip?.();
          }}
          style={({ pressed }) => [
            {
              flex: 1,
              paddingVertical: 12,
              paddingHorizontal: 16,
              backgroundColor: pressed ? colors.primary : colors.primary,
              borderRadius: 8,
              alignItems: 'center',
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <View className="flex-row items-center gap-2">
            <IconSymbol size={16} name="play.fill" color={colors.background} />
            <Text className="text-sm font-semibold text-background">Skip</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}
