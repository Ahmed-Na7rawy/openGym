import { describe, it, expect } from 'vitest';
import { calculateBmr } from './bmr.js';
import { calculateMaintenance } from './activity.js';
import { calculateTargetCalories } from './calories.js';
import { calculateProteinTarget } from './protein.js';
import { calculateMacros } from './macros.js';
import { calculateTrainingStats } from './trainingStats.js';
import { calculateWeightTrend } from './weightTrend.js';
import { generateDietSuggestion } from './suggestion.js';

describe('BMR calculation (Mifflin-St Jeor)', () => {
  it('calculates male BMR accurately', () => {
    // 80kg, 180cm, 30y -> 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
    const bmr = calculateBmr(80, 180, 30, 'male');
    expect(bmr).toBe(1780);
  });

  it('calculates female BMR accurately', () => {
    // 60kg, 165cm, 28y -> 10*60 + 6.25*165 - 5*28 - 161 = 600 + 1031.25 - 140 - 161 = 1330.25
    const bmr = calculateBmr(60, 165, 28, 'female');
    expect(bmr).toBeCloseTo(1330.25, 2);
  });

  it('throws on invalid inputs', () => {
    expect(() => calculateBmr(-5, 170, 25, 'male')).toThrow();
    expect(() => calculateBmr(70, 0, 25, 'male')).toThrow();
    expect(() => calculateBmr(70, 170, -1, 'female')).toThrow();
  });
});

describe('Maintenance calories', () => {
  it('applies activity factors correctly', () => {
    const bmr = 1800;
    expect(calculateMaintenance(bmr, 1)).toBe(Math.round(1800 * 1.2));
    expect(calculateMaintenance(bmr, 2)).toBe(Math.round(1800 * 1.375));
    expect(calculateMaintenance(bmr, 3)).toBe(Math.round(1800 * 1.55));
    expect(calculateMaintenance(bmr, 4)).toBe(Math.round(1800 * 1.725));
  });
});

describe('Target calories & safety caps/floors', () => {
  it('caps deficit at 25% of maintenance', () => {
    const maintenance = 2000;
    // aggressive 1.5 kg/week deficit would be 1.5 * 7700 / 7 = 1650 deficit -> uncapped 350
    // 25% cap of 2000 is 500 deficit -> target 1500
    const res = calculateTargetCalories(maintenance, 'lose', 'male', 1.5);
    expect(res.calories).toBe(1500);
    expect(res.reasons.some(r => r.key === 'calories.reason.deficit_capped')).toBe(true);
  });

  it('enforces sex safety floors', () => {
    // Male floor 1500
    const maleRes = calculateTargetCalories(1600, 'lose', 'male', 0.5);
    expect(maleRes.calories).toBe(1500);
    expect(maleRes.floorApplied).toBe(true);

    // Female floor 1200
    const femaleRes = calculateTargetCalories(1300, 'lose', 'female', 0.5);
    expect(femaleRes.calories).toBe(1200);
    expect(femaleRes.floorApplied).toBe(true);
  });
});

describe('Protein calculation', () => {
  it('sets base 1.2 g/kg when training < 2 sessions/wk', () => {
    const res = calculateProteinTarget(80, 1, 10, 'maintain');
    expect(res.gPerKg).toBe(1.2);
    expect(res.proteinG).toBe(96);
  });

  it('sets base 1.6 and applies modifiers for volume and deficit', () => {
    // sessions >= 4 (+0.1), sets >= 60 (+0.1), goal 'lose' (+0.2) -> 1.6 + 0.4 = 2.0
    const res = calculateProteinTarget(80, 4.5, 65, 'lose');
    expect(res.gPerKg).toBe(2.0);
    expect(res.proteinG).toBe(160);
  });

  it('hard-caps protein at 2.2 g/kg', () => {
    // even if modifiers exceed
    const res = calculateProteinTarget(80, 6, 80, 'lose');
    expect(res.gPerKg).toBeLessThanOrEqual(2.2);
  });
});

describe('Training stats calculation', () => {
  it('calculates sessions and non-warmup sets per week across 28-day window', () => {
    const now = new Date('2026-10-31T12:00:00Z');
    const workouts = [
      {
        d: '2026-10-30',
        entries: [
          {
            sets: [
              { warmup: true, completed: true },
              { phase: 'work', completed: true },
              { phase: 'work', completed: true }
            ]
          }
        ]
      },
      {
        d: '2026-10-28',
        entries: [
          {
            sets: [
              { phase: 'work', completed: true }
            ]
          }
        ]
      }
    ];

    const stats = calculateTrainingStats(workouts, now);
    expect(stats.totalSessions).toBe(2);
    expect(stats.totalSets).toBe(3); // 2 + 1 non-warmup sets
  });
});

describe('Weight trend (OLS regression)', () => {
  it('returns null slope when entries < 2', () => {
    const trend = calculateWeightTrend([{ d: '2026-10-01', w: 80 }]);
    expect(trend.trendKgPerWeek).toBeNull();
  });

  it('calculates kg/week slope accurately', () => {
    // 14 days apart, lost 2 kg -> slope -1 kg/week
    const weights = [
      { d: '2026-10-01', w: 82 },
      { d: '2026-10-15', w: 80 }
    ];
    const trend = calculateWeightTrend(weights);
    expect(trend.trendKgPerWeek).toBe(-1);
    expect(trend.direction).toBe('losing');
  });
});

describe('Diet suggestion orchestration', () => {
  it('emits structured suggestion with reasons when valid inputs provided', () => {
    const profile = {
      sex: 'male',
      birthYear: 1996,
      heightCm: 180,
      activity: 2,
      goal: 'lose',
      weeklyRateKg: 0.5
    };
    const weights = [
      { d: '2026-10-25', w: 80 },
      { d: '2026-10-26', w: 80 },
      { d: '2026-10-27', w: 80 }
    ];

    const res = generateDietSuggestion(profile, weights, [], new Date('2026-10-31T00:00:00Z'));
    expect(res.available).toBe(true);
    expect(res.suggestion.targetCalories).toBeGreaterThan(1500);
    expect(res.suggestion.proteinG).toBeGreaterThan(0);
    expect(res.suggestion.fatG).toBeGreaterThan(0);
    expect(res.suggestion.carbsG).toBeGreaterThan(0);
    expect(Array.isArray(res.suggestion.reasons)).toBe(true);
  });
});
