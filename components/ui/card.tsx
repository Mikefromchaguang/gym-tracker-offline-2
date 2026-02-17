/**
 * Card component for displaying content
 */

import { View, Text, Pressable } from 'react-native';
import { cn } from '@/lib/utils';

interface CardProps {
  className?: string;
  children: React.ReactNode;
  onPress?: () => void;
  pressable?: boolean;
}

export function Card({ className, children, onPress, pressable = false }: CardProps) {
  const content = (
    <View className={cn('bg-surface rounded-lg p-4 border border-border', className)}>
      {children}
    </View>
  );

  if (pressable && onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return <View className={cn('mb-2', className)}>{children}</View>;
}

interface CardTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function CardTitle({ children, className }: CardTitleProps) {
  return (
    <Text className={cn('text-lg font-bold text-foreground', className)}>
      {children}
    </Text>
  );
}

interface CardDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export function CardDescription({ children, className }: CardDescriptionProps) {
  return (
    <Text className={cn('text-sm text-muted', className)}>
      {children}
    </Text>
  );
}

interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export function CardContent({ children, className }: CardContentProps) {
  return <View className={cn('gap-2', className)}>{children}</View>;
}

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <View className={cn('flex-row gap-2 mt-4 pt-4 border-t border-border', className)}>
      {children}
    </View>
  );
}
