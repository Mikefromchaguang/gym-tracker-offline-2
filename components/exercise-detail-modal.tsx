import { Modal, View } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { ExerciseDetailView } from '@/app/_hidden/exercises/[exerciseName]';

interface ExerciseDetailModalProps {
  visible: boolean;
  exerciseName: string | null;
  onClose: () => void;
}

export function ExerciseDetailModal({ visible, exerciseName, onClose }: ExerciseDetailModalProps) {
  const colors = useColors();

  if (!exerciseName) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ExerciseDetailView exerciseName={exerciseName} onRequestClose={onClose} />
      </View>
    </Modal>
  );
}
