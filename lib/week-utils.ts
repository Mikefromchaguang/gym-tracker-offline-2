/**
 * Week utility functions - centralized date calculations respecting user's week start preference
 */

import type { WeekStartDay } from './types';

/**
 * Gets the start of the week containing the given date, based on the user's preferred week start day.
 *
 * @param date - The reference date
 * @param weekStartDay - Day to start the week (0 = Sunday, 1 = Monday, etc.)
 * @returns Date object set to the start of that week (00:00:00.000)
 */
export function getWeekStart(date: Date, weekStartDay: WeekStartDay = 1): Date {
  const d = new Date(date);
  const currentDay = d.getDay(); // 0 = Sunday, 1 = Monday, etc.

  // Calculate how many days to go back to reach the start of the week
  // Formula: (currentDay - weekStartDay + 7) % 7 gives days since week start
  const daysSinceWeekStart = (currentDay - weekStartDay + 7) % 7;

  d.setDate(d.getDate() - daysSinceWeekStart);
  d.setHours(0, 0, 0, 0);

  return d;
}

/**
 * Gets the week range (start and end timestamps) for a given week start date.
 *
 * @param weekStart - The first day of the week
 * @returns Object with start and end timestamps
 */
export function getWeekRange(weekStart: Date): { start: number; end: number } {
  const start = new Date(weekStart);
  start.setHours(0, 0, 0, 0);

  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start: start.getTime(), end: end.getTime() };
}

/**
 * Gets the current week's range based on the user's preferred week start day.
 *
 * @param weekStartDay - Day to start the week (0 = Sunday, 1 = Monday, etc.)
 * @returns Object with start and end timestamps for the current week
 */
export function getCurrentWeekRange(weekStartDay: WeekStartDay = 1): { start: number; end: number } {
  const weekStart = getWeekStart(new Date(), weekStartDay);
  return getWeekRange(weekStart);
}

/**
 * Gets the previous week's range based on the user's preferred week start day.
 *
 * @param weekStartDay - Day to start the week (0 = Sunday, 1 = Monday, etc.)
 * @returns Object with start and end timestamps for the previous week
 */
export function getPreviousWeekRange(weekStartDay: WeekStartDay = 1): { start: number; end: number } {
  const currentWeekStart = getWeekStart(new Date(), weekStartDay);
  const previousWeekStart = new Date(currentWeekStart);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);
  return getWeekRange(previousWeekStart);
}

/**
 * Gets the day index within the week (0-6) for a given date, based on week start preference.
 *
 * @param date - The date to check
 * @param weekStartDay - Day to start the week (0 = Sunday, 1 = Monday, etc.)
 * @returns Index 0-6 where 0 is the first day of the week
 */
export function getDayIndexInWeek(date: Date, weekStartDay: WeekStartDay = 1): number {
  const currentDay = date.getDay();
  return (currentDay - weekStartDay + 7) % 7;
}

/**
 * Gets the display name for a day of week.
 *
 * @param day - Day index (0 = Sunday, 1 = Monday, etc.)
 * @returns Display name (e.g., "Monday")
 */
export function getDayName(day: WeekStartDay): string {
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return names[day];
}

/**
 * Gets the abbreviated display name for a day of week.
 *
 * @param day - Day index (0 = Sunday, 1 = Monday, etc.)
 * @returns Abbreviated name (e.g., "Mon")
 */
export function getDayAbbrev(day: WeekStartDay): string {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return names[day];
}

/**
 * Gets the ordered list of day abbreviations starting from the user's preferred week start day.
 *
 * @param weekStartDay - Day to start the week (0 = Sunday, 1 = Monday, etc.)
 * @returns Array of 7 abbreviated day names starting from weekStartDay
 */
export function getOrderedDayAbbrevs(weekStartDay: WeekStartDay = 1): string[] {
  const allDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const result: string[] = [];
  for (let i = 0; i < 7; i++) {
    result.push(allDays[(weekStartDay + i) % 7]);
  }
  return result;
}
