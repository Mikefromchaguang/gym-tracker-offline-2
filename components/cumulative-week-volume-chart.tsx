import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Line as SvgLine,
  Path,
  Text as SvgText,
  Circle,
} from 'react-native-svg';
import { useColors } from '@/hooks/use-colors';
import { useBodyweight } from '@/hooks/use-bodyweight';
import { CompletedWorkout, WeekStartDay } from '@/lib/types';
import { calculateSetVolume } from '@/lib/volume-calculation';
import { convertWeight } from '@/lib/unit-conversion';
import { getWeekStart, getWeekRange, getDayIndexInWeek, getOrderedDayAbbrevs } from '@/lib/week-utils';

type WeightUnit = 'kg' | 'lbs';

interface CumulativeWeekVolumeChartProps {
  workouts: CompletedWorkout[];
  weightUnit: WeightUnit;
  weekStartDay?: WeekStartDay;
  height?: number;
}

type SeriesPoint = { x: number; y: number };

type WeekSeries = {
  dayTotals: number[]; // length 7, in display units
  cumulative: number[]; // length 7, in display units
  points: SeriesPoint[];
};

type AreaRegion = { upper: SeriesPoint[]; lower: SeriesPoint[] };

function buildAboveRegions(
  blue: number[],
  grey: number[],
  maxDayIndexInclusive: number
): AreaRegion[] {
  const n = Math.min(maxDayIndexInclusive + 1, blue.length, grey.length);
  if (n < 2) return [];

  const regions: AreaRegion[] = [];
  let inRegion = false;
  let upper: SeriesPoint[] = [];
  let lower: SeriesPoint[] = [];

  const addPoint = (arr: SeriesPoint[], pt: SeriesPoint) => {
    const last = arr[arr.length - 1];
    if (!last || last.x !== pt.x || last.y !== pt.y) arr.push(pt);
  };

  const intersectionT = (b0: number, b1: number, g0: number, g1: number): number | null => {
    const denom = (b1 - b0) - (g1 - g0);
    if (denom === 0) return null;
    const t = (g0 - b0) / denom;
    if (t < 0 || t > 1) return null;
    return t;
  };

  for (let i = 0; i < n - 1; i++) {
    const x0 = i;
    const x1 = i + 1;

    const b0 = blue[i];
    const b1 = blue[i + 1];
    const g0 = grey[i];
    const g1 = grey[i + 1];

    const above0 = b0 > g0;
    const above1 = b1 > g1;

    if (!inRegion) {
      if (above0) {
        inRegion = true;
        upper = [{ x: x0, y: b0 }];
        lower = [{ x: x0, y: g0 }];
      } else if (!above0 && above1) {
        const t = intersectionT(b0, b1, g0, g1);
        if (t !== null) {
          const xi = x0 + t;
          const yi = b0 + (b1 - b0) * t;
          inRegion = true;
          upper = [{ x: xi, y: yi }];
          lower = [{ x: xi, y: yi }];
        }
      }
    }

    if (inRegion) {
      if (above1) {
        addPoint(upper, { x: x1, y: b1 });
        addPoint(lower, { x: x1, y: g1 });
      } else {
        if (above0 && !above1) {
          const t = intersectionT(b0, b1, g0, g1);
          if (t !== null) {
            const xi = x0 + t;
            const yi = b0 + (b1 - b0) * t;
            addPoint(upper, { x: xi, y: yi });
            addPoint(lower, { x: xi, y: yi });
          }
        }
        regions.push({ upper, lower });
        inRegion = false;
      }
    }
  }

  if (inRegion) {
    regions.push({ upper, lower });
  }

  return regions;
}

function calculateGridLines(
  minY: number,
  maxY: number,
  targetLines: number = 5,
  options?: { clampMinToZero?: boolean }
): { lines: number[]; paddedMin: number; paddedMax: number } {
  const clampMinToZero = options?.clampMinToZero === true;
  const shouldClampMinToZero = clampMinToZero && minY >= 0;
  const range = maxY - minY;
  const padding = Math.max(range * 0.15, 1);
  const paddedMin = shouldClampMinToZero ? 0 : minY - padding;
  const paddedMax = maxY + padding;
  const paddedRange = paddedMax - paddedMin;

  if (range === 0) {
    if (shouldClampMinToZero) {
      return {
        lines: [0, 1, 2],
        paddedMin: 0,
        paddedMax: 2.5,
      };
    }
    return {
      lines: [minY - 2, minY, minY + 2],
      paddedMin: minY - 2.5,
      paddedMax: minY + 2.5,
    };
  }

  const roughStep = paddedRange / (targetLines - 1);

  let step: number;
  if (roughStep < 1) step = 1;
  else if (roughStep < 2) step = 2;
  else if (roughStep < 5) step = 5;
  else if (roughStep < 10) step = 10;
  else if (roughStep < 25) step = 25;
  else if (roughStep < 50) step = 50;
  else if (roughStep < 100) step = 100;
  else step = Math.ceil(roughStep / 100) * 100;

  const start = shouldClampMinToZero ? 0 : Math.floor(paddedMin / step) * step;

  const lines: number[] = [];
  let current = start;
  while (current <= paddedMax + step * 0.5) {
    lines.push(current);
    current += step;
  }

  if (lines[lines.length - 1] < maxY) {
    lines.push(lines[lines.length - 1] + step);
  }

  const finalMin = shouldClampMinToZero ? 0 : Math.min(lines[0], paddedMin);
  const finalMax = Math.max(lines[lines.length - 1], paddedMax);

  return { lines, paddedMin: finalMin, paddedMax: finalMax };
}

