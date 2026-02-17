/**
 * Calculate rolling average for time series data
 * @param data Array of data points with date and value
 * @param windowSize Number of data points to average (e.g., 4 for 4-week rolling average)
 * @returns Array of data points with rolling average values
 */
export function calculateRollingAverage(
  data: Array<{ date: string; value: number }>,
  windowSize: number
): Array<{ date: string; value: number }> {
  if (data.length === 0 || windowSize <= 0) {
    return [];
  }

  // Sort data by date ascending
  const sortedData = [...data].sort((a, b) => a.date.localeCompare(b.date));

  const result: Array<{ date: string; value: number }> = [];

  for (let i = 0; i < sortedData.length; i++) {
    // Calculate average of current point and previous (windowSize - 1) points
    const startIndex = Math.max(0, i - windowSize + 1);
    const windowData = sortedData.slice(startIndex, i + 1);
    
    const sum = windowData.reduce((acc, point) => acc + point.value, 0);
    const average = sum / windowData.length;

    result.push({
      date: sortedData[i].date,
      value: Math.round(average * 100) / 100, // Round to 2 decimal places
    });
  }

  return result;
}
