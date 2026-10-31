import {
  PROTEIN_LOW_SESSIONS_THRESHOLD,
  PROTEIN_BASE_LOW_G_PER_KG,
  PROTEIN_BASE_STANDARD_G_PER_KG,
  PROTEIN_HIGH_SESSIONS_THRESHOLD,
  PROTEIN_HIGH_SESSIONS_BONUS,
  PROTEIN_HARD_SETS_THRESHOLD,
  PROTEIN_HARD_SETS_BONUS,
  PROTEIN_GOAL_LOSE_BONUS,
  PROTEIN_MAX_CAP
} from './constants.js';

/**
 * Calculates protein target g/kg and total grams based on training volume and goal.
 * - Base: 1.2 if sessions < 2, else 1.6
 * - Bonus +0.1 if sessions >= 4
 * - Bonus +0.1 if sets >= 60
 * - Bonus +0.2 if goal is 'lose'
 * - Hard cap: 2.2
 * - Round to 1 decimal place; grams = round(weightKg * gPerKg)
 * @param {number} weightKg
 * @param {number} sessionsPerWeek
 * @param {number} setsPerWeek
 * @param {'lose'|'maintain'|'gain'} goal
 * @returns {{ gPerKg: number, proteinG: number, reasons: Array<{ key: string, params?: Record<string, any> }> }}
 */
export function calculateProteinTarget(
  weightKg,
  sessionsPerWeek,
  setsPerWeek,
  goal
) {
  if (weightKg <= 0) {
    throw new Error('Weight must be positive');
  }

  const reasons = [];

  let g = sessionsPerWeek < PROTEIN_LOW_SESSIONS_THRESHOLD
    ? PROTEIN_BASE_LOW_G_PER_KG
    : PROTEIN_BASE_STANDARD_G_PER_KG;

  if (sessionsPerWeek < PROTEIN_LOW_SESSIONS_THRESHOLD) {
    reasons.push({
      key: 'protein.reason.low_sessions',
      params: { sessions: Math.round(sessionsPerWeek * 10) / 10, base: PROTEIN_BASE_LOW_G_PER_KG }
    });
  } else {
    reasons.push({
      key: 'protein.reason.base',
      params: { sessions: Math.round(sessionsPerWeek * 10) / 10, base: PROTEIN_BASE_STANDARD_G_PER_KG }
    });
  }

  if (sessionsPerWeek >= PROTEIN_HIGH_SESSIONS_THRESHOLD) {
    g += PROTEIN_HIGH_SESSIONS_BONUS;
    reasons.push({
      key: 'protein.reason.high_sessions',
      params: { bonus: PROTEIN_HIGH_SESSIONS_BONUS }
    });
  }

  if (setsPerWeek >= PROTEIN_HARD_SETS_THRESHOLD) {
    g += PROTEIN_HARD_SETS_BONUS;
    reasons.push({
      key: 'protein.reason.hard_sets',
      params: { sets: Math.round(setsPerWeek), bonus: PROTEIN_HARD_SETS_BONUS }
    });
  }

  if (goal === 'lose') {
    g += PROTEIN_GOAL_LOSE_BONUS;
    reasons.push({
      key: 'protein.reason.goal_lose',
      params: { bonus: PROTEIN_GOAL_LOSE_BONUS }
    });
  }

  const roundedBeforeCap = Math.round(g * 10) / 10;
  const capped = roundedBeforeCap > PROTEIN_MAX_CAP;
  const finalGPerKg = capped ? PROTEIN_MAX_CAP : roundedBeforeCap;

  if (capped) {
    reasons.push({
      key: 'protein.reason.max_cap',
      params: { cap: PROTEIN_MAX_CAP }
    });
  }

  const proteinG = Math.round(weightKg * finalGPerKg);

  return {
    gPerKg: finalGPerKg,
    proteinG,
    reasons
  };
}
