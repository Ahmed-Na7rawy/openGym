import { describe, it, expect } from 'vitest';
import {
  scaleNutrients,
  entryNutrients,
  sumEntries,
  mealTotals,
  dayTotals,
  formatNutrient
} from './foodMath.js';

describe('foodMath library', () => {
  const sampleFood = {
    id: 'f1',
    name: 'Oats',
    nutrients: {
      kcal: 389,
      protein: 16.9,
      carbs: 66.3,
      fat: 6.9,
      fiber: 10.6,
      magnesium: 177,
      vitaminC: null // unknown
    }
  };

  it('scales nutrients proportionally to gram weight', () => {
    // 50g is half of 100g
    const scaled = scaleNutrients(sampleFood.nutrients, 50);
    expect(scaled.kcal).toBeCloseTo(194.5, 1);
    expect(scaled.protein).toBeCloseTo(8.45, 2);
    expect(scaled.vitaminC).toBeNull(); // remains null/unknown
  });

  it('entryNutrients uses food nutrients when available', () => {
    const entry = { foodId: 'f1', grams: 100 };
    const n = entryNutrients(entry, sampleFood);
    expect(n.kcal).toBe(389);
    expect(n.protein).toBe(16.9);
  });

  it('entryNutrients falls back to snapshot when food object is missing', () => {
    const entry = {
      foodId: 'f_missing',
      grams: 50,
      snap: { kcal: 200, p: 10, c: 20, f: 5 }
    };
    const n = entryNutrients(entry, null);
    expect(n.kcal).toBe(200);
    expect(n.protein).toBe(10);
  });

  it('sumEntries correctly sums active entries and respects unknown values', () => {
    const entries = [
      { foodId: 'f1', grams: 100 },
      { foodId: 'f1', grams: 50 },
      { foodId: 'f1', grams: 100, d: true } // deleted tombstone should be ignored
    ];

    const totals = sumEntries(entries, { f1: sampleFood });
    // 100g + 50g = 150g -> 1.5 * 389 = 583.5
    expect(totals.kcal).toBeCloseTo(583.5, 1);
    expect(totals.vitaminC).toBeNull(); // was null in all entries -> null
  });

  it('mealTotals breaks down nutrients by meal category', () => {
    const entries = [
      { meal: 'breakfast', foodId: 'f1', grams: 50 },
      { meal: 'lunch', foodId: 'f1', grams: 100 }
    ];

    const meals = mealTotals(entries, { f1: sampleFood });
    expect(meals.breakfast.kcal).toBeCloseTo(194.5, 1);
    expect(meals.lunch.kcal).toBeCloseTo(389, 1);
  });

  it('formatNutrient handles display precision and null formatting', () => {
    expect(formatNutrient('kcal', 250.4)).toBe('250');
    expect(formatNutrient('protein', 32.56)).toBe('32.6');
    expect(formatNutrient('vitaminB12', 2.456)).toBe('2.46');
    expect(formatNutrient('kcal', null)).toBe('-');
    expect(formatNutrient('kcal', undefined)).toBe('-');
  });
});
