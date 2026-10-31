/**
 * Named constants and thresholds for the nutrition calculator module.
 * If any threshold is changed, update test suites and docs/DECISIONS.md.
 */

// BMR (Mifflin-St Jeor)
export const BMR_WEIGHT_MULT = 10;
export const BMR_HEIGHT_MULT = 6.25;
export const BMR_AGE_MULT = 5;
export const BMR_MALE_OFFSET = 5;
export const BMR_FEMALE_OFFSET = -161;

// Activity Multipliers
export const ACTIVITY_FACTORS = {
  1: 1.2,   // Sedentary
  2: 1.375, // Light
  3: 1.55,  // Moderate
  4: 1.725  // High
};

// Calorie Calculation
export const KCAL_PER_KG_WEIGHT_CHANGE = 7700;
export const DEFAULT_LOSE_RATE_KG_PER_WEEK = 0.5;
export const DEFAULT_GAIN_RATE_KG_PER_WEEK = 0.25;
export const MAX_DEFICIT_MAINTENANCE_RATIO = 0.25; // 25% cap on deficit
export const MAX_SURPLUS_MAINTENANCE_RATIO = 0.15; // 15% cap on surplus

// Safety Floors
export const CALORIE_FLOOR_MALE = 1500;
export const CALORIE_FLOOR_FEMALE = 1200;

// Protein (g/kg) Thresholds
export const PROTEIN_LOW_SESSIONS_THRESHOLD = 2; // < 2 sessions -> 1.2 g/kg
export const PROTEIN_BASE_LOW_G_PER_KG = 1.2;
export const PROTEIN_BASE_STANDARD_G_PER_KG = 1.6; // >= 2 sessions -> 1.6 g/kg
export const PROTEIN_HIGH_SESSIONS_THRESHOLD = 4; // >= 4 sessions -> +0.1 g/kg
export const PROTEIN_HIGH_SESSIONS_BONUS = 0.1;
export const PROTEIN_HARD_SETS_THRESHOLD = 60; // >= 60 hard sets/week -> +0.1 g/kg
export const PROTEIN_HARD_SETS_BONUS = 0.1;
export const PROTEIN_GOAL_LOSE_BONUS = 0.2; // Goal 'lose' -> +0.2 g/kg
export const PROTEIN_MAX_CAP = 2.2; // Hard cap at 2.2 g/kg

// Fat & Carb Constants
export const FAT_G_PER_KG = 0.9;
export const FAT_MIN_G_PER_KG = 0.6;
export const KCAL_PER_G_PROTEIN = 4;
export const KCAL_PER_G_FAT = 9;
export const KCAL_PER_G_CARB = 4;

// Training Stats & Averaging Windows
export const TRAINING_STATS_WINDOW_DAYS = 28;
export const TRAINING_STATS_MIN_DIVISOR_DAYS = 7;
export const WEIGHT_AVERAGE_COUNT = 7;

// Adherence
export const ADHERENCE_TARGET_RATIO = 0.9; // 90% or more of target
