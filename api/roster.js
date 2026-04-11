// api/roster.js — Vercel Serverless Function
// Proxies requests to the official NBA.com stats API (no key needed)
// Called from the frontend as: /api/roster?teamId=1610612737

export default async function handler(req, res) {
  // CORS headers so the frontend can call this
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { teamId } = req.query;
  if (!teamId) {
    return res.status(400).json({ error: 'Missing teamId' });
  }

  // NBA.com uses its own team ID format (10-digit).
  // We receive our internal BallDontLie-style ID and map it to NBA.com's.
  const NBA_TEAM_IDS = {
    1:  '1610612737', // Atlanta Hawks
    2:  '1610612738', // Boston Celtics
    4:  '1610612751', // Brooklyn Nets
    5:  '1610612766', // Charlotte Hornets
    6:  '1610612741', // Chicago Bulls
    7:  '1610612739', // Cleveland Cavaliers
    8:  '1610612742', // Dallas Mavericks
    9:  '1610612743', // Denver Nuggets
    10: '1610612765', // Detroit Pistons
    11: '1610612744', // Golden State Warriors
    14: '1610612745', // Houston Rockets
    15: '1610612754', // Indiana Pacers
    16: '1610612746', // LA Clippers
    17: '1610612747', // Los Angeles Lakers
    19: '1610612763', // Memphis Grizzlies
    20: '1610612748', // Miami Heat
    21: '1610612749', // Milwaukee Bucks
    22: '1610612750', // Minnesota Timberwolves
    23: '1610612740', // New Orleans Pelicans
    24: '1610612752', // New York Knicks
    25: '1610612760', // Oklahoma City Thunder
    26: '1610612753', // Orlando Magic
    27: '1610612755', // Philadelphia 76ers
    28: '1610612756', // Phoenix Suns
    29: '1610612757', // Portland Trail Blazers
    30: '1610612758', // Sacramento Kings
    31: '1610612759', // San Antonio Spurs
    38: '1610612761', // Toronto Raptors
    40: '1610612762', // Utah Jazz
    41: '1610612764', // Washington Wizards
  };

  const nbaId = NBA_TEAM_IDS[parseInt(teamId)];
  if (!nbaId) {
    return res.status(400).json({ error: `Unknown teamId: ${teamId}` });
  }

  const url = `https://stats.nba.com/stats/commonteamroster?TeamID=${nbaId}&Season=2024-25`;

  try {
    const response = await fetch(url, {
      headers: {
        // NBA.com requires these headers or it returns 403
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://www.nba.com',
        'Referer': 'https://www.nba.com/',
        'x-nba-stats-origin': 'stats',
        'x-nba-stats-token': 'true',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `NBA API error: ${response.status}` });
    }

    const data = await response.json();

    // NBA.com returns data as resultSets — parse the CommonTeamRoster set
    const rosterSet = data.resultSets?.find(s => s.name === 'CommonTeamRoster');
    if (!rosterSet) {
      return res.status(500).json({ error: 'Unexpected NBA API response shape' });
    }

    const headers = rosterSet.headers; // e.g. ["TeamID","SEASON","LeagueID","PLAYER","NICKNAME","PLAYER_SLUG","NUM","POSITION","HEIGHT","WEIGHT",...]
    const playerIdx  = headers.indexOf('PLAYER');
    const posIdx     = headers.indexOf('POSITION');
    const numIdx     = headers.indexOf('NUM');
    const playerIdIdx = headers.indexOf('PLAYER_ID');

    const players = rosterSet.rowSet.map((row, i) => ({
      id: row[playerIdIdx] ?? i,
      name: row[playerIdx] ?? '—',
      position: row[posIdx] ?? '—',
      number: row[numIdx] ?? '',
    }));

    // Sort by jersey number numerically, then alphabetically
    players.sort((a, b) => {
      const na = parseInt(a.number);
      const nb = parseInt(b.number);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.name.localeCompare(b.name);
    });

    return res.status(200).json({ players });
  } catch (err) {
    console.error('Roster fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch roster' });
  }
}
