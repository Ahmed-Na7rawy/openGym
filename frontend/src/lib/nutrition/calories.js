import {
  KCAL_PER_KG_WEIGHT_CHANGE,
  DEFAULT_LOSE_RATE_KG_PER_WEEK,
  DEFAULT_GAIN_RATE_KG_PER_WEEK,
  MAX_DEFICIT_MAINTENANCE_RATIO,
  MAX_SURPLUS_MAINTENANCE_RATIO,
  CALORIE_FLOOR_MALE,
  CALORIE_FLOOR_FEMALE
} from './constants.js';

/**
 * Calculates target calories according to goal, weekly rate, deficit/surplus caps,
 * and safety calorie floors.
 * @param {number} maintenance
 * @param {'lose'|'maintain'|'gain'} goal
 * @param {'male'|'female'} sex
 * @param {number|null|undefined} weeklyRateKg
 * @returns {{ calories: number, maintenance: number, targetBeforeFloor: number, floorApplied: boolean, reasons: Array<{ key: string, params?: Record<string, any> }> }}
 */
export function calculateTargetCalories(
  maintenance,
  goal,
  sex,
  weeklyRateKg = null
) {
  if (maintenance <= 0) {
    throw new Error('Maintenance calories must be positive');
  }

  const reasons = [
    { key: 'calories.reason.maintenance', params: { kcal: maintenance } }
  ];

  let targetBeforeFloor = maintenance;

  if (goal === 'lose') {
    const rate = weeklyRateKg && weeklyRateKg > 0 ? weeklyRateKg : DEFAULT_LOSE_RATE_KG_PER_WEEK;
    const rawDailyDeficit = (rate * KCAL_PER_KG_WEIGHT_CHANGE) / 7;
    const maxDeficit = maintenance * MAX_DEFICIT_MAINTENANCE_RATIO;
    const deficitCapped = rawDailyDeficit > maxDeficit;
    const actualDeficit = Math.min(rawDailyDeficit, maxDeficit);

    targetBeforeFloor = Math.round(maintenance - actualDeficit);

    if (deficitCapped) {
      reasons.push({
        key: 'calories.reason.deficit_capped',
        params: { rate, maxDeficit: Math.round(maxDeficit), actualDeficit: Math.round(actualDeficit) }
      });
    } else {
      reasons.push({
        key: 'calories.reason.deficit_applied',
        params: { rate, deficit: Math.round(actualDeficit) }
      });
    }
  } else if (goal === 'gain') {
    const rate = weeklyRateKg && weeklyRateKg > 0 ? weeklyRateKg : DEFAULT_GAIN_RATE_KG_PER_WEEK;
    const rawDailySurplus = (rate * KCAL_PER_KG_WEIGHT_CHANGE) / 7;
    const maxSurplus = maintenance * MAX_SURPLUS_MAINTENANCE_RATIO;
    const surplusCapped = rawDailySurplus > maxSurplus;
    const actualSurplus = Math.min(rawDailySurplus, maxSurplus);

    targetBeforeFloor = Math.round(maintenance + actualSurplus);

    if (surplusCapped) {
      reasons.push({
        key: 'calories.reason.surplus_capped',
        params: { rate, maxSurplus: Math.round(maxSurplus), actualSurplus: Math.round(actualSurplus) }
      });
    } else {
      reasons.push({
        key: 'calories.reason.surplus_applied',
        params: { rate, surplus: Math.round(actualSurplus) }
      });
    }
  } else {
    reasons.push({ key: 'calories.reason.maintain' });
  }

  const floor = sex === 'female' ? CALORIE_FLOOR_FEMALE : CALORIE_FLOOR_MALE;
  const floorApplied = targetBeforeFloor < floor;
  const finalCalories = floorApplied ? floor : targetBeforeFloor;

  if (floorApplied) {
    reasons.push({
      key: 'calories.reason.floor_applied',
      params: { floor, sex }
    });
  }

  return {
    calories: finalCalories,
    maintenance,
    targetBeforeFloor,
    floorApplied,
    reasons
  };
}
