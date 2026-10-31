import { create } from 'zustand';
import { mergeDay, pruneTombstones } from '../lib/nutrition/merge.js';

const STORAGE_KEY = 'gym_nutrition_v1';
const DEBOUNCE_PUSH_MS = 1500;

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'e_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function getInitialState() {
  const fallback = {
    days: {},
    customFoods: [],
    targets: {
      kcal: null,
      protein: null,
      carbs: null,
      fat: null,
      micros: {},
      u: Date.now()
    },
    coachTargets: {
      active: false,
      kcal: null,
      protein: null,
      carbs: null,
      fat: null,
      micros: {},
      u: 0
    },
    settings: {
      enabled: false,
      preferredUnits: 'metric'
    },
    sync: {
      rev: 0,
      lastSyncTime: 0,
      pendingSync: false,
      syncing: false,
      error: null
    }
  };

  if (typeof window === 'undefined' || !window.localStorage) {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      days: parsed.days || {},
      customFoods: Array.isArray(parsed.customFoods) ? parsed.customFoods : [],
      targets: parsed.targets || fallback.targets,
      coachTargets: parsed.coachTargets || fallback.coachTargets,
      settings: parsed.settings || fallback.settings,
      sync: {
        ...fallback.sync,
        rev: parsed.sync?.rev || 0,
        lastSyncTime: parsed.sync?.lastSyncTime || 0
      }
    };
  } catch (err) {
    console.error('Failed to parse nutrition storage:', err);
    return fallback;
  }
}

function persistToStorage(state) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const payload = {
      days: state.days,
      customFoods: state.customFoods,
      targets: state.targets,
      coachTargets: state.coachTargets,
      settings: state.settings,
      sync: {
        rev: state.sync.rev,
        lastSyncTime: state.sync.lastSyncTime
      }
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.error('Failed to write nutrition storage:', err);
  }
}

let syncTimeout = null;

function scheduleSync(get, set) {
  const state = get();
  if (!state.settings.enabled) return;

  set((s) => ({ sync: { ...s.sync, pendingSync: true } }));

  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    syncTimeout = null;
    const current = get();
    if (!current.sync.pendingSync || current.sync.syncing) return;

    // Check if user is authenticated (gym_user in localStorage)
    const isAuthed = typeof window !== 'undefined' && window.localStorage && window.localStorage.getItem('gym_user');
    if (!isAuthed) {
      set((s) => ({ sync: { ...s.sync, pendingSync: false } }));
      return;
    }

    set((s) => ({ sync: { ...s.sync, syncing: true, error: null } }));
    try {
      const res = await fetch('/api/nutrition', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseRev: current.sync.rev,
          days: current.days,
          customFoods: current.customFoods,
          targets: current.targets
        })
      });

      if (res.ok) {
        const data = await res.json();
        set((s) => {
          const next = {
            ...s,
            sync: {
              rev: data.rev != null ? data.rev : s.sync.rev + 1,
              lastSyncTime: Date.now(),
              pendingSync: false,
              syncing: false,
              error: null
            }
          };
          persistToStorage(next);
          return next;
        });
      } else if (res.status === 409) {
        const conflict = await res.json();
        if (conflict.remoteState) {
          get().mergeServerState(conflict.remoteState, conflict.rev);
        }
      } else {
        set((s) => ({
          sync: { ...s.sync, syncing: false, error: `HTTP ${res.status}` }
        }));
      }
    } catch (err) {
      set((s) => ({
        sync: { ...s.sync, syncing: false, error: err.message }
      }));
    }
  }, DEBOUNCE_PUSH_MS);
}

