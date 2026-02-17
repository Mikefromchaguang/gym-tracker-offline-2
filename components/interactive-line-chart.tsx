import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Svg, { Line as SvgLine, Circle, Text as SvgText, Polyline, Rect, Defs, LinearGradient, Stop, Path } from 'react-native-svg';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ChartSettingsModal, ChartSettings } from '@/components/chart-settings-modal';
import { calculateLinearRegression, formatTrendRate } from '@/lib/linear-regression';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export interface ChartDataPoint {
  x: number;
  y: number;
}

export interface TooltipData {
  value: number;
  /** Primary extra line, e.g. "80 × 10" or "5 sets • 50 reps" */
  label?: string;
  /** Title line (often a date or category) */
  title?: string;
  /** Additional lines rendered below the main value */
  lines?: string[];
  /** Legacy field (some callers still pass date separately) */
  date?: string;

  /** If true, hides the main numeric value line in the tooltip. */
  hideValue?: boolean;
  /** If true, hides the title/date line in the tooltip. */
  hideTitle?: boolean;
  /** Optional override for the main value line (instead of formatYValue(activePoint.y)). */
  valueText?: string;
}

export interface ChartMarkerPoint {
  x: number;
  y: number;
  color?: string;
  radius?: number;
}

export interface InteractiveLineChartProps {
  data: ChartDataPoint[];
  yLabel: string;
  xLabels?: string[];
  height?: number;
  formatYValue?: (value: number) => string;
  /** Tooltip data for each point (indexed same as data array) */
  tooltipData?: TooltipData[];
  /** Optional marker points rendered on top of the series (e.g. best set highlight) */
  markers?: ChartMarkerPoint[];
  /** Optional tooltip data for markers (indexed same as markers array) */
  markerTooltips?: TooltipData[];
  /** Raw data points to calculate rolling average from (if not provided, uses data) */
  rawDataForRollingAverage?: Array<{ date: string; value: number }>;
  /** Function to calculate rolling average with custom window */
  calculateRollingAvg?: (data: Array<{ date: string; value: number }>, window: number) => Array<{ date: string; value: number }>;
  /** Legacy prop - rolling average data (will be overridden if calculateRollingAvg is provided) */
  rollingAverageData?: ChartDataPoint[];
  rollingAverageLabel?: string;
  onPointTap?: (dataPoint: ChartDataPoint, xLabel: string) => void;
  /** Unit for trend rate display (e.g., 'kg', 'lbs') */
  unit?: string;
  /** Show settings button */
  showSettings?: boolean;
  /** Initial chart settings */
  initialSettings?: Partial<ChartSettings>;
  /** Callback when settings change */
  onSettingsChange?: (settings: ChartSettings) => void;
  /** Use smooth bezier curves instead of straight lines */
  smoothCurve?: boolean;
  /** Callback when a marker is selected (or deselected) - returns marker data with index */
  onMarkerSelect?: (marker: ChartMarkerPoint | null, index: number | null) => void;
}

