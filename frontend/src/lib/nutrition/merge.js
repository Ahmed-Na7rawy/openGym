/**
 * CRDT-style LWW (Last-Write-Wins) entry merger for nutrition diary synchronization.
 *
 * Each entry has:
 * - id: unique string identifier
 * - u: update timestamp (number, ms since epoch)
 * - d?: boolean (tombstone flag for deletions)
 *
 * Rule:
 * - Union entries by id.
 * - When id exists in both, higher u wins.
 * - If u is equal, tombstone (d=true) wins to prevent resurrected items.
 *
 * @param {Array<Object>} localEntries
 * @param {Array<Object>} remoteEntries
 * @returns {Array<Object>}
 */
export function mergeDay(localEntries = [], remoteEntries = []) {
  const map = new Map();

  const processEntry = (entry) => {
    if (!entry || typeof entry !== 'object' || !entry.id) return;

    const existing = map.get(entry.id);
    if (!existing) {
      map.set(entry.id, entry);
      return;
    }

    const uNew = Number(entry.u) || 0;
    const uOld = Number(existing.u) || 0;

    if (uNew > uOld) {
      map.set(entry.id, entry);
    } else if (uNew === uOld) {
      // Tie breaker: tombstone wins
      if (entry.d && !existing.d) {
        map.set(entry.id, entry);
      }
    }
  };

  for (const item of localEntries) processEntry(item);
  for (const item of remoteEntries) processEntry(item);

  return Array.from(map.values());
}

/**
 * Prunes tombstones older than maxAgeMs (default: 30 days) to keep diary payloads bounded.
 *
 * @param {Array<Object>} entries
 * @param {number} [now]
 * @param {number} [maxAgeMs]
 * @returns {Array<Object>}
 */
export function pruneTombstones(entries = [], now = Date.now(), maxAgeMs = 30 * 86_400_000) {
  const cutoff = now - maxAgeMs;
  return (entries || []).filter(e => {
    if (!e || typeof e !== 'object') return false;
    if (e.d) {
      const u = Number(e.u) || 0;
      return u >= cutoff;
    }
    return true;
  });
}
