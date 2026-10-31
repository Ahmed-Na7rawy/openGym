/* openGym nutrition sync module
   Stores per-user nutrition records in DATA_DIR/nutrition-<uid>.json.
   Uses atomicWrite for durability.
   Routes:
   - GET /api/nutrition
   - GET /api/nutrition/rev
   - PUT /api/nutrition
*/
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function createNutritionModule({ DATA, json, readBody, readSession, atomicWrite }) {
  const nutritionFile = (uid) => path.join(DATA, `nutrition-${uid}.json`);

  function readNutrition(uid) {
    const file = nutritionFile(uid);
    try {
      const raw = fs.readFileSync(file, 'utf8');
      return JSON.parse(raw);
    } catch (e) {
      if (e.code === 'ENOENT') return null;
      throw e;
    }
  }

  function writeNutrition(uid, doc) {
    const file = nutritionFile(uid);
    atomicWrite(file, JSON.stringify(doc));
  }

  const routes = {
    'GET /api/nutrition': async (req, res) => {
      const user = readSession(req);
      if (!user) return json(res, 401, { error: 'not signed in' });

      try {
        const doc = readNutrition(user.id);
        if (!doc) {
          return json(res, 200, {
            state: null,
            rev: 0
          });
        }
        json(res, 200, {
          state: {
            days: doc.days || {},
            customFoods: Array.isArray(doc.customFoods) ? doc.customFoods : [],
            targets: doc.targets || null,
            coachTargets: doc.coachTargets || null
          },
          rev: doc._rev || 0
        });
      } catch (err) {
        console.error('nutrition read error', err);
        return json(res, 503, { error: 'nutrition state unreadable' });
      }
    },

    'GET /api/nutrition/rev': async (req, res) => {
      const user = readSession(req);
      if (!user) return json(res, 401, { error: 'not signed in' });

      try {
        const doc = readNutrition(user.id);
        json(res, 200, { rev: doc?._rev || 0 });
      } catch (err) {
        return json(res, 503, { error: 'nutrition state unreadable' });
      }
    },

    'PUT /api/nutrition': async (req, res) => {
      const user = readSession(req);
      if (!user) return json(res, 401, { error: 'not signed in' });

      const body = await readBody(req);
      if (!body || typeof body !== 'object') {
        return json(res, 400, { error: 'invalid payload' });
      }

      let cur;
      try {
        cur = readNutrition(user.id);
      } catch (err) {
        return json(res, 503, { error: 'nutrition state unreadable' });
      }

      const curRev = cur?._rev || 0;

      // Optimistic concurrency check
      if (body.baseRev != null && body.baseRev !== curRev) {
        return json(res, 409, {
          error: 'conflict',
          rev: curRev,
          remoteState: cur ? {
            days: cur.days || {},
            customFoods: cur.customFoods || [],
            targets: cur.targets || null,
            coachTargets: cur.coachTargets || null
          } : null
        });
      }

      const nextRev = curRev + 1;
      const doc = {
        _rev: nextRev,
        _u: Date.now(),
        days: (body.days && typeof body.days === 'object') ? body.days : (cur?.days || {}),
        customFoods: Array.isArray(body.customFoods) ? body.customFoods : (cur?.customFoods || []),
        targets: body.targets || cur?.targets || null,
        // Coach targets are managed by coaching layer, preserve what is on disk
        coachTargets: cur?.coachTargets || null
      };

      try {
        writeNutrition(user.id, doc);
        json(res, 200, { ok: true, rev: nextRev });
      } catch (err) {
        console.error('nutrition write error', err);
        return json(res, 503, { error: 'failed to save nutrition' });
      }
    }
  };

  return { routes, readNutrition, writeNutrition };
}
