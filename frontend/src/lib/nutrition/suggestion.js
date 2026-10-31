import { calculateBmr } from './bmr.js';
import { calculateMaintenance } from './activity.js';
import { calculateTargetCalories } from './calories.js';
import { calculateProteinTarget } from './protein.js';
import { calculateMacros } from './macros.js';
import { calculateTrainingStats } from './trainingStats.js';
import { WEIGHT_AVERAGE_COUNT } from './constants.js';

/**
 * Generates an automated diet suggestion based on profile, 7-weight average,
 * and 28-day training volume. Emits localized reason keys.
 *
 * @param {Object} [profile] { sex, birthYear, heightCm, activity, goal, weeklyRateKg }
 * @param {Array<any>} [weights] Array<{ measuredOn?: string, d?: string, kg?: number, w?: number }>
 * @param {Array<any>} [trainingLogs] Array of workouts or log entries
 * @param {Date} [referenceDate]
 * @returns {{ available: boolean, missingFields?: string[], suggestion?: any }}
 */
export function generateDietSuggestion(
  profile,
  weights = [],
  trainingLogs = [],
  referenceDate = new Date()
) {
  const missing = [];

  if (!profile) {
    missing.push('profile', 'sex', 'birthYear', 'heightCm');
  } else {
    if (!profile.sex) missing.push('sex');
    if (!profile.birthYear) missing.push('birthYear');
    if (!profile.heightCm) missing.push('heightCm');
  }

  const validWeights = (weights || [])
    .map(w => ({
      date: w.measuredOn || w.d,
      kg: Number(w.kg != null ? w.kg : w.w)
    }))
    .filter(w => w.date && !isNaN(w.kg));

  if (validWeights.length === 0) missing.push('weight');

  if (missing.length > 0 || !profile) {
    return { available: false, missingFields: missing };
  }

  // Calculate age from birthYear
  const currentYear = referenceDate.getUTCFullYear();
  const age = Math.max(1, currentYear - profile.birthYear);

  // Weight average over up to last 7 entries
  const sortedWeights = [...validWeights].sort((a, b) => b.date.localeCompare(a.date));
  const recentWeights = sortedWeights.slice(0, WEIGHT_AVERAGE_COUNT);
  const sumWeights = recentWeights.reduce((acc, w) => acc + w.kg, 0);
  const avgWeightKg = Math.round((sumWeights / recentWeights.length) * 10) / 10;

  // Training stats
  const stats = calculateTrainingStats(trainingLogs, referenceDate);

  // BMR & Maintenance
  const sex = profile.sex;
  const heightCm = Number(profile.heightCm);
  const bmr = Math.round(calculateBmr(avgWeightKg, heightCm, age, sex));

  const activityLevel = Number(profile.activity) || 2;
  const maintenance = calculateMaintenance(bmr, activityLevel);

  // Goal & Calories
  const goal = profile.goal || 'maintain';
  const calorieResult = calculateTargetCalories(maintenance, goal, sex, profile.weeklyRateKg);

  // Protein Target
  const proteinResult = calculateProteinTarget(
    avgWeightKg,
    stats.sessionsPerWeek,
    stats.setsPerWeek,
    goal
  );

  // Macros (Fat & Carbs)
  const macros = calculateMacros(
    avgWeightKg,
    calorieResult.calories,
    proteinResult.proteinG
  );

  // Aggregate translation reasons
  const allReasons = [
    {
      key: 'weight.reason.average',
      params: { count: recentWeights.length, avgKg: avgWeightKg }
    },
    ...calorieResult.reasons,
    ...proteinResult.reasons
  ];

  return {
    available: true,
    suggestion: {
      weightKg: avgWeightKg,
      weightEntriesUsed: recentWeights.length,
      bmr,
      maintenanceCalories: maintenance,
      targetCalories: calorieResult.calories,
      targetBeforeFloor: calorieResult.targetBeforeFloor,
      floorApplied: calorieResult.floorApplied,
      proteinG: proteinResult.proteinG,
      proteinGPerKg: proteinResult.gPerKg,
      fatG: macros.fatG,
      carbsG: macros.carbsG,
      trainingStats: stats,
      reasons: allReasons
    }
  };
}
