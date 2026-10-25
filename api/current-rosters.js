import { Redis } from '@upstash/redis';

const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Public read of the current-season slice written by api/sync-rosters.js, in the same
// shape as one season of public/rosters.json. The frontend overlays this on the static
// file (see src/hooks/useRoster.js), so an empty response just means "use the static data".
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

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
