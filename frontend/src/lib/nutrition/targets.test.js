import { describe, it, expect } from 'vitest';
import { getEffectiveTargets, DEFAULT_MICRONUTRIENT_TARGETS } from './targets.js';

describe('targets & coach overrides', () => {
  it('falls back to default micronutrients when none specified', () => {
    const targets = getEffectiveTargets({}, null);
    expect(targets.micros.vitaminC).toBe(DEFAULT_MICRONUTRIENT_TARGETS.vitaminC);
    expect(targets.isCoachOverride.micros.vitaminC).toBe(false);
  });

  it('uses user targets when coach targets are absent', () => {
    const user = {
      kcal: 2200,
      protein: 160,
      micros: { vitaminC: 150 }
    };
    const targets = getEffectiveTargets(user, null);
    expect(targets.kcal).toBe(2200);
    expect(targets.protein).toBe(160);
    expect(targets.micros.vitaminC).toBe(150);
    expect(targets.isCoachOverride.kcal).toBe(false);
    expect(targets.isCoachOverride.protein).toBe(false);
  });

  it('allows coach targets to override user targets when active', () => {
    const user = { kcal: 2200, protein: 160 };
    const coach = { active: true, kcal: 2000, protein: 180 };

    const targets = getEffectiveTargets(user, coach);
    expect(targets.kcal).toBe(2000);
    expect(targets.protein).toBe(180);
    expect(targets.isCoachOverride.kcal).toBe(true);
    expect(targets.isCoachOverride.protein).toBe(true);
  });

  it('ignores coach targets when coachTargets.active is false', () => {
    const user = { kcal: 2200, protein: 160 };
    const coach = { active: false, kcal: 1800, protein: 200 };

    const targets = getEffectiveTargets(user, coach);
    expect(targets.kcal).toBe(2200);
    expect(targets.protein).toBe(160);
    expect(targets.isCoachOverride.kcal).toBe(false);
  });
});
