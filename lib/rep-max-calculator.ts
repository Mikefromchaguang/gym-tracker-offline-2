/**
 * Rep Max Calculator
 * 
 * Calculates estimated rep max weights based on top 5 sets with recency weighting,
 * supplemented by actual failure set data points.
 * Uses the Epley formula as a baseline.
 */

import type { FailureSetData } from './types';

export interface RepMaxEstimate {
  reps: number;
  weight: number;
  isActualData?: boolean; // true if this is a real failure data point
  timestamp?: number;     // timestamp of the failure set (for actual data)
}

export interface RepMaxInput {
  oneRepMax: number;
  bestSetWeight: number;
  bestSetReps: number;
  topSets?: Array<{ weight: number; reps: number; timestamp: number }>; // Top 5 sets with timestamps
}

/**
 * Estimate 1RM from a single set using the Epley formula
 * Formula: 1RM = weight × (1 + reps/30)
 */
export function estimate1RMFromSet(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/**
 * Calculate weight at N reps given a 1RM using the Epley formula
 * Formula: Weight = 1RM / (1 + reps/30)
 */
export function calculateWeightAtReps(oneRepMax: number, reps: number): number {
  if (reps <= 0 || oneRepMax <= 0) return 0;
  if (reps === 1) return oneRepMax;
  return oneRepMax / (1 + reps / 30);
}

/**
 * Calculate recency weight factor based on how old the set is
 * Recent sets (< 3 months) get full weight
 * Older sets gradually decrease in influence
 */
function getRecencyWeight(timestamp: number): number {
  const now = Date.now();
  const ageMs = now - timestamp;
  const ageMonths = ageMs / (1000 * 60 * 60 * 24 * 30);

  if (ageMonths <= 3) return 1.0;      // Full weight for recent (< 3 months)
  if (ageMonths <= 6) return 0.8;      // 80% weight for 3-6 months
  if (ageMonths <= 12) return 0.5;     // 50% weight for 6-12 months
  return 0.2;                           // 20% weight for 12+ months
}

/**
 * Calculate rep max estimates from top 5 sets with recency weighting.
 * This provides more stable and accurate estimates than relying on a single best set.
 * 
 * @param input - Current 1RM and best set data from workout history
 * @param manualOverrides - Optional manual overrides for specific rep counts
 * @returns Array of rep max estimates for target rep counts (1, 5, 10, 15, 20, 25)
 */
export function calculateRepMaxEstimates(
  input: RepMaxInput,
  manualOverrides?: Record<number, number>
): RepMaxEstimate[] | null {
  const { oneRepMax, bestSetWeight, bestSetReps, topSets } = input;

  // Validate inputs
  if (!oneRepMax || oneRepMax <= 0 || !bestSetWeight || bestSetWeight <= 0 || !bestSetReps || bestSetReps <= 0) {
    return null;
  }

  // STEP 1: Calculate weighted average fatigue constant from top sets
  let fatigueConstant: number;

  if (topSets && topSets.length > 0) {
    // Use top sets with recency weighting
    let totalWeight = 0;
    let weightedFatigueSum = 0;

    for (const set of topSets) {
      if (set.reps === 1) {
        // Skip 1-rep sets for fatigue constant calculation
        continue;
      }

      const recencyWeight = getRecencyWeight(set.timestamp);
      const denominator = (oneRepMax / set.weight) - 1;

      if (denominator > 0 && isFinite(denominator)) {
        const calculated = set.reps / denominator;
        if (isFinite(calculated) && calculated > 0 && !isNaN(calculated)) {
          // Clamp individual fatigue constant between 15 and 60
          const clamped = Math.max(15, Math.min(60, calculated));
          weightedFatigueSum += clamped * recencyWeight;
          totalWeight += recencyWeight;
        }
      }
    }

    if (totalWeight > 0) {
      fatigueConstant = weightedFatigueSum / totalWeight;
    } else {
      // Fallback to default if no valid sets
      fatigueConstant = 30;
    }
  } else {
    // Fallback to single best set calculation
    if (bestSetReps === 1) {
      fatigueConstant = 30;
    } else {
      const denominator = (oneRepMax / bestSetWeight) - 1;
      if (denominator <= 0 || !isFinite(denominator)) {
        fatigueConstant = 30;
      } else {
        const calculated = bestSetReps / denominator;
        if (!isFinite(calculated) || calculated < 0 || isNaN(calculated)) {
          fatigueConstant = 30;
        } else {
          fatigueConstant = Math.max(15, Math.min(60, calculated));
        }
      }
    }
  }

  // STEP 2: Calculate estimated weights for target rep counts
  const targetReps = [1, 5, 10, 15, 20, 25];
  const estimates: RepMaxEstimate[] = [];

  for (const reps of targetReps) {
    let estimatedWeight: number;
    
    // Check for manual override first
    if (manualOverrides && manualOverrides[reps] !== undefined) {
      estimatedWeight = manualOverrides[reps];
    }
    // For 1 rep, use the actual 1RM (no calculation needed)
    else if (reps === 1) {
      estimatedWeight = oneRepMax;
    }
    // For other rep counts, calculate using the personalized formula
    else {
      estimatedWeight = oneRepMax / (1 + (reps / fatigueConstant));
    }
    
    estimates.push({
      reps,
      weight: estimatedWeight,
    });
  }

  // STEP 3: Normalize results to ensure monotonic decreasing curve
  let previousWeight = Infinity;

  for (let i = 0; i < estimates.length; i++) {
    let weight = estimates[i].weight;

    // Cap at 1RM
    weight = Math.min(weight, oneRepMax);

    // Ensure strictly decreasing
    weight = Math.min(weight, previousWeight);

    // Round to integer
    weight = Math.round(weight);

    estimates[i].weight = weight;
    previousWeight = weight;
  }

  return estimates;
}

/**
 * Process failure data points for display as chart markers.
 * Converts failure data to the format needed for chart overlay.
 * 
 * @param failureData - Array of failure set data points
 * @returns Array of rep max estimates marked as actual data
 */
export function processFailureDataForChart(
  failureData: FailureSetData[]
): RepMaxEstimate[] {
  if (!failureData || failureData.length === 0) {
    return [];
  }

  return failureData.map((data) => ({
    reps: data.reps,
    weight: data.weight,
    isActualData: true,
    timestamp: data.timestamp,
  }));
}
