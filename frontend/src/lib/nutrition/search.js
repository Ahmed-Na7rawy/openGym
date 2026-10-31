/**
 * Normalizes text for search indexing and queries.
 * Handles English and Arabic (removes diacritics / tashkeel, normalizes alef and taa marbuta).
 *
 * @param {string} text
 * @returns {string}
 */
export function normalizeText(text = '') {
  if (!text || typeof text !== 'string') return '';

  return text
    .toLowerCase()
    // Strip Arabic diacritics (tashkeel: fatha, damma, kasra, sukun, shadda, tanween)
    .replace(/[ً-ْٰ]/g, '')
    // Normalize Alefs: أ, إ, آ, ٱ -> ا
    .replace(/[آأإٱ]/g, 'ا')
    // Normalize Taa Marbuta: ة -> ه
    .replace(/ة/g, 'ه')
    // Normalize Yaa: ى -> ي
    .replace(/ى/g, 'ي')
    // Remove punctuation, keep letters, numbers, spaces
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokenizes text into unique search terms.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function tokenize(text = '') {
  const norm = normalizeText(text);
  if (!norm) return [];
  return norm.split(' ').filter(t => t.length > 0);
}

/**
 * Builds an in-memory search index for foods.
 *
 * Each food item is expected to have:
 * - id: string
 * - name: string (e.g. English name)
 * - nameAr?: string (optional Arabic name)
 * - brand?: string
 * - category?: string
 *
 * @param {Array<Object>} foods
 * @returns {{ foods: Array<Object>, index: Map<string, Set<number>> }}
 */
export function buildIndex(foods = []) {
  const foodList = Array.isArray(foods) ? foods : [];
  const index = new Map();

  foodList.forEach((food, idx) => {
    if (!food) return;
    const combinedText = [
      food.name,
      food.nameAr,
      food.brand,
      food.category
    ].filter(Boolean).join(' ');

    const tokens = tokenize(combinedText);
    for (const token of tokens) {
      if (!index.has(token)) {
        index.set(token, new Set());
      }
      index.get(token).add(idx);
    }
  });

  return { foods: foodList, index };
}

/**
 * Searches food index with prefix matching, ranking, and limit.
 * Ranking rules:
 * - Exact name match > exact token match > prefix match
 * - Common/popular items boosted if food.popular === true
 *
 * @param {{ foods: Array<Object>, index: Map<string, Set<number>> }} searchIndex
 * @param {string} query
 * @param {number} [limit=25]
 * @returns {Array<Object>}
 */
export function search(searchIndex, query = '', limit = 25) {
  if (!searchIndex || !searchIndex.foods || !searchIndex.index) return [];

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const { foods, index } = searchIndex;
  const candidateScores = new Map(); // foodIndex -> score

  for (const qToken of queryTokens) {
    // Find all index tokens starting with qToken
    for (const [indexedToken, docIndices] of index.entries()) {
      if (indexedToken === qToken) {
        // Exact token match
        for (const docIdx of docIndices) {
          const current = candidateScores.get(docIdx) || 0;
          candidateScores.set(docIdx, current + 10);
        }
      } else if (indexedToken.startsWith(qToken)) {
        // Prefix match
        for (const docIdx of docIndices) {
          const current = candidateScores.get(docIdx) || 0;
          candidateScores.set(docIdx, current + 5);
        }
      }
    }
  }

  const normQuery = normalizeText(query);

  const results = [];
  for (const [docIdx, score] of candidateScores.entries()) {
    const food = foods[docIdx];
    if (!food) continue;

    let totalScore = score;

    // Exact full name match bonus
    const normName = normalizeText(food.name);
    const normNameAr = normalizeText(food.nameAr);
    if (normName === normQuery || normNameAr === normQuery) {
      totalScore += 50;
    } else if (normName.startsWith(normQuery) || (normNameAr && normNameAr.startsWith(normQuery))) {
      totalScore += 20;
    }

    // Popularity bonus
    if (food.popular) {
      totalScore += 3;
    }

    results.push({ food, score: totalScore });
  }

  // Sort descending by score, tiebreak by shorter name
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.food.name || '').length - (b.food.name || '').length;
  });

  return results.slice(0, limit).map(r => r.food);
}
