import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/use-colors';
import { useGym } from '@/lib/gym-context';

/**
 * Global rest timer popup component
 * 
 * Displays at the bottom of the screen during active workouts.
 * Features:
 * - Large countdown display
 * - Exercise name and set number
 * - +15s / -15s adjustment buttons
 * - Skip button to end timer early
 * - Progress bar showing time remaining
 * - Always visible (non-blocking, workout remains interactive)
 */
export function RestTimerPopup() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { timerState, stopTimer, adjustTimer } = useGym();

  // On Android, safe-area bottom often includes the full system navigation bar height,
  // which makes the popup feel unnecessarily tall. Keep a small, consistent padding there.
  const bottomPadding = Platform.OS === 'android' ? 8 : Math.max(insets.bottom, 8);

  // Don't render if timer is not running
  if (!timerState.isRunning) {
    return null;
  }

  const handleAdjust = (seconds: number) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    adjustTimer(seconds);
  };

  const handleSkip = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    await stopTimer();
  };

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage
  const progress = timerState.totalSeconds > 0
    ? (timerState.remainingSeconds / timerState.totalSeconds) * 100
    : 0;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: bottomPadding,
        },
      ]}
    >
      {/* Progress bar */}
      <View style={[styles.progressBarBackground, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.progressBarFill,
            { backgroundColor: colors.primary, width: `${progress}%` },
          ]}
        />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Timer display */}
        <Text style={[styles.timerDisplay, { color: colors.primary }]}>
          {formatTime(timerState.remainingSeconds)}
        </Text>

        {/* Controls */}
        <View style={styles.controls}>
          {/* -15s button */}
          <TouchableOpacity
            style={[styles.adjustButton, { backgroundColor: colors.background, borderColor: colors.border }]}
            onPress={() => handleAdjust(-15)}
            activeOpacity={0.7}
          >
            <Text style={[styles.adjustButtonText, { color: colors.foreground }]}>-15s</Text>
          </TouchableOpacity>

          {/* Skip button */}
          <TouchableOpacity
            style={[styles.skipButton, { backgroundColor: colors.primary }]}
            onPress={handleSkip}
            activeOpacity={0.7}
          >
            <Text style={[styles.skipButtonText, { color: colors.background }]}>Skip</Text>
          </TouchableOpacity>

          {/* +15s button */}
          <TouchableOpacity
            style={[styles.adjustButton, { backgroundColor: colors.background, borderColor: colors.border }]}
            onPress={() => handleAdjust(15)}
            activeOpacity={0.7}
          >
            <Text style={[styles.adjustButtonText, { color: colors.foreground }]}>+15s</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  progressBarBackground: {
    height: 4,
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    alignItems: 'center',
    gap: 6,
  },
  infoSection: {
    alignItems: 'center',
    gap: 2,
  },
  exerciseName: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  setNumber: {
    fontSize: 12,
  },
  timerDisplay: {
    fontSize: 36,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  controls: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  adjustButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 60,
    alignItems: 'center',
  },
  adjustButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  skipButton: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
});
