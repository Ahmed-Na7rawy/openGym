import { NUTRIENTS, NUTRIENTS_BY_ID } from './nutrients.js';

/**
 * Scales nutrient values per 100g to a given weight in grams.
 * Treats undefined/null/missing as null (unknown), NOT zero.
 *
 * @param {Record<string, number|null>} per100g
 * @param {number} grams
 * @returns {Record<string, number|null>}
 */
export function scaleNutrients(per100g = {}, grams = 0) {
  if (!per100g || typeof per100g !== 'object') return {};
  const factor = Math.max(0, Number(grams) || 0) / 100;
  const scaled = {};

  for (const n of NUTRIENTS) {
    const val = per100g[n.id];
    if (val === null || val === undefined || isNaN(val)) {
      scaled[n.id] = null;
    } else {
      scaled[n.id] = Number(val) * factor;
    }
  }

  return scaled;
}

/**
 * Computes nutrient breakdown for a diary entry using its food reference or fallback snapshot.
 *
 * @param {Object} entry { foodId, grams, snap?: { kcal, p, c, f }, d?: boolean }
 * @param {Object} [food] Food definition { nutrients: { [id]: number } }
 * @returns {Record<string, number|null>}
 */
export function entryNutrients(entry, food) {
  if (!entry || entry.d) return scaleNutrients({}, 0);

  if (food && food.nutrients) {
    return scaleNutrients(food.nutrients, entry.grams);
  }

  // Fallback to entry snapshot if full food record is unavailable
  const snap = entry.snap || {};
  const per100Estimate = {};
  const g = entry.grams || 100;
  if (snap.kcal != null) per100Estimate.kcal = (snap.kcal / g) * 100;
  if (snap.p != null) per100Estimate.protein = (snap.p / g) * 100;
  if (snap.c != null) per100Estimate.carbs = (snap.c / g) * 100;
  if (snap.f != null) per100Estimate.fat = (snap.f / g) * 100;

  return scaleNutrients(per100Estimate, g);
}

/**
 * Sums nutrient values across entries.
 * Missing nutrient values are treated as unknown (null).
 * Returns null for a nutrient total only if EVERY contributing entry is unknown for that nutrient.
 * If at least one entry has a numeric value, returns the sum of all known values.
 *
 * @param {Array<Object>} entries
 * @param {Function|Record<string, Object>} foodLookup (foodId) => food or { [foodId]: food }
 * @returns {Record<string, number|null>}
 */
export function sumEntries(entries = [], foodLookup = {}) {
  const getFood = typeof foodLookup === 'function' ? foodLookup : (id => foodLookup[id]);
  const activeEntries = (entries || []).filter(e => e && !e.d);

  const totals = {};
  const hasKnown = {};

  for (const n of NUTRIENTS) {
    totals[n.id] = 0;
    hasKnown[n.id] = false;
  }

  for (const entry of activeEntries) {
    const food = getFood(entry.foodId);
    const n = entryNutrients(entry, food);

    for (const nutrient of NUTRIENTS) {
      const val = n[nutrient.id];
      if (val !== null && val !== undefined && !isNaN(val)) {
        totals[nutrient.id] += val;
        hasKnown[nutrient.id] = true;
      }
    }
  }

  const result = {};
  for (const n of NUTRIENTS) {
    result[n.id] = hasKnown[n.id] ? totals[n.id] : null;
  }
  return result;
}

/**
 * Sums entries grouped by meal name.
 *
 * @param {Array<Object>} entries
 * @param {Function|Record<string, Object>} foodLookup
 * @returns {Record<string, Record<string, number|null>>}
 */
export function mealTotals(entries = [], foodLookup = {}) {
  const byMeal = {};
  for (const entry of (entries || [])) {
    if (!entry || entry.d) continue;
    const meal = entry.meal || 'other';
    if (!byMeal[meal]) byMeal[meal] = [];
    byMeal[meal].push(entry);
  }

  const res = {};
  for (const [meal, mealEntries] of Object.entries(byMeal)) {
    res[meal] = sumEntries(mealEntries, foodLookup);
  }
  return res;
}

/**
 * Computes total nutrients for a day.
 *
 * @param {Array<Object>} entries
 * @param {Function|Record<string, Object>} foodLookup
 * @returns {Record<string, number|null>}
 */
export function dayTotals(entries = [], foodLookup = {}) {
  return sumEntries(entries, foodLookup);
}

/**
 * Rounds a nutrient value for display according to its definition.
 * Rounding is done in this display helper only; never during accumulation.
 *
 * @param {string} nutrientId
 * @param {number|null|undefined} value
 * @returns {string} Formatted number or '-' if unknown
 */
export function formatNutrient(nutrientId, value) {
  if (value === null || value === undefined || isNaN(value)) {
    return '-';
  }
  const def = NUTRIENTS_BY_ID[nutrientId];
  const decimals = def ? def.decimals : 1;
  return Number(value).toFixed(decimals);
}
