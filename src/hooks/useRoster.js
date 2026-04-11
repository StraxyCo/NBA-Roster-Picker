// Session cache to avoid re-fetching same team
const rosterCache = {};

export async function fetchRoster(teamId) {
  if (rosterCache[teamId]) return rosterCache[teamId];

  try {
    // Calls our own Vercel serverless function (api/roster.js)
    // which proxies to NBA.com — no API key needed
    const res = await fetch(`/api/roster?teamId=${teamId}`);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('Roster error:', err);
      return { error: 'FETCH_FAILED' };
    }

    const data = await res.json();
    const players = data.players || [];

    rosterCache[teamId] = players;
    return players;
  } catch (err) {
    console.error('Failed to fetch roster:', err);
    return { error: 'FETCH_FAILED' };
  }
}
