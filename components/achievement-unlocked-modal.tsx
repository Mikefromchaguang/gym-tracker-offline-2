import React, { useEffect } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import * as Haptics from 'expo-haptics';

export interface AchievementUnlockedModalProps {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
}

export function AchievementUnlockedModal({ visible, title, message, onClose }: AchievementUnlockedModalProps) {
  const colors = useColors();

  useEffect(() => {
    if (!visible) return;
    if (Platform.OS === 'web') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={styles.header}>
            <Text style={styles.badge}>🏆</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
          </View>

          <Text style={[styles.message, { color: colors.muted }]}>{message}</Text>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: colors.primary },
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={[styles.buttonText, { color: colors.background }]}>Nice!</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
  },
  header: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  badge: {
    fontSize: 56,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 18,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
