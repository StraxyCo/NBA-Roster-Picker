// node scripts/fetch-rosters.mjs
//
// First run  → fetches all seasons from 2005-06 to current, writes public/rosters.json
// Later runs → detects existing seasons, only re-fetches the current season
//
// Output structure: { "2005-06": { "1": [...players], "2": [...] }, "2006-07": { ... }, ... }

import { writeFileSync, readFileSync, existsSync } from 'fs';

const CURRENT_SEASON = '2025-26';

const ALL_SEASONS = [
  '2005-06','2006-07','2007-08','2008-09','2009-10',
  '2010-11','2011-12','2012-13','2013-14','2014-15',
  '2015-16','2016-17','2017-18','2018-19','2019-20',
  '2020-21','2021-22','2022-23','2023-24','2024-25',
  '2025-26',
];

const TEAMS = {
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

const NBA_HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://www.nba.com',
  'Referer': 'https://www.nba.com/',
  'x-nba-stats-origin': 'stats',
  'x-nba-stats-token': 'true',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

async function fetchTeamRoster(nbaId, name, season) {
  const url = `https://stats.nba.com/stats/commonteamroster?TeamID=${nbaId}&Season=${season}`;
  const res = await fetch(url, { headers: NBA_HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  const rosterSet = data.resultSets?.find(s => s.name === 'CommonTeamRoster');
  if (!rosterSet) throw new Error('No CommonTeamRoster in response');

  const h = rosterSet.headers;
  return rosterSet.rowSet.map((row, i) => ({
    id:       row[h.indexOf('PLAYER_ID')] ?? i,
    name:     row[h.indexOf('PLAYER')] ?? '—',
    position: row[h.indexOf('POSITION')] ?? '—',
    number:   row[h.indexOf('NUM')] ?? '',
  }));
}

// ── Load existing data ──────────────────────────────────────────────────────

const OUTPUT = 'public/rosters.json';
let existing = {};

if (existsSync(OUTPUT)) {
  existing = JSON.parse(readFileSync(OUTPUT, 'utf8'));
  console.log(`📂 Found existing rosters.json with seasons: ${Object.keys(existing).join(', ')}\n`);
} else {
  console.log('📂 No existing rosters.json — full fetch from scratch.\n');
}

// ── Decide which seasons to fetch ──────────────────────────────────────────

const existingSeasons = new Set(Object.keys(existing));
const seasonsToFetch = ALL_SEASONS.filter(s =>
  !existingSeasons.has(s) || s === CURRENT_SEASON
);

if (seasonsToFetch.length === 1 && seasonsToFetch[0] === CURRENT_SEASON) {
  console.log(`🔄 All historical seasons already present. Refreshing current season only: ${CURRENT_SEASON}\n`);
} else {
  const newSeasons = seasonsToFetch.filter(s => s !== CURRENT_SEASON);
  console.log(`🆕 New seasons to fetch: ${newSeasons.join(', ')}`);
  console.log(`🔄 Also refreshing current season: ${CURRENT_SEASON}\n`);
}

// ── Fetch ───────────────────────────────────────────────────────────────────

const result = { ...existing };
let totalFetched = 0;
let totalFailed  = 0;

for (const season of seasonsToFetch) {
  console.log(`\n── Season ${season} ──`);
  result[season] = result[season] || {};

  for (const [teamId, { nbaId, name }] of Object.entries(TEAMS)) {
    process.stdout.write(`  ${name}... `);
    try {
      await new Promise(r => setTimeout(r, 500));
      const players = await fetchTeamRoster(nbaId, name, season);
      result[season][teamId] = players;
      console.log(`✓ ${players.length} players`);
      totalFetched++;
    } catch (err) {
      // Some teams didn't exist in early seasons (e.g. Pelicans pre-2002)
      // Keep existing data if any, otherwise store empty array
      result[season][teamId] = result[season][teamId] || [];
      console.log(`✗ ${err.message}`);
      totalFailed++;
    }
  }
}

// ── Write ───────────────────────────────────────────────────────────────────

writeFileSync(OUTPUT, JSON.stringify(result, null, 2));
console.log(`\n✅ Done. Fetched: ${totalFetched}, Failed: ${totalFailed}`);
console.log(`📝 Written to ${OUTPUT} — commit and push to GitHub.`);
