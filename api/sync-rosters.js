import { Redis } from '@upstash/redis';
import { TEAMS, NBA_ID_TO_TEAM_ID, getCurrentSeason, fetchResultSet } from './_nba.js';
import { syncCareers } from './_careers.js';

const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const STATS = 'https://stats.nba.com/stats';

// Every roster is built from four league-wide calls rather than one call per team:
// 30 sequential team requests do not fit inside a serverless function's time budget.

// All players under contract this season, including ones who have not played a game yet.
async function fetchLeagueRosters(season) {
  const { rows, has, get } = await fetchResultSet(
    `${STATS}/playerindex?LeagueID=00&Season=${season}&Historical=0`,
    'PlayerIndex'
  );
  if (!has('PERSON_ID', 'TEAM_ID')) throw new Error('playerindex: missing PERSON_ID/TEAM_ID');

  const byTeam = {};
  for (const row of rows) {
    const teamId = NBA_ID_TO_TEAM_ID[String(get(row, 'TEAM_ID', ''))];
    if (!teamId) continue; // free agents and non-NBA teams

    const first = get(row, 'PLAYER_FIRST_NAME', '');
    const last  = get(row, 'PLAYER_LAST_NAME', '');
    (byTeam[teamId] ||= []).push({
      id:       get(row, 'PERSON_ID'),
      name:     `${first} ${last}`.trim() || '—',
      position: get(row, 'POSITION', '—') || '—',
      number:   String(get(row, 'JERSEY_NUMBER', '') ?? ''),
    });
  }
  return byTeam;
}

// Per-game averages, keyed by player id. Same endpoint and fields as scripts/fetch-rosters.mjs.
async function fetchPerGameStats(season) {
  const { rows, get } = await fetchResultSet(
    `${STATS}/leaguedashplayerstats?Season=${season}&SeasonType=Regular+Season&PerMode=PerGame`
    + `&MeasureType=Base&LastNGames=0&Month=0&OpponentTeamID=0&PaceAdjust=N&PlusMinus=N&Rank=N`
    + `&Period=0&LeagueID=00&TwoWay=0`
  );
  const map = new Map();
  for (const row of rows) {
    map.set(get(row, 'PLAYER_ID'), {
      pts: +Number(get(row, 'PTS', 0)).toFixed(1),
      reb: +Number(get(row, 'REB', 0)).toFixed(1),
      ast: +Number(get(row, 'AST', 0)).toFixed(1),
      stl: +Number(get(row, 'STL', 0)).toFixed(1),
      blk: +Number(get(row, 'BLK', 0)).toFixed(1),
      min: +Number(get(row, 'MIN', 0)).toFixed(1),
      gp:  Number(get(row, 'GP', 0)),
    });
  }
  return map;
}

// Season 3PM totals (the per-game call only carries the average).
async function fetch3pmTotals(season) {
  const { rows, get } = await fetchResultSet(
    `${STATS}/leaguedashplayerstats?Season=${season}&SeasonType=Regular+Season&PerMode=Totals`
    + `&MeasureType=Base&LastNGames=0&Month=0&OpponentTeamID=0&PaceAdjust=N&PlusMinus=N&Rank=N`
    + `&Period=0&LeagueID=00&TwoWay=0`
  );
  const map = new Map();
  for (const row of rows) map.set(get(row, 'PLAYER_ID'), Number(get(row, 'FG3M', 0)));
  return map;
}

async function fetchStandings(season) {
  const { rows, get } = await fetchResultSet(
    `${STATS}/leaguestandings?Season=${season}&SeasonType=Regular+Season&LeagueID=00`
  );
  const byTeam = {};
  for (const row of rows) {
    const teamId = NBA_ID_TO_TEAM_ID[String(get(row, 'TeamID', ''))];
    if (!teamId) continue;
    byTeam[teamId] = {
      w: Number(get(row, 'WINS', get(row, 'W', 0))),
      l: Number(get(row, 'LOSSES', get(row, 'L', 0))),
    };
  }
  return byTeam;
}

// Vercel cron sends `Authorization: Bearer $CRON_SECRET`; the header/query forms are
// kept so the endpoint can still be triggered by hand.
function isAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return bearer === secret
    || req.headers['x-cron-secret'] === secret
    || req.query?.secret === secret;
}

export default async function handler(req, res) {
  if (!process.env.CRON_SECRET) {
    return res.status(500).json({ error: 'CRON_SECRET is not configured' });
  }
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const season = req.query?.season || getCurrentSeason();

  try {
    const [teams, perGame, totals, standings] = await Promise.all([
      fetchLeagueRosters(season),
      fetchPerGameStats(season),
      fetch3pmTotals(season),
      fetchStandings(season),
    ]);

    let playerCount = 0;
    for (const [teamId, players] of Object.entries(teams)) {
      teams[teamId] = players
        .map(p => ({ ...p, ...(perGame.get(p.id) || {}), fg3m: totals.get(p.id) ?? 0 }))
        .sort((a, b) => a.name.localeCompare(b.name));
      playerCount += teams[teamId].length;
    }

    const missing = Object.keys(TEAMS).filter(id => !teams[id]?.length);
    if (missing.length > 10) {
      throw new Error(`Only ${30 - missing.length}/30 teams had players — refusing to publish`);
    }

    const syncedAt = new Date().toISOString();
    await Promise.all([
      kv.set('rosters:current', { season, teams }),
      kv.set('standings:current', { season, teams: standings }),
      kv.set('rosters:sync_status', {
        ok: true, season, syncedAt, playerCount,
        teamCount: 30 - missing.length,
        missingTeams: missing,
        error: null,
      }),
    ]);

    console.log(`✓ ${season}: ${playerCount} players across ${30 - missing.length} teams`);

    // The same weekly run refreshes the current season's slice of careers.json. It writes
    // its own Redis keys and returns its result rather than throwing, so a careers failure
    // cannot lose the rosters we just published.
    const careers = await syncCareers(kv, season);

    return res.status(200).json({ ok: true, season, syncedAt, playerCount, missingTeams: missing, careers });
  } catch (err) {
    console.error('sync-rosters failed:', err);
    // Record the failure but leave the last good slice in place.
    await kv.set('rosters:sync_status', {
      ok: false, season, syncedAt: new Date().toISOString(), error: err.message,
    }).catch(() => {});
    return res.status(502).json({ ok: false, season, error: err.message });
  }
}
