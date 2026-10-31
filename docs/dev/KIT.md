# openGym + Coaching + Nutrition: Claude Code Build Kit

Goal: fork openGym and add two things **on top of it**, without rewriting it:

1. **A nutrition module** whose Android look and flow is inspired by Cronometer: a daily food diary with meals, a food search, an energy summary, macro bars and a detailed nutrient report.
2. **A coaching layer**: a coach is responsible for his own trainees, sets their nutrition targets, reads their training, weight and food diary, writes notes and assigns routines. Each trainee keeps his own login.

This kit replaces the standalone-app route. Your standalone coach app (from `repomix-output.xml`) becomes a **reference to port from**, not the base.

## What I based this on

- openGym's `CLAUDE.md` (read in full): React 19 + Vite + Zustand frontend, a **single-file `api/server.js`** on plain `node:http`, **two dependencies total in the API**, state as flat JSON files in `DATA_DIR` (`db.json` for users, `state-<uid>.json` per user), **passkey (WebAuthn) login**, `ADMIN_UIDS`, `INVITE_ONLY` signup codes, no TypeScript, no linter, pure helpers in `frontend/src/lib/` with a test beside each. The canonical remote is GitLab and the GitHub copy is a mirror.
- Your uploaded standalone app (structure and the calculator, overview and constants files). It has a tested nutrition calculator, coach overview flags, an access-test pattern and security docs worth porting.
- I have **not** read `api/server.js` or the frontend source. Task 0 (read-only recon) finds the real hook points, and every later task says to follow what it found.

## Design decisions (and why)

| Decision | Why |
|---|---|
| **Additive code in new files**, with a handful of small edits to existing files (route registration, nav, settings link, locale files) | Keeps `git merge upstream` possible. Upstream moves fast and you do not want a permanent conflict. |
| **No new dependencies** (frontend or API) | openGym treats this as a hard rule. No SQLite, no chart library, no UI kit. |
| **Nutrition lives in its own per-user file** (`nutrition-<uid>.json`) and its own store, not inside `state-<uid>.json` | A food diary grows every day. Keeping it out of the main state keeps the main sync small and avoids conflicts with the existing push logic. |
| **Coach data lives in separate files** (`coaching.json`, `coaching/<traineeUid>.json`), never inside a trainee's `state-<uid>.json` | The trainee's app pushes its state on a debounce. If the server also edited that file they would overwrite each other. The trainee's app *pulls* coach data and applies it. |
| **Coach reads trainee data through server-side summary endpoints**, only for trainees linked to that coach | One place enforces who sees what. |
| **Linking needs the trainee's consent**: an invite code is created by the coach and accepted by the trainee, and the trainee can leave at any time and sees what the coach can read | You are handling health-related data about real people. |
| **Food data is a static dataset** served like the exercise `media`, with a USDA-derived subset plus a curated Egyptian foods file and per-user and coach-shared custom foods | No database dependency and it works offline. USDA FoodData Central is public domain (verify and keep the attribution file). Open Food Facts barcode lookup is optional later because it is a third-party network call and openGym promises "no telemetry". |
| **Calculator ported to plain JavaScript** in `frontend/src/lib/nutrition/` | One implementation, unit-tested, used by both the trainee view and the coach panel. |
| **Feature is off by default** (Settings toggle) | Matches how openGym handles optional extras, and makes an upstream merge request more likely to be accepted. |

**Licence:** openGym is AGPL-3.0-or-later. If coaches run your modified version for their trainees, you must offer those users the source. Keep your fork public. I am not a lawyer, so check this before you sell anything.

**Coach features need the server.** The standalone phone builds in guest mode have no server, so nutrition works there locally but coaching does not.

---

## 1. Start here

1. Fork or clone openGym from its canonical GitLab remote and add the GitHub mirror and upstream as extra remotes. Create the branch `feature/coach-nutrition`.
2. Put your standalone app next to the fork as read-only reference, for example `reference/standalone/` (add it to `.gitignore` so it is never committed).
3. Download the USDA FoodData Central CSV files you want (Foundation Foods and SR Legacy) into `tools/foods-src/` (gitignored). The agent cannot download them for you.
4. Put this file at `docs/dev/KIT.md`.
5. Run Claude Code in the fork, start with **Task A**, then Task 0, then the rest in order. Fresh session per task (`/clear`), commit per task, run the tests yourself at the end of each one.
6. Use plan mode for Tasks 3, 4 and 8, read the plan, then let it write code.

The Claude Code file locations and commands below come from community write-ups, not the official pages. Task A tells the agent to check them against the current official documentation.

---

## 2. Claude Code setup

### 2.1 What to install and why

| Item | Type | Why |
|---|---|---|
| `opengym-conventions` | project skill | Keeps every session inside openGym's hard rules (no deps, no TypeScript, pure helpers with tests, additive files). |
| `coach-access` | project skill | The biggest risk: a coach seeing the wrong trainee, or a trainee seeing another's data. |
| `nutrition-data` | project skill | One place for nutrient ids and units, per-100 g maths, rounding, merge rules and the dataset licence. |
| `diary-ui` | project skill | The Cronometer-inspired layout rules, so every screen looks like one app. |
| `security-reviewer` | read-only subagent | Independent review after Tasks 8 and 9, and in the final gate. |
| `upstream-diff-reviewer` | read-only subagent | Checks that the diff stays additive and lists every edit to an existing upstream file. |
| Syntax-check hook | hook | Catches a broken `api/` file immediately after an edit. |
| Design, accessibility, testing and architecture skills already available to you | existing skills or plugins | Use for the diary screens (Tasks 5 to 7) and the access model (Task 8). |

