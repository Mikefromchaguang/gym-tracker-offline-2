import React from 'react';
import { View, type ViewProps, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface ModalContainerProps extends ViewProps {
  /**
   * Additional className for the container
   */
  className?: string;
}

/**
 * Shared modal content wrapper that applies safe area insets
 * to prevent content from being obscured by system UI (e.g., Android navigation bar).
 */
export function ModalContainer({
  children,
  style,
  className,
  ...props
}: ModalContainerProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: Math.max(insets.bottom, 0),
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // No default padding - let the modal define its own layout
    // Only add bottom safe area padding dynamically
  },
});
