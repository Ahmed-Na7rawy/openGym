import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadFoods,
  indexFoods,
  calculateServingGrams,
  calculatePortionNutrients,
  clearFoodCache
} from './foodSource.js';

describe('foodSource', () => {
  const sampleFoods = [
    {
      id: 'food_1',
      name: 'Ful Medames',
      nameAr: 'فول مدمس',
      category: 'Legumes',
      defaultServingG: 200,
      commonPortions: [
        { label: '1 plate', labelAr: 'طبق', grams: 250 },
        { label: '1 spoon', labelAr: 'ملعقة', grams: 30 }
      ],
      nutrients: {
        kcal: 110,
        protein: 7.6,
        carbs: 19.8,
        fat: 0.6
      }
    },
    {
      id: 'food_2',
      name: 'Boiled Egg',
      nameAr: 'بيض مسلوق',
      category: 'Dairy',
      defaultServingG: 50,
      commonPortions: [
        { label: '1 egg', labelAr: 'بيضة', grams: 50 }
      ],
      nutrients: {
        kcal: 155,
        protein: 12.6,
        carbs: 1.1,
        fat: 10.6
      }
    }
  ];

  beforeEach(() => {
    clearFoodCache();
  });

  describe('indexFoods', () => {
    it('indexes foods and builds quick lookup map by id', () => {
      const indexed = indexFoods(sampleFoods);
      expect(indexed.foods).toHaveLength(2);
      expect(indexed.byId['food_1']).toBeDefined();
      expect(indexed.byId['food_1'].name).toBe('Ful Medames');
      expect(indexed.byId['food_2'].nameAr).toBe('بيض مسلوق');
    });

    it('handles empty food list gracefully', () => {
      const indexed = indexFoods([]);
      expect(indexed.foods).toEqual([]);
      expect(indexed.byId).toEqual({});
    });
  });

  describe('loadFoods', () => {
    it('falls back to bundled Egyptian staples when fetch fails or returns error', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      const result = await loadFoods({ fetchFn: mockFetch });

      expect(mockFetch).toHaveBeenCalled();
      expect(result.foods.length).toBeGreaterThan(0);
      expect(result.byId['eg_ful_medames']).toBeDefined();
      expect(result.byId['eg_koshari']).toBeDefined();

      // Search functionality works on loaded data
      const searchRes = result.search('koshari');
      expect(searchRes.length).toBeGreaterThan(0);
      expect(searchRes[0].id).toBe('eg_koshari');
    });

    it('fetches remote bundle successfully when fetch succeeds', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          version: 1,
          count: sampleFoods.length,
          foods: sampleFoods
        })
      });

      const result = await loadFoods({ fetchFn: mockFetch });
      expect(result.foods).toHaveLength(2);
      expect(result.byId['food_1']).toBeDefined();
      expect(result.byId['food_2']).toBeDefined();
    });

    it('caches loaded result in memory across multiple calls', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ foods: sampleFoods })
      });

      const firstCall = await loadFoods({ fetchFn: mockFetch });
      const secondCall = await loadFoods({ fetchFn: mockFetch });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(firstCall.foods).toBe(secondCall.foods);
    });

    it('re-fetches when forceRefresh option is true', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ foods: sampleFoods })
      });

      await loadFoods({ fetchFn: mockFetch });
      await loadFoods({ fetchFn: mockFetch, forceRefresh: true });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('calculateServingGrams', () => {
    const food = sampleFoods[0];

    it('returns default serving grams when portionRef is null or default', () => {
      expect(calculateServingGrams(food, null, 1)).toBe(200);
      expect(calculateServingGrams(food, 'default', 2)).toBe(400);
    });

    it('calculates grams by portion index', () => {
      expect(calculateServingGrams(food, 0, 1)).toBe(250); // 1 plate = 250g
      expect(calculateServingGrams(food, 1, 3)).toBe(90);  // 3 spoons = 90g
    });

    it('calculates grams by portion label (English or Arabic)', () => {
      expect(calculateServingGrams(food, '1 plate', 2)).toBe(500);
      expect(calculateServingGrams(food, 'طبق', 1)).toBe(250);
      expect(calculateServingGrams(food, 'ملعقة', 2)).toBe(60);
    });

    it('falls back to defaultServingG if portion label is unknown', () => {
      expect(calculateServingGrams(food, 'unknown_label', 1)).toBe(200);
    });

    it('handles null food or invalid quantity safely', () => {
      expect(calculateServingGrams(null)).toBe(0);
      expect(calculateServingGrams(food, 0, -5)).toBe(0);
      expect(calculateServingGrams(food, 0, NaN)).toBe(0);
    });
  });

  describe('calculatePortionNutrients', () => {
    const food = sampleFoods[0]; // kcal: 110 per 100g

    it('calculates scaled nutrients correctly for portion', () => {
      // 1 plate = 250g -> 2.5x
      const nutrients = calculatePortionNutrients(food, '1 plate', 1);
      expect(nutrients.kcal).toBeCloseTo(275, 1);
      expect(nutrients.protein).toBeCloseTo(19.0, 1);
    });

    it('handles quantity multiplier', () => {
      // 2 spoons = 60g -> 0.6x
      const nutrients = calculatePortionNutrients(food, 1, 2);
      expect(nutrients.kcal).toBeCloseTo(66, 1);
    });

    it('returns empty object when food is null or missing nutrients', () => {
      expect(calculatePortionNutrients(null)).toEqual({});
      expect(calculatePortionNutrients({})).toEqual({});
    });
  });
});
