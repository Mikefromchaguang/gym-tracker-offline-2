/**
 * Victory Line Chart Component
 * Professional line chart using Victory Native for body weight and other time series data
 */

import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { calculateRollingAverage } from '@/lib/rolling-average';
import { calculateLinearRegression, formatTrendRate } from '@/lib/linear-regression';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Victory Native imports
import {
  CartesianChart,
  Line,
  Scatter,
  useChartPressState,
} from 'victory-native';
import { Circle, matchFont } from '@shopify/react-native-skia';

export interface ChartDataPoint {
  /** X value (typically index or timestamp) */
  x: number;
  /** Y value (the measurement) */
  y: number;
  /** Optional label for display */
  label?: string;
}

export interface ChartOverlaySettings {
  /** Show rolling average line */
  showRollingAverage: boolean;
  /** Rolling average window size (e.g., 3, 7, 14, 30) */
  rollingAverageWindow: number;
  /** Show linear regression trendline */
  showTrendline: boolean;
}

export interface VictoryLineChartProps {
  /** Main data points */
  data: ChartDataPoint[];
  /** Y-axis label (e.g., "Weight (kg)") */
  yLabel: string;
  /** X-axis labels for each data point */
  xLabels?: string[];
  /** Chart height */
  height?: number;
  /** Chart width */
  width?: number;
  /** Format Y value for display */
  formatYValue?: (value: number) => string;
  /** Overlay settings (rolling average, trendline) */
  overlaySettings?: ChartOverlaySettings;
  /** Callback when settings button is pressed */
  onSettingsPress?: () => void;
  /** Unit for trend rate display */
  unit?: string;
}

const DEFAULT_OVERLAY_SETTINGS: ChartOverlaySettings = {
  showRollingAverage: true,
  rollingAverageWindow: 7,
  showTrendline: false,
};

