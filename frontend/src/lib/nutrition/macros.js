import {
  FAT_G_PER_KG,
  FAT_MIN_G_PER_KG,
  KCAL_PER_G_PROTEIN,
  KCAL_PER_G_FAT,
  KCAL_PER_G_CARB
} from './constants.js';

/**
 * Calculates macro split in grams:
 * - Protein is already decided (proteinG)
 * - Fat is 0.9 g/kg (min 0.6 g/kg)
 * - Carbs take the remaining calories, never negative
 * @param {number} weightKg
 * @param {number} calories
 * @param {number} proteinG
 * @returns {{ calories: number, proteinG: number, fatG: number, carbsG: number }}
 */
export function calculateMacros(
  weightKg,
  calories,
  proteinG
) {
  if (weightKg <= 0 || calories <= 0 || proteinG < 0) {
    throw new Error('Weight, calories, and protein must be non-negative');
  }

  // Base fat 0.9 g/kg
  let fatG = Math.round(weightKg * FAT_G_PER_KG);
  const minFatG = Math.round(weightKg * FAT_MIN_G_PER_KG);

  // If protein + base fat exceeds total calories, compress fat down to min 0.6 g/kg
  const proteinKcal = proteinG * KCAL_PER_G_PROTEIN;
  let fatKcal = fatG * KCAL_PER_G_FAT;

  if (proteinKcal + fatKcal > calories && fatG > minFatG) {
    const availableForFat = Math.max(0, calories - proteinKcal);
    const adjustedFat = Math.round(availableForFat / KCAL_PER_G_FAT);
    fatG = Math.max(minFatG, adjustedFat);
    fatKcal = fatG * KCAL_PER_G_FAT;
  }

  const remainingKcal = Math.max(0, calories - (proteinKcal + fatKcal));
  const carbsG = Math.round(remainingKcal / KCAL_PER_G_CARB);

  return {
    calories,
    proteinG,
    fatG,
    carbsG
  };
}
