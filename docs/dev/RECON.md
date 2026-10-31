# Reconnaissance of openGym Fork

*Target:* `d:\work\repos\opengym-fork` (branch: `feature/coach-nutrition`)  
*Date:* 2026-10-31

---

## 1. api/server.js: Routes Structure & Signature

The server is a single file using plain `node:http`. Routes are held in an object mapping `'METHOD /path'` to an `async (req, res)` handler.

```javascript
// Excerpt from api/server.js
const routes = {
  'GET /api/health': async (req, res) => {
    if (!dataWritable()) return json(res, 503, { ok: false, writable: false });
    json(res, 200, { ok: true, users: db.users.length, writable: true });
  },

  'GET /api/data': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const state = readStateStrict(user.id);
    if (state === UNREADABLE) return json(res, 503, { error: 'state unreadable' });
    notePull(user);
    json(res, 200, { state: forClient(state), rev: state?._rev || 0 });
  },

  'PUT /api/data': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    // ...
  }
};
```

### Handler Signature & User Context
- Signature: `async (req, res) => { ... }`
- Authenticated user is obtained via:
  ```javascript
  const user = readSession(req); // returns db.users entry or null
  // Or:
  const s = sessionOf(req); // { user, token, bearer } or null
  ```
- User ID is always accessed from `user.id`.

---

## 2. Auth: Sessions, Passkeys, Invites & Admin

### Sessions & Passkeys
- Handled with `@simplewebauthn/server`.
- Challenge store: In-memory `Map` with 5-minute TTL (`challenges.set(cid, { kind, challenge, exp })`).
- Session cookies: HMAC-signed token using `DATA_DIR/secret`. Cookie contains user ID + expiration + session version (`sv`).
- **Do not touch:**
  - `POST /api/register/options`, `POST /api/register/verify`
  - `POST /api/login/options`, `POST /api/login/verify`
  - `passkeys-store.js`, challenge store logic, session signing/verification.

### Invite-Only Signup
- Controlled by `INVITE_ONLY` env var (`/^(1|true|yes|on)$/i.test(process.env.INVITE_ONLY)`).
- Invite codes stored in `db.json` in array `db.invites`:
  ```javascript
  // Created in POST /api/admin/invites/new
  { code: '8-byte-hex', note: '...', createdBy: admin.id, created: ISOString }
  ```
- Consumed during registration:
  ```javascript
  // In POST /api/register/verify or POST /api/register/password
  if (inv) {
    user.invitedBy = inv.code;
    inv.usedBy = user.id;
    inv.usedAt = created;
  }
  ```

### ADMIN_UIDS & Admin Role
- `ADMIN_UIDS`: Comma-separated list in env var `ADMIN_UIDS`.
- `isAdmin(user)` checks:
  ```javascript
  function isAdmin(u) {
    if (!u) return false;
    return u.admin === true || ADMIN_UIDS.includes(u.id);
  }
  ```
- Owner role: `u.owner === true`.

---

## 3. Storage & Durable Writes

### db.json Shape
```json
{
  "users": [
    { "id": "base64url", "name": "Alice", "created": "...", "admin": true, "pw": { "h": "...", "set": "..." }, "email": "..." }
  ],
  "creds": [
    { "id": "...", "userId": "...", "publicKey": "...", "counter": 0, "transports": [], "created": "...", "lastUsed": "..." }
  ],
  "subs": [
    { "userId": "...", "endpoint": "...", "keys": { "p256dh": "...", "auth": "..." }, "created": "..." }
  ],
  "invites": [
    { "code": "...", "note": "...", "createdBy": "...", "created": "...", "usedBy": "...", "usedAt": "..." }
  ]
}
```

### state-\<uid\>.json Shape
Per-user client state dump:
```json
{
  "_rev": 12,
  "_wid": "hex",
  "_ts": 1730000000000,
  "unit": "kg",
  "routines": [],
  "workouts": [],
  "bodyweight": [],
  "measurements": [],
  "dayNotes": {},
  "settings": {}
}
```