### 2.2 `CLAUDE.md` addendum (append to openGym's existing `CLAUDE.md`, do not replace it)

```markdown
## Coaching and nutrition additions (this fork)

Spec and decisions: docs/dev/KIT.md, docs/dev/RECON.md.

### Where new code goes (additive only)
- frontend/src/lib/nutrition/    pure helpers + tests (calculator, food maths, targets, merge, search)
- frontend/src/lib/coaching/     pure helpers + tests (overview flags, effective targets)
- frontend/src/store/useNutrition.js   separate Zustand store, localStorage key gym_nutrition_v1
- frontend/src/views/nutrition/  diary, add-food sheet, report, targets
- frontend/src/views/coach/      coach area
- api/modules/nutrition.js, api/modules/coaching.js   routes registered from server.js with minimal edits
- api/test/                      node:test files (node --test), no new dependency
- tools/                         dataset build script (tools/build-foods.mjs), not shipped
- foods/                         generated static dataset served like media/

### Rules
- Edit existing upstream files as little as possible. List every upstream file you touched in your report.
- No new dependencies. No TypeScript. Match the existing style by hand.
- Anything that calculates or merges is a pure helper in lib/ with a vitest test beside it.
- API code uses the existing atomicWrite pattern and the existing auth helpers. The user id always comes from the session, never from the request.
- Coaching features are server-only. Nutrition must also work in guest and Capacitor mode.
- Both nutrition and coaching are OFF by default behind settings.
- All UI text goes through the existing i18n catalogue in every locale.
```

### 2.3 Project skills

`.claude/skills/opengym-conventions/SKILL.md`

```markdown
---
name: opengym-conventions
description: Use for any change in this fork. Keeps work inside openGym's hard rules and keeps upstream merges possible.
---

# openGym conventions

1. No new dependencies in frontend/ or api/. If you think you need one practical reason, explain in the report.
2. No TypeScript. Plain JavaScript with JSDoc where it helps.
3. Pure logic goes in frontend/src/lib/ with a same-directory *.test.js (vitest).
4. API additions go in api/modules/*.js and are registered in the `routes` object of api/server.js with the smallest possible edit. Writes use the existing atomicWrite.
5. Never edit state-<uid>.json from the server on behalf of another user.
6. Prefer new files over editing upstream files. When an upstream file must change, make the smallest edit and list it in the report.
7. Do not commit data/ or media/.
8. Before finishing: run `cd frontend && npm test`, run `node --test api/test` if api/ changed, run `cd frontend && npm run build`, and report results.
```

### 2.4 Subagents

`.claude/agents/security-reviewer.md`

```markdown
---
name: security-reviewer
description: Reviews coaching routes, invites, consent and data access. Use after changes to api/modules/coaching.js, coach summaries or linking.
tools: Read, Grep, Glob
---

You review a small self-hosted fitness app that now has coaches and trainees. Read code only.
Check: session-derived user ids only; assertCoachOfTrainee on every coach route; admin does not imply data access; single-use hashed expiring invites; unlink removes access immediately; no state files edited by the server for another user; input size limits and validation; audit log lines; no secrets or personal data in logs; passkey and session code untouched.
Report: severity, file and line, problem, fix. End with what you could not verify.
```

`.claude/agents/upstream-diff-reviewer.md`

```markdown
---
name: upstream-diff-reviewer
description: Checks that the fork's changes stay additive so upstream merges stay easy.
tools: Read, Grep, Glob, Bash
---

Run git diff against the upstream main branch. List every EXISTING file that was modified, with the size of each change, and flag any edit that is larger than a few lines. Flag new dependencies, TypeScript, files that should have a test and do not, and edits to auth, session or notification code. Suggest how to make each upstream-file edit smaller. Do not edit files.
```

---

## 3. Project Context (paste at the top of every task)

```text
PROJECT CONTEXT
This is a fork of openGym (self-hosted gym tracker). Read CLAUDE.md (including the "Coaching and nutrition additions" section), docs/dev/KIT.md and docs/dev/RECON.md (once it exists) first.
We are adding (1) a Cronometer-inspired nutrition module and (2) a coaching layer where each coach is responsible for his own trainees. Everything is additive, in new files, with minimal edits to upstream files.
Hard rules: no new dependencies, no TypeScript, pure logic in frontend/src/lib with a test beside it, API additions in api/modules registered from server.js, features off by default, all UI text through the existing i18n in every locale.
Reference material (read-only, never copy blindly): reference/standalone/ (the previous standalone coach app) and tools/foods-src/ (USDA CSVs).
Never guess. If something is ambiguous, choose the safest simple option and list it under "Open questions". Before finishing: run frontend tests, node --test api/test if api changed, the frontend build, and report results plus every upstream file you edited.
```

---

## 4. Tasks

### Task A: Claude Code setup files
### Task 0: Recon of the fork (read-only)
### Task 1: Pure nutrition library (port the calculator and add food maths)
### Task 2: Food dataset pipeline
### Task 3: Nutrition store and persistence
### Task 4: Nutrition sync API
### Task 5: Diary screen (Cronometer-inspired)
### Task 6: Add-food flow
### Task 7: Nutrient report and targets
### Task 8: Coaching server layer
### Task 9: Coaching frontend
### Task 10: Translations and right-to-left
### Task 11: Quality gate and docs
