// Session cache to avoid re-fetching same team
const rosterCache = {};

// Key is injected at build time via Vite env variable.
// Set VITE_BALLDONTLIE_KEY in your Vercel environment settings.
const API_KEY = import.meta.env.VITE_BALLDONTLIE_KEY;

export async function fetchRoster(teamId) {
  if (rosterCache[teamId]) return rosterCache[teamId];

  if (!API_KEY) {
    return { error: 'NO_API_KEY' };
  }

  // /nba/v1/players is available on the free tier and supports team_ids[] filtering.
  // Note: this is the NEW base URL (nba.balldontlie.io path), not the old /v1/players.
  const url = `https://api.balldontlie.io/nba/v1/players?team_ids[]=${teamId}&per_page=100`;

  try {
    const res = await fetch(url, { headers: { Authorization: API_KEY } });

    if (res.status === 401) return { error: 'INVALID_KEY' };
    if (!res.ok) throw new Error(`API error: ${res.status}`);

    const data = await res.json();

    const players = (data.data || []).map((p) => ({
      id: p.id,
      name: `${p.first_name} ${p.last_name}`,
      position: p.position || '—',
    }));

    players.sort((a, b) => {
      const la = a.name.split(' ').slice(-1)[0];
      const lb = b.name.split(' ').slice(-1)[0];
      return la.localeCompare(lb);
    });

    rosterCache[teamId] = players;
    return players;
  } catch (err) {
    console.error('Failed to fetch roster:', err);
    return { error: 'FETCH_FAILED' };
  }
}
