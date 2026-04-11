// Cache to avoid re-fetching same team in a session
const rosterCache = {};

// Current NBA season (2024 = the 2024-25 season)
const CURRENT_SEASON = 2024;

export async function fetchRoster(teamId, apiKey) {
  if (rosterCache[teamId]) return rosterCache[teamId];

  const headers = apiKey ? { Authorization: apiKey } : {};

  // Use season averages endpoint — this reliably returns only players
  // who actually played for the team this season, not historical records.
  // We fetch two pages to cover full rosters (some teams have 20+ entries).
  const base = `https://api.balldontlie.io/nba/v1/season_averages/general?season=${CURRENT_SEASON}&season_type=regular&type=base&team_ids[]=${teamId}&per_page=100`;

  try {
    const res = await fetch(base, { headers });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();

    // Deduplicate by player id (a player may appear multiple times if traded)
    const seen = new Set();
    const players = [];
    for (const entry of (data.data || [])) {
      const p = entry.player;
      if (!p || seen.has(p.id)) continue;
      seen.add(p.id);
      players.push({
        id: p.id,
        name: `${p.first_name} ${p.last_name}`,
        position: p.position || "—",
      });
    }

    // Sort alphabetically by last name
    players.sort((a, b) => {
      const la = a.name.split(' ').slice(-1)[0];
      const lb = b.name.split(' ').slice(-1)[0];
      return la.localeCompare(lb);
    });

    rosterCache[teamId] = players;
    return players;
  } catch (err) {
    console.error("Failed to fetch roster:", err);
    return [];
  }
}
