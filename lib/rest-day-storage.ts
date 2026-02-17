import AsyncStorage from '@react-native-async-storage/async-storage';

const REST_DAYS_KEY = '@gym_tracker_rest_days';

export interface RestDay {
  date: string; // YYYY-MM-DD format
  note?: string; // Optional note about the rest day
  timestamp: number; // Unix timestamp when logged
}

/**
 * Rest Day Storage Module
 * Handles CRUD operations for rest day logs
 */
export const RestDayStorage = {
  /**
   * Get all rest days
   */
  async getAll(): Promise<RestDay[]> {
    try {
      const data = await AsyncStorage.getItem(REST_DAYS_KEY);
      if (!data) return [];
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading rest days:', error);
      return [];
    }
  },

  /**
   * Get rest days for a specific date range
   */
  async getForDateRange(startDate: string, endDate: string): Promise<RestDay[]> {
    const allRestDays = await this.getAll();
    return allRestDays.filter(
      (day) => day.date >= startDate && day.date <= endDate
    );
  },

  /**
   * Check if a specific date is logged as a rest day
   */
  async isRestDay(date: string): Promise<boolean> {
    const allRestDays = await this.getAll();
    return allRestDays.some((day) => day.date === date);
  },

  /**
   * Log a rest day (or update if already exists)
   */
  async logRestDay(date: string, note?: string): Promise<void> {
    try {
      const allRestDays = await this.getAll();
      
      // Check if rest day already exists for this date
      const existingIndex = allRestDays.findIndex((day) => day.date === date);
      
      const restDay: RestDay = {
        date,
        note,
        timestamp: Date.now(),
      };

      if (existingIndex >= 0) {
        // Update existing rest day
        allRestDays[existingIndex] = restDay;
      } else {
        // Add new rest day
        allRestDays.push(restDay);
      }

      // Sort by date (newest first)
      allRestDays.sort((a, b) => b.date.localeCompare(a.date));

      await AsyncStorage.setItem(REST_DAYS_KEY, JSON.stringify(allRestDays));
    } catch (error) {
      console.error('Error logging rest day:', error);
      throw error;
    }
  },

  /**
   * Delete a rest day log
   */
  async deleteRestDay(date: string): Promise<void> {
    try {
      const allRestDays = await this.getAll();
      const filtered = allRestDays.filter((day) => day.date !== date);
      await AsyncStorage.setItem(REST_DAYS_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error deleting rest day:', error);
      throw error;
    }
  },

  /**
   * Clear all rest day logs
   */
  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.removeItem(REST_DAYS_KEY);
    } catch (error) {
      console.error('Error clearing rest days:', error);
      throw error;
    }
  },

  /**
   * Get count of rest days in a date range
   */
  async getCountForDateRange(startDate: string, endDate: string): Promise<number> {
    const restDays = await this.getForDateRange(startDate, endDate);
    return restDays.length;
  },
};
