import { Redis } from '@upstash/redis';

const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Public read of the current-season career slice written by api/sync-careers.js, in the
// same row shape as one season inside public/careers.json. The frontend overlays this on
// the static file (see src/hooks/useCareers.js), so an empty response just means
// "use the static data".
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const [careers, status] = await Promise.all([
      kv.get('careers:current'),
      kv.get('careers:sync_status'),
    ]);

    if (!careers?.season || !careers?.players) {
      // Nothing synced yet — not an error, the client falls back to the static file.
      return res.status(200).json({});
    }

    // Served from the edge so a visitor never waits on Redis.
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({
      season: careers.season,
      players: careers.players,
      syncedAt: status?.syncedAt ?? null,
    });
  } catch (err) {
    console.error('current-careers failed:', err);
    return res.status(200).json({});
  }
}