### atomicWrite
Implemented in `api/durable.js`:
- Writes to `<file>.tmp` with `fs.openSync`, `fs.writeFileSync`, and `fs.fsyncSync`.
- Renames atomically via `fs.renameSync(tmp, file)`.
- Calls `syncDir(path.dirname(file))` to fsync directory entry.

### Limits & Locks
- Request body limit: `MAX_BODY = 5 * 1024 * 1024` (5 MB).
- Rate limits / burst windows (`rate-limit.js`):
  - `AUTH_BURST`: 60 req/min per IP.
  - `ADDR_FAILS`: Backoff for failures (20 free, then 30s doubling to 15m).
  - `ACCOUNT_FAILS`: Per-account password guesses (5 free, 1m doubling to 1h).

---

## 4. Frontend Sync & Offline

- **Zustand Store:** `frontend/src/store/useStore.js` with key `gym_state_v1`.
- **Sync mechanism:**
  - `pushState`: Debounced PUT to `/api/data`. Sends `{ state, baseRev }`. Returns `{ rev, ts, wid }`.
  - `pullState`: GET `/api/data`. Compares `state._rev` with server `rev`. Merges using `lib/sync-merge.js`.
  - Periodic polling: `GET /api/data/rev` every 30s or on window focus.
- **Guest mode:**
  - If signed out / guest (`isGuest() === true`), API sync is skipped completely. State lives solely in `localStorage`.
- **Capacitor Mobile:**
  - `nativeSave` / `nativeLoad` in `lib/mobile.js` mirror `gym_state_v1` to `opengym-state.json` on device storage to prevent OS webview eviction.

---

## 5. Frontend Structure & Optional Toggles

- **Routing:** `frontend/src/App.jsx` using `HashRouter` and `<Routes>`.
- **Navigation:** `frontend/src/components/TabBar.jsx` (Home, Plan, Start/Resume, Stats, Exercises).
- **Optional Feature Toggle Pattern:**
  - Gated in `S` (state in store) or in server config.
  - Example (Check-in):
    ```jsx
    {S.checkIn !== false && <Route path="/checkin" element={<CheckIn />} />}
    ```
  - In Settings: Checkbox toggles `S.featureEnabled` via `useStore.getState().setPref(...)`.

---

## 6. Theme & Reusable UI

- **Tokens (`frontend/src/index.css`):**
  - Surfaces: `--bg`, `--bg-el`, `--surface`, `--surface-2`, `--surface-3`
  - Text: `--label`, `--label-2`, `--label-3`, `--label-4`
  - Accent: `--acc`, `--acc-2`, `--acc-soft`, `--acc-line`
  - Radius: `--r-sm` (8px), `--r` (12px), `--r-card` (14px), `--r-lg` (16px)
  - Layout: `--pad: 16px;`
- **Existing Components:**
  - Modal / Sheet: `useUI(s => s.openSheet)` and `components/Modals.jsx`
  - Toast: `useUI(s => s.toast)` and `components/Toast.jsx` with undo toast pattern
  - Icons: `<Icon name="..." />` in `components/Icon.jsx`
  - Buttons / Controls: `components/ui.jsx` (`Button`, `Segmented`, `Switch`)

---

## 7. Data Storage Shapes for Coaching

Stored in `state-<uid>.json` inside the root object:
- **Workouts:** Array of workout records:
  ```javascript
  {
    id: "uuid",
    d: "YYYY-MM-DD",
    start: 1730000000000,
    end: 1730003600000,
    name: "Push Day",
    entries: [
      {
        exId: "bench-press",
        sets: [
          {
            w: 80,          // weight in user unit
            r: 10,          // reps
            phase: "work",  // "work" | "warmup" (or boolean warmup: true)
            completed: true,
            type: "straight", // "straight" | "dropset" | "restpause"
            failure: false,
            rpe: 8
          }
        ]
      }
    ]
  }
  ```