export const useNutrition = create((set, get) => ({
  ...getInitialState(),

  setEnabled: (enabled) => {
    set((s) => {
      const next = { ...s, settings: { ...s.settings, enabled } };
      persistToStorage(next);
      return next;
    });
  },

  addEntry: (date, entry) => {
    const id = entry.id || generateId();
    const now = Date.now();
    const newEntry = {
      ...entry,
      id,
      u: entry.u != null ? entry.u : now,
      d: entry.d != null ? entry.d : false
    };

    set((s) => {
      const dayEntries = s.days[date] ? [...s.days[date]] : [];
      const updatedDays = {
        ...s.days,
        [date]: [...dayEntries, newEntry]
      };
      const next = { ...s, days: updatedDays };
      persistToStorage(next);
      return next;
    });

    scheduleSync(get, set);
    return id;
  },

  updateEntry: (date, id, updates) => {
    const now = Date.now();
    set((s) => {
      const dayEntries = s.days[date];
      if (!dayEntries) return s;

      const updated = dayEntries.map((e) => {
        if (e.id === id) {
          return { ...e, ...updates, u: now };
        }
        return e;
      });

      const next = { ...s, days: { ...s.days, [date]: updated } };
      persistToStorage(next);
      return next;
    });

    scheduleSync(get, set);
  },

  deleteEntry: (date, id) => {
    const now = Date.now();
    set((s) => {
      const dayEntries = s.days[date];
      if (!dayEntries) return s;

      const updated = dayEntries.map((e) => {
        if (e.id === id) {
          return { ...e, d: true, u: now };
        }
        return e;
      });

      const next = { ...s, days: { ...s.days, [date]: updated } };
      persistToStorage(next);
      return next;
    });

    scheduleSync(get, set);
  },

  addCustomFood: (food) => {
    const id = food.id || generateId();
    const now = Date.now();
    const newFood = {
      ...food,
      id,
      u: now,
      d: false
    };

    set((s) => {
      const next = { ...s, customFoods: [...s.customFoods, newFood] };
      persistToStorage(next);
      return next;
    });

    scheduleSync(get, set);
    return id;
  },

  updateCustomFood: (id, updates) => {
    const now = Date.now();
    set((s) => {
      const updated = s.customFoods.map((f) => {
        if (f.id === id) {
          return { ...f, ...updates, u: now };
        }
        return f;
      });
      const next = { ...s, customFoods: updated };
      persistToStorage(next);
      return next;
    });

    scheduleSync(get, set);
  },

  deleteCustomFood: (id) => {
    const now = Date.now();
    set((s) => {
      const updated = s.customFoods.map((f) => {
        if (f.id === id) {
          return { ...f, d: true, u: now };
        }
        return f;
      });
      const next = { ...s, customFoods: updated };
      persistToStorage(next);
      return next;
    });

    scheduleSync(get, set);
  },

  setTargets: (targets) => {
    const now = Date.now();
    set((s) => {
      const next = {
        ...s,
        targets: {
          ...s.targets,
          ...targets,
          u: now
        }
      };
      persistToStorage(next);
      return next;
    });

    scheduleSync(get, set);
  },

  setCoachTargets: (coachTargets) => {
    set((s) => {
      const next = {
        ...s,
        coachTargets: {
          ...s.coachTargets,
          ...coachTargets
        }
      };
      persistToStorage(next);
      return next;
    });
  },

  mergeServerState: (remote, remoteRev = null) => {
    if (!remote || typeof remote !== 'object') return;

    set((s) => {
      // 1. Merge days via CRDT mergeDay
      const mergedDays = { ...s.days };
      const allDates = new Set([
        ...Object.keys(s.days || {}),
        ...Object.keys(remote.days || {})
      ]);

      for (const d of allDates) {
        const localDay = s.days[d] || [];
        const remoteDay = remote.days?.[d] || [];
        mergedDays[d] = pruneTombstones(mergeDay(localDay, remoteDay));
      }

      // 2. Merge customFoods (LWW by ID)
      const foodMap = new Map();
      for (const f of s.customFoods || []) {
        if (f && f.id) foodMap.set(f.id, f);
      }
      for (const f of remote.customFoods || []) {
        if (!f || !f.id) continue;
        const cur = foodMap.get(f.id);
        if (!cur || (Number(f.u) || 0) > (Number(cur.u) || 0)) {
          foodMap.set(f.id, f);
        } else if ((Number(f.u) || 0) === (Number(cur.u) || 0) && f.d) {
          foodMap.set(f.id, f);
        }
      }
      const mergedCustomFoods = Array.from(foodMap.values());

      // 3. User targets (higher u wins)
      let mergedTargets = s.targets;
      if (remote.targets && (remote.targets.u || 0) > (s.targets.u || 0)) {
        mergedTargets = remote.targets;
      }

      // 4. Coach targets (server is authoritative)
      const mergedCoachTargets = remote.coachTargets || s.coachTargets;

      const next = {
        ...s,
        days: mergedDays,
        customFoods: mergedCustomFoods,
        targets: mergedTargets,
        coachTargets: mergedCoachTargets,
        sync: {
          ...s.sync,
          rev: remoteRev != null ? remoteRev : (remote.rev || s.sync.rev),
          lastSyncTime: Date.now(),
          pendingSync: false,
          syncing: false,
          error: null
        }
      };

      persistToStorage(next);
      return next;
    });
  }
}));
