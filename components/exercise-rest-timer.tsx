/**
 * Exercise Rest Timer Component - Per-exercise rest countdown
 * With edit and reset functionality
 */

import { View, Text, Pressable, TextInput, Modal } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from './ui/icon-symbol';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useAudioPlayer } from 'expo-audio';

interface ExerciseRestTimerProps {
  duration: number; // in seconds
  onTimerStateChange?: (isRunning: boolean) => void;
  onDurationChange?: (newDuration: number) => void;
  autoStart?: boolean; // Auto-start timer when component mounts or prop changes
}

export function ExerciseRestTimer({ duration, onTimerStateChange, onDurationChange, autoStart }: ExerciseRestTimerProps) {
  const colors = useColors();
  const [timeLeft, setTimeLeft] = useState(duration);
  const [isRunning, setIsRunning] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);
  
  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editMinutes, setEditMinutes] = useState(Math.floor(duration / 60).toString());
  const [editSeconds, setEditSeconds] = useState((duration % 60).toString());

  // Update timeLeft when duration prop changes
  useEffect(() => {
    if (!isRunning) {
      setTimeLeft(duration);
    }
  }, [duration, isRunning]);

  // Auto-start timer when autoStart prop is true
  useEffect(() => {
    if (autoStart && !isRunning && !hasCompleted) {
      setIsRunning(true);
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  }, [autoStart]);

  useEffect(() => {
    onTimerStateChange?.(isRunning);
  }, [isRunning, onTimerStateChange]);

  // Audio player for completion sound
  const player = useAudioPlayer('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

  useEffect(() => {
    if (!isRunning || hasCompleted) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Play completion sound
          if (Platform.OS !== 'web') {
            player.play();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          setIsRunning(false);
          setHasCompleted(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, hasCompleted, player]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const displayTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  const handleToggleTimer = useCallback(() => {
    if (isRunning) {
      // Stop button: reset timer
      setTimeLeft(duration);
      setIsRunning(false);
      setHasCompleted(false);
    } else {
      // Start button: begin countdown
      setIsRunning(true);
    }
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [isRunning, duration]);



  const handleOpenEdit = useCallback(() => {
    setEditMinutes(Math.floor(duration / 60).toString());
    setEditSeconds((duration % 60).toString());
    setShowEditModal(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [duration]);

  const handleSaveEdit = useCallback(() => {
    const mins = parseInt(editMinutes, 10) || 0;
    const secs = parseInt(editSeconds, 10) || 0;
    const newDuration = Math.max(0, mins * 60 + secs);
    
    if (newDuration > 0) {
      onDurationChange?.(newDuration);
      setTimeLeft(newDuration);
      setIsRunning(false);
      setHasCompleted(false);
    }
    
    setShowEditModal(false);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [editMinutes, editSeconds, onDurationChange]);

  const handleAddTime = useCallback(() => {
    setTimeLeft((prev) => prev + 15);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const handleSubtractTime = useCallback(() => {
    setTimeLeft((prev) => Math.max(0, prev - 15));
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  return (
    <>
      <View className="flex-row items-center gap-2 py-2 px-3 bg-background rounded-lg border border-border">
        <IconSymbol size={16} name="clock" color={colors.primary} />
        <Text className="text-sm font-semibold text-foreground flex-1">
          Rest: {displayTime}
        </Text>
        
        {/* -15s button */}
        <Pressable
          onPress={handleSubtractTime}
          style={({ pressed }) => [
            {
              paddingHorizontal: 8,
              paddingVertical: 4,
              backgroundColor: pressed ? colors.surface : 'transparent',
              borderRadius: 4,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: '600' }}>-15</Text>
        </Pressable>

        {/* +15s button */}
        <Pressable
          onPress={handleAddTime}
          style={({ pressed }) => [
            {
              paddingHorizontal: 8,
              paddingVertical: 4,
              backgroundColor: pressed ? colors.surface : 'transparent',
              borderRadius: 4,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: '600' }}>+15</Text>
        </Pressable>
        
        {/* Edit button */}
        <Pressable
          onPress={handleOpenEdit}
          style={({ pressed }) => [
            {
              paddingHorizontal: 6,
              paddingVertical: 4,
              backgroundColor: pressed ? colors.surface : 'transparent',
              borderRadius: 4,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <IconSymbol size={14} name="pencil" color={colors.muted} />
        </Pressable>

        {/* Start/Stop button */}
        <Pressable
          onPress={handleToggleTimer}
          style={({ pressed }) => [
            {
              paddingHorizontal: 10,
              paddingVertical: 4,
              backgroundColor: isRunning ? colors.error : colors.primary,
              borderRadius: 4,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text style={{ color: colors.background, fontSize: 12, fontWeight: '600' }}>
            {isRunning ? 'Stop' : 'Start'}
          </Text>
        </Pressable>
      </View>

      {/* Edit Timer Modal */}
      <Modal
        visible={showEditModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowEditModal(false)}
      >
        <Pressable 
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
          onPress={() => setShowEditModal(false)}
        >
          <Pressable 
            style={{ 
              backgroundColor: colors.background, 
              borderRadius: 16, 
              padding: 24, 
              width: '80%',
              maxWidth: 300,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.foreground, marginBottom: 16, textAlign: 'center' }}>
              Edit Rest Timer
            </Text>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <View style={{ alignItems: 'center' }}>
                <TextInput
                  value={editMinutes}
                  onChangeText={setEditMinutes}
                  keyboardType="numeric"
                  maxLength={2}
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 8,
                    width: 60,
                    height: 50,
                    textAlign: 'center',
                    fontSize: 24,
                    fontWeight: '600',
                    color: colors.foreground,
                  }}
                />
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>min</Text>
              </View>
              
              <Text style={{ fontSize: 24, fontWeight: '700', color: colors.foreground }}>:</Text>
              
              <View style={{ alignItems: 'center' }}>
                <TextInput
                  value={editSeconds}
                  onChangeText={setEditSeconds}
                  keyboardType="numeric"
                  maxLength={2}
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 8,
                    width: 60,
                    height: 50,
                    textAlign: 'center',
                    fontSize: 24,
                    fontWeight: '600',
                    color: colors.foreground,
                  }}
                />
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>sec</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
              <Pressable
                onPress={() => setShowEditModal(false)}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    paddingVertical: 12,
                    backgroundColor: colors.surface,
                    borderRadius: 8,
                    alignItems: 'center',
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={{ color: colors.foreground, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              
              <Pressable
                onPress={handleSaveEdit}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    paddingVertical: 12,
                    backgroundColor: colors.primary,
                    borderRadius: 8,
                    alignItems: 'center',
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={{ color: colors.background, fontWeight: '600' }}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
