/**
 * Rep Max Calculator
 * 
 * Calculates estimated rep max weights based on best set performance,
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
  // New: multiple sets for improved accuracy
  topSets?: Array<{ weight: number; reps: number; timestamp: number }>;
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
 * Calculate recency weight factor for a set based on how old it is.
 * More recent sets get higher weight in the calculation.
 * 
 * @param timestamp - Unix timestamp of the set
 * @returns Weight factor between 0.2 and 1.0
 */
function calculateRecencyWeight(timestamp: number): number {
  const now = Date.now();
  const ageInDays = (now - timestamp) / (1000 * 60 * 60 * 24);
  
  if (ageInDays <= 90) return 1.0;        // Last 3 months: full weight
  if (ageInDays <= 180) return 0.7;       // 3-6 months: 70% weight
  if (ageInDays <= 365) return 0.5;       // 6-12 months: 50% weight
  return 0.3;                              // 12+ months: 30% weight
}

/**
 * Calculate rep max estimates from best set performance data.
 * This always returns estimates based on historical workout performance.
 * 
 * IMPROVED: Now uses top 3-5 sets with recency weighting for more accurate estimates.
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

  // STEP 1: Derive the fatigue constant from top sets (or fallback to best set)
  let fatigueConstant: number;

  if (topSets && topSets.length > 0) {
    // NEW LOGIC: Calculate weighted average fatigue constant from top 3-5 sets
    let totalWeightedConstant = 0;
    let totalWeight = 0;
    let validSets = 0;

    for (const set of topSets) {
      if (set.reps === 1) continue; // Skip 1-rep sets for fatigue calculation
      
      const denominator = (oneRepMax / set.weight) - 1;
      if (denominator <= 0 || !isFinite(denominator)) continue;
      
      const calculated = set.reps / denominator;
      if (!isFinite(calculated) || calculated < 0 || isNaN(calculated)) continue;
      
      // Clamp individual constant
      const clampedConstant = Math.max(15, Math.min(60, calculated));
      
      // Apply recency weighting
      const recencyWeight = calculateRecencyWeight(set.timestamp);
      
      totalWeightedConstant += clampedConstant * recencyWeight;
      totalWeight += recencyWeight;
      validSets++;
    }

    if (validSets > 0 && totalWeight > 0) {
      // Use weighted average
      fatigueConstant = totalWeightedConstant / totalWeight;
    } else {
      // Fallback to single best set logic
      fatigueConstant = 30;
    }
  } else {
    // FALLBACK: Original single best set logic
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

  return failureData.map((dataPoint) => ({
    reps: dataPoint.reps,
    weight: Math.round(dataPoint.weight),
    isActualData: true,
    timestamp: dataPoint.timestamp,
  }));
}

/**
 * @deprecated Use calculateRepMaxEstimates for estimates and processFailureDataForChart for failure points
 * Calculate rep max estimates from failure data points only.
 */
export function calculateRepMaxFromFailureData(
  failureData: FailureSetData[],
  manualOverrides?: Record<number, number>
): RepMaxEstimate[] | null {
  if (!failureData || failureData.length === 0) {
    return null;
  }

  // Step 1: Estimate 1RM from each failure data point, take the highest
  let best1RM = 0;
  for (const dataPoint of failureData) {
    const estimated1RM = estimate1RMFromSet(dataPoint.weight, dataPoint.reps);
    if (estimated1RM > best1RM) {
      best1RM = estimated1RM;
    }
  }

  if (best1RM <= 0) {
    return null;
  }

  // Step 2: Build a map of actual data points (keyed by reps)
  const actualDataMap = new Map<number, FailureSetData>();
  for (const dataPoint of failureData) {
    actualDataMap.set(dataPoint.reps, dataPoint);
  }

  // Step 3: Generate estimates for target rep counts
  const targetReps = [1, 5, 10, 15, 20, 25];
  const estimates: RepMaxEstimate[] = [];

  for (const reps of targetReps) {
    let weight: number;
    let isActualData = false;
    let timestamp: number | undefined;

    // Check for manual override first
    if (manualOverrides && manualOverrides[reps] !== undefined) {
      weight = manualOverrides[reps];
    }
    // Check for actual failure data at this rep count
    else if (actualDataMap.has(reps)) {
      const dataPoint = actualDataMap.get(reps)!;
      weight = dataPoint.weight;
      isActualData = true;
      timestamp = dataPoint.timestamp;
    }
    // Calculate estimated value from best 1RM
    else {
      weight = calculateWeightAtReps(best1RM, reps);
    }

    estimates.push({
      reps,
      weight: Math.round(weight),
      isActualData,
      timestamp,
    });
  }

  // Step 4: Normalize to ensure monotonic decreasing curve
  let previousWeight = Infinity;
  for (let i = 0; i < estimates.length; i++) {
    let weight = estimates[i].weight;

    // Cap at 1RM
    weight = Math.min(weight, Math.round(best1RM));

    // Ensure strictly decreasing (allow equal for consecutive reps)
    weight = Math.min(weight, previousWeight);

    estimates[i].weight = weight;
    previousWeight = weight;
  }

  return estimates;
}
