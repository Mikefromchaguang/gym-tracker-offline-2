/**
 * Linear Regression Utilities
 * Calculate trendlines for time series data using least-squares method
 */

export interface RegressionResult {
  slope: number;
  intercept: number;
  /** Predicted values for each x point */
  predictions: Array<{ x: number; y: number }>;
  /** R-squared value (0-1, higher = better fit) */
  rSquared: number;
  /** Human-readable trend description */
  trend: 'increasing' | 'decreasing' | 'stable';
  /** Rate of change per unit (e.g., per day) */
  ratePerUnit: number;
}

/**
 * Calculate linear regression using least-squares method
 * 
 * @param data Array of {x, y} points
 * @returns Regression result with slope, intercept, predictions, and trend
 */
export function calculateLinearRegression(
  data: Array<{ x: number; y: number }>
): RegressionResult | null {
  if (data.length < 2) {
    return null;
  }

  const n = data.length;
  
  // Calculate sums for least-squares formula
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  let sumYY = 0;

  for (const point of data) {
    sumX += point.x;
    sumY += point.y;
    sumXY += point.x * point.y;
    sumXX += point.x * point.x;
    sumYY += point.y * point.y;
  }

  const meanX = sumX / n;
  const meanY = sumY / n;

  // Calculate slope and intercept
  const denominator = sumXX - (sumX * sumX) / n;
  
  // Handle case where all x values are the same (vertical line)
  if (denominator === 0) {
    return null;
  }

  const slope = (sumXY - (sumX * sumY) / n) / denominator;
  const intercept = meanY - slope * meanX;

  // Calculate R-squared (coefficient of determination)
  let ssRes = 0; // Sum of squares of residuals
  let ssTot = 0; // Total sum of squares

  const predictions: Array<{ x: number; y: number }> = [];

  for (const point of data) {
    const predictedY = slope * point.x + intercept;
    predictions.push({ x: point.x, y: predictedY });
    
    ssRes += Math.pow(point.y - predictedY, 2);
    ssTot += Math.pow(point.y - meanY, 2);
  }

  const rSquared = ssTot === 0 ? 1 : 1 - (ssRes / ssTot);

  // Determine trend based on slope
  // Use a threshold relative to the data range to determine if change is significant
  const yRange = Math.max(...data.map(d => d.y)) - Math.min(...data.map(d => d.y));
  const xRange = Math.max(...data.map(d => d.x)) - Math.min(...data.map(d => d.x));
  const totalChange = slope * xRange;
  const relativeChange = yRange > 0 ? Math.abs(totalChange) / yRange : 0;
  
  let trend: 'increasing' | 'decreasing' | 'stable';
  if (relativeChange < 0.05) {
    trend = 'stable';
  } else if (slope > 0) {
    trend = 'increasing';
  } else {
    trend = 'decreasing';
  }

  return {
    slope,
    intercept,
    predictions,
    rSquared: Math.max(0, Math.min(1, rSquared)), // Clamp to [0, 1]
    trend,
    ratePerUnit: slope,
  };
}

/**
 * Format the regression slope as a human-readable string
 * 
 * @param slope The slope value (change per unit)
 * @param unit The unit of measurement (e.g., 'kg', 'lbs')
 * @param timeUnit The time unit (e.g., 'day', 'week')
 * @returns Formatted string like "+0.2 kg/day" or "-0.5 lbs/week"
 */
export function formatTrendRate(
  slope: number,
  unit: string,
  timeUnit: string = 'day'
): string {
  const sign = slope >= 0 ? '+' : '';
  const value = Math.abs(slope) < 0.01 ? '~0' : slope.toFixed(2);
  return `${sign}${value} ${unit}/${timeUnit}`;
}
