import { Redis } from '@upstash/redis';
import { TEAMS, NBA_ID_TO_TEAM_ID, getCurrentSeason, fetchResultSet } from './_nba.js';
import { syncCareers } from './_careers.js';

const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const STATS = 'https://stats.nba.com/stats';

// Every roster is built from three league-wide calls rather than one call per team:
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

// Stats PER TEAM, keyed "<playerId>:<teamId>", so a player traded mid-season gets one
// line per team holding only the games he played there — the same split that
// scripts/fetch-rosters.mjs writes into rosters.json.
//
// This has to be the game logs rather than leaguedashplayerstats. That endpoint only
// splits by team when it is called once PER team (30 calls, which do not fit the time
// budget); called league-wide it collapses a traded player into a single row filed
// under the team he finished with, carrying his full-season totals. The game logs are
// one call for the whole league and aggregate to exactly the same per-team numbers.
async function fetchPerTeamStats(season) {
  const { rows, has, get } = await fetchResultSet(
    `${STATS}/playergamelogs?Season=${season}&SeasonType=Regular+Season&LeagueID=00`
  );
  if (!has('PLAYER_ID', 'TEAM_ID')) throw new Error('playergamelogs: missing PLAYER_ID/TEAM_ID');

  const SUMMED = ['PTS', 'REB', 'AST', 'STL', 'BLK', 'MIN', 'FG3M'];
  const totals = new Map();
  for (const row of rows) {
    const teamId = NBA_ID_TO_TEAM_ID[String(get(row, 'TEAM_ID', ''))];
    if (!teamId) continue;
    const playerId = get(row, 'PLAYER_ID');
    const key = `${playerId}:${teamId}`;
    let acc = totals.get(key);
    if (!acc) {
      acc = { playerId, teamId, name: get(row, 'PLAYER_NAME', '—') || '—', gp: 0 };
      for (const k of SUMMED) acc[k] = 0;
      totals.set(key, acc);
    }
    acc.gp++;
    for (const k of SUMMED) acc[k] += Number(get(row, k, 0));
  }

  // fg3m stays a season total; everything else becomes a per-game average.
  const map = new Map();
  for (const [key, acc] of totals) {
    const per = k => +(acc[k] / acc.gp).toFixed(1);
    map.set(key, {
      playerId: acc.playerId, teamId: acc.teamId, name: acc.name,
      stats: {
        pts: per('PTS'), reb: per('REB'), ast: per('AST'),
        stl: per('STL'), blk: per('BLK'), min: per('MIN'),
        gp: acc.gp,
        fg3m: acc.FG3M,
      },
    });
  }
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
    const [teams, perTeam, standings] = await Promise.all([
      fetchLeagueRosters(season),
      fetchPerTeamStats(season),
      fetchStandings(season),
    ]);

    // playerindex lists a player only under the team he is on NOW, so a traded player
    // is missing from his former team. His position still comes from there.
    const positionById = new Map();
    for (const players of Object.values(teams)) {
      for (const p of players) if (!positionById.has(p.id)) positionById.set(p.id, p.position);
    }

    let playerCount = 0;
    for (const teamId of Object.keys(TEAMS)) {
      const players = teams[teamId] || [];
      const onRoster = new Set(players.map(p => p.id));
      const merged = players.map(p => ({ ...p, ...(perTeam.get(`${p.id}:${teamId}`)?.stats || {}) }));

      // Anyone who played for this team and has since moved on. No endpoint reports the
      // jersey he wore here, so it is left blank rather than carrying his current one.
      for (const entry of perTeam.values()) {
        if (entry.teamId !== teamId || onRoster.has(entry.playerId)) continue;
        merged.push({
          id: entry.playerId,
          name: entry.name,
          position: positionById.get(entry.playerId) ?? '—',
          number: '',
          ...entry.stats,
        });
      }

      if (!merged.length) continue;
      teams[teamId] = merged.sort((a, b) => a.name.localeCompare(b.name));
      playerCount += merged.length;
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
