import { buildIndex, search } from './search.js';
import { scaleNutrients } from './foodMath.js';
import egyptianFoods from '../../../../foods/egyptian.json';

let cachedBundle = null;
let cachedIndex = null;

/**
 * Parses and indexes a list of food items.
 *
 * @param {Array<Object>} foods
 * @returns {{ foods: Array<Object>, index: Object, byId: Record<string, Object> }}
 */
export function indexFoods(foods = []) {
  const foodList = Array.isArray(foods) ? foods : [];
  const searchIndex = buildIndex(foodList);
  const byId = {};
  for (const f of foodList) {
    if (f && f.id) {
      byId[f.id] = f;
    }
  }
  return {
    foods: foodList,
    searchIndex,
    byId
  };
}

/**
 * Loads food dataset supporting web fetch and local fallback, caching results in memory.
 *
 * @param {Object} [options]
 * @param {string} [options.url='/foods/bundle.json']
 * @param {boolean} [options.forceRefresh=false]
 * @param {Function} [options.fetchFn=globalThis.fetch]
 * @returns {Promise<{ foods: Array<Object>, searchIndex: Object, byId: Record<string, Object>, search: (q: string, limit?: number) => Array<Object> }>}
 */
export async function loadFoods(options = {}) {
  const {
    url = '/foods/bundle.json',
    forceRefresh = false,
    fetchFn = globalThis.fetch
  } = options;

  if (cachedBundle && cachedIndex && !forceRefresh) {
    return createResult(cachedIndex);
  }

  let loadedFoods = null;

  // Try web fetch if available
  if (typeof fetchFn === 'function') {
    try {
      const res = await fetchFn(url);
      if (res && res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.foods)) {
          loadedFoods = data.foods;
        } else if (Array.isArray(data)) {
          loadedFoods = data;
        }
      }
    } catch {
      // Fallback to static bundled foods below
    }
  }

  // Fallback to bundled Egyptian staples
  if (!loadedFoods || loadedFoods.length === 0) {
    loadedFoods = Array.isArray(egyptianFoods) ? egyptianFoods : [];
  }

  cachedBundle = loadedFoods;
  cachedIndex = indexFoods(loadedFoods);

  return createResult(cachedIndex);
}

/**
 * Calculates serving weight in grams for a given portion selection or raw grams.
 *
 * @param {Object} food
 * @param {string|number} portionRef Portion index (number), portion label (string), or null for default
 * @param {number} [quantity=1]
 * @returns {number}
 */
export function calculateServingGrams(food, portionRef = null, quantity = 1) {
  if (!food) return 0;
  const qty = Math.max(0, Number(quantity) || 0);

  if (portionRef === null || portionRef === undefined || portionRef === 'default') {
    const baseG = food.defaultServingG || 100;
    return baseG * qty;
  }

  if (typeof portionRef === 'number') {
    const portion = food.commonPortions && food.commonPortions[portionRef];
    if (portion && portion.grams) {
      return portion.grams * qty;
    }
  }

  if (typeof portionRef === 'string') {
    const portion = (food.commonPortions || []).find(
      p => p.label === portionRef || p.labelAr === portionRef
    );
    if (portion && portion.grams) {
      return portion.grams * qty;
    }
  }

  return (food.defaultServingG || 100) * qty;
}

/**
 * Calculates nutrients for a specific food portion and quantity.
 *
 * @param {Object} food
 * @param {string|number} portionRef
 * @param {number} [quantity=1]
 * @returns {Record<string, number|null>}
 */
export function calculatePortionNutrients(food, portionRef = null, quantity = 1) {
  if (!food || !food.nutrients) return {};
  const grams = calculateServingGrams(food, portionRef, quantity);
  return scaleNutrients(food.nutrients, grams);
}

/**
 * Clears in-memory food cache (useful for tests).
 */
export function clearFoodCache() {
  cachedBundle = null;
  cachedIndex = null;
}

function createResult(indexed) {
  return {
    foods: indexed.foods,
    searchIndex: indexed.searchIndex,
    byId: indexed.byId,
    search: (query, limit = 25) => search(indexed.searchIndex, query, limit)
  };
}
