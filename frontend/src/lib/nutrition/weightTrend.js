/**
 * Calculates 4-week weight trend in kg/week using ordinary least squares regression over days.
 * Returns null if fewer than 2 entries exist.
 *
 * Accepts either:
 * - Array<{ measuredOn: string, kg: number }>
 * - Array<{ d: string, w: number }> (openGym S.bodyweight format)
 *
 * @param {Array<any>} weights
 * @returns {{ trendKgPerWeek: number|null, direction: 'losing'|'maintaining'|'gaining'|null, entriesCount: number, latestKg: number|null, earliestKg: number|null }}
 */
export function calculateWeightTrend(weights = []) {
  if (!Array.isArray(weights) || weights.length < 2) {
    const single = weights && weights.length === 1 ? weights[0] : null;
    const singleKg = single ? (single.kg != null ? single.kg : single.w) : null;
    return {
      trendKgPerWeek: null,
      direction: null,
      entriesCount: Array.isArray(weights) ? weights.length : 0,
      latestKg: singleKg != null ? Number(singleKg) : null,
      earliestKg: singleKg != null ? Number(singleKg) : null
    };
  }

  // Normalize to { date: 'YYYY-MM-DD', kg: number }
  const normalized = weights
    .map(w => ({
      date: w.measuredOn || w.d,
      kg: Number(w.kg != null ? w.kg : w.w)
    }))
    .filter(w => w.date && !isNaN(w.kg));

  if (normalized.length < 2) {
    const single = normalized[0];
    return {
      trendKgPerWeek: null,
      direction: null,
      entriesCount: normalized.length,
      latestKg: single ? single.kg : null,
      earliestKg: single ? single.kg : null
    };
  }

  // Sort ascending by date
  const sorted = [...normalized].sort((a, b) => a.date.localeCompare(b.date));
  const baseTime = new Date(`${sorted[0].date}T00:00:00.000Z`).getTime();

  const points = sorted.map((w) => {
    const time = new Date(`${w.date}T00:00:00.000Z`).getTime();
    const day = (time - baseTime) / 86_400_000;
    return { x: day, y: w.kg };
  });

  const n = points.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumXX += p.x * p.x;
  }

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) {
    return {
      trendKgPerWeek: 0,
      direction: 'maintaining',
      entriesCount: n,
      latestKg: sorted[sorted.length - 1].kg,
      earliestKg: sorted[0].kg
    };
  }

  const slopePerDay = (n * sumXY - sumX * sumY) / denominator;
  const trendKgPerWeek = Math.round(slopePerDay * 7 * 100) / 100;

  let direction = 'maintaining';
  if (trendKgPerWeek > 0.05) {
    direction = 'gaining';
  } else if (trendKgPerWeek < -0.05) {
    direction = 'losing';
  }

  return {
    trendKgPerWeek,
    direction,
    entriesCount: n,
    latestKg: sorted[sorted.length - 1].kg,
    earliestKg: sorted[0].kg
  };
}