- **Routines:**
  ```javascript
  {
    id: "uuid",
    name: "Upper Body",
    ex: [ { id: "bench-press", targetSets: 3, targetReps: "8-10" } ]
  }
  ```
- **Body Weight:**
  ```javascript
  bodyweight: [
    { d: "YYYY-MM-DD", w: 82.5, time: "08:00", _ts: 1730000000000 }
  ]
  ```
- **Week Schedule:**
  ```javascript
  week: { 0: ["routine-id"], 1: ["routine-id-2"] } // 0 = Sunday, 1 = Monday...
  ```

---

## 8. i18n & RTL

- **Directory:** `frontend/src/locales/*.js` (e.g. `ar.js`, `de.js`, `es.js`, `pt.js`, etc.).
- **Source of truth:** English source strings used as keys: `t('Confirm')`. English has no file.
- **RTL Support:**
  - `RTL_LANGS = new Set(['ar', 'he', 'fa', 'ur'])` in `frontend/src/lib/i18n-core.js`.
  - Sets `document.documentElement.dir = 'rtl'` when Arabic is chosen.
- **CI Locale Check:** `frontend/scripts/check-locales.mjs` verifies that every key in any locale exists across all locales and has matching placeholder count (`{0}`, `{1}`).

---

## 9. Tests & CI

- **Frontend tests:** Vitest (`cd frontend && npm test`).
- **API tests:** `node --test test/*.test.js` (`cd api && npm test`).
- **CI configuration:** `.github/workflows/test.yml` runs `npm test` in `frontend`, `api`, and `mcp`, plus `check-locales.mjs` and `npm run build`.

---

## 10. Admin Dashboard & "Promote to Coach"

- **Admin View:** `frontend/src/views/Admin.jsx` (available if `user.admin === true`).
- **Promoting a Coach:**
  - Add API route `POST /api/admin/coaches` accepting `{ uid }`.
  - In `Admin.jsx`, add a "Make Coach" / "Revoke Coach" action button next to users in `UserDetail`.

---

## 11. Static Serving of Datasets (foods/ like media/)

- **Nginx configuration (`web/nginx.conf.template`):**
  Exercise media is served via `/exercise-media/` cached with `max-age=2592000, immutable`.
- **For `foods/`:**
  - In dev: Vite serves from `frontend/public/foods/`.
  - In Docker/prod: Web container copies `foods/` to `/usr/share/nginx/html/foods/` or proxies to static assets.
  - Client loads `foods/index.json` once, cached via Cache API, and fetches chunks lazily.

---

## 12. Upstream Files to Edit & Smallest Possible Changes

| File | Smallest Edit | Reason |
|---|---|---|
| `api/server.js` | Import and spread `nutritionRoutes` and `coachingRoutes` into `routes` | Mount API modules |
| `frontend/src/App.jsx` | Add `/nutrition` and `/coach` subroutes | App routing |
| `frontend/src/components/TabBar.jsx` | Show Nutrition tab if enabled in settings | Tab navigation |
| `frontend/src/views/Settings.jsx` | Add "Nutrition" and "Coaching" section cards | Settings toggles |
| `frontend/src/views/Admin.jsx` | Add "Coach" badge and promote/demote button | Coach promotion |
| `frontend/src/locales/*.js` | Add translated strings | Multilingual i18n |
| `docker-compose.yml` / `web/Dockerfile` | Include static `foods/` distribution | Offline dataset |

---

## Risks and Open Questions

1. **Passkey Origin & Guest Mode:** Coaching requires server authentication; guest mode users cannot link to coaches. Nutrition diary must operate entirely locally in guest mode.
2. **Sync Conflicts:** Trainee state and nutrition data must stay in separate files (`state-<uid>.json` vs `nutrition-<uid>.json` and `coaching/<uid>.json`) so debounce writes never clobber each other.
3. **Food Dataset Size:** USDA CSV files are large; `tools/build-foods.mjs` must create a lean index (`< 1.5MB`) and ~500-food lazy chunk JSONs.
