import { ACTIVITY_FACTORS } from './constants.js';

/**
 * Calculates Maintenance calories based on BMR and activity multiplier.
 * @param {number} bmr
 * @param {1|2|3|4} activityLevel
 * @returns {number}
 */
export function calculateMaintenance(bmr, activityLevel) {
  if (bmr <= 0) {
    throw new Error('BMR must be a positive number');
  }

  const factor = ACTIVITY_FACTORS[activityLevel];
  if (!factor) {
    throw new Error(`Invalid activity level: ${activityLevel}`);
  }

  return Math.round(bmr * factor);
}
