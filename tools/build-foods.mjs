#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NUTRIENTS } from '../frontend/src/lib/nutrition/nutrients.js';
import { buildIndex, search } from '../frontend/src/lib/nutrition/search.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '..');

const VALID_NUTRIENT_IDS = new Set(NUTRIENTS.map(n => n.id));
const FOODS_DIR = resolve(ROOT_DIR, 'foods');
const DIST_FOODS_DIR = resolve(ROOT_DIR, 'foods');
const FRONTEND_PUBLIC_FOODS = resolve(ROOT_DIR, 'frontend/public/foods');

/**
 * Validates a single food item according to schema.
 */
export function validateFood(food, fileOrigin = 'dataset') {
  const errors = [];
  if (!food.id || typeof food.id !== 'string') errors.push(`Missing or invalid 'id'`);
  if (!food.name || typeof food.name !== 'string') errors.push(`Missing or invalid 'name'`);
  if (!food.category || typeof food.category !== 'string') errors.push(`Missing or invalid 'category'`);
  if (!food.defaultServingG || typeof food.defaultServingG !== 'number' || food.defaultServingG <= 0) {
    errors.push(`Missing or invalid 'defaultServingG' (must be positive number)`);
  }
  if (!Array.isArray(food.commonPortions) || food.commonPortions.length === 0) {
    errors.push(`Missing or empty 'commonPortions' array`);
  } else {
    food.commonPortions.forEach((p, idx) => {
      if (!p.label || !p.grams || p.grams <= 0) {
        errors.push(`Invalid portion at index ${idx}: must have label and positive grams`);
      }
    });
  }
  if (!food.nutrients || typeof food.nutrients !== 'object') {
    errors.push(`Missing 'nutrients' object`);
  } else {
    for (const key of Object.keys(food.nutrients)) {
      if (!VALID_NUTRIENT_IDS.has(key)) {
        errors.push(`Unknown nutrient id '${key}'`);
      }
      const val = food.nutrients[key];
      if (val !== null && val !== undefined && (typeof val !== 'number' || isNaN(val))) {
        errors.push(`Invalid value for nutrient '${key}': must be number or null`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Validation failed for '${food.id || 'unknown'}' in ${fileOrigin}:\n  - ${errors.join('\n  - ')}`);
  }
}

/**
 * Compiles all food JSON datasets into unified bundle and manifest.
 */
export function buildFoods() {
  if (!existsSync(FOODS_DIR)) {
    throw new Error(`Foods directory does not exist: ${FOODS_DIR}`);
  }

  const files = readdirSync(FOODS_DIR).filter(f => f.endsWith('.json') && f !== 'bundle.json' && f !== 'manifest.json');

  const allFoods = [];
  const seenIds = new Set();
  const sources = [];

  for (const file of files) {
    const filePath = join(FOODS_DIR, file);
    const content = JSON.parse(readFileSync(filePath, 'utf-8'));
    if (!Array.isArray(content)) {
      continue;
    }

    let fileCount = 0;
    for (const item of content) {
      validateFood(item, file);
      if (seenIds.has(item.id)) {
        throw new Error(`Duplicate food id detected: '${item.id}' in ${file}`);
      }
      seenIds.add(item.id);
      allFoods.push(item);
      fileCount++;
    }

    sources.push({ file, count: fileCount });
  }

  // Test search index build and verify
  const searchIndex = buildIndex(allFoods);
  const testResults = search(searchIndex, 'koshari');
  if (testResults.length === 0 && allFoods.some(f => f.id === 'eg_koshari')) {
    throw new Error(`Search verification failed: could not find 'eg_koshari'`);
  }

  const bundle = {
    version: 1,
    generatedAt: new Date().toISOString(),
    count: allFoods.length,
    foods: allFoods
  };

  const manifest = {
    version: 1,
    generatedAt: bundle.generatedAt,
    totalFoods: allFoods.length,
    sources,
    bundleFile: 'bundle.json'
  };

  const bundleJson = JSON.stringify(bundle, null, 2);
  const manifestJson = JSON.stringify(manifest, null, 2);

  // Write to foods/
  writeFileSync(join(DIST_FOODS_DIR, 'bundle.json'), bundleJson, 'utf-8');
  writeFileSync(join(DIST_FOODS_DIR, 'manifest.json'), manifestJson, 'utf-8');

  // If frontend/public exists, also mirror to public/foods/ for web fetch
  if (existsSync(resolve(ROOT_DIR, 'frontend/public'))) {
    if (!existsSync(FRONTEND_PUBLIC_FOODS)) {
      mkdirSync(FRONTEND_PUBLIC_FOODS, { recursive: true });
    }
    writeFileSync(join(FRONTEND_PUBLIC_FOODS, 'bundle.json'), bundleJson, 'utf-8');
    writeFileSync(join(FRONTEND_PUBLIC_FOODS, 'manifest.json'), manifestJson, 'utf-8');
  }

  return { totalFoods: allFoods.length, sources };
}

// Auto-run when invoked directly
const isDirectRun = process.argv[1] && resolve(process.argv[1]) === resolve(__filename);
if (isDirectRun) {
  try {
    const res = buildFoods();
    console.log(`Successfully compiled ${res.totalFoods} foods from ${res.sources.length} sources.`);
  } catch (err) {
    console.error('Build foods failed:', err.message);
    process.exit(1);
  }
}
