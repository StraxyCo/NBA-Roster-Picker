// node scripts/fetch-rosters.mjs                        → smart update (rosters + stats + standings)
// node scripts/fetch-rosters.mjs --stats-only           → only update stats & standings, no roster re-fetch
// node scripts/fetch-rosters.mjs --season 2012-13       → target a specific season only (rosters + stats + standings)
// node scripts/fetch-rosters.mjs --stats-only --season 2012-13 → stats & standings for one season only

import { writeFileSync, readFileSync, existsSync } from 'fs';

const CURRENT_SEASON = '2025-26';
const STATS_ONLY = process.argv.includes('--stats-only');

// Parse --season XXXX-XX argument
const seasonArgIdx = process.argv.indexOf('--season');
const TARGET_SEASON = seasonArgIdx !== -1 ? process.argv[seasonArgIdx + 1] : null;

const ALL_SEASONS = [
  '2005-06','2006-07','2007-08','2008-09','2009-10',
  '2010-11','2011-12','2012-13','2013-14','2014-15',
  '2015-16','2016-17','2017-18','2018-19','2019-20',
  '2020-21','2021-22','2022-23','2023-24','2024-25','2025-26',
];

// When --season is used, only process that one season
const SEASONS_TO_CONSIDER = TARGET_SEASON
  ? (ALL_SEASONS.includes(TARGET_SEASON)
      ? [TARGET_SEASON]
      : (() => { console.error(`❌ Unknown season: "${TARGET_SEASON}". Valid: ${ALL_SEASONS.join(', ')}`); process.exit(1) })())
  : ALL_SEASONS;

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

const NBA_ID_TO_TEAM_ID = Object.fromEntries(
  Object.entries(TEAMS).map(([id, { nbaId }]) => [nbaId, id])
);

