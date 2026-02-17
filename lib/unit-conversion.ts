/**
 * Unit conversion utilities for weight (kg ↔ lbs)
 */

export const KG_TO_LBS = 2.20462;
export const LBS_TO_KG = 1 / KG_TO_LBS;

/**
 * Convert weight from kg to lbs
 */
export function kgToLbs(kg: number): number {
  return kg * KG_TO_LBS;
}

/**
 * Convert weight from lbs to kg
 */
export function lbsToKg(lbs: number): number {
  return lbs * LBS_TO_KG;
}

/**
 * Convert weight between two units
 * @param weight Weight value
 * @param fromUnit Unit the weight is currently in
 * @param toUnit Unit to convert to
 * @returns Converted weight value
 */
export function convertWeightBetweenUnits(weight: number, fromUnit: 'kg' | 'lbs', toUnit: 'kg' | 'lbs'): number {
  if (fromUnit === toUnit) {
    return weight;
  }
  if (fromUnit === 'kg' && toUnit === 'lbs') {
    return kgToLbs(weight);
  }
  if (fromUnit === 'lbs' && toUnit === 'kg') {
    return lbsToKg(weight);
  }
  return weight;
}

/**
 * Convert weight to display unit
 * @param weight Weight value in kg (stored format)
 * @param targetUnit Unit to display ('kg' or 'lbs')
 * @returns Converted weight value
 */
export function convertWeight(weight: number, targetUnit: 'kg' | 'lbs'): number {
  if (targetUnit === 'lbs') {
    return kgToLbs(weight);
  }
  return weight;
}

/**
 * Format weight for display with unit label
 * @param weight Weight value in kg (stored format)
 * @param targetUnit Unit to display ('kg' or 'lbs')
 * @param decimals Number of decimal places (default 1)
 * @returns Formatted string with unit
 */
export function formatWeight(weight: number, targetUnit: 'kg' | 'lbs', decimals: number = 1): string {
  const converted = convertWeight(weight, targetUnit);
  return `${converted.toFixed(decimals)} ${targetUnit}`;
}

/**
 * Format volume for display with unit label
 * @param volume Volume value in kg (stored format)
 * @param targetUnit Unit to display ('kg' or 'lbs')
 * @returns Formatted string with unit
 */
export function formatVolume(volume: number, targetUnit: 'kg' | 'lbs'): string {
  const converted = convertWeight(volume, targetUnit);
  return `${Math.round(converted)} ${targetUnit}`;
}
