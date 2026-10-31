import { describe, it, expect } from 'vitest';
import { normalizeText, tokenize, buildIndex, search } from './search.js';

describe('search normalization & tokenization', () => {
  it('normalizes English text and strips punctuation', () => {
    expect(normalizeText('Rolled Oats, Organic!')).toBe('rolled oats organic');
  });

  it('normalizes Arabic alefs, taa marbuta, and strips diacritics (tashkeel)', () => {
    // أرز -> ارز, شُوفَان -> شوفان, قِشْطَة -> قشطه
    expect(normalizeText('أَرُزّ مَصْرِيّ')).toBe('ارز مصري');
    expect(normalizeText('شُوفَان')).toBe('شوفان');
    expect(normalizeText('قِشْطَة')).toBe('قشطه');
  });

  it('tokenizes normalized words', () => {
    expect(tokenize('Greek Yogurt (0% Fat)')).toEqual(['greek', 'yogurt', '0', 'fat']);
    expect(tokenize('دَجَاج مَشْوِي')).toEqual(['دجاج', 'مشوي']);
  });
});

describe('food indexing and search', () => {
  const foods = [
    { id: '1', name: 'Rolled Oats', nameAr: 'شوفان', category: 'grains', popular: true },
    { id: '2', name: 'Oat Milk', nameAr: 'حليب شوفان', category: 'dairy' },
    { id: '3', name: 'Chicken Breast', nameAr: 'صدر دجاج', category: 'poultry', popular: true },
    { id: '4', name: 'White Rice', nameAr: 'ارز ابيض', category: 'grains' }
  ];

  const searchIndex = buildIndex(foods);

  it('finds exact and prefix matches', () => {
    const res = search(searchIndex, 'oat');
    expect(res.length).toBe(2);
    expect(res.map(f => f.id)).toContain('1');
    expect(res.map(f => f.id)).toContain('2');
  });

  it('ranks popular exact item higher', () => {
    const res = search(searchIndex, 'oats');
    expect(res[0].id).toBe('1');
  });

  it('searches with Arabic input seamlessly', () => {
    const res = search(searchIndex, 'دَجَاج'); // with tashkeel
    expect(res.length).toBe(1);
    expect(res[0].id).toBe('3');
  });

  it('returns empty array when query has no matches', () => {
    const res = search(searchIndex, 'salmon');
    expect(res).toEqual([]);
  });
});
