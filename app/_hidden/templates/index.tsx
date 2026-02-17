/**
 * Templates Tab - Manage workout templates
 */

import { ScrollView, Text, View, FlatList } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useGym } from '@/lib/gym-context';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';

export default function TemplatesScreen() {
  const router = useRouter();
  const colors = useColors();
  const { templates } = useGym();

  return (
    <ScreenContainer className="p-4">
      <View className="flex-1 gap-4">
        {/* Header */}
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-foreground">Workout Templates</Text>
          <Button
            size="sm"
            onPress={() => router.push('/_hidden/templates/create')}
          >
            <IconSymbol size={16} name="plus" color={colors.background} />
          </Button>
        </View>

        {/* Templates List */}
        {templates.length > 0 ? (
          <FlatList
            data={templates}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Card
                pressable
                onPress={() => router.push(`/_hidden/templates/create?templateId=${item.id}`)}
                className="mb-3"
              >
                <CardHeader>
                  <CardTitle>{item.name}</CardTitle>
                  <CardDescription>
                    {item.exercises.length} exercises
                  </CardDescription>
                </CardHeader>
              </Card>
            )}
            scrollEnabled={false}
          />
        ) : (
          <View className="flex-1 items-center justify-center gap-4">
            <Text className="text-lg font-semibold text-foreground">No templates yet</Text>
            <Text className="text-sm text-muted text-center">
              Create your first workout template to get started
            </Text>
              <Button
                onPress={() => router.push('/_hidden/templates/create')}
              >
                Create Template
              </Button>
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}
