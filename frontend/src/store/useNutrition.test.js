import { describe, it, expect, beforeEach } from 'vitest';
import { useNutrition } from './useNutrition.js';

// Polyfill window and localStorage for node environment test runs
if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis;
}
const mockStorage = new Map();
globalThis.localStorage = {
  getItem: (k) => mockStorage.get(k) || null,
  setItem: (k, v) => mockStorage.set(k, String(v)),
  removeItem: (k) => mockStorage.delete(k),
  clear: () => mockStorage.clear()
};

describe('useNutrition Zustand store', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    useNutrition.setState({
      days: {},
      customFoods: [],
      targets: { kcal: null, protein: null, carbs: null, fat: null, micros: {}, u: 0 },
      coachTargets: { active: false, kcal: null, protein: null, carbs: null, fat: null, micros: {}, u: 0 },
      settings: { enabled: true, preferredUnits: 'metric' },
      sync: { rev: 0, lastSyncTime: 0, pendingSync: false, syncing: false, error: null }
    });
  });

  it('adds an entry with unique id, timestamp u, and tombstone false', () => {
    const id = useNutrition.getState().addEntry('2026-10-31', {
      foodId: 'food_1',
      grams: 150,
      meal: 'breakfast',
      snap: { kcal: 200, p: 15, c: 20, f: 5 }
    });

    expect(id).toBeDefined();
    const day = useNutrition.getState().days['2026-10-31'];
    expect(day.length).toBe(1);
    expect(day[0].id).toBe(id);
    expect(day[0].grams).toBe(150);
    expect(day[0].d).toBe(false);
    expect(day[0].u).toBeGreaterThan(0);
  });

  it('updates an entry and bumps timestamp', () => {
    const id = useNutrition.getState().addEntry('2026-10-31', {
      foodId: 'food_1',
      grams: 100,
      meal: 'lunch'
    });

    const initialU = useNutrition.getState().days['2026-10-31'][0].u;

    useNutrition.getState().updateEntry('2026-10-31', id, { grams: 250 });

    const updated = useNutrition.getState().days['2026-10-31'][0];
    expect(updated.grams).toBe(250);
    expect(updated.u).toBeGreaterThanOrEqual(initialU);
  });

  it('deletes an entry by setting tombstone d: true', () => {
    const id = useNutrition.getState().addEntry('2026-10-31', {
      foodId: 'food_1',
      grams: 100
    });

    useNutrition.getState().deleteEntry('2026-10-31', id);

    const day = useNutrition.getState().days['2026-10-31'];
    expect(day.length).toBe(1);
    expect(day[0].d).toBe(true);
  });

  it('manages custom foods lifecycle', () => {
    const id = useNutrition.getState().addCustomFood({
      name: 'My Protein Shake',
      nutrients: { kcal: 250, protein: 40 }
    });

    expect(useNutrition.getState().customFoods.length).toBe(1);
    expect(useNutrition.getState().customFoods[0].id).toBe(id);

    useNutrition.getState().updateCustomFood(id, { name: 'Super Shake' });
    expect(useNutrition.getState().customFoods[0].name).toBe('Super Shake');

    useNutrition.getState().deleteCustomFood(id);
    expect(useNutrition.getState().customFoods[0].d).toBe(true);
  });

  it('merges remote server state with CRDT conflict resolution', () => {
    useNutrition.getState().addEntry('2026-10-31', {
      id: 'e1',
      foodId: 'f1',
      grams: 100,
      u: 1000
    });

    const remoteState = {
      rev: 5,
      days: {
        '2026-10-31': [
          { id: 'e1', foodId: 'f1', grams: 200, u: 2000, d: false },
          { id: 'e2', foodId: 'f2', grams: 50, u: 1500, d: false }
        ]
      },
      targets: { kcal: 2400, protein: 180, u: 5000 },
      coachTargets: { active: true, kcal: 2100, protein: 200 }
    };

    useNutrition.getState().mergeServerState(remoteState, 5);

    const state = useNutrition.getState();
    const day = state.days['2026-10-31'];
    expect(day.length).toBe(2);

    const e1 = day.find(e => e.id === 'e1');
    expect(e1.grams).toBe(200); // remote won with u: 2000

    expect(state.targets.kcal).toBe(2400);
    expect(state.coachTargets.kcal).toBe(2100);
    expect(state.sync.rev).toBe(5);
  });
});
