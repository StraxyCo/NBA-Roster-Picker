import { Redis } from '@upstash/redis';
const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { teamId } = req.query;
  if (!teamId) return res.status(400).json({ error: 'Missing teamId' });

  try {
    const players = await kv.get(`roster:${teamId}`);
    if (!players) {
      return res.status(404).json({ error: 'Roster not found. Run /api/sync-rosters first.' });
    }
    return res.status(200).json({ players });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'KV error' });
  }
}