export function CumulativeWeekVolumeChart({ workouts, weightUnit, weekStartDay = 1, height = 250 }: CumulativeWeekVolumeChartProps) {
  const colors = useColors();
  const { bodyWeightKg } = useBodyweight();
  const dayLabels = getOrderedDayAbbrevs(weekStartDay);

  const { thisWeek, lastWeek, todayIndex } = useMemo((): { thisWeek: WeekSeries; lastWeek: WeekSeries; todayIndex: number } => {
    const now = new Date();
    const todayIdx = getDayIndexInWeek(now, weekStartDay);
    const thisWeekStart = getWeekStart(now, weekStartDay);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const thisRange = getWeekRange(thisWeekStart);
    const lastRange = getWeekRange(lastWeekStart);

    const sumVolumeForWorkout = (workout: CompletedWorkout): number => {
      let total = 0;
      for (const ex of workout.exercises) {
        const exType = ex.type;
        for (const set of ex.sets) {
          if (set.completed === false) continue;
          if (set.setType === 'warmup') continue; // Exclude warmup sets
          total += calculateSetVolume(set, exType, bodyWeightKg);
        }
      }
      return total;
    };

    const accumulateWeek = (range: { start: number; end: number }): WeekSeries => {
      const totals = Array(7).fill(0) as number[];

      for (const workout of workouts) {
        if (workout.startTime < range.start || workout.startTime > range.end) continue;
        const dayIdx = getDayIndexInWeek(new Date(workout.startTime), weekStartDay);
        const workoutVolumeKg = sumVolumeForWorkout(workout);
        const workoutVolumeDisplay = convertWeight(workoutVolumeKg, weightUnit);
        totals[dayIdx] += workoutVolumeDisplay;
      }

      const cumulative: number[] = [];
      let running = 0;
      for (let i = 0; i < 7; i++) {
        running += totals[i];
        cumulative.push(running);
      }

      return {
        dayTotals: totals,
        cumulative,
        points: cumulative.map((y, x) => ({ x, y })),
      };
    };

    return {
      thisWeek: accumulateWeek(thisRange),
      lastWeek: accumulateWeek(lastRange),
      todayIndex: todayIdx,
    };
  }, [bodyWeightKg, weightUnit, workouts, weekStartDay]);

  const hasAnyData = thisWeek.cumulative.some(v => v > 0) || lastWeek.cumulative.some(v => v > 0);
  if (!hasAnyData) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={[styles.emptyText, { color: colors.muted }]}>
          No workout volume yet
        </Text>
      </View>
    );
  }

  const width = 350;
  // Unified padding with VolumePerDayChart for consistent axis alignment when switching.
  const padding = { top: 44, right: 20, bottom: 44, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const allY = [...thisWeek.cumulative, ...lastWeek.cumulative];
  const dataMinY = Math.min(0, ...allY);
  const dataMaxY = Math.max(...allY);

  const { lines: gridLineValues, paddedMin: chartMinY, paddedMax: chartMaxY } = calculateGridLines(dataMinY, dataMaxY, 5, {
    clampMinToZero: true,
  });
  const yRange = chartMaxY - chartMinY || 1;

  const scaleX = (x: number) => padding.left + (x / 6) * chartWidth;
  const scaleY = (y: number) => padding.top + chartHeight - ((y - chartMinY) / yRange) * chartHeight;

  const baselineY = height - padding.bottom;

  const generateLinePath = (pts: SeriesPoint[]): string => {
    if (pts.length < 2) return '';
    const points = pts.map(d => ({ x: scaleX(d.x), y: scaleY(d.y) }));

    let path = `M ${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x},${points[i].y}`;
    }
    return path;
  };

  const clampedTodayIndex = Math.max(0, Math.min(6, todayIndex));
  const thisWeekPointsThroughToday = thisWeek.points.slice(0, clampedTodayIndex + 1);

  const thisWeekPath = generateLinePath(thisWeekPointsThroughToday);
  const lastWeekPath = generateLinePath(lastWeek.points);

  const thisStroke = colors.primary;
  const lastStroke = '#9CA3AF';
  const green = (colors.success as string | undefined) || '#22c55e';

  // Regions where this week cumulative exceeds last week (only up to today)
  const aboveRegions = buildAboveRegions(thisWeek.cumulative, lastWeek.cumulative, clampedTodayIndex);

  const buildAreaUnderPath = (path: string, startX: number, endX: number) => {
    if (!path) return '';
    return `${path} L ${scaleX(endX)},${baselineY} L ${scaleX(startX)},${baselineY} Z`;
  };

  const thisAreaPath = thisWeekPath ? buildAreaUnderPath(thisWeekPath, 0, clampedTodayIndex) : '';
  const lastAreaPath = lastWeekPath ? buildAreaUnderPath(lastWeekPath, 0, 6) : '';

  const buildRegionPath = (region: AreaRegion): string => {
    if (region.upper.length < 2 || region.lower.length < 2) return '';
    const upper = region.upper.map(p => `${scaleX(p.x)},${scaleY(p.y)}`).join(' L ');
    const lower = [...region.lower].reverse().map(p => `${scaleX(p.x)},${scaleY(p.y)}`).join(' L ');
    return `M ${upper} L ${lower} Z`;
  };

  return (
    <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="cwvcFillBlue" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={thisStroke} stopOpacity="0.22" />
            <Stop offset="100%" stopColor={thisStroke} stopOpacity="0.03" />
          </LinearGradient>
          <LinearGradient id="cwvcFillGrey" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={lastStroke} stopOpacity="0.18" />
            <Stop offset="100%" stopColor={lastStroke} stopOpacity="0.03" />
          </LinearGradient>
        </Defs>

        {/* Horizontal grid lines */}
        {gridLineValues.map((v) => {
          const y = scaleY(v);
          return (
            <React.Fragment key={v}>
              <SvgLine
                x1={padding.left}
                y1={y}
                x2={padding.left + chartWidth}
                y2={y}
                stroke={colors.border}
                strokeWidth={1}
                strokeOpacity={0.35}
              />
              <SvgText
                x={padding.left - 10}
                y={y}
                fontSize={10}
                fill={colors.muted}
                textAnchor="end"
                alignmentBaseline="middle"
              >
                {Math.round(v).toString()}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* X labels */}
        {dayLabels.map((label, idx) => {
          const x = scaleX(idx);
          return (
            <SvgText
              key={label}
              x={x}
              y={padding.top + chartHeight + 20}
              fontSize={12}
              fill={colors.muted}
              textAnchor="middle"
            >
              {label}
            </SvgText>
          );
        })}

        {/* Area under last week (grey) */}
        {lastAreaPath ? (
          <Path d={lastAreaPath} fill="url(#cwvcFillGrey)" />
        ) : null}

        {/* Area under this week (blue) - stops at today */}
        {thisAreaPath ? (
          <Path d={thisAreaPath} fill="url(#cwvcFillBlue)" />
        ) : null}

        {/* Green area where this week exceeds last week (between lines) */}
        {aboveRegions.map((region, idx) => {
          const d = buildRegionPath(region);
          if (!d) return null;
          return <Path key={`above-${idx}`} d={d} fill={green} opacity={0.18} />;
        })}

        {/* Last week line */}
        {lastWeekPath ? (
          <Path
            d={lastWeekPath}
            fill="none"
            stroke={lastStroke}
            strokeWidth={2}
            opacity={0.8}
          />
        ) : null}

        {/* This week line */}
        {thisWeekPath ? (
          <Path
            d={thisWeekPath}
            fill="none"
            stroke={thisStroke}
            strokeWidth={3}
          />
        ) : null}

        {/* Points */}
        {lastWeek.points.map((p, idx) => (
          <Circle
            key={`lw-${idx}`}
            cx={scaleX(p.x)}
            cy={scaleY(p.y)}
            r={3}
            fill={lastStroke}
            opacity={0.9}
          />
        ))}

        {thisWeekPointsThroughToday.map((p, idx) => (
          <Circle
            key={`tw-${idx}`}
            cx={scaleX(p.x)}
            cy={scaleY(p.y)}
            r={4}
            fill={thisStroke}
          />
        ))}

        {/* Unit label (bottom-right) */}
        <SvgText
          x={width - padding.right}
          y={padding.top - 10}
          fontSize={11}
          fill={colors.muted}
          textAnchor="end"
        >
          {`Cumulative volume (${weightUnit})`}
        </SvgText>
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
