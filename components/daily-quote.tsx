import { View, Text } from "react-native";
import { getDailyQuote } from "@/constants/quotes";
import { useColors } from "@/hooks/use-colors";

/**
 * Daily Quote Card Component
 * Displays a philosophical quote that changes once per day
 */
export function DailyQuote() {
  const colors = useColors();
  const quote = getDailyQuote();

  return (
    <View
      className="bg-surface rounded-2xl p-4 border border-border"
      style={{ backgroundColor: colors.surface, borderColor: colors.border }}
    >
      <Text className="text-sm text-muted italic leading-relaxed mb-2">
        "{quote.text}"
      </Text>
      <Text className="text-xs text-muted text-right">
        — {quote.author}
      </Text>
    </View>
  );
}
