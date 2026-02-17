/**
 * Reusable input components
 */

import { TextInput, View, Text } from 'react-native';
import { cn } from '@/lib/utils';
import { useColors } from '@/hooks/use-colors';

interface TextInputProps {
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'email-address';
  label?: string;
  error?: string;
  className?: string;
  editable?: boolean;
  returnKeyType?: 'done' | 'next' | 'search' | 'send';
  onSubmitEditing?: () => void;
}

export function Input({
  placeholder,
  value,
  onChangeText,
  keyboardType = 'default',
  label,
  error,
  className,
  editable = true,
  returnKeyType = 'done',
  onSubmitEditing,
}: TextInputProps) {
  const colors = useColors();

  return (
    <View className="gap-1">
      {label && <Text className="text-sm font-semibold text-foreground">{label}</Text>}
      <TextInput
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        editable={editable}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        placeholderTextColor={colors.muted}
        style={{
          backgroundColor: colors.surface,
          borderColor: error ? colors.error : colors.border,
          color: colors.foreground,
          borderWidth: 1,
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontSize: 16,
        }}
        className={cn('text-base', className)}
      />
      {error && <Text className="text-xs text-error">{error}</Text>}
    </View>
  );
}

interface NumericInputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  suffix?: string;
}

export function NumericInput({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  suffix,
}: NumericInputProps) {
  const colors = useColors();

  const handleChange = (text: string) => {
    // Only allow numbers and decimal point
    const filtered = text.replace(/[^0-9.]/g, '');
    // Prevent multiple decimal points
    const parts = filtered.split('.');
    if (parts.length > 2) {
      onChangeText(parts[0] + '.' + parts[1]);
    } else {
      onChangeText(filtered);
    }
  };

  return (
    <View className="gap-1">
      {label && <Text className="text-sm font-semibold text-foreground">{label}</Text>}
      <View className="flex-row items-center gap-2">
        <TextInput
          placeholder={placeholder}
          value={value}
          onChangeText={handleChange}
          keyboardType="decimal-pad"
          placeholderTextColor={colors.muted}
          style={{
            backgroundColor: colors.surface,
            borderColor: error ? colors.error : colors.border,
            color: colors.foreground,
            borderWidth: 1,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontSize: 16,
            flex: 1,
          }}
        />
        {suffix && <Text className="text-base font-semibold text-muted">{suffix}</Text>}
      </View>
      {error && <Text className="text-xs text-error">{error}</Text>}
    </View>
  );
}
