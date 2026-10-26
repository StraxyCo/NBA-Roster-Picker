import { Redis } from '@upstash/redis';

const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Public read of the current-season slices written by the weekly cron. An empty response
// just means "use the static data", so neither client treats it as an error.
//
// `?kind=careers` serves the careers slice (api/_careers.js → src/hooks/useCareers.js) and
// anything else serves the roster slice (api/sync-rosters.js → src/hooks/useRoster.js), in
// the same shape as one season of public/rosters.json. Two reads share one endpoint because
// the Vercel Hobby plan caps a deployment at 12 serverless functions and this project is
// exactly at it; the query param keeps each client from downloading the other's payload.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  if (req.query?.kind === 'careers') return serveCareers(res);

  try {
    const [rosters, standings, status] = await Promise.all([
      kv.get('rosters:current'),
      kv.get('standings:current'),
      kv.get('rosters:sync_status'),
    ]);

    if (!rosters?.season || !rosters?.teams) {
      // Nothing synced yet — not an error, the client falls back to the static file.
      return res.status(200).json({});
    }

    // Served from the edge so a visitor never waits on Redis.
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({
      season: rosters.season,
      teams: rosters.teams,
      standings: standings?.season === rosters.season ? standings.teams : null,
      syncedAt: status?.syncedAt ?? null,
    });
  } catch (err) {
    console.error('current-rosters failed:', err);
    return res.status(200).json({});
  }
}

async function serveCareers(res) {
  try {
    const [careers, status] = await Promise.all([
      kv.get('careers:current'),
      kv.get('careers:sync_status'),
    ]);

    if (!careers?.season || !careers?.players) return res.status(200).json({});

    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({
      season: careers.season,
      players: careers.players,
      syncedAt: status?.syncedAt ?? null,
    });
  } catch (err) {
    console.error('current-rosters?kind=careers failed:', err);
    return res.status(200).json({});
  }
}
