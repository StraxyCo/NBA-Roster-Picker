// node scripts/fetch-rosters.mjs                        → smart update (rosters + stats + standings)
// node scripts/fetch-rosters.mjs --stats-only           → only update stats & standings, no roster re-fetch
// node scripts/fetch-rosters.mjs --season 2012-13       → target a specific season only (rosters + stats + standings)
// node scripts/fetch-rosters.mjs --rebuild              → rebuild every season from scratch, ignoring what is cached
//
// Stats are fetched PER TEAM, not league-wide. leaguedashplayerstats filtered by
// TeamID returns only the games a player played for that team, so a player traded
// mid-season gets one entry per team, each holding that team's games and averages.
// Fetched league-wide (as this script used to do) the endpoint collapses him into a
// single row filed under the team he finished with, carrying his full-season totals —
// which made e.g. Kevin Durant the Suns' 2022-23 scoring leader on the strength of
// 39 games played for Brooklyn.
//
// Two notes on the endpoints:
//   • In a TeamID-filtered response, TEAM_ABBREVIATION still names the player's FINAL
//     team of the season, so the queried TeamID is the only trustworthy team key.
//   • commonteamroster returns the END-OF-SEASON roster, so it does not list players
//     the team traded away. It is still the only source of position and jersey number,
//     so membership is the union of the two endpoints: see buildTeamEntries.

import { writeFileSync, readFileSync, existsSync } from 'fs';

const CURRENT_SEASON = '2025-26';
const STATS_ONLY = process.argv.includes('--stats-only');
const REBUILD = process.argv.includes('--rebuild');

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

// stats.nba.com stalls rather than erroring when it throttles, so every call gets a
// timeout and a few backing-off retries; a whole-season run is ~60 requests and one
// silent hang would otherwise strand it.
async function fetchJson(url, attempts = 4) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: NBA_HEADERS, signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await delay(1500 * (i + 1));
    }
  }
  throw lastErr;
}

function resultRows(data, setName) {
  const set = setName ? data.resultSets?.find(s => s.name === setName) : data.resultSets?.[0];
  if (!set) throw new Error(`No resultSet${setName ? ` "${setName}"` : ''}`);
  const h = set.headers;
  const idx = Object.fromEntries(h.map((k, i) => [k, i]));
  return set.rowSet.map(row => ({ get: k => row[idx[k]] }));
}

// End-of-season roster: the only source of position and jersey number.
async function fetchTeamRoster(nbaId, season) {
  const data = await fetchJson(`https://stats.nba.com/stats/commonteamroster?TeamID=${nbaId}&Season=${season}`);
  return resultRows(data, 'CommonTeamRoster').map((r, i) => ({
    id: r.get('PLAYER_ID') ?? i,
    name: r.get('PLAYER') ?? '—',
    position: r.get('POSITION') ?? '—',
    number: r.get('NUM') ?? '',
  }));
}

// Season totals for the games this player played FOR THIS TEAM. Totals mode (rather
// than PerGame) because it carries the fg3m season total the games need, and dividing
// its totals by GP reproduces the PerGame endpoint's averages exactly — verified
// across a full team-season, so one request does the work of two.
async function fetchTeamPlayerStats(nbaId, season) {
  const url = `https://stats.nba.com/stats/leaguedashplayerstats?Season=${season}&SeasonType=Regular+Season&PerMode=Totals&MeasureType=Base&GameScope=&PlayerExperience=&PlayerPosition=&StarterBench=&LastNGames=0&Month=0&OpponentTeamID=0&PaceAdjust=N&PlusMinus=N&Rank=N&Conference=&Division=&DateFrom=&DateTo=&GameSegment=&Period=0&ShotClockRange=&VsConference=&VsDivision=&LeagueID=00&TwoWay=0&TeamID=${nbaId}`;
  const data = await fetchJson(url);
  const map = new Map();
  for (const r of resultRows(data)) {
    const gp = r.get('GP') ?? 0;
    const per = k => (gp > 0 ? +((r.get(k) ?? 0) / gp).toFixed(1) : 0);
    map.set(r.get('PLAYER_ID'), {
      name: r.get('PLAYER_NAME') ?? '—',
      stats: {
        pts: per('PTS'), reb: per('REB'), ast: per('AST'),
        stl: per('STL'), blk: per('BLK'), min: per('MIN'),
        gp,
        fg3m: r.get('FG3M') ?? 0,
      },
    });
  }
  return map;
}

// Membership is the union of the two endpoints:
//   • on the end-of-season roster AND has stats → full entry (the common case)
//   • on the roster, no stats → id/name/position/number only, as before: a signing who
//     never played keeps appearing in the roster-browsing games
//   • has stats but was traded away before season's end → full entry, with position
//     from the season-wide map and NO jersey number. No cheap endpoint gives a player's
//     number for a team he has left (Durant wore 7 in Brooklyn, 35 in Phoenix), and a
//     wrong number would feed the Jersey Guesser; '' is already skipped there.
function buildTeamEntries(rosterPlayers, statsByPlayerId, positionBySeason) {
  const entries = [];
  const onRoster = new Set();

  for (const p of rosterPlayers) {
    onRoster.add(p.id);
    const hit = statsByPlayerId.get(p.id);
    entries.push(hit ? { ...p, ...hit.stats } : p);
  }

  for (const [playerId, hit] of statsByPlayerId) {
    if (onRoster.has(playerId)) continue;
    entries.push({
      id: playerId,
      name: hit.name,
      position: positionBySeason.get(playerId) ?? '—',
      number: '',
      ...hit.stats,
    });
  }

  return entries;
}

