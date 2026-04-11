const teamCache = {};

export async function fetchRoster(teamId) {
  if (teamCache[teamId]) return teamCache[teamId];

  try {
    const res = await fetch(`/api/roster?teamId=${teamId}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('Roster error:', err);
      return { error: 'FETCH_FAILED' };
    }
    const data = await res.json();
    const players = data.players || [];
    teamCache[teamId] = players;
    return players;
  } catch (err) {
    console.error('Failed to fetch roster:', err);
    return { error: 'FETCH_FAILED' };
  }
}
