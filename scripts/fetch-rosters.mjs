// node scripts/fetch-rosters.mjs                        → smart update (rosters + stats + standings)
// node scripts/fetch-rosters.mjs --stats-only           → only update stats & standings, no roster re-fetch
// node scripts/fetch-rosters.mjs --season 2012-13       → target a specific season only (rosters + stats + standings)
// node scripts/fetch-rosters.mjs --stats-only --season 2012-13 → stats & standings for one season only

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { TEAMS, NBA_ID_TO_TEAM_ID, NBA_HEADERS, getCurrentSeason } from '../api/_nba.js';

const CURRENT_SEASON = getCurrentSeason();
const STATS_ONLY = process.argv.includes('--stats-only');

// Parse --season XXXX-XX argument
const seasonArgIdx = process.argv.indexOf('--season');
const TARGET_SEASON = seasonArgIdx !== -1 ? process.argv[seasonArgIdx + 1] : null;

const FIRST_SEASON_YEAR = 2005;
const ALL_SEASONS = [];
for (let y = FIRST_SEASON_YEAR; y <= Number(CURRENT_SEASON.slice(0, 4)); y++) {
  ALL_SEASONS.push(`${y}-${String((y + 1) % 100).padStart(2, '0')}`);
}

// When --season is used, only process that one season
const SEASONS_TO_CONSIDER = TARGET_SEASON
  ? (ALL_SEASONS.includes(TARGET_SEASON)
      ? [TARGET_SEASON]
      : (() => { console.error(`❌ Unknown season: "${TARGET_SEASON}". Valid: ${ALL_SEASONS.join(', ')}`); process.exit(1) })())
  : ALL_SEASONS;

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
      min: +(row[h.indexOf('MIN')] ?? 0).toFixed(1),
      gp: row[h.indexOf('GP')] ?? 0,
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
