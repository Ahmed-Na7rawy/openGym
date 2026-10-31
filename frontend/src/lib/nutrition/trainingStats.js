import {
  TRAINING_STATS_WINDOW_DAYS,
  TRAINING_STATS_MIN_DIVISOR_DAYS
} from './constants.js';

/**
 * Checks whether a set counts as a completed non-warm-up set.
 * Supports openGym shapes:
 * - set.phase === 'work' or set.warmup !== true
 * - set.completed === true (or implicit completed in saved logs if not false)
 * @param {any} set
 * @returns {boolean}
 */
export function isCompletedWorkSet(set) {
  if (!set || typeof set !== 'object') return false;
  if (set.completed === false) return false;
  const phase = typeof set.phase === 'string' ? set.phase.trim().toLowerCase() : '';
  if (phase === 'warmup' || phase === 'warm-up' || set.warmup === true) return false;
  return true;
}

/**
 * Calculates training volume (sessions per week and completed non-warmup sets per week)
 * over the last 28 days.
 * Minimum divisor is 7 days (1 week).
 *
 * Accepts either:
 * 1. Simple training log entries: Array<{ performedOn: string }>
 * 2. openGym workout array: Array<{ d: string, entries?: Array<{ sets?: Array<any> }> }>
 *
 * @param {Array<any>} workoutsOrLogs
 * @param {Date} [referenceDate]
 * @returns {{ sessionsPerWeek: number, setsPerWeek: number, totalSessions: number, totalSets: number, weeksDivisor: number }}
 */
export function calculateTrainingStats(
  workoutsOrLogs = [],
  referenceDate = new Date()
) {
  const refTime = referenceDate.getTime();
  const cutoffTime = refTime - TRAINING_STATS_WINDOW_DAYS * 86_400_000;
  const cutoffDateStr = new Date(cutoffTime).toISOString().slice(0, 10);

  // Normalize entries into items with { date: 'YYYY-MM-DD', setCount: number }
  const items = [];
  for (const item of workoutsOrLogs) {
    if (!item || typeof item !== 'object') continue;
    const dateStr = item.d || item.performedOn;
    if (!dateStr || dateStr < cutoffDateStr) continue;

    if (Array.isArray(item.entries)) {
      // openGym workout format
      let workSets = 0;
      for (const entry of item.entries) {
        if (Array.isArray(entry?.sets)) {
          for (const s of entry.sets) {
            if (isCompletedWorkSet(s)) workSets++;
          }
        }
      }
      items.push({ date: dateStr, setCount: workSets });
    } else {
      // flat log entry format (1 set per log item)
      items.push({ date: dateStr, setCount: 1 });
    }
  }

  if (items.length === 0) {
    return {
      sessionsPerWeek: 0,
      setsPerWeek: 0,
      totalSessions: 0,
      totalSets: 0,
      weeksDivisor: TRAINING_STATS_MIN_DIVISOR_DAYS / 7
    };
  }

  const timestamps = items.map(l => new Date(`${l.date}T00:00:00.000Z`).getTime());
  const earliestTime = Math.min(...timestamps);
  const daysElapsed = Math.max(0, (refTime - earliestTime) / 86_400_000);

  const effectiveDays = Math.max(
    TRAINING_STATS_MIN_DIVISOR_DAYS,
    Math.min(TRAINING_STATS_WINDOW_DAYS, daysElapsed)
  );
  const weeksDivisor = effectiveDays / 7;

  const distinctDays = new Set(items.map(l => l.date)).size;
  const totalSets = items.reduce((acc, curr) => acc + curr.setCount, 0);

  const sessionsPerWeek = distinctDays / weeksDivisor;
  const setsPerWeek = totalSets / weeksDivisor;

  return {
    sessionsPerWeek: Math.round(sessionsPerWeek * 10) / 10,
    setsPerWeek: Math.round(setsPerWeek * 10) / 10,
    totalSessions: distinctDays,
    totalSets,
    weeksDivisor: Math.round(weeksDivisor * 10) / 10
  };
}