function calculateGridLines(minY: number, maxY: number, targetLines: number = 5): { lines: number[], paddedMin: number, paddedMax: number } {
  if (!Number.isFinite(minY) || !Number.isFinite(maxY)) {
    return {
      lines: [-2, 0, 2],
      paddedMin: -2.5,
      paddedMax: 2.5,
    };
  }

  const range = maxY - minY;
  // Increase padding to ensure data points are never at the edge
  const padding = Math.max(range * 0.15, 1);
  const paddedMin = minY - padding;
  const paddedMax = maxY + padding;
  const paddedRange = paddedMax - paddedMin;
  
  if (range === 0) {
    return {
      lines: [minY - 2, minY, minY + 2],
      paddedMin: minY - 2.5,
      paddedMax: minY + 2.5,
    };
  }
  
  const roughStep = paddedRange / (targetLines - 1);
  
  let step: number;
  if (roughStep < 0.5) {
    step = 0.5;
  } else if (roughStep < 1) {
    step = 1;
  } else if (roughStep < 2) {
    step = 2;
  } else if (roughStep < 5) {
    step = 5;
  } else if (roughStep < 10) {
    step = 10;
  } else if (roughStep < 20) {
    step = 20;
  } else if (roughStep < 50) {
    step = 50;
  } else if (roughStep < 100) {
    step = 100;
  } else if (roughStep < 200) {
    step = 200;
  } else if (roughStep < 500) {
    step = 500;
  } else {
    step = Math.ceil(roughStep / 100) * 100;
  }
  
  const start = Math.floor(paddedMin / step) * step;
  
  const lines: number[] = [];
  let current = start;
  // Generate grid lines that cover the entire padded range
  while (current <= paddedMax + step * 0.5) {
    lines.push(current);
    current += step;
  }
  
  // Ensure we have at least one line above the max data point
  if (lines[lines.length - 1] < maxY) {
    lines.push(lines[lines.length - 1] + step);
  }
  
  if (lines.length < 3) {
    const mid = (start + start + step * 2) / 2;
    lines.push(start, mid, start + step * 2);
    lines.sort((a, b) => a - b);
  }
  
  // Use the actual grid line bounds, ensuring they fully contain the data
  const finalMin = Math.min(lines[0], paddedMin);
  const finalMax = Math.max(lines[lines.length - 1], paddedMax);
  
  return {
    lines,
    paddedMin: finalMin,
    paddedMax: finalMax,
  };
}

