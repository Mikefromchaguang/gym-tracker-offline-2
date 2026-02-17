/**
 * Reusable button component
 */

import { Pressable, Text, View } from 'react-native';
import { cn } from '@/lib/utils';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

interface ButtonProps {
  onPress?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'destructive' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  /**
   * Tailwind className applied to the outer Pressable (layout sizing like flex-1 / w-full).
   * Use `className` for visual styling of the inner button surface.
   */
  containerClassName?: string;
  className?: string;
  children: React.ReactNode;
  haptic?: boolean;
}

export function Button({
  onPress,
  disabled = false,
  variant = 'primary',
  size = 'md',
  containerClassName,
  className,
  children,
  haptic = true,
}: ButtonProps) {
  const handlePress = async () => {
    if (haptic && Platform.OS !== 'web') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.();
  };

  const baseClasses = 'rounded-lg font-semibold flex-row items-center justify-center gap-2';

  const variantClasses = {
    primary: 'bg-primary',
    secondary: 'bg-surface border border-border',
    destructive: 'bg-error',
    outline: 'border border-border',
  };

  const sizeClasses = {
    sm: 'px-3 py-2',
    md: 'px-4 py-3',
    lg: 'px-6 py-4',
  };

  const textColorClasses = {
    primary: 'text-background',
    secondary: 'text-foreground',
    destructive: 'text-background',
    outline: 'text-foreground',
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      className={containerClassName}
      style={({ pressed }) => [
        {
          opacity: pressed && !disabled ? 0.8 : disabled ? 0.5 : 1,
        },
      ]}
    >
      <View
        className={cn(
          baseClasses,
          variantClasses[variant],
          sizeClasses[size],
          className,
          disabled && 'opacity-50'
        )}
      >
        {typeof children === 'string' ? (
          <Text className={cn('text-base', textColorClasses[variant])}>{children}</Text>
        ) : (
          children
        )}
      </View>
    </Pressable>
  );
}
