// Shared NBA.com Stats API constants. Imported by api/sync-rosters.js and
// scripts/fetch-rosters.mjs so the team-id mapping lives in exactly one place.

// Our internal team IDs (see src/data/teams.js) → NBA.com team IDs
export const TEAMS = {
  1:  { nbaId: '1610612737', name: 'Atlanta Hawks' },
  2:  { nbaId: '1610612738', name: 'Boston Celtics' },
  4:  { nbaId: '1610612751', name: 'Brooklyn Nets' },
  5:  { nbaId: '1610612766', name: 'Charlotte Hornets' },
  6:  { nbaId: '1610612741', name: 'Chicago Bulls' },
  7:  { nbaId: '1610612739', name: 'Cleveland Cavaliers' },
  8:  { nbaId: '1610612742', name: 'Dallas Mavericks' },
  9:  { nbaId: '1610612743', name: 'Denver Nuggets' },
  10: { nbaId: '1610612765', name: 'Detroit Pistons' },
  11: { nbaId: '1610612744', name: 'Golden State Warriors' },
  14: { nbaId: '1610612745', name: 'Houston Rockets' },
  15: { nbaId: '1610612754', name: 'Indiana Pacers' },
  16: { nbaId: '1610612746', name: 'LA Clippers' },
  17: { nbaId: '1610612747', name: 'Los Angeles Lakers' },
  19: { nbaId: '1610612763', name: 'Memphis Grizzlies' },
  20: { nbaId: '1610612748', name: 'Miami Heat' },
  21: { nbaId: '1610612749', name: 'Milwaukee Bucks' },
  22: { nbaId: '1610612750', name: 'Minnesota Timberwolves' },
  23: { nbaId: '1610612740', name: 'New Orleans Pelicans' },
  24: { nbaId: '1610612752', name: 'New York Knicks' },
  25: { nbaId: '1610612760', name: 'Oklahoma City Thunder' },
  26: { nbaId: '1610612753', name: 'Orlando Magic' },
  27: { nbaId: '1610612755', name: 'Philadelphia 76ers' },
  28: { nbaId: '1610612756', name: 'Phoenix Suns' },
  29: { nbaId: '1610612757', name: 'Portland Trail Blazers' },
  30: { nbaId: '1610612758', name: 'Sacramento Kings' },
  31: { nbaId: '1610612759', name: 'San Antonio Spurs' },
  38: { nbaId: '1610612761', name: 'Toronto Raptors' },
  40: { nbaId: '1610612762', name: 'Utah Jazz' },
  41: { nbaId: '1610612764', name: 'Washington Wizards' },
};

export const NBA_ID_TO_TEAM_ID = Object.fromEntries(
  Object.entries(TEAMS).map(([id, { nbaId }]) => [nbaId, id])
);

export const NBA_HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://www.nba.com',
  'Referer': 'https://www.nba.com/',
  'x-nba-stats-origin': 'stats',
  'x-nba-stats-token': 'true',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

// Mirrors getCurrentSeason() in src/data/seasons.js — kept as a copy rather than an
// import so the serverless functions never reach across into the Vite source tree.
export function getCurrentSeason(date = new Date()) {
  const year = date.getMonth() >= 9 ? date.getFullYear() : date.getFullYear() - 1;
  return `${year}-${String((year + 1) % 100).padStart(2, '0')}`;
}

// Pull one resultSet out of a stats.nba.com response and return a row reader that
// looks fields up by header name, so a changed column order can't silently corrupt data.
export async function fetchResultSet(url, setName) {
  const res = await fetch(url, { headers: NBA_HEADERS });
  if (!res.ok) throw new Error(`NBA API ${res.status} for ${setName || url}`);
  const data = await res.json();
  const set = setName
    ? data.resultSets?.find(s => s.name === setName)
    : data.resultSets?.[0];
  if (!set) throw new Error(`Missing resultSet ${setName || '[0]'}`);

  const idx = Object.fromEntries(set.headers.map((h, i) => [h, i]));
  const has = (...names) => names.every(n => idx[n] !== undefined);
  const get = (row, name, fallback = null) => {
    if (idx[name] === undefined) return fallback;
    const v = row[idx[name]];
    return v === null || v === undefined ? fallback : v;
  };
  return { rows: set.rowSet, headers: set.headers, has, get };
}