const NBA_HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://www.nba.com',
  'Referer': 'https://www.nba.com/',
  'x-nba-stats-origin': 'stats',
  'x-nba-stats-token': 'true',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchTeamRoster(nbaId, name, season) {
  const url = `https://stats.nba.com/stats/commonteamroster?TeamID=${nbaId}&Season=${season}`;
  const res = await fetch(url, { headers: NBA_HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const set = data.resultSets?.find(s => s.name === 'CommonTeamRoster');
  if (!set) throw new Error('No CommonTeamRoster');
  const h = set.headers;
  return set.rowSet.map((row, i) => ({
    id: row[h.indexOf('PLAYER_ID')] ?? i,
    name: row[h.indexOf('PLAYER')] ?? '—',
    position: row[h.indexOf('POSITION')] ?? '—',
    number: row[h.indexOf('NUM')] ?? '',
  }));
}

async function fetchPlayerStats(season) {
  const url = `https://stats.nba.com/stats/leaguedashplayerstats?Season=${season}&SeasonType=Regular+Season&PerMode=PerGame&MeasureType=Base&GameScope=&PlayerExperience=&PlayerPosition=&StarterBench=&LastNGames=0&Month=0&OpponentTeamID=0&PaceAdjust=N&PlusMinus=N&Rank=N&Conference=&Division=&DateFrom=&DateTo=&GameSegment=&Period=0&ShotClockRange=&VsConference=&VsDivision=&LeagueID=00&TwoWay=0`;
  const res = await fetch(url, { headers: NBA_HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const set = data.resultSets?.[0];
  if (!set) throw new Error('No resultSet');
  const h = set.headers;
  const map = new Map();
  for (const row of set.rowSet) {
    map.set(row[h.indexOf('PLAYER_ID')], {
      pts: +(row[h.indexOf('PTS')] ?? 0).toFixed(1),
      reb: +(row[h.indexOf('REB')] ?? 0).toFixed(1),
      ast: +(row[h.indexOf('AST')] ?? 0).toFixed(1),
      stl: +(row[h.indexOf('STL')] ?? 0).toFixed(1),
      blk: +(row[h.indexOf('BLK')] ?? 0).toFixed(1),
    });
  }
  return map;
}

async function fetchPlayer3PMTotals(season) {
  const url = `https://stats.nba.com/stats/leaguedashplayerstats?Season=${season}&SeasonType=Regular+Season&PerMode=Totals&MeasureType=Base&GameScope=&PlayerExperience=&PlayerPosition=&StarterBench=&LastNGames=0&Month=0&OpponentTeamID=0&PaceAdjust=N&PlusMinus=N&Rank=N&Conference=&Division=&DateFrom=&DateTo=&GameSegment=&Period=0&ShotClockRange=&VsConference=&VsDivision=&LeagueID=00&TwoWay=0`;
  const res = await fetch(url, { headers: NBA_HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const set = data.resultSets?.[0];
  if (!set) throw new Error('No totals resultSet');
  const h = set.headers;
  const map = new Map();
  for (const row of set.rowSet) {
    map.set(row[h.indexOf('PLAYER_ID')], row[h.indexOf('FG3M')] ?? 0);
  }
  return map;
}

async function fetchStandingsForSeason(season) {
  const url = `https://stats.nba.com/stats/leaguestandings?Season=${season}&SeasonType=Regular+Season&LeagueID=00`;
  const res = await fetch(url, { headers: NBA_HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const set = data.resultSets?.[0];
  if (!set) throw new Error('No standings resultSet');
  const h = set.headers;
  const map = new Map();
  for (const row of set.rowSet) {
    const nbaId = String(row[h.indexOf('TeamID')]);
    map.set(nbaId, {
      w: row[h.indexOf('WINS')] ?? row[h.indexOf('W')] ?? 0,
      l: row[h.indexOf('LOSSES')] ?? row[h.indexOf('L')] ?? 0,
    });
  }
  return map;
}

function seasonHasStats(seasonData) {
  for (const players of Object.values(seasonData)) {
    for (const p of (players || [])) {
      if (p.pts !== undefined) return true;
    }
  }
  return false;
}

// ── Load existing ────────────────────────────────────────────────────────────

const ROSTERS_OUT   = 'public/rosters.json';
const STANDINGS_OUT = 'public/standings.json';

let rosters   = existsSync(ROSTERS_OUT)   ? JSON.parse(readFileSync(ROSTERS_OUT,   'utf8')) : {};
let standings = existsSync(STANDINGS_OUT) ? JSON.parse(readFileSync(STANDINGS_OUT, 'utf8')) : {};

const existingSeasons = new Set(Object.keys(rosters));
console.log(`📂 rosters.json: ${existingSeasons.size} seasons | standings.json: ${Object.keys(standings).length} seasons\n`);

// ── Decide what to do ────────────────────────────────────────────────────────

const needsRosters   = STATS_ONLY ? [] : SEASONS_TO_CONSIDER.filter(s => !existingSeasons.has(s) || s === CURRENT_SEASON);
const needsStats     = SEASONS_TO_CONSIDER.filter(s => {
  if (!existingSeasons.has(s)) return false;
  if (s === CURRENT_SEASON) return true;
  if (STATS_ONLY) return true;
  return !seasonHasStats(rosters[s] || {});
});
const needsStandings = SEASONS_TO_CONSIDER.filter(s => s === CURRENT_SEASON || !standings[s]);

const allToProcess = new Set([...needsRosters, ...needsStats, ...needsStandings]);

if (TARGET_SEASON) {
  console.log(`🎯 --season ${TARGET_SEASON}: forced update`);
} else if (STATS_ONLY) {
  console.log(`📊 --stats-only: updating stats for ${needsStats.length} seasons + standings for ${needsStandings.length} seasons`);
} else {
  const missingStats = needsStats.filter(s => !seasonHasStats(rosters[s] || {}));
  console.log(`📋 Rosters: ${needsRosters.length ? needsRosters.join(', ') : 'all present'}`);
  console.log(`📊 Missing stats: ${missingStats.length ? missingStats.join(', ') : 'none'}`);
  console.log(`🏆 Standings: ${needsStandings.length} seasons to update`);
}
console.log('');

// ── Process ──────────────────────────────────────────────────────────────────

let totalFetched = 0, totalFailed = 0;

for (const season of SEASONS_TO_CONSIDER.filter(s => allToProcess.has(s) || TARGET_SEASON === s)) {
  console.log(`\n══ ${season} ══`);
  rosters[season]   = rosters[season]   || {};
  standings[season] = standings[season] || {};

  let statsMap = new Map(), totalsMap = new Map();

  if (needsStats.includes(season) || needsRosters.includes(season) || TARGET_SEASON) {
    process.stdout.write('  Stats (per game)... ');
    try {
      await delay(600); statsMap = await fetchPlayerStats(season);
      console.log(`✓ ${statsMap.size} players`);
    } catch (e) { console.log(`✗ ${e.message}`); }

    process.stdout.write('  3PM totals... ');
    try {
      await delay(600); totalsMap = await fetchPlayer3PMTotals(season);
      console.log(`✓ ${totalsMap.size} players`);
    } catch (e) { console.log(`✗ ${e.message}`); }
  }

  if (needsStandings.includes(season) || TARGET_SEASON) {
    process.stdout.write('  Standings... ');
    try {
      await delay(600);
      const map = await fetchStandingsForSeason(season);
      for (const [nbaId, wl] of map) {
        const teamId = NBA_ID_TO_TEAM_ID[nbaId];
        if (teamId) standings[season][teamId] = wl;
      }
      console.log(`✓ ${map.size} teams`);
    } catch (e) { console.log(`✗ ${e.message}`); }
  }

  if (needsRosters.includes(season)) {
    for (const [teamId, { nbaId, name }] of Object.entries(TEAMS)) {
      process.stdout.write(`  ${name}... `);
      try {
        await delay(500);
        const players = await fetchTeamRoster(nbaId, name, season);
        rosters[season][teamId] = players.map(p => {
          const s = statsMap.get(p.id);
          const fg3m = totalsMap.get(p.id) ?? 0;
          return s ? { ...p, ...s, fg3m } : p;
        });
        console.log(`✓ ${rosters[season][teamId].length} players`);
        totalFetched++;
      } catch (e) {
        rosters[season][teamId] = rosters[season][teamId] || [];
        console.log(`✗ ${e.message}`);
        totalFailed++;
      }
    }
  } else if (statsMap.size > 0) {
    // Merge stats into existing rosters
    process.stdout.write('  Merging stats into existing rosters... ');
    let count = 0;
    for (const [teamId, players] of Object.entries(rosters[season])) {
      rosters[season][teamId] = players.map(p => {
        const s = statsMap.get(p.id);
        const fg3m = totalsMap.get(p.id) ?? p.fg3m ?? 0;
        return s ? { ...p, ...s, fg3m } : p;
      });
      count += players.length;
    }
    console.log(`✓ ${count} players updated`);
  }
}

// ── Write ────────────────────────────────────────────────────────────────────

writeFileSync(ROSTERS_OUT,   JSON.stringify(rosters,   null, 2));
writeFileSync(STANDINGS_OUT, JSON.stringify(standings, null, 2));
console.log(`\n✅ Done. Rosters: ${totalFetched} fetched / ${totalFailed} failed`);
console.log(`📝 Written: ${ROSTERS_OUT} + ${STANDINGS_OUT} — commit and push to GitHub.`);
