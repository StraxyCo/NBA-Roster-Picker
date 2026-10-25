import { NBA_ID_TO_ABBR, getCurrentSeason, fetchResultSet } from './_nba.js';

const STATS = 'https://stats.nba.com/stats';

// public/careers.json is per-player career history — scripts/fetch-careers.mjs rebuilds it
// with one playercareerstats call per player (thousands of requests, ~500ms apart), which
// cannot run inside a serverless function. So we only rebuild the CURRENT season's slice,
// from three league-wide calls, in the same row shape careers.json uses:
//   { season, teamAbbr, gp, min, pts, reb, ast, stl, blk, fg3m }
// The frontend overlays that slice on top of the static file (src/hooks/useCareers.js), so
// every season before this one still comes from the committed file.
//
// This is a module, not a handler: api/sync-rosters.js calls syncCareers() on the weekly
// cron, and the leading underscore keeps Vercel from counting it against the project's
// serverless function budget.

// Everyone under contract this season, with the team they are on right now. This is also
// what gives us a row for a player who has not appeared in a game yet.
async function fetchLeaguePlayers(season) {
  const { rows, has, get } = await fetchResultSet(
    `${STATS}/playerindex?LeagueID=00&Season=${season}&Historical=0`,
    'PlayerIndex'
  );
  if (!has('PERSON_ID', 'TEAM_ID')) throw new Error('playerindex: missing PERSON_ID/TEAM_ID');

  const out = new Map();
  for (const row of rows) {
    const teamAbbr = NBA_ID_TO_ABBR[String(get(row, 'TEAM_ID', ''))];
    if (!teamAbbr) continue; // free agents and non-NBA teams

    const id = get(row, 'PERSON_ID');
    if (id === null) continue;
    const first = get(row, 'PLAYER_FIRST_NAME', '');
    const last  = get(row, 'PLAYER_LAST_NAME', '');
    out.set(String(id), { name: `${first} ${last}`.trim() || '—', teamAbbr });
  }
  return out;
}

function statsUrl(season, perMode) {
  return `${STATS}/leaguedashplayerstats?Season=${season}&SeasonType=Regular+Season&PerMode=${perMode}`
    + `&MeasureType=Base&LastNGames=0&Month=0&OpponentTeamID=0&PaceAdjust=N&PlusMinus=N&Rank=N`
    + `&Period=0&LeagueID=00&TwoWay=0`;
}

// Per-game averages, keyed by player id — the same fields and rounding as
// scripts/fetch-careers.mjs reads off playercareerstats with PerMode=PerGame.
async function fetchPerGame(season) {
  const { rows, get } = await fetchResultSet(statsUrl(season, 'PerGame'));
  const map = new Map();
  for (const row of rows) {
    map.set(String(get(row, 'PLAYER_ID')), {
      gp:  Number(get(row, 'GP', 0)),
      min: +Number(get(row, 'MIN', 0)).toFixed(1),
      pts: +Number(get(row, 'PTS', 0)).toFixed(1),
      reb: +Number(get(row, 'REB', 0)).toFixed(1),
      ast: +Number(get(row, 'AST', 0)).toFixed(1),
      stl: +Number(get(row, 'STL', 0)).toFixed(1),
      blk: +Number(get(row, 'BLK', 0)).toFixed(1),
    });
  }
  return map;
}

// fg3m in careers.json is a SEASON TOTAL (the grid's "150+ 3PM" categories compare against
// it), so it needs the Totals call rather than the per-game one.
async function fetch3pmTotals(season) {
  const { rows, get } = await fetchResultSet(statsUrl(season, 'Totals'));
  const map = new Map();
  for (const row of rows) map.set(String(get(row, 'PLAYER_ID')), Number(get(row, 'FG3M', 0)));
  return map;
}

export function buildCareersSlice(season, league, perGame, totals) {
  const players = {};
  const teams = new Set();
  for (const [id, { name, teamAbbr }] of league) {
    const stats = perGame.get(id) || { gp: 0, min: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0 };
    players[id] = {
      name,
      seasons: [{ season, teamAbbr, ...stats, fg3m: totals.get(id) ?? 0 }],
    };
    teams.add(teamAbbr);
  }
  return { players, teamCount: teams.size };
}

/**
 * Rebuild the current season's careers slice and publish it to `careers:current`.
 * Never throws: the roster sync that calls this must not fail because careers did.
 */
export async function syncCareers(kv, season = getCurrentSeason()) {
  try {
    const [league, perGame, totals] = await Promise.all([
      fetchLeaguePlayers(season),
      fetchPerGame(season),
      fetch3pmTotals(season),
    ]);

    const { players, teamCount } = buildCareersSlice(season, league, perGame, totals);
    const playerCount = Object.keys(players).length;

    // A partial answer from the NBA API would silently delete current-season career rows
    // for everyone it missed, so publish nothing unless the slice looks league-sized.
    if (teamCount < 25 || playerCount < 300) {
      throw new Error(`Only ${playerCount} players across ${teamCount} teams — refusing to publish`);
    }

    const syncedAt = new Date().toISOString();
    await Promise.all([
      kv.set('careers:current', { season, players }),
      kv.set('careers:sync_status', {
        ok: true, season, syncedAt, playerCount, teamCount, error: null,
      }),
    ]);

    console.log(`✓ careers ${season}: ${playerCount} players across ${teamCount} teams`);
    return { ok: true, season, syncedAt, playerCount, teamCount };
  } catch (err) {
    console.error('syncCareers failed:', err);
    // Record the failure but leave the last good slice in place.
    await kv.set('careers:sync_status', {
      ok: false, season, syncedAt: new Date().toISOString(), error: err.message,
    }).catch(() => {});
    return { ok: false, season, error: err.message };
  }
}
