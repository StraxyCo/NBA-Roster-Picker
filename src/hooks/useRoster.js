// Session cache to avoid re-fetching same team
const rosterCache = {};

const API_KEY = import.meta.env.VITE_BALLDONTLIE_KEY;

// 2024 = saison 2024-25
const SEASON = 2024;

export async function fetchRoster(teamId) {
  if (rosterCache[teamId]) return rosterCache[teamId];

  if (!API_KEY) return { error: 'NO_API_KEY' };

  // On récupère les stats de la saison en cours pour cette équipe.
  // Cela retourne uniquement les joueurs ayant effectivement joué cette année.
  // per_page=100 couvre largement un effectif complet (~15 joueurs actifs).
  const url = `https://api.balldontlie.io/nba/v1/stats?seasons[]=${SEASON}&team_ids[]=${teamId}&per_page=100`;

  try {
    const res = await fetch(url, { headers: { Authorization: API_KEY } });
    if (res.status === 401) return { error: 'INVALID_KEY' };
    if (!res.ok) throw new Error(`API error: ${res.status}`);

    const data = await res.json();

    // Dédoublonnage par player id (un joueur = plusieurs lignes de stats)
    const seen = new Set();
    const players = [];
    for (const entry of (data.data || [])) {
      const p = entry.player;
      if (!p || seen.has(p.id)) continue;
      // Exclure les joueurs de l'équipe adverse qui seraient remontés
      if (entry.team?.id !== teamId) continue;
      seen.add(p.id);
      players.push({
        id: p.id,
        name: `${p.first_name} ${p.last_name}`,
        position: p.position || '—',
      });
    }

    // Tri alphabétique par nom de famille
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
