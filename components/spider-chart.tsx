import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Polygon, Text as SvgText } from 'react-native-svg';
import { useColors } from '@/hooks/use-colors';
import { getMuscleGroupDisplayName } from '@/lib/muscle-groups';
import { MuscleGroup } from '@/lib/types';

export interface SpiderChartDataPoint {
  muscle: string;  // assumed to be the internal key, e.g. "chest"
  volume: number;
}

export interface SpiderChartProps {
  data: SpiderChartDataPoint[];
  comparisonData?: SpiderChartDataPoint[];
  height?: number;
  width?: number;
}

export function SpiderChart({
  data,
  comparisonData,
  height = 300,
  width = 300,
}: SpiderChartProps) {
  const colors = useColors();

  if (data.length < 3) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={[styles.emptyText, { color: colors.muted }]}>
          Select at least 3 muscle groups to display the chart
        </Text>
      </View>
    );
  }

  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 2 - 50;

  const comparisonByMuscle = new Map(
    (comparisonData || []).map((d) => [d.muscle, d.volume] as const)
  );
  const comparisonAligned = data.map((d) => ({ muscle: d.muscle, volume: comparisonByMuscle.get(d.muscle) ?? 0 }));

  const maxVolume = Math.max(
    ...data.map((d) => d.volume),
    ...comparisonAligned.map((d) => d.volume),
    1
  );
  const normalizedData = data.map((d) => ({
    ...d,
    normalizedVolume: d.volume / maxVolume,
  }));
  const normalizedComparison = comparisonAligned.map((d) => ({
    ...d,
    normalizedVolume: d.volume / maxVolume,
  }));

  const numPoints = normalizedData.length;
  const angleStep = (2 * Math.PI) / numPoints;

  const gridLevels = 5;
  const gridCircles = Array.from({ length: gridLevels }, (_, i) => {
    const levelRadius = (radius / gridLevels) * (i + 1);
    return levelRadius;
  });

  // ⬇️ Use display name here
  const axes = normalizedData.map((point, index) => {
    const angle = index * angleStep - Math.PI / 2;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);

    const labelDistance = radius + 22;
    const labelX = centerX + labelDistance * Math.cos(angle);
    const labelY = centerY + labelDistance * Math.sin(angle);

    return {
      x,
      y,
      labelX,
      labelY,
      angle,
      label: getMuscleGroupDisplayName(point.muscle as MuscleGroup),
    };
  });

  const dataPoints = normalizedData.map((point, index) => {
    const angle = index * angleStep - Math.PI / 2;
    const distance = point.normalizedVolume * radius;
    const x = centerX + distance * Math.cos(angle);
    const y = centerY + distance * Math.sin(angle);
    return { x, y };
  });

  const comparisonPoints = normalizedComparison.map((point, index) => {
    const angle = index * angleStep - Math.PI / 2;
    const distance = point.normalizedVolume * radius;
    const x = centerX + distance * Math.cos(angle);
    const y = centerY + distance * Math.sin(angle);
    return { x, y };
  });

  const polygonPoints = dataPoints.map((p) => `${p.x},${p.y}`).join(' ');
  const comparisonPolygonPoints = comparisonPoints.map((p) => `${p.x},${p.y}`).join(' ');
  const lastStroke = '#9CA3AF';

  return (
    <View style={[styles.container, { height }]}>
      <Svg width={width} height={height}>
        {gridCircles.map((r, i) => (
          <Circle
            key={`grid-${i}`}
            cx={centerX}
            cy={centerY}
            r={r}
            stroke={colors.border}
            strokeWidth={1}
            strokeOpacity={0.3}
            fill="none"
          />
        ))}

        {axes.map((axis, i) => (
          <Line
            key={`axis-${i}`}
            x1={centerX}
            y1={centerY}
            x2={axis.x}
            y2={axis.y}
            stroke={colors.border}
            strokeWidth={1}
            strokeOpacity={0.5}
          />
        ))}

        {comparisonData ? (
          <Polygon
            points={comparisonPolygonPoints}
            fill={lastStroke}
            fillOpacity={0.12}
            stroke={lastStroke}
            strokeWidth={2}
            strokeOpacity={0.85}
          />
        ) : null}

        <Polygon
          points={polygonPoints}
          fill={colors.primary}
          fillOpacity={0.2}
          stroke={colors.primary}
          strokeWidth={3}
          strokeOpacity={1}
        />

        {comparisonData
          ? comparisonPoints.map((point, i) => (
              <Circle
                key={`cmp-point-${i}`}
                cx={point.x}
                cy={point.y}
                r={3}
                fill={lastStroke}
                opacity={0.8}
              />
            ))
          : null}

        {dataPoints.map((point, i) => (
          <Circle
            key={`point-${i}`}
            cx={point.x}
            cy={point.y}
            r={4}
            fill={colors.primary}
            stroke={colors.background}
            strokeWidth={2}
          />
        ))}

        {axes.map((axis, i) => {
          let textAnchor: 'start' | 'middle' | 'end' = 'middle';
          // Render labels inward so they don't get clipped by the SVG bounds.
          // Left side should extend rightward (start), right side should extend leftward (end).
          if (axis.labelX < centerX - 10) textAnchor = 'start';
          else if (axis.labelX > centerX + 10) textAnchor = 'end';

          const dx = textAnchor === 'start' ? 2 : textAnchor === 'end' ? -2 : 0;

          return (
            <SvgText
              key={`label-${i}`}
              x={axis.labelX}
              y={axis.labelY}
              dx={dx}
              fontSize={12}
              fill={colors.foreground}
              textAnchor={textAnchor}
              alignmentBaseline="middle"
            >
              {axis.label}
            </SvgText>
          );
        })}
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
