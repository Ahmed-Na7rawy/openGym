import { NUTRIENTS_BY_ID } from './nutrients.js';

/**
 * Standard adult reference daily intakes (RDIs) / DRIs for 37 tracked nutrients.
 * Defaults represent baseline general maintenance recommendations.
 */
export const DEFAULT_MICRONUTRIENT_TARGETS = {
  // General
  water: 2500, // ml/g
  caffeine: null, // no min target
  alcohol: null,

  // Carbohydrates & Fiber
  fiber: 30, // g
  sugars: null, // upper limit target, not min

  // Lipids
  saturated: null, // upper limit
  monounsaturated: null,
  polyunsaturated: null,
  trans: null,
  cholesterol: null,
  omega3: 1.6, // g

  // Vitamins
  vitaminA: 900, // mcg
  vitaminC: 90, // mg
  vitaminD: 20, // mcg (800 IU)
  vitaminE: 15, // mg
  vitaminK: 120, // mcg
  vitaminB1: 1.2, // mg
  vitaminB2: 1.3, // mg
  vitaminB3: 16, // mg
  vitaminB5: 5, // mg
  vitaminB6: 1.7, // mg
  folate: 400, // mcg
  vitaminB12: 2.4, // mcg

  // Minerals
  calcium: 1000, // mg
  iron: 18, // mg
  magnesium: 400, // mg
  phosphorus: 700, // mg
  potassium: 3400, // mg
  sodium: 2300, // mg (adequate intake / upper guidance)
  zinc: 11, // mg
  copper: 0.9, // mg
  manganese: 2.3, // mg
  selenium: 55 // mcg
};

/**
 * Tolerable Upper Intake Levels (UL) for safety flags.
 */
export const NUTRIENT_UPPER_LIMITS = {
  caffeine: 400, // mg
  sugars: 50, // g (added sugars guideline)
  saturated: 20, // g (~10% kcal base)
  trans: 2, // g
  cholesterol: 300, // mg
  sodium: 2300, // mg
  vitaminA: 3000, // mcg
  vitaminC: 2000, // mg
  vitaminD: 100, // mcg
  vitaminE: 1000, // mg
  vitaminB3: 35, // mg
  vitaminB6: 100, // mg
  folate: 1000, // mcg
  calcium: 2500, // mg
  iron: 45, // mg
  magnesium: 350, // mg (supplemental)
  zinc: 40, // mg
  copper: 10, // mg
  manganese: 11, // mg
  selenium: 400 // mcg
};

/**
 * Computes effective targets by overlaying coach targets onto user/default targets.
 * Coach targets override user targets when active and present.
 *
 * @param {Object} [userTargets] { kcal, protein, carbs, fat, micros: {} }
 * @param {Object} [coachTargets] { active?: boolean, kcal?, protein?, carbs?, fat?, micros?: {} }
 * @returns {{
 *   kcal: number|null,
 *   protein: number|null,
 *   carbs: number|null,
 *   fat: number|null,
 *   micros: Record<string, number|null>,
 *   isCoachOverride: { kcal: boolean, protein: boolean, carbs: boolean, fat: boolean, micros: Record<string, boolean> }
 * }}
 */
export function getEffectiveTargets(userTargets = {}, coachTargets = null) {
  const isCoachActive = Boolean(coachTargets && coachTargets.active !== false);

  const u = userTargets || {};
  const c = isCoachActive ? (coachTargets || {}) : {};

  const effective = {
    kcal: c.kcal != null ? Number(c.kcal) : (u.kcal != null ? Number(u.kcal) : null),
    protein: c.protein != null ? Number(c.protein) : (u.protein != null ? Number(u.protein) : null),
    carbs: c.carbs != null ? Number(c.carbs) : (u.carbs != null ? Number(u.carbs) : null),
    fat: c.fat != null ? Number(c.fat) : (u.fat != null ? Number(u.fat) : null),
    micros: {},
    isCoachOverride: {
      kcal: Boolean(isCoachActive && c.kcal != null),
      protein: Boolean(isCoachActive && c.protein != null),
      carbs: Boolean(isCoachActive && c.carbs != null),
      fat: Boolean(isCoachActive && c.fat != null),
      micros: {}
    }
  };

  const userMicros = u.micros || {};
  const coachMicros = isCoachActive ? (c.micros || {}) : {};

  for (const [key, defaultTarget] of Object.entries(DEFAULT_MICRONUTRIENT_TARGETS)) {
    if (coachMicros[key] != null) {
      effective.micros[key] = Number(coachMicros[key]);
      effective.isCoachOverride.micros[key] = true;
    } else if (userMicros[key] != null) {
      effective.micros[key] = Number(userMicros[key]);
      effective.isCoachOverride.micros[key] = false;
    } else {
      effective.micros[key] = defaultTarget;
      effective.isCoachOverride.micros[key] = false;
    }
  }

  return effective;
}
