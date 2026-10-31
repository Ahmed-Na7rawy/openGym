import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SECRET = crypto.randomBytes(32).toString('hex');

function mintSession(uid, sv = 0) {
  const payload = `${uid}:${Date.now() + 86400000}:${sv}`;
  return payload + '.' + crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
}
const headers = uid => ({ Cookie: `gymsid=${mintSession(uid)}`, 'Content-Type': 'application/json' });

async function startServer(t) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-nutrition-'));
  fs.writeFileSync(path.join(dataDir, 'secret'), SECRET, { mode: 0o600 });
  fs.writeFileSync(path.join(dataDir, 'db.json'), JSON.stringify({
    users: [
      { id: 'u_nut_1', name: 'User 1', created: new Date().toISOString() },
      { id: 'u_nut_2', name: 'User 2', created: new Date().toISOString() }
    ],
    creds: [], subs: [], invites: []
  }));

  const child = spawn(process.execPath, ['server.js'], {
    cwd: API, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '0', DATA_DIR: dataDir, ORIGIN: 'http://localhost:8080', RP_ID: 'localhost' }
  });

  const h = { api: '', log: '', dataDir };
  child.stdout.on('data', d => h.log += d);
  child.stderr.on('data', d => h.log += d);
  t.after(() => { child.kill('SIGKILL'); fs.rmSync(dataDir, { recursive: true, force: true }); });

  h.port = await boundPort(child, () => h.log);
  h.api = `http://127.0.0.1:${h.port}`;
  return h;
}

test('GET & PUT /api/nutrition: isolation, revisioning and optimistic concurrency', async (t) => {
  const h = await startServer(t);
  const u1 = 'u_nut_1';
  const u2 = 'u_nut_2';

  // 1. Unauthenticated gets 401
  const unauth = await fetch(`${h.api}/api/nutrition`);
  assert.equal(unauth.status, 401);

  // 2. Initial state is null with rev 0
  const get1 = await fetch(`${h.api}/api/nutrition`, { headers: headers(u1) });
  assert.equal(get1.status, 200);
  const body1 = await get1.json();
  assert.equal(body1.rev, 0);
  assert.equal(body1.state, null);

  // 3. First write succeeds and bumps rev to 1
  const payload1 = {
    baseRev: 0,
    days: {
      '2026-10-31': [
        { id: 'e1', foodId: 'f1', grams: 150, meal: 'breakfast', u: 1000 }
      ]
    },
    targets: { kcal: 2200, protein: 160 }
  };
  const put1 = await fetch(`${h.api}/api/nutrition`, {
    method: 'PUT',
    headers: headers(u1),
    body: JSON.stringify(payload1)
  });
  assert.equal(put1.status, 200);
  const put1Res = await put1.json();
  assert.equal(put1Res.ok, true);
  assert.equal(put1Res.rev, 1);

  // Verify file written to disk
  const diskFile = path.join(h.dataDir, `nutrition-${u1}.json`);
  assert.equal(fs.existsSync(diskFile), true);

  // 4. Stale write with baseRev 0 yields 409 conflict
  const stalePut = await fetch(`${h.api}/api/nutrition`, {
    method: 'PUT',
    headers: headers(u1),
    body: JSON.stringify({ baseRev: 0, days: {} })
  });
  assert.equal(stalePut.status, 409);
  const conflict = await stalePut.json();
  assert.equal(conflict.error, 'conflict');
  assert.equal(conflict.rev, 1);
  assert.equal(conflict.remoteState.days['2026-10-31'].length, 1);

  // 5. User 2 has isolated state and rev 0
  const get2 = await fetch(`${h.api}/api/nutrition`, { headers: headers(u2) });
  assert.equal(get2.status, 200);
  const body2 = await get2.json();
  assert.equal(body2.rev, 0);
  assert.equal(body2.state, null);
});