export function InteractiveLineChart({
  data,
  yLabel,
  xLabels,
  height = 280,
  formatYValue = (v) => v.toFixed(1),
  tooltipData,
  markers,
  markerTooltips,
  rawDataForRollingAverage,
  calculateRollingAvg,
  rollingAverageData: legacyRollingAvgData,
  rollingAverageLabel = "Rolling Avg",
  onPointTap,
  unit = '',
  showSettings = true,
  initialSettings,
  onSettingsChange,
  smoothCurve = false,
  onMarkerSelect,
}: InteractiveLineChartProps) {
  const colors = useColors();
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [selectedMarkerIndex, setSelectedMarkerIndex] = useState<number | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [chartSettings, setChartSettings] = useState<ChartSettings>({
    showRollingAverage: initialSettings?.showRollingAverage ?? true,
    rollingAverageWindow: initialSettings?.rollingAverageWindow ?? 7,
    showTrendline: initialSettings?.showTrendline ?? false,
  });

  // Calculate rolling average dynamically based on settings
  const rollingAverageData = React.useMemo(() => {
    if (!chartSettings.showRollingAverage) return [];
    
    // If custom calculation function provided, use it
    if (calculateRollingAvg && rawDataForRollingAverage) {
      const avgData = calculateRollingAvg(rawDataForRollingAverage, chartSettings.rollingAverageWindow);
      return avgData.map((avg, idx) => ({ x: idx, y: avg.value }));
    }
    
    // Fall back to legacy prop
    return legacyRollingAvgData || [];
  }, [chartSettings.showRollingAverage, chartSettings.rollingAverageWindow, calculateRollingAvg, rawDataForRollingAverage, legacyRollingAvgData]);

  // Calculate linear regression for trendline
  const regressionResult = React.useMemo(() => {
    if (!chartSettings.showTrendline || data.length < 2) return null;
    return calculateLinearRegression(data);
  }, [chartSettings.showTrendline, data]);

  const triggerHaptic = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  // Sync settings when initialSettings change
  useEffect(() => {
    if (initialSettings) {
      setChartSettings(prev => ({
        ...prev,
        ...initialSettings,
      }));
    }
  }, [initialSettings]);

  useEffect(() => {
    if (selectedPointIndex !== null) {
      const timer = setTimeout(() => {
        setSelectedPointIndex(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [selectedPointIndex]);

  useEffect(() => {
    if (selectedMarkerIndex !== null) {
      const timer = setTimeout(() => {
        setSelectedMarkerIndex(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [selectedMarkerIndex]);

  const sanitized = React.useMemo(() => {
    const rawData = data || [];
    const rawMarkers = markers || [];

    const dataPairs = rawData
      .map((d, i) => ({ d, i }))
      .filter(({ d }) => Number.isFinite(d.x) && Number.isFinite(d.y));

    const markerPairs = rawMarkers
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => Number.isFinite(m.x) && Number.isFinite(m.y));

    if (__DEV__) {
      const droppedData = rawData.length - dataPairs.length;
      const droppedMarkers = rawMarkers.length - markerPairs.length;
      if (droppedData > 0 || droppedMarkers > 0) {
        console.warn(
          `[InteractiveLineChart:${yLabel}] Dropped invalid points (data: ${droppedData}, markers: ${droppedMarkers}). ` +
            `This usually means a NaN/Infinity y-value was produced upstream.`
        );
      }
    }

    const safeData = dataPairs.map((p) => p.d);
    const safeMarkers = markerPairs.map((p) => p.m);

    const safeTooltipData = tooltipData ? dataPairs.map((p) => tooltipData[p.i]) : undefined;
    const safeMarkerTooltips = markerTooltips ? markerPairs.map((p) => markerTooltips[p.i]) : undefined;
    const safeXLabels = xLabels ? dataPairs.map((p) => xLabels[p.i]) : undefined;

    return {
      data: safeData,
      tooltipData: safeTooltipData,
      markers: safeMarkers,
      markerTooltips: safeMarkerTooltips,
      xLabels: safeXLabels,
    };
  }, [data, markers, tooltipData, markerTooltips, xLabels]);

  if (sanitized.data.length === 0) {
    return (
      <View style={{ height, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: colors.muted, fontSize: 14 }}>No data available</Text>
      </View>
    );
  }

  const width = 350;
  const padding = { left: 55, right: 30, top: 30, bottom: 45 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const sortedData = [...sanitized.data].sort((a, b) => a.x - b.x);
  const sortedRollingAvg = (rollingAverageData || [])
    .filter((d) => Number.isFinite(d.x) && Number.isFinite(d.y))
    .sort((a, b) => a.x - b.x);

  const allYValues = [
    ...sortedData.map((d) => d.y),
    ...sortedRollingAvg.map((d) => d.y),
    ...(sanitized.markers || []).map((m) => m.y),
  ];
  const dataMinY = allYValues.length > 0 ? Math.min(...allYValues) : 0;
  const dataMaxY = allYValues.length > 0 ? Math.max(...allYValues) : 0;
  const safeMinY = Number.isFinite(dataMinY) ? dataMinY : 0;
  const safeMaxY = Number.isFinite(dataMaxY) ? dataMaxY : 0;
  
  const { lines: gridLineValues, paddedMin: chartMinY, paddedMax: chartMaxY } = calculateGridLines(safeMinY, safeMaxY, 5);
  const yRange = chartMaxY - chartMinY || 1;

  const scaleX = (x: number) => {
    const markerMinX = sanitized.markers && sanitized.markers.length > 0 ? Math.min(...sanitized.markers.map((m) => m.x)) : Infinity;
    const markerMaxX = sanitized.markers && sanitized.markers.length > 0 ? Math.max(...sanitized.markers.map((m) => m.x)) : -Infinity;
    const minX = Math.min(sortedData[0].x, markerMinX);
    const maxX = Math.max(sortedData[sortedData.length - 1].x, markerMaxX);
    const xRange = maxX - minX || 1;
    return padding.left + ((x - minX) / xRange) * chartWidth;
  };

  const scaleY = (y: number) => {
    return padding.top + chartHeight - ((y - chartMinY) / yRange) * chartHeight;
  };

  const points = sortedData.map((d) => `${scaleX(d.x)},${scaleY(d.y)}`).join(' ');

  const rollingAvgPoints = sortedRollingAvg.length > 0
    ? sortedRollingAvg.map((d) => `${scaleX(d.x)},${scaleY(d.y)}`).join(' ')
    : null;

  const gridLines = gridLineValues.map((yValue) => ({
    yPos: scaleY(yValue),
    yValue,
  }));

  const maxXLabels = 6;
  const xLabelIndices = sortedData.length <= maxXLabels
    ? sortedData.map((_, i) => i)
    : Array.from({ length: maxXLabels }, (_, i) => 
        Math.floor((i * (sortedData.length - 1)) / (maxXLabels - 1))
      );

  const handlePointTap = (index: number) => {
    setSelectedPointIndex(index);
    setSelectedMarkerIndex(null);
    // Clear marker selection callback when a non-marker point is tapped
    if (onMarkerSelect) {
      onMarkerSelect(null, null);
    }
    const d = sortedData[index];
    const label = sanitized.xLabels && sanitized.xLabels[index] ? sanitized.xLabels[index] : String(d.x + 1);
    if (onPointTap) {
      onPointTap(d, label);
    }
  };

  const handleMarkerTap = (index: number) => {
    setSelectedMarkerIndex(index);
    setSelectedPointIndex(null);
    if (onMarkerSelect) {
      onMarkerSelect(sanitized.markers?.[index] ?? null, index);
    }
  };

  const activePoint =
    selectedMarkerIndex !== null
      ? (sanitized.markers?.[selectedMarkerIndex] ?? null)
      : selectedPointIndex !== null
        ? sortedData[selectedPointIndex]
        : null;

  const selectedLabel = selectedPointIndex !== null && sanitized.xLabels ? sanitized.xLabels[selectedPointIndex] : null;

  const activeTooltip =
    selectedMarkerIndex !== null
      ? sanitized.markerTooltips?.[selectedMarkerIndex]
      : selectedPointIndex !== null
        ? sanitized.tooltipData?.[selectedPointIndex]
        : undefined;

  const tooltipTitle = activeTooltip?.title ?? activeTooltip?.date ?? selectedLabel;
  const tooltipLines = activeTooltip?.lines ?? (activeTooltip?.label ? [activeTooltip.label] : []);

  const showTooltipValue = !activeTooltip?.hideValue;
  const showTooltipTitle = !!tooltipTitle && !activeTooltip?.hideTitle;
  const tooltipValueText = activeTooltip?.valueText ?? (activePoint ? `${formatYValue(activePoint.y)}${unit ? ` ${unit}` : ''}` : '');

  // Calculate tooltip position near the selected point
  let tooltipLeft = 0;
  let tooltipTop = 0;
  if (activePoint) {
    const pointX = scaleX(activePoint.x);
    const pointY = scaleY(activePoint.y);
    const tooltipWidth = 170;
    const tooltipHeight = 16
      + (showTooltipValue ? 18 : 0)
      + (showTooltipTitle ? 14 : 0)
      + Math.min(4, tooltipLines.length) * 14;
    
    // Position tooltip above the point, centered horizontally
    tooltipLeft = pointX - tooltipWidth / 2;
    tooltipTop = pointY - tooltipHeight - 10;
    
    // Keep tooltip within bounds
    if (tooltipLeft < 5) tooltipLeft = 5;
    if (tooltipLeft + tooltipWidth > width - 5) tooltipLeft = width - tooltipWidth - 5;
    if (tooltipTop < 5) tooltipTop = pointY + 10; // Move below if not enough space above
  }

  // Trendline points calculation
  const trendlinePoints = regressionResult?.predictions
    ? regressionResult.predictions.map((p) => `${scaleX(p.x)},${scaleY(p.y)}`).join(' ')
    : null;

  // Generate smooth bezier curve path using Catmull-Rom splines
  const generateSmoothPath = (dataPoints: ChartDataPoint[]): string => {
    if (dataPoints.length < 2) return '';

    const points = dataPoints.map(d => ({ x: scaleX(d.x), y: scaleY(d.y) }));
    
    if (points.length === 2) {
      return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`;
    }

    // Catmull-Rom to Bezier conversion
    // This creates smooth curves that pass through all points
    let path = `M ${points[0].x},${points[0].y}`;
    
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];
      
      // Catmull-Rom to cubic bezier control points
      const tension = 0.5;
      const cp1x = p1.x + (p2.x - p0.x) * tension / 3;
      const cp1y = p1.y + (p2.y - p0.y) * tension / 3;
      const cp2x = p2.x - (p3.x - p1.x) * tension / 3;
      const cp2y = p2.y - (p3.y - p1.y) * tension / 3;
      
      path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    
    return path;
  };

  // Generate straight line path
  const generateLinePath = (dataPoints: ChartDataPoint[]): string => {
    if (dataPoints.length < 2) return '';

    const points = dataPoints.map(d => ({ x: scaleX(d.x), y: scaleY(d.y) }));
    let path = `M ${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x},${points[i].y}`;
    }
    return path;
  };

  const smoothDataPath = smoothCurve ? generateSmoothPath(sortedData) : generateLinePath(sortedData);
  const smoothRollingAvgPath = sortedRollingAvg.length > 1 ? generateLinePath(sortedRollingAvg) : null;

  // Trend badge info
  const getTrendBadgeColor = () => {
    if (!regressionResult) return colors.muted;
    switch (regressionResult.trend) {
      case 'increasing': return colors.success || '#22c55e';
      case 'decreasing': return colors.destructive || '#ef4444';
      default: return colors.muted;
    }
  };

  const getTrendIcon = () => {
    if (!regressionResult) return 'minus';
    switch (regressionResult.trend) {
      case 'increasing': return 'arrow.up.right';
      case 'decreasing': return 'arrow.down.right';
      default: return 'minus';
    }
  };

  return (
    <View style={{ height: height + (chartSettings.showTrendline && regressionResult ? 36 : 0), width, paddingVertical: 8, position: 'relative', alignSelf: 'center' }}>
      {/* Settings Button */}
      {showSettings && (
        <Pressable
          onPress={() => {
            triggerHaptic();
            setShowSettingsModal(true);
          }}
          style={({ pressed }) => ({
            position: 'absolute',
            top: 4,
            right: 4,
            zIndex: 20,
            padding: 8,
            borderRadius: 8,
            backgroundColor: pressed ? colors.surface : 'transparent',
          })}
        >
          <IconSymbol name="gearshape" size={18} color={colors.muted} />
        </Pressable>
      )}

      {/* Trend Badge */}
      {chartSettings.showTrendline && regressionResult && unit && (
        <View style={{
          position: 'absolute',
          top: 6,
          right: showSettings ? 40 : 8,
          zIndex: 15,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          backgroundColor: colors.surface,
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: getTrendBadgeColor(),
        }}>
          <IconSymbol name={getTrendIcon()} size={12} color={getTrendBadgeColor()} />
          <Text style={{ fontSize: 11, fontWeight: '600', color: getTrendBadgeColor() }}>
            {formatTrendRate(regressionResult.ratePerUnit, unit, 'day')}
          </Text>
        </View>
      )}

      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.primary} stopOpacity="0.3" />
            <Stop offset="1" stopColor={colors.primary} stopOpacity="0.05" />
          </LinearGradient>
          <LinearGradient id="trendGradient" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={getTrendBadgeColor()} stopOpacity="0.6" />
            <Stop offset="1" stopColor={getTrendBadgeColor()} stopOpacity="0.9" />
          </LinearGradient>
        </Defs>

        <Rect x={0} y={0} width={width} height={height} fill="transparent" />

        {gridLines.map((line, i) => (
          <React.Fragment key={`grid-${i}`}>
            <SvgLine
              x1={padding.left}
              y1={line.yPos}
              x2={width - padding.right}
              y2={line.yPos}
              stroke={colors.border}
              strokeWidth={0.5}
              strokeOpacity={0.2}
              strokeDasharray="4,4"
            />
            <SvgText
              x={padding.left - 8}
              y={line.yPos}
              fontSize={10}
              fill={colors.muted}
              textAnchor="end"
              alignmentBaseline="middle"
              fontWeight="400"
            >
              {line.yValue % 1 === 0 ? Math.round(line.yValue) : line.yValue.toFixed(1)}
            </SvgText>
          </React.Fragment>
        ))}

        {/* Area fill under main line */}
        {smoothDataPath && (
          <Path
            d={`${smoothDataPath} L ${scaleX(sortedData[sortedData.length - 1].x)},${height - padding.bottom} L ${scaleX(sortedData[0].x)},${height - padding.bottom} Z`}
            fill="url(#lineGradient)"
          />
        )}

        {/* Trendline (behind main line) */}
        {trendlinePoints && chartSettings.showTrendline && (
          <Polyline
            points={trendlinePoints}
            fill="none"
            stroke={getTrendBadgeColor()}
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray="8,6"
            opacity={0.7}
          />
        )}

        {/* Main data line - smooth curve */}
        {smoothDataPath ? (
          <Path
            d={smoothDataPath}
            fill="none"
            stroke={colors.primary}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <Polyline
            points={points}
            fill="none"
            stroke={colors.primary}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Rolling average line - smooth curve */}
        {chartSettings.showRollingAverage && smoothRollingAvgPath ? (
          <Path
            d={smoothRollingAvgPath}
            fill="none"
            stroke={colors.warning || '#f59e0b'}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="6,4"
            opacity={0.8}
          />
        ) : chartSettings.showRollingAverage && rollingAvgPoints ? (
          <Polyline
            points={rollingAvgPoints}
            fill="none"
            stroke={colors.warning || '#f59e0b'}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="6,4"
            opacity={0.8}
          />
        ) : null}

        {/* Data points */}
        {sortedData.map((d, i) => (
          <React.Fragment key={`point-${i}`}>
            {/* Outer glow for selected point */}
            {selectedPointIndex === i && (
              <Circle
                cx={scaleX(d.x)}
                cy={scaleY(d.y)}
                r={12}
                fill={colors.primary}
                opacity={0.15}
              />
            )}
            {/* Outer ring */}
            <Circle
              cx={scaleX(d.x)}
              cy={scaleY(d.y)}
              r={selectedPointIndex === i ? 7 : 5}
              fill={colors.primary}
              opacity={selectedPointIndex === i ? 0.3 : 0.15}
            />
            {/* Inner dot */}
            <Circle
              cx={scaleX(d.x)}
              cy={scaleY(d.y)}
              r={selectedPointIndex === i ? 5 : 3.5}
              fill={colors.primary}
              stroke={colors.background}
              strokeWidth={2}
            />
          </React.Fragment>
        ))}

        {/* Marker points (rendered on top) */}
        {(sanitized.markers || []).map((m, i) => (
          <React.Fragment key={`marker-${i}`}>
            {/* Outer ring (no glow) */}
            <Circle
              cx={scaleX(m.x)}
              cy={scaleY(m.y)}
              r={selectedMarkerIndex === i ? 7 : 5}
              fill={m.color ?? (colors.warning || '#f59e0b')}
              opacity={selectedMarkerIndex === i ? 0.3 : 0.15}
            />
            {/* Inner dot */}
            <Circle
              cx={scaleX(m.x)}
              cy={scaleY(m.y)}
              r={selectedMarkerIndex === i ? 5 : 3.5}
              fill={m.color ?? (colors.warning || '#f59e0b')}
              stroke={colors.background}
              strokeWidth={2}
            />
          </React.Fragment>
        ))}

        {xLabelIndices.map((index) => {
          const d = sortedData[index];
          const label = sanitized.xLabels && sanitized.xLabels[index] ? sanitized.xLabels[index] : String(d.x + 1);
          const shortLabel = label.length > 8 ? label.substring(5) : label;
          return (
            <SvgText
              key={`xlabel-${index}`}
              x={scaleX(d.x)}
              y={height - padding.bottom + 20}
              fontSize={10}
              fill={colors.muted}
              textAnchor="middle"
              fontWeight="400"
            >
              {shortLabel}
            </SvgText>
          );
        })}

        <SvgText
          x={12}
          y={20}
          fontSize={12}
          fill={colors.foreground}
          fontWeight="600"
        >
          {yLabel}
        </SvgText>

        <SvgLine
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={height - padding.bottom}
          stroke={colors.border}
          strokeWidth={1}
          strokeOpacity={0.3}
        />
        <SvgLine
          x1={padding.left}
          y1={height - padding.bottom}
          x2={width - padding.right}
          y2={height - padding.bottom}
          stroke={colors.border}
          strokeWidth={1}
          strokeOpacity={0.3}
        />
      </Svg>

      {/* Pressable overlay for tap detection */}
      <View style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: width,
        height: height,
        pointerEvents: 'box-none',
      }}>
        {sortedData.map((d, i) => (
          <Pressable
            key={`tap-${i}`}
            onPress={() => {
              triggerHaptic();
              handlePointTap(i);
            }}
            style={{
              position: 'absolute',
              left: scaleX(d.x) - 16,
              top: scaleY(d.y) - 16,
              width: 32,
              height: 32,
            }}
          />
        ))}

        {(sanitized.markers || []).map((m, i) => (
          <Pressable
            key={`marker-tap-${i}`}
            onPress={() => {
              triggerHaptic();
              handleMarkerTap(i);
            }}
            style={{
              position: 'absolute',
              left: scaleX(m.x) - 16,
              top: scaleY(m.y) - 16,
              width: 32,
              height: 32,
            }}
          />
        ))}
      </View>

      {/* Tooltip */}
      {activePoint && (selectedPointIndex !== null || selectedMarkerIndex !== null) && (
        <View style={[styles.tooltip, { 
          backgroundColor: colors.surface, 
          borderColor: colors.border,
          left: tooltipLeft,
          top: tooltipTop,
        }]}>
          {showTooltipValue && (
            <Text style={[styles.tooltipValue, { color: colors.foreground }]}>
              {tooltipValueText}
            </Text>
          )}
          {showTooltipTitle && (
            <Text style={[styles.tooltipLabel, { color: colors.muted }]}>
              {tooltipTitle}
            </Text>
          )}
          {tooltipLines.slice(0, 4).map((line, idx) => (
            <Text key={`tooltip-line-${idx}`} style={[styles.tooltipLabel, { color: colors.muted }]}>
              {line}
            </Text>
          ))}
        </View>
      )}

      {/* Legend */}
      {(chartSettings.showRollingAverage || chartSettings.showTrendline) && (
        <View style={{
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 16,
          marginTop: 4,
          paddingHorizontal: 8,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 16, height: 3, backgroundColor: colors.primary, borderRadius: 2 }} />
            <Text style={{ fontSize: 10, color: colors.muted }}>Actual</Text>
          </View>
          {chartSettings.showRollingAverage && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 16, height: 2, backgroundColor: colors.warning || '#f59e0b', borderRadius: 1, opacity: 0.8 }} />
              <Text style={{ fontSize: 10, color: colors.muted }}>{chartSettings.rollingAverageWindow}-day avg</Text>
            </View>
          )}
          {chartSettings.showTrendline && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 16, height: 2, backgroundColor: getTrendBadgeColor(), borderRadius: 1, opacity: 0.7 }} />
              <Text style={{ fontSize: 10, color: colors.muted }}>Trend</Text>
            </View>
          )}
        </View>
      )}

      {/* Settings Modal */}
      <ChartSettingsModal
        visible={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        settings={chartSettings}
        onSettingsChange={(settings) => {
          setChartSettings(settings);
          onSettingsChange?.(settings);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tooltip: {
    position: 'absolute',
    top: 10,
    left: 10,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tooltipValue: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  tooltipLabel: {
    fontSize: 10,
    marginTop: 2,
  },
});
