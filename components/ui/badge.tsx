/**
 * Badge component for displaying tags and status
 */

import { View, Text } from 'react-native';
import { cn } from '@/lib/utils';

interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'secondary';
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  const variantClasses = {
    default: 'bg-primary/20',
    success: 'bg-success/20',
    warning: 'bg-warning/20',
    error: 'bg-error/20',
    secondary: 'bg-surface',
  };

  const textColorClasses = {
    default: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
    error: 'text-error',
    secondary: 'text-foreground',
  };

  return (
    <View
      className={cn(
        'px-2 py-1 rounded-full',
        variantClasses[variant],
        className
      )}
    >
      <Text className={cn('text-xs font-semibold', textColorClasses[variant])}>
        {children}
      </Text>
    </View>
  );
}
