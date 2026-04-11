import { Redis } from '@upstash/redis';
const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Map our internal team IDs → NBA.com team IDs
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

const NBA_HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://www.nba.com',
  'Referer': 'https://www.nba.com/',
  'x-nba-stats-origin': 'stats',
  'x-nba-stats-token': 'true',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

async function fetchTeamRoster(nbaId) {
  const url = `https://stats.nba.com/stats/commonteamroster?TeamID=${nbaId}&Season=2025-26`;
  const res = await fetch(url, { headers: NBA_HEADERS });
  if (!res.ok) throw new Error(`NBA API ${res.status} for team ${nbaId}`);

  const data = await res.json();
  const rosterSet = data.resultSets?.find(s => s.name === 'CommonTeamRoster');
  if (!rosterSet) throw new Error('Unexpected response shape');

  const h = rosterSet.headers;
  const nameIdx = h.indexOf('PLAYER');
  const posIdx  = h.indexOf('POSITION');
  const numIdx  = h.indexOf('NUM');
  const idIdx   = h.indexOf('PLAYER_ID');

  return rosterSet.rowSet.map((row, i) => ({
    id:       row[idIdx] ?? i,
    name:     row[nameIdx] ?? '—',
    position: row[posIdx] ?? '—',
    number:   row[numIdx] ?? '',
  }));
}

// Protect the endpoint with a secret so only Vercel cron (or you) can trigger it
export default async function handler(req, res) {
  const secret = req.headers['x-cron-secret'] || req.query.secret;
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const results = { success: [], failed: [] };

  for (const [teamId, team] of Object.entries(TEAMS)) {
    try {
      // Small delay between requests to avoid NBA.com rate limiting
      await new Promise(r => setTimeout(r, 400));
      const players = await fetchTeamRoster(team.nbaId);
      await kv.set(`roster:${teamId}`, players);
      results.success.push(team.name);
      console.log(`✓ ${team.name}: ${players.length} players`);
    } catch (err) {
      results.failed.push({ team: team.name, error: err.message });
      console.error(`✗ ${team.name}:`, err.message);
    }
  }

  await kv.set('rosters:last_synced', new Date().toISOString());

  return res.status(200).json({
    synced: results.success.length,
    failed: results.failed.length,
    details: results,
  });
}
