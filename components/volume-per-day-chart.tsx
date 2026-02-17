import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import { useColors } from '@/hooks/use-colors';

export interface VolumePerDayDataPoint {
  day: string; // 'Mon', 'Tue', 'Wed', etc.
  volume: number; // in display unit (kg or lbs)
}

export interface VolumePerDayChartProps {
  data: VolumePerDayDataPoint[];
  unit: 'kg' | 'lbs'; // Unit to display
  height?: number;
  width?: number;
}

/**
 * Volume Per Day Bar Chart Component
 * 
 * Shows total volume lifted each day of the week.
 * X-axis: Days of the week (Mon-Sun)
 * Y-axis: Volume in specified unit
 */
export function VolumePerDayChart({
  data,
  unit,
  height = 250,
  width = 350,
}: VolumePerDayChartProps) {
  const colors = useColors();

  if (data.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={[styles.emptyText, { color: colors.muted }]}>
          No workout data for this week
        </Text>
      </View>
    );
  }

  // Chart dimensions
  // Extra top/left padding keeps bar value labels from drifting into the card header.
  const padding = { top: 44, right: 20, bottom: 44, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Find max volume for scaling
  // Add a bit of headroom so value labels can always render above even the tallest bar.
  const rawMaxVolume = Math.max(...data.map((d) => d.volume), 0);
  const maxVolume = Math.max(rawMaxVolume, 100); // Minimum 100 for scale
  const scaleMaxVolume = maxVolume * 1.12;
  const yScale = chartHeight / scaleMaxVolume;

  // Bar dimensions
  const barWidth = chartWidth / data.length - 10;
  const barSpacing = 10;

  // Generate Y-axis labels (5 levels)
  const yAxisLevels = 5;
  const yAxisLabels = Array.from({ length: yAxisLevels + 1 }, (_, i) => {
    const value = (scaleMaxVolume / yAxisLevels) * i;
    return Math.round(value);
  });

  return (
    <View style={[styles.container, { height }]}>
      <Svg width={width} height={height}>
        {/* Y-axis grid lines and labels */}
        {yAxisLabels.map((label, i) => {
          const y = padding.top + chartHeight - (chartHeight / yAxisLevels) * i;
          return (
            <React.Fragment key={`y-axis-${i}`}>
              {/* Grid line */}
              <Line
                x1={padding.left}
                y1={y}
                x2={padding.left + chartWidth}
                y2={y}
                stroke={colors.border}
                strokeWidth={1}
                strokeOpacity={0.35}
              />
              {/* Y-axis label */}
              <SvgText
                x={padding.left - 10}
                y={y}
                fontSize={10}
                fill={colors.muted}
                textAnchor="end"
                alignmentBaseline="middle"
              >
                {label}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Bars */}
        {data.map((point, index) => {
          const barHeight = point.volume * yScale;
          const x = padding.left + index * (barWidth + barSpacing) + barSpacing / 2;
          const y = padding.top + chartHeight - barHeight;
          const valueLabelY = y - 8;

          return (
            <React.Fragment key={`bar-${index}`}>
              {/* Bar */}
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={colors.primary}
                rx={4}
              />
              {/* Volume label on top of bar */}
              {point.volume > 0 && (
                <SvgText
                  x={x + barWidth / 2}
                  y={valueLabelY}
                  fontSize={10}
                  fill={colors.muted}
                  textAnchor="middle"
                  fontWeight="600"
                >
                  {Math.round(point.volume)}
                </SvgText>
              )}
              {/* Day label */}
              <SvgText
                x={x + barWidth / 2}
                y={padding.top + chartHeight + 20}
                fontSize={12}
                fill={colors.muted}
                textAnchor="middle"
              >
                {point.day}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* X-axis line */}
        <Line
          x1={padding.left}
          y1={padding.top + chartHeight}
          x2={padding.left + chartWidth}
          y2={padding.top + chartHeight}
          stroke={colors.border}
          strokeWidth={1}
          strokeOpacity={0.35}
        />

        {/* Y-axis line */}
        <Line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={padding.top + chartHeight}
          stroke={colors.border}
          strokeWidth={1}
          strokeOpacity={0.35}
        />

        {/* Y-axis unit label */}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
