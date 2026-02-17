import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/use-colors';

interface PRCelebrationModalProps {
  visible: boolean;
  onClose: () => void;
  prs: Array<{ exerciseName: string; prType: 'heaviest_weight' | 'highest_volume'; value: number }>;
}

export function PRCelebrationModal({ visible, onClose, prs }: PRCelebrationModalProps) {
  const colors = useColors();

  if (prs.length === 0) {
    return null;
  }

  // Group PRs by exercise
  const prsByExercise = prs.reduce((acc, pr) => {
    if (!acc[pr.exerciseName]) {
      acc[pr.exerciseName] = [];
    }
    acc[pr.exerciseName].push(pr);
    return acc;
  }, {} as Record<string, typeof prs>);

  const exerciseNames = Object.keys(prsByExercise);
  const firstExercise = exerciseNames[0];
  const otherCount = exerciseNames.length - 1;

  const motivationalMessages = [
    "Hell yeah, you real strong! 💪",
    "You're crushing it! 💪",
    "Beast mode activated! 💪",
    "New record, who dis? 💪",
    "You're getting stronger! 💪",
    "Flexing on 'em! 💪",
    "Hide ya girl, there's swole ppl around! 💪",
    "Another one! 💪",
    "Future you says thanks! 💪",
    "Making that shit look easy! 💪",
    "Bro woke up dangerous! 💪",
    "On foenem you crazy! 💪",
  ];

  const randomMessage = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: colors.surface }]}>
          {/* Gold header */}
          <View style={styles.header}>
            <Text style={styles.trophy}>🏆</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>
              {randomMessage}
            </Text>
          </View>

          {/* PR summary */}
          <View style={styles.content}>
            <Text style={[styles.message, { color: colors.foreground }]}>
              You crushed {prs.length} PR{prs.length > 1 ? 's' : ''} today!
            </Text>

            <Text style={[styles.exerciseText, { color: colors.muted }]}>
              {firstExercise}
              {otherCount > 0 && ` and ${otherCount} other exercise${otherCount > 1 ? 's' : ''}`}
            </Text>
          </View>

          {/* Close button */}
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: colors.primary },
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={[styles.buttonText, { color: colors.background }]}>
              View Summary
            </Text>
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
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  trophy: {
    fontSize: 64,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  content: {
    alignItems: 'center',
    marginBottom: 24,
  },
  message: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  exerciseText: {
    fontSize: 16,
    textAlign: 'center',
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
