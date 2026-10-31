/**
 * Single nutrient definition list used everywhere in openGym nutrition.
 * Nutrient values are always stored per 100 g (or per 100 ml) in food records.
 *
 * id: Unique canonical key
 * labelKey: Translation key in i18n
 * unit: Standard unit ('kcal', 'g', 'mg', 'mcg', 'ml')
 * group: 'general' | 'carbs' | 'lipids' | 'protein' | 'vitamins' | 'minerals'
 * decimals: Default decimal precision for display
 */
export const NUTRIENTS = [
  // General
  { id: 'kcal', labelKey: 'nutrient.kcal', unit: 'kcal', group: 'general', decimals: 0 },
  { id: 'water', labelKey: 'nutrient.water', unit: 'g', group: 'general', decimals: 1 },
  { id: 'caffeine', labelKey: 'nutrient.caffeine', unit: 'mg', group: 'general', decimals: 0 },
  { id: 'alcohol', labelKey: 'nutrient.alcohol', unit: 'g', group: 'general', decimals: 1 },

  // Protein & Amino Acids
  { id: 'protein', labelKey: 'nutrient.protein', unit: 'g', group: 'protein', decimals: 1 },

  // Carbohydrates
  { id: 'carbs', labelKey: 'nutrient.carbs', unit: 'g', group: 'carbs', decimals: 1 },
  { id: 'fiber', labelKey: 'nutrient.fiber', unit: 'g', group: 'carbs', decimals: 1 },
  { id: 'sugars', labelKey: 'nutrient.sugars', unit: 'g', group: 'carbs', decimals: 1 },

  // Lipids
  { id: 'fat', labelKey: 'nutrient.fat', unit: 'g', group: 'lipids', decimals: 1 },
  { id: 'saturated', labelKey: 'nutrient.saturated', unit: 'g', group: 'lipids', decimals: 1 },
  { id: 'monounsaturated', labelKey: 'nutrient.monounsaturated', unit: 'g', group: 'lipids', decimals: 1 },
  { id: 'polyunsaturated', labelKey: 'nutrient.polyunsaturated', unit: 'g', group: 'lipids', decimals: 1 },
  { id: 'trans', labelKey: 'nutrient.trans', unit: 'g', group: 'lipids', decimals: 1 },
  { id: 'cholesterol', labelKey: 'nutrient.cholesterol', unit: 'mg', group: 'lipids', decimals: 1 },
  { id: 'omega3', labelKey: 'nutrient.omega3', unit: 'g', group: 'lipids', decimals: 2 },

  // Vitamins
  { id: 'vitaminA', labelKey: 'nutrient.vitaminA', unit: 'mcg', group: 'vitamins', decimals: 1 },
  { id: 'vitaminC', labelKey: 'nutrient.vitaminC', unit: 'mg', group: 'vitamins', decimals: 1 },
  { id: 'vitaminD', labelKey: 'nutrient.vitaminD', unit: 'mcg', group: 'vitamins', decimals: 1 },
  { id: 'vitaminE', labelKey: 'nutrient.vitaminE', unit: 'mg', group: 'vitamins', decimals: 1 },
  { id: 'vitaminK', labelKey: 'nutrient.vitaminK', unit: 'mcg', group: 'vitamins', decimals: 1 },
  { id: 'vitaminB1', labelKey: 'nutrient.vitaminB1', unit: 'mg', group: 'vitamins', decimals: 2 },
  { id: 'vitaminB2', labelKey: 'nutrient.vitaminB2', unit: 'mg', group: 'vitamins', decimals: 2 },
  { id: 'vitaminB3', labelKey: 'nutrient.vitaminB3', unit: 'mg', group: 'vitamins', decimals: 1 },
  { id: 'vitaminB5', labelKey: 'nutrient.vitaminB5', unit: 'mg', group: 'vitamins', decimals: 2 },
  { id: 'vitaminB6', labelKey: 'nutrient.vitaminB6', unit: 'mg', group: 'vitamins', decimals: 2 },
  { id: 'folate', labelKey: 'nutrient.folate', unit: 'mcg', group: 'vitamins', decimals: 1 },
  { id: 'vitaminB12', labelKey: 'nutrient.vitaminB12', unit: 'mcg', group: 'vitamins', decimals: 2 },

  // Minerals
  { id: 'calcium', labelKey: 'nutrient.calcium', unit: 'mg', group: 'minerals', decimals: 0 },
  { id: 'iron', labelKey: 'nutrient.iron', unit: 'mg', group: 'minerals', decimals: 1 },
  { id: 'magnesium', labelKey: 'nutrient.magnesium', unit: 'mg', group: 'minerals', decimals: 0 },
  { id: 'phosphorus', labelKey: 'nutrient.phosphorus', unit: 'mg', group: 'minerals', decimals: 0 },
  { id: 'potassium', labelKey: 'nutrient.potassium', unit: 'mg', group: 'minerals', decimals: 0 },
  { id: 'sodium', labelKey: 'nutrient.sodium', unit: 'mg', group: 'minerals', decimals: 0 },
  { id: 'zinc', labelKey: 'nutrient.zinc', unit: 'mg', group: 'minerals', decimals: 1 },
  { id: 'copper', labelKey: 'nutrient.copper', unit: 'mg', group: 'minerals', decimals: 2 },
  { id: 'manganese', labelKey: 'nutrient.manganese', unit: 'mg', group: 'minerals', decimals: 2 },
  { id: 'selenium', labelKey: 'nutrient.selenium', unit: 'mcg', group: 'minerals', decimals: 1 }
];

export const NUTRIENTS_BY_ID = Object.fromEntries(NUTRIENTS.map(n => [n.id, n]));

export const NUTRIENT_GROUPS = [
  'general',
  'carbs',
  'lipids',
  'protein',
  'vitamins',
  'minerals'
];
