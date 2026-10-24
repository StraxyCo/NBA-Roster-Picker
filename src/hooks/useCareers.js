// Careers: /careers.json — { "<playerId>": { name, seasons: [{ season, teamAbbr, gp, min,
// pts, reb, ast, stl, blk, fg3m }] } }, regular season only, oldest season first.
//
// The static file is the historical base and the offline fallback. On top of it we overlay
// /api/current-careers, the current-season slice refreshed weekly by the cron in
// api/sync-careers.js, so this season's rows stay fresh without a commit. Every consumer
// must go through loadCareers() to get that overlay.

let careersData = null;
let careersPromise = null;

let liveData = null;
let livePromise = null;

async function loadLive() {
  if (liveData !== null) return liveData;
  if (!livePromise) {
    livePromise = fetch('/api/current-careers')
      .then(r => (r.ok ? r.json() : {}))
      .catch(err => { console.warn('Live careers overlay unavailable:', err.message); return {}; })
      .then(d => { liveData = d || {}; return liveData; });
  }
  return livePromise;
}

/**
 * Replace every row for `live.season` with the freshly synced ones, and add players the
 * static file has never seen. Rows for earlier seasons are left untouched.
 *
 * The synced slice carries one row per player — the team they are on now, with their whole
 * season's stats — so a mid-season trade shows up as the new team only until
 * scripts/fetch-careers.mjs is run again. Dropping the stale rows anyway is the right call:
 * a player's current team is what every game asks about most.
 *
 * Exported for the merge tests in scripts/; consumers want loadCareers().
 */
export function mergeCurrentSeason(staticCareers, live) {
  if (!live?.season || !live?.players) return staticCareers;

  for (const [id, entry] of Object.entries(live.players)) {
    if (!entry?.seasons?.length) continue;
    const base = staticCareers[id];
    const kept = (base?.seasons || []).filter(s => s.season !== live.season);
    staticCareers[id] = {
      // The static name wins where we have one: it carries the diacritics and the spelling
      // the rest of the data uses. The synced name is only for players new to the file.
      name: base?.name || entry.name,
      seasons: [...kept, ...entry.seasons].sort((a, b) => a.season.localeCompare(b.season)),
    };
  }
  return staticCareers;
}

export async function loadCareers() {
  if (careersData) return careersData;
  if (!careersPromise) {
    careersPromise = Promise.all([
      fetch('/careers.json').then(r => {
        if (!r.ok) throw new Error('Failed to load careers.json');
        return r.json();
      }),
      loadLive(),
    ]).then(([staticCareers, live]) => {
      try {
        mergeCurrentSeason(staticCareers, live);
      } catch (err) {
        // The overlay must never be able to break a load.
        console.warn('Failed to merge live careers, using static data:', err.message);
      }
      careersData = staticCareers;
      return staticCareers;
    });
  }
  return careersPromise;
}