export function VictoryLineChart({
  data,
  yLabel,
  xLabels,
  height = 280,
  width = 350,
  formatYValue = (v) => v.toFixed(1),
  overlaySettings = DEFAULT_OVERLAY_SETTINGS,
  onSettingsPress,
  unit = '',
}: VictoryLineChartProps) {
  const colors = useColors();
  const { state, isActive } = useChartPressState({ x: 0, y: { primary: 0 } });

  // Use system font for axis labels (avoids font file loading issues)
  const font = useMemo(() => {
    try {
      return matchFont({
        fontFamily: Platform.select({ ios: 'Helvetica', default: 'sans-serif' }),
        fontSize: 11,
        fontWeight: '400',
      });
    } catch {
      return null;
    }
  }, []);

  // Transform data for Victory Native format
  const chartData = useMemo(() => {
    return data.map((point, index) => ({
      x: index,
      primary: point.y,
      label: xLabels?.[index] || `${index + 1}`,
    }));
  }, [data, xLabels]);

  // Calculate rolling average if enabled
  const rollingAverageData = useMemo(() => {
    if (!overlaySettings.showRollingAverage || data.length < 2) {
      return [];
    }
    
    const weightData = data.map((point, idx) => ({
      date: String(idx),
      value: point.y,
    }));
    
    const rolling = calculateRollingAverage(weightData, overlaySettings.rollingAverageWindow);
    
    return rolling.map((point, idx) => ({
      x: idx,
      rollingAvg: point.value,
    }));
  }, [data, overlaySettings.showRollingAverage, overlaySettings.rollingAverageWindow]);

  // Calculate linear regression if enabled
  const regressionData = useMemo(() => {
    if (!overlaySettings.showTrendline || data.length < 2) {
      return null;
    }
    
    const regression = calculateLinearRegression(
      data.map((point, idx) => ({ x: idx, y: point.y }))
    );
    
    return regression;
  }, [data, overlaySettings.showTrendline]);

  // Merge all data for the chart
  const mergedData = useMemo(() => {
    return chartData.map((point, idx) => ({
      ...point,
      rollingAvg: rollingAverageData[idx]?.rollingAvg,
      trendline: regressionData?.predictions[idx]?.y,
    }));
  }, [chartData, rollingAverageData, regressionData]);

  // Calculate Y domain with padding
  const yDomain = useMemo(() => {
    const allValues = [
      ...data.map(d => d.y),
      ...rollingAverageData.map(d => d.rollingAvg).filter(Boolean),
      ...(regressionData?.predictions.map(d => d.y) || []),
    ].filter((v): v is number => v !== undefined);
    
    if (allValues.length === 0) return { min: 0, max: 100 };
    
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const range = max - min || 1;
    const padding = range * 0.1;
    
    return {
      min: min - padding,
      max: max + padding,
    };
  }, [data, rollingAverageData, regressionData]);

  // Get active point info for tooltip
  const activePoint = useMemo(() => {
    if (!isActive || !state.x) return null;
    
    const xValue = state.x.value;
    const idx = Math.round(xValue as number);
    
    if (idx < 0 || idx >= data.length) return null;
    
    return {
      index: idx,
      value: data[idx].y,
      label: xLabels?.[idx] || `Point ${idx + 1}`,
    };
  }, [isActive, state.x, data, xLabels]);

  if (data.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={[styles.emptyText, { color: colors.muted }]}>
          No data available
        </Text>
      </View>
    );
  }

  // Web fallback - Victory Native uses Skia which doesn't work on web
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={[styles.emptyText, { color: colors.muted }]}>
          Chart not available on web
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height: height + 60 }]}>
      {/* Header with Y-label and settings button */}
      <View style={styles.header}>
        <Text style={[styles.yLabel, { color: colors.foreground }]}>{yLabel}</Text>
        <View style={styles.headerRight}>
          {/* Trend indicator */}
          {regressionData && overlaySettings.showTrendline && (
            <View style={[styles.trendBadge, { 
              backgroundColor: regressionData.trend === 'increasing' 
                ? `${colors.success}20` 
                : regressionData.trend === 'decreasing' 
                  ? `${colors.error}20` 
                  : `${colors.muted}20` 
            }]}>
              <Text style={[styles.trendText, { 
                color: regressionData.trend === 'increasing' 
                  ? colors.success 
                  : regressionData.trend === 'decreasing' 
                    ? colors.error 
                    : colors.muted 
              }]}>
                {formatTrendRate(regressionData.ratePerUnit, unit)}
              </Text>
            </View>
          )}
          {onSettingsPress && (
            <Pressable 
              onPress={onSettingsPress}
              style={({ pressed }) => [
                styles.settingsButton,
                { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 }
              ]}
            >
              <IconSymbol name="slider.horizontal.3" size={18} color={colors.muted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Tooltip */}
      {activePoint && (
        <View style={[styles.tooltip, { 
          backgroundColor: colors.surface, 
          borderColor: colors.border,
          shadowColor: colors.foreground,
        }]}>
          <Text style={[styles.tooltipLabel, { color: colors.muted }]}>
            {activePoint.label}
          </Text>
          <Text style={[styles.tooltipValue, { color: colors.foreground }]}>
            {formatYValue(activePoint.value)} {unit}
          </Text>
        </View>
      )}

      {/* Chart */}
      <View style={{ height, width }}>
        <CartesianChart
          data={mergedData}
          xKey="x"
          yKeys={['primary', 'rollingAvg', 'trendline']}
          domain={{ y: [yDomain.min, yDomain.max] }}
          axisOptions={font ? {
            font,
            tickCount: { x: Math.min(6, data.length), y: 5 },
            lineColor: colors.border,
            labelColor: colors.muted,
            formatXLabel: (value) => {
              const idx = Math.round(value as number);
              if (idx < 0 || idx >= data.length) return '';
              // Show abbreviated label
              const label = xLabels?.[idx] || '';
              return label.length > 5 ? label.substring(label.length - 5) : label;
            },
            formatYLabel: (value) => formatYValue(value as number),
          } : undefined}
          chartPressState={state}
        >
          {({ points }) => (
            <>
              {/* Trendline (bottom layer) */}
              {overlaySettings.showTrendline && regressionData && (
                <Line
                  points={points.trendline}
                  color={colors.warning}
                  strokeWidth={2}
                  opacity={0.6}
                  strokeDasharray={[8, 4]}
                />
              )}

              {/* Rolling average line (middle layer) */}
              {overlaySettings.showRollingAverage && (
                <Line
                  points={points.rollingAvg}
                  color={colors.muted}
                  strokeWidth={2}
                  opacity={0.8}
                  strokeDasharray={[6, 3]}
                />
              )}

              {/* Main data line (top layer) */}
              <Line
                points={points.primary}
                color={colors.primary}
                strokeWidth={2.5}
                animate={{ type: 'timing', duration: 300 }}
              />

              {/* Data points */}
              <Scatter
                points={points.primary}
                shape={({ x, y }) => (
                  <Circle cx={x} cy={y} r={4} color={colors.primary} />
                )}
              />

              {/* Active point highlight */}
              {isActive && activePoint && (
                <Scatter
                  points={[points.primary[activePoint.index]].filter(Boolean)}
                  shape={({ x, y }) => (
                    <>
                      <Circle cx={x} cy={y} r={8} color={`${colors.primary}40`} />
                      <Circle cx={x} cy={y} r={5} color={colors.primary} />
                    </>
                  )}
                />
              )}
            </>
          )}
        </CartesianChart>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: colors.primary }]} />
          <Text style={[styles.legendText, { color: colors.muted }]}>Actual</Text>
        </View>
        {overlaySettings.showRollingAverage && (
          <View style={styles.legendItem}>
            <View style={[styles.legendLineDashed, { borderColor: colors.muted }]} />
            <Text style={[styles.legendText, { color: colors.muted }]}>
              {overlaySettings.rollingAverageWindow}-day avg
            </Text>
          </View>
        )}
        {overlaySettings.showTrendline && (
          <View style={styles.legendItem}>
            <View style={[styles.legendLineDashed, { borderColor: colors.warning }]} />
            <Text style={[styles.legendText, { color: colors.muted }]}>Trend</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  yLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  settingsButton: {
    padding: 6,
    borderRadius: 6,
  },
  trendBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  trendText: {
    fontSize: 11,
    fontWeight: '600',
  },
  tooltip: {
    position: 'absolute',
    top: 35,
    right: 10,
    zIndex: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tooltipLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  tooltipValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
    paddingHorizontal: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendLine: {
    width: 16,
    height: 3,
    borderRadius: 2,
  },
  legendLineDashed: {
    width: 16,
    height: 0,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 2,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '500',
  },
});
