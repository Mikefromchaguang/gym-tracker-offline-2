/**
 * Custom hook for fetching and managing bodyweight data
 * Centralizes the repeated pattern of fetching bodyweight from storage and converting units
 */

import { useState, useEffect, useCallback } from 'react';
import { BodyWeightStorage } from '@/lib/storage';
import { lbsToKg } from '@/lib/unit-conversion';
import type { BodyWeightLog } from '@/lib/types';

interface UseBodyweightOptions {
  /** Fetch bodyweight for a specific date instead of today (accepts Date object or YYYY-MM-DD string) */
  forDate?: string | Date;
}

interface UseBodyweightReturn {
  /** Bodyweight in kg (for calculations) */
  bodyWeightKg: number;
  /** Raw bodyweight log entry (includes original unit) */
  bodyWeightLog: BodyWeightLog | null;
  /** Whether the bodyweight is still loading */
  isLoading: boolean;
  /** Refetch bodyweight from storage */
  refetch: () => Promise<void>;
}

const DEFAULT_BODYWEIGHT_KG = 70;

/**
 * Hook to fetch and convert bodyweight for volume calculations
 * 
 * @example
 * // Get today's bodyweight
 * const { bodyWeightKg, isLoading } = useBodyweight();
 * 
 * @example
 * // Get bodyweight for a specific workout date
 * const { bodyWeightKg } = useBodyweight({ forDate: '2026-01-30' });
 */
export function useBodyweight(options?: UseBodyweightOptions): UseBodyweightReturn {
  const [bodyWeightKg, setBodyWeightKg] = useState<number>(DEFAULT_BODYWEIGHT_KG);
  const [bodyWeightLog, setBodyWeightLog] = useState<BodyWeightLog | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBodyweight = useCallback(async () => {
    try {
      setIsLoading(true);
      
      let log: BodyWeightLog | null = null;
      
      if (options?.forDate) {
        // Convert string to Date if needed
        const dateObj = options.forDate instanceof Date 
          ? options.forDate
          : new Date(options.forDate);
        log = await BodyWeightStorage.getWeightForDate(dateObj);
      } else {
        log = await BodyWeightStorage.getTodayWeight();
      }
      
      setBodyWeightLog(log);
      
      if (log) {
        // Always convert to kg for internal calculations
        const weightInKg = log.unit === 'lbs' ? lbsToKg(log.weight) : log.weight;
        setBodyWeightKg(weightInKg);
      } else {
        setBodyWeightKg(DEFAULT_BODYWEIGHT_KG);
      }
    } catch (error) {
      console.error('[useBodyweight] Failed to fetch bodyweight:', error);
      setBodyWeightKg(DEFAULT_BODYWEIGHT_KG);
    } finally {
      setIsLoading(false);
    }
  }, [options?.forDate instanceof Date ? options.forDate.toISOString() : options?.forDate]);

  useEffect(() => {
    fetchBodyweight();
  }, [fetchBodyweight]);

  return {
    bodyWeightKg,
    bodyWeightLog,
    isLoading,
    refetch: fetchBodyweight,
  };
}
