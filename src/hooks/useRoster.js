// Cache to avoid re-fetching same team in a session
const rosterCache = {};

export async function fetchRoster(teamId, apiKey) {
  if (rosterCache[teamId]) return rosterCache[teamId];

  const headers = apiKey ? { Authorization: apiKey } : {};

  // Fetch players for this team — we get all active players associated with the team
  const url = `https://api.balldontlie.io/v1/players?team_ids[]=${teamId}&per_page=100`;

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();

    const players = (data.data || []).map((p) => ({
      id: p.id,
      name: `${p.first_name} ${p.last_name}`,
      position: p.position || "—",
    }));

    rosterCache[teamId] = players;
    return players;
  } catch (err) {
    console.error("Failed to fetch roster:", err);
    return [];
  }
}
