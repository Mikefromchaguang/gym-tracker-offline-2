/**
 * ModalBottomSheet - Reusable bottom sheet modal with safe area padding
 * 
 * Use this component for all bottom sheet modals to ensure content is never
 * hidden behind the Android navigation bar.
 * 
 * Usage:
 * ```tsx
 * <ModalBottomSheet
 *   visible={showModal}
 *   onClose={() => setShowModal(false)}
 *   title="Modal Title"
 * >
 *   <View className="gap-4">
 *     // Your modal content here
 *   </View>
 * </ModalBottomSheet>
 * ```
 */

import { Modal, View, Text, Pressable, ScrollView, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from './ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';

interface ModalBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /**
   * Additional padding to add to the bottom (in addition to safe area insets).
   * Defaults to 16.
   */
  extraBottomPadding?: number;
  /**
   * Maximum height of the modal as a percentage. Defaults to 90%.
   */
  maxHeight?: string;
}

export function ModalBottomSheet({
  visible,
  onClose,
  title,
  children,
  extraBottomPadding = 16,
  maxHeight = '90%',
}: ModalBottomSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-background rounded-t-3xl" style={{ maxHeight: maxHeight as any }}>
          <ScrollView
            className="p-6"
            contentContainerStyle={{
              gap: 16,
              paddingBottom: insets.bottom + extraBottomPadding,
            }}
            showsVerticalScrollIndicator={true}
          >
            {/* Header */}
            <View className="flex-row items-center justify-between">
              <Text className="text-xl font-bold text-foreground">{title}</Text>
              <Pressable onPress={onClose}>
                <IconSymbol size={24} name="xmark.circle.fill" color={colors.muted} />
              </Pressable>
            </View>

            {/* Content */}
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
