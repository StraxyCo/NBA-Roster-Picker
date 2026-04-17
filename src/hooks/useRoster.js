// Rosters: /rosters.json — { "2025-26": { "1": [{id,name,position,pts,reb,ast,stl,blk,fg3m}] } }
// Standings: /standings.json — { "2025-26": { "1": { w, l } } }

let rostersData  = null;
let standingsData = null;
let rosterPromise  = null;
let standingPromise = null;

async function loadRosters() {
  if (rostersData) return rostersData;
  if (!rosterPromise) {
    rosterPromise = fetch('/rosters.json')
      .then(r => { if (!r.ok) throw new Error('Failed to load rosters.json'); return r.json(); })
      .then(d => { rostersData = d; return d; });
  }
  return rosterPromise;
}

async function loadStandings() {
  if (standingsData) return standingsData;
  if (!standingPromise) {
    standingPromise = fetch('/standings.json')
      .then(r => { if (!r.ok) throw new Error('Failed to load standings.json'); return r.json(); })
      .then(d => { standingsData = d; return d; });
  }
  return standingPromise;
}

export async function getAvailableSeasons() {
  const rosters = await loadRosters();
  return Object.keys(rosters).sort((a, b) => b.localeCompare(a));
}

const rosterCache = {};
export async function fetchRoster(teamId, season) {
  const key = `${season}:${teamId}`;
  if (rosterCache[key]) return rosterCache[key];
  try {
    const rosters = await loadRosters();
    const players = (rosters[season] || {})[teamId] || [];
    rosterCache[key] = players;
    return players;
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
