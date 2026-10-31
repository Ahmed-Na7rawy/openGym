import { describe, it, expect } from 'vitest';
import { mergeDay, pruneTombstones } from './merge.js';

describe('nutrition diary CRDT merge (mergeDay)', () => {
  it('unions distinct entries across local and remote', () => {
    const local = [{ id: 'e1', foodId: 'f1', grams: 100, u: 1000 }];
    const remote = [{ id: 'e2', foodId: 'f2', grams: 200, u: 1000 }];

    const merged = mergeDay(local, remote);
    expect(merged.length).toBe(2);
    expect(merged.map(e => e.id).sort()).toEqual(['e1', 'e2']);
  });

  it('selects entry with higher update timestamp (u)', () => {
    const local = [{ id: 'e1', foodId: 'f1', grams: 100, u: 1000 }];
    const remote = [{ id: 'e1', foodId: 'f1', grams: 150, u: 1500 }];

    const merged = mergeDay(local, remote);
    expect(merged.length).toBe(1);
    expect(merged[0].grams).toBe(150);
    expect(merged[0].u).toBe(1500);
  });

  it('tie-breaks equal timestamp in favor of deletion tombstone (d=true)', () => {
    const local = [{ id: 'e1', foodId: 'f1', grams: 100, u: 2000 }];
    const remote = [{ id: 'e1', foodId: 'f1', grams: 100, u: 2000, d: true }];

    const merged = mergeDay(local, remote);
    expect(merged.length).toBe(1);
    expect(merged[0].d).toBe(true);
  });
});

describe('pruneTombstones', () => {
  it('retains recent tombstones and prunes old ones', () => {
    const now = 100_000_000;
    const maxAge = 10_000; // 10s cutoff

    const entries = [
      { id: 'active', u: 50_000 },
      { id: 'recent_del', u: now - 5_000, d: true },
      { id: 'old_del', u: now - 20_000, d: true }
    ];

    const pruned = pruneTombstones(entries, now, maxAge);
    expect(pruned.map(e => e.id)).toEqual(['active', 'recent_del']);
  });
});