async function fetchStandingsForSeason(season) {
  const data = await fetchJson(`https://stats.nba.com/stats/leaguestandings?Season=${season}&SeasonType=Regular+Season&LeagueID=00`);
  const map = new Map();
  for (const r of resultRows(data)) {
    map.set(String(r.get('TeamID')), {
      w: r.get('WINS') ?? r.get('W') ?? 0,
      l: r.get('LOSSES') ?? r.get('L') ?? 0,
    });
  }
  return map;
}

// A season built by the old league-wide path has no traded-player splits, so it is
// treated as needing a refetch just like a season with no stats at all.
function seasonHasSplitStats(seasonData) {
  const seen = new Set();
  for (const players of Object.values(seasonData)) {
    for (const p of (players || [])) {
      if (p.pts === undefined) continue;
      if (seen.has(p.id)) return true;   // same player on two teams → already split
      seen.add(p.id);
    }
  }
  // No stats, or stats with nobody doubled up (pre-split data). Every season since
  // 2005-06 had at least one in-season trade, so "nobody doubled up" means pre-split.
  return false;
}

// ── Load existing ────────────────────────────────────────────────────────────

const ROSTERS_OUT   = 'public/rosters.json';
const STANDINGS_OUT = 'public/standings.json';

let rosters   = (!REBUILD && existsSync(ROSTERS_OUT))   ? JSON.parse(readFileSync(ROSTERS_OUT,   'utf8')) : {};
let standings = (!REBUILD && existsSync(STANDINGS_OUT)) ? JSON.parse(readFileSync(STANDINGS_OUT, 'utf8')) : {};

console.log(`📂 rosters.json: ${Object.keys(rosters).length} seasons | standings.json: ${Object.keys(standings).length} seasons\n`);

// ── Decide what to do ────────────────────────────────────────────────────────

// Rosters and stats now come from the same per-team pass, so they are no longer
// decided separately: a season needs the pass if it is missing, in progress, still
// on pre-split data, or explicitly targeted.
const needsPass = SEASONS_TO_CONSIDER.filter(s =>
  REBUILD || TARGET_SEASON === s || !rosters[s] || s === CURRENT_SEASON || !seasonHasSplitStats(rosters[s])
);
const needsStandings = SEASONS_TO_CONSIDER.filter(s => REBUILD || TARGET_SEASON === s || s === CURRENT_SEASON || !standings[s]);

console.log(`📋 Seasons to fetch: ${needsPass.length ? needsPass.join(', ') : 'all up to date'}`);
console.log(`🏆 Standings to update: ${needsStandings.length}`);
if (STATS_ONLY) console.log('   (--stats-only has no effect now that stats and membership come from one pass)');
console.log('');

// ── Process ──────────────────────────────────────────────────────────────────

let teamsDone = 0, teamsFailed = 0;

function write() {
  writeFileSync(ROSTERS_OUT,   JSON.stringify(rosters,   null, 2));
  writeFileSync(STANDINGS_OUT, JSON.stringify(standings, null, 2));
}

for (const season of SEASONS_TO_CONSIDER) {
  if (!needsPass.includes(season) && !needsStandings.includes(season)) continue;
  console.log(`\n══ ${season} ══`);
  rosters[season]   = rosters[season]   || {};
  standings[season] = standings[season] || {};

  if (needsStandings.includes(season)) {
    process.stdout.write('  Standings... ');
    try {
      await delay(500);
      const map = await fetchStandingsForSeason(season);
      for (const [nbaId, wl] of map) {
        const teamId = NBA_ID_TO_TEAM_ID[nbaId];
        if (teamId) standings[season][teamId] = wl;
      }
      console.log(`✓ ${map.size} teams`);
    } catch (e) { console.log(`✗ ${e.message}`); }
  }

  if (!needsPass.includes(season)) continue;

  // Pass 1: end-of-season rosters, which also give the season-wide position map used
  // for players their team traded away.
  const rostersByTeam = new Map();
  const positionBySeason = new Map();
  for (const [teamId, { nbaId, name }] of Object.entries(TEAMS)) {
    process.stdout.write(`  roster ${name}... `);
    try {
      await delay(450);
      const players = await fetchTeamRoster(nbaId, season);
      rostersByTeam.set(teamId, players);
      for (const p of players) if (!positionBySeason.has(p.id)) positionBySeason.set(p.id, p.position);
      console.log(`✓ ${players.length}`);
    } catch (e) {
      rostersByTeam.set(teamId, []);
      console.log(`✗ ${e.message}`);
      teamsFailed++;
    }
  }

  // Pass 2: per-team stats, then merge.
  for (const [teamId, { nbaId, name }] of Object.entries(TEAMS)) {
    process.stdout.write(`  stats ${name}... `);
    try {
      await delay(450);
      const statsMap = await fetchTeamPlayerStats(nbaId, season);
      const entries = buildTeamEntries(rostersByTeam.get(teamId) || [], statsMap, positionBySeason);
      // An empty result means the request failed in a way that looked like success —
      // keep whatever was there rather than blanking a team-season.
      if (entries.length === 0 && (rosters[season][teamId] || []).length > 0) {
        console.log('✗ empty result, keeping previous');
        teamsFailed++;
        continue;
      }
      rosters[season][teamId] = entries;
      const extra = entries.filter(e => e.number === '' && e.gp !== undefined).length;
      console.log(`✓ ${entries.length}${extra ? ` (+${extra} traded away)` : ''}`);
      teamsDone++;
    } catch (e) {
      console.log(`✗ ${e.message}`);
      teamsFailed++;
    }
  }

  write();   // checkpoint after each season
}

write();
console.log(`\n✅ Done. Team-seasons: ${teamsDone} written / ${teamsFailed} failed`);
console.log(`📝 Written: ${ROSTERS_OUT} + ${STANDINGS_OUT} — commit and push to GitHub.`);
