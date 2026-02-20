/**
 * Chart Settings Modal
 * Configure analytics overlays like rolling average and linear regression
 */

import React from 'react';
import { View, Text, Modal, Pressable, StyleSheet, Switch } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface ChartSettings {
  showRollingAverage: boolean;
  rollingAverageWindow: number;
  showTrendline: boolean;
}

interface ChartSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  settings: ChartSettings;
  onSettingsChange: (settings: ChartSettings) => void;
}

const ROLLING_AVERAGE_OPTIONS = [
  { value: 3, label: '3-day' },
  { value: 7, label: '7-day' },
  { value: 14, label: '14-day' },
  { value: 30, label: '30-day' },
];

export function ChartSettingsModal({
  visible,
  onClose,
  settings,
  onSettingsChange,
}: ChartSettingsModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const triggerHaptic = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleToggleRollingAverage = (value: boolean) => {
    triggerHaptic();
    onSettingsChange({ ...settings, showRollingAverage: value });
  };

  const handleToggleTrendline = (value: boolean) => {
    triggerHaptic();
    onSettingsChange({ ...settings, showTrendline: value });
  };

  const handleSelectWindow = (window: number) => {
    triggerHaptic();
    onSettingsChange({ ...settings, rollingAverageWindow: window });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable 
          style={[styles.modalContent, { backgroundColor: colors.background }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Chart Settings
            </Text>
            <Pressable
              onPress={() => {
                triggerHaptic();
                onClose();
              }}
              style={({ pressed }) => [
                styles.closeButton,
                { opacity: pressed ? 0.6 : 1 }
              ]}
            >
              <IconSymbol name="xmark.circle.fill" size={24} color={colors.error} />
            </Pressable>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {/* Rolling Average Section */}
            <View style={[styles.section, { borderBottomColor: colors.border }]}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <IconSymbol name="chart.line.uptrend.xyaxis" size={20} color={colors.primary} />
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                    Rolling Average
                  </Text>
                </View>
                <Switch
                  value={settings.showRollingAverage}
                  onValueChange={handleToggleRollingAverage}
                  trackColor={{ false: colors.muted, true: colors.primary }}
                  thumbColor={colors.background}
                />
              </View>
              <Text style={[styles.sectionDescription, { color: colors.muted }]}>
                Smooth out daily fluctuations to see the overall trend
              </Text>

              {/* Window Size Options */}
              {settings.showRollingAverage && (
                <View style={styles.optionsRow}>
                  {ROLLING_AVERAGE_OPTIONS.map((option) => (
                    <Pressable
                      key={option.value}
                      onPress={() => handleSelectWindow(option.value)}
                      style={[
                        styles.optionButton,
                        {
                          backgroundColor: settings.rollingAverageWindow === option.value
                            ? colors.primary
                            : colors.surface,
                          borderColor: settings.rollingAverageWindow === option.value
                            ? colors.primary
                            : colors.border,
                        }
                      ]}
                    >
                      <Text style={[
                        styles.optionText,
                        {
                          color: settings.rollingAverageWindow === option.value
                            ? colors.background
                            : colors.foreground,
                        }
                      ]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* Trendline Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <IconSymbol name="arrow.up.right" size={20} color={colors.warning} />
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                    Linear Trendline
                  </Text>
                </View>
                <Switch
                  value={settings.showTrendline}
                  onValueChange={handleToggleTrendline}
                  trackColor={{ false: colors.muted, true: colors.primary }}
                  thumbColor={colors.background}
                />
              </View>
              <Text style={[styles.sectionDescription, { color: colors.muted }]}>
                Show linear regression line to visualize overall direction and rate of change
              </Text>
              
              {settings.showTrendline && (
                <View style={[styles.infoBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <IconSymbol name="info.circle" size={16} color={colors.muted} />
                  <Text style={[styles.infoText, { color: colors.muted }]}>
                    The trend badge shows the average change per day based on the selected time range
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Footer */}
          <View
            style={[
              styles.footer,
              {
                borderTopColor: colors.border,
                // Ensure the button sits above Android's bottom navigation bar / gesture area.
                paddingBottom: 16 + Math.max(insets.bottom, 10),
              },
            ]}
          >
            <Pressable
              onPress={() => {
                triggerHaptic();
                onClose();
              }}
              style={[styles.doneButton, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.doneButtonText, { color: colors.background }]}>
                Done
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  section: {
    paddingBottom: 20,
    marginBottom: 20,
    borderBottomWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  sectionDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  optionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  optionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  doneButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
