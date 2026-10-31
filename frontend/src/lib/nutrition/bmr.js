import {
  BMR_WEIGHT_MULT,
  BMR_HEIGHT_MULT,
  BMR_AGE_MULT,
  BMR_MALE_OFFSET,
  BMR_FEMALE_OFFSET
} from './constants.js';

/**
 * Calculates Basal Metabolic Rate using the Mifflin-St Jeor formula.
 * Male: 10 * kg + 6.25 * cm - 5 * age + 5
 * Female: 10 * kg + 6.25 * cm - 5 * age - 161
 * @param {number} weightKg
 * @param {number} heightCm
 * @param {number} age
 * @param {'male'|'female'} sex
 * @returns {number}
 */
export function calculateBmr(weightKg, heightCm, age, sex) {
  if (weightKg <= 0 || heightCm <= 0 || age <= 0) {
    throw new Error('Weight, height, and age must be positive numbers');
  }

  const base =
    BMR_WEIGHT_MULT * weightKg +
    BMR_HEIGHT_MULT * heightCm -
    BMR_AGE_MULT * age;

  const offset = sex === 'female' ? BMR_FEMALE_OFFSET : BMR_MALE_OFFSET;
  return base + offset;
}
