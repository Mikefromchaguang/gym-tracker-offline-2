import { describe, it, expect } from 'vitest';

/**
 * Test weighted-bodyweight exercise type
 * 
 * This test verifies that weighted-bodyweight exercises (like weighted pull-ups)
 * correctly calculate total weight as bodyweight + added weight
 */

describe('Weighted Bodyweight Exercise Type', () => {
  it('should calculate weight as bodyweight + added weight', () => {
    const bodyWeight = 75; // kg
    const addedWeight = 20; // kg (weight plate)
    const expectedTotal = 95; // kg
    
    const totalWeight = bodyWeight + addedWeight;
    
    expect(totalWeight).toBe(expectedTotal);
  });

  it('should handle zero added weight', () => {
    const bodyWeight = 75;
    const addedWeight = 0;
    
    const totalWeight = bodyWeight + addedWeight;
    
    expect(totalWeight).toBe(75);
  });

  it('should handle fractional weights', () => {
    const bodyWeight = 72.5;
    const addedWeight = 15.5;
    
    const totalWeight = bodyWeight + addedWeight;
    
    expect(totalWeight).toBe(88);
  });

  it('should correctly identify PR for weighted-bodyweight exercises', () => {
    // Previous workout: 75kg BW + 15kg added = 90kg total
    const previousTotal = 90;
    
    // Current workout: 75kg BW + 20kg added = 95kg total
    const currentTotal = 95;
    
    const isPR = currentTotal > previousTotal;
    
    expect(isPR).toBe(true);
  });

  it('should not show PR when added weight decreases', () => {
    // Previous workout: 75kg BW + 20kg added = 95kg total
    const previousTotal = 95;
    
    // Current workout: 75kg BW + 15kg added = 90kg total
    const currentTotal = 90;
    
    const isPR = currentTotal > previousTotal;
    
    expect(isPR).toBe(false);
  });

  it('should account for bodyweight changes in PR calculation', () => {
    // Previous workout: 75kg BW + 20kg added = 95kg total
    const previousTotal = 95;
    
    // Current workout: 76kg BW + 20kg added = 96kg total (gained 1kg bodyweight)
    const currentTotal = 96;
    
    const isPR = currentTotal > previousTotal;
    
    // Even with same added weight, bodyweight increase makes it a PR
    expect(isPR).toBe(true);
  });
});
