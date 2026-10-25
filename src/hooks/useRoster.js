// Rosters: /rosters.json — { "<season>": { "<teamId>": [{id,name,position,number,pts,reb,ast,stl,blk,min,gp,fg3m}] } }
// Standings: /standings.json — { "<season>": { "<teamId>": { w, l } } }
//
// The static files are the historical base and the offline fallback. On top of them we
// overlay /api/current-rosters, the current-season slice refreshed weekly by the cron in
// api/sync-rosters.js, so the current season stays fresh without a commit. Every consumer
// must go through loadRosters() to get that overlay.

let rostersData  = null;
let standingsData = null;
let rosterPromise  = null;
let standingPromise = null;

let liveData = null;
let livePromise = null;

const WEIGHT_FIELDS = ['pts', 'reb', 'ast', 'stl', 'blk', 'min', 'gp', 'fg3m'];

// Everything api/sync-rosters.js publishes for a player. Any other key on a static entry
// is data this project added by hand (a backfilled headshot, say); the overlay carries it
// across so a live slice does not quietly drop it.
const LIVE_FIELDS = new Set([
  'id', 'name', 'position', 'number', ...WEIGHT_FIELDS,
]);

async function loadLive() {
  if (liveData !== null) return liveData;
  if (!livePromise) {
    livePromise = fetch('/api/current-rosters')
      .then(r => (r.ok ? r.json() : {}))
      .catch(err => { console.warn('Live roster overlay unavailable:', err.message); return {}; })
      .then(d => { liveData = d || {}; return liveData; });
  }
  return livePromise;
}

// Most recent stat line we have for each player across the static seasons, used so a
// player with no games yet this season is still weighted by their real history —
// weightedShuffle() in utils/playerSelection.js drops every zero-weight entry, which
// would otherwise empty the draw pools before opening night.
function buildStatHistory(staticRosters, upToSeason) {
  const history = new Map();
  for (const season of Object.keys(staticRosters).sort()) {
    if (season >= upToSeason) continue;
    for (const players of Object.values(staticRosters[season] || {})) {
      for (const p of players || []) {
        if ((p.gp ?? 0) > 0) history.set(p.id, p);
      }
    }
  }
  return history;
}

// Hand-added fields per player id, newest season wins. Keyed by id rather than by season
// so a backfill committed against last season still applies when the player turns up in a
// season the static file does not have yet.
function buildCustomFields(staticRosters) {
  const byId = new Map();
  for (const season of Object.keys(staticRosters).sort()) {
    for (const players of Object.values(staticRosters[season] || {})) {
      for (const p of players || []) {
        let extras = null;
        for (const key of Object.keys(p)) {
          if (!LIVE_FIELDS.has(key)) (extras ??= {})[key] = p[key];
        }
        if (extras) byId.set(p.id, { ...byId.get(p.id), ...extras });
      }
    }
  }
  return byId;
}

function indexSeasonById(seasonData) {
  const byId = new Map();
  for (const players of Object.values(seasonData || {})) {
    for (const p of players || []) byId.set(p.id, p);
  }
  return byId;
}

function mergeLiveSeason(staticRosters, live) {
  const history = buildStatHistory(staticRosters, live.season);
  const custom = buildCustomFields(staticRosters);
  const committed = indexSeasonById(staticRosters[live.season]);
  const merged = {};
  for (const [teamId, players] of Object.entries(live.teams)) {
    merged[teamId] = (players || []).map(p => {
      const extras = custom.get(p.id);
      // Live fields always win; extras only fill in keys the sync does not publish.
      const out = extras ? { ...extras, ...p } : p;
      if ((p.gp ?? 0) > 0) return out;

      // No games yet: weight from this season's committed stats if the static file
      // already has them, otherwise from the player's most recent prior season.
      const sameSeason = committed.get(p.id);
      const prior = (sameSeason?.gp ?? 0) > 0 ? sameSeason : history.get(p.id);
      if (!prior) return out; // true rookie with no history — stays unweighted, as before
      const carried = { ...out };
      for (const f of WEIGHT_FIELDS) carried[f] = prior[f] ?? 0;
      return carried;
    });
  }
  return merged;
}

export async function loadRosters() {
  if (rostersData) return rostersData;
  if (!rosterPromise) {
    rosterPromise = Promise.all([
      fetch('/rosters.json').then(r => {
        if (!r.ok) throw new Error('Failed to load rosters.json');
        return r.json();
      }),
      loadLive(),
    ]).then(([staticRosters, live]) => {
      if (live?.season && live?.teams && Object.keys(live.teams).length) {
        try {
          staticRosters[live.season] = mergeLiveSeason(staticRosters, live);
        } catch (err) {
          // The overlay must never be able to break a load.
          console.warn('Failed to merge live rosters, using static data:', err.message);
        }
      }
      rostersData = staticRosters;
      return staticRosters;
    });
  }
  return rosterPromise;
}

async function loadStandings() {
  if (standingsData) return standingsData;
  if (!standingPromise) {
    standingPromise = Promise.all([
      fetch('/standings.json').then(r => {
        if (!r.ok) throw new Error('Failed to load standings.json');
        return r.json();
      }),
      loadLive(),
    ]).then(([staticStandings, live]) => {
      if (live?.season && live?.standings && Object.keys(live.standings).length) {
        staticStandings[live.season] = live.standings;
      }
      standingsData = staticStandings;
      return staticStandings;
    });
  }
  return standingPromise;
}

export async function getAvailableSeasons() {
  const rosters = await loadRosters();
  return Object.keys(rosters).sort((a, b) => b.localeCompare(a));
}

// Newest season we actually hold data for. Prefer this over CURRENT_SEASON when indexing
// into the roster data: a new season only appears once the cron has published a slice for it.
export async function getLatestSeason() {
  const [latest] = await getAvailableSeasons();
  return latest;
}

// Seasons with at least one team far enough along to judge stat leaders. A
// season in progress has nobody near the games bar, so it is not offered.
export async function getSeasonsWithFullSample(minGames) {
  const rosters = await loadRosters();
  return Object.keys(rosters).filter(season =>
    Object.values(rosters[season] || {}).some(players =>
      (players || []).some(p => (p.gp ?? 0) >= minGames)
    )
  );
}

const rosterCache = {};
export async function fetchRoster(teamId, season) {
  const key = `${season}:${teamId}`;
  if (rosterCache[key]) return rosterCache[key];
  try {
    const rosters = await loadRosters();
    const players = (rosters[season] || {})[teamId] || [];
    const sorted = [...players].sort((a, b) => a.name.localeCompare(b.name));
    rosterCache[key] = sorted;
    return sorted;
  } catch (err) {
    console.error('Failed to load rosters:', err);
    return { error: 'FETCH_FAILED' };
  }
}

const standingsCache = {};
export async function fetchStandings(teamId, season) {
  const key = `${season}:${teamId}`;
  if (standingsCache[key]) return standingsCache[key];
  try {
    const standings = await loadStandings();
    const wl = (standings[season] || {})[teamId] || { w: 0, l: 0 };
    standingsCache[key] = wl;
    return wl;
  } catch (err) {
    console.error('Failed to load standings:', err);
    return { w: 0, l: 0 };
  }
}
