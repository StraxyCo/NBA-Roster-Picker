// Fetch the Basketball-GM roster JSON once, cache everything in memory.
// Source: github.com/alexnoob/BasketBall-GM-Rosters (updated regularly, no API key needed)
const RAW_URL = 'https://raw.githubusercontent.com/alexnoob/BasketBall-GM-Rosters/master/2025-26.NBA.Roster.json';

// Map our internal BallDontLie team IDs → Basketball-GM team abbreviations
const TEAM_ABBR = {
  1:  'ATL', 2:  'BOS', 4:  'BKN', 5:  'CHA', 6:  'CHI',
  7:  'CLE', 8:  'DAL', 9:  'DEN', 10: 'DET', 11: 'GSW',
  14: 'HOU', 15: 'IND', 16: 'LAC', 17: 'LAL', 19: 'MEM',
  20: 'MIA', 21: 'MIL', 22: 'MIN', 23: 'NOP', 24: 'NYK',
  25: 'OKC', 26: 'ORL', 27: 'PHI', 28: 'PHX', 29: 'POR',
  30: 'SAC', 31: 'SAS', 38: 'TOR', 40: 'UTA', 41: 'WAS',
};

// Global cache: { abbr -> [players] }
let rostersByTeam = null;
let fetchPromise  = null;

async function loadAllRosters() {
  if (rostersByTeam) return rostersByTeam;
  // Only one concurrent fetch even if called multiple times
  if (!fetchPromise) {
    fetchPromise = (async () => {
      const res = await fetch(RAW_URL);
      if (!res.ok) throw new Error(`Failed to fetch roster file: ${res.status}`);
      const data = await res.json();

      // Basketball-GM structure:
      // data.teams = [{ abbrev, region, name, roster: [{pid, pos, ...}] }]
      // data.players = [{ pid, firstName, lastName, ... }]
      const playerMap = {};
      for (const p of (data.players || [])) {
        playerMap[p.pid] = p;
      }

      const result = {};
      for (const team of (data.teams || [])) {
        const abbr = team.abbrev;
        const players = [];
        for (const slot of (team.roster || [])) {
          const p = playerMap[slot.pid];
          if (!p) continue;
          // Skip retired/historical players — they have no real position in current roster
          // Basketball-GM marks active players with a ratings entry for the current season
          players.push({
            id:       p.pid,
            name:     `${p.firstName} ${p.lastName}`,
            position: slot.pos || p.ratings?.at(-1)?.pos || '—',
          });
        }
        result[abbr] = players;
      }

      rostersByTeam = result;
      return result;
    })();
  }
  return fetchPromise;
}

// Per-team cache after first lookup
const teamCache = {};

export async function fetchRoster(teamId) {
  if (teamCache[teamId]) return teamCache[teamId];

  const abbr = TEAM_ABBR[teamId];
  if (!abbr) return { error: 'UNKNOWN_TEAM' };

  try {
    const rosters = await loadAllRosters();
    const players = rosters[abbr] || [];
    teamCache[teamId] = players;
    return players;
  } catch (err) {
    console.error('Failed to load rosters:', err);
    return { error: 'FETCH_FAILED' };
  }
}
