const BASE = process.env.KV_REST_API_URL
const TOKEN = process.env.KV_REST_API_TOKEN

async function hgetall(key) {
  const res = await fetch(`${BASE}/hgetall/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
  const data = await res.json()
  if (!data.result || data.result.length === 0) return null
  const obj = {}
  for (let i = 0; i < data.result.length; i += 2) {
    obj[data.result[i]] = data.result[i + 1]
  }
  return obj
}

async function hget(key, field) {
  const res = await fetch(`${BASE}/hget/${encodeURIComponent(key)}/${encodeURIComponent(field)}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
  const data = await res.json()
  return data.result
}

async function hset(key, field, value) {
  await fetch(`${BASE}/hset/${encodeURIComponent(key)}/${encodeURIComponent(field)}/${encodeURIComponent(value)}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
}

async function hdel(key, field) {
  await fetch(`${BASE}/hdel/${encodeURIComponent(key)}/${encodeURIComponent(field)}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
}

// Migrate flat schema → nested stats on read (backward compatible)
function normalizePlayer(raw) {
  const p = typeof raw === 'string' ? JSON.parse(raw) : { ...raw }
  if (!p.stats) {
    p.stats = {
      rosterPicker:  { played: p.gamesPlayed || 0,       wins: p.wins || 0 },
      jerseyGuesser: { played: p.jerseyGamesPlayed || 0, wins: p.jerseyWins || 0 },
    }
    delete p.gamesPlayed
    delete p.wins
    delete p.jerseyGamesPlayed
    delete p.jerseyWins
  }
  // Migrate stale flat whoHasMore fields that may exist alongside p.stats
  if (p.whoHasMoreGamesPlayed !== undefined || p.whoHasMoreWins !== undefined) {
    if (!p.stats.whoHasMore) p.stats.whoHasMore = { played: 0, wins: 0 }
    p.stats.whoHasMore.played += p.whoHasMoreGamesPlayed || 0
    p.stats.whoHasMore.wins += p.whoHasMoreWins || 0
    delete p.whoHasMoreGamesPlayed
    delete p.whoHasMoreWins
  }
  return p
}

function totalPlayed(player) {
  return Object.values(player.stats || {}).reduce((sum, g) => sum + (g.played || 0), 0)
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  try {
    if (req.method === 'GET') {
      const raw = await hgetall('players')
      if (!raw) return res.status(200).json([])
      const players = Object.entries(raw).map(([id, val]) => ({
        id,
        ...normalizePlayer(val),
      }))
      players.sort((a, b) => totalPlayed(b) - totalPlayed(a))
      return res.status(200).json(players)
    }

    if (req.method === 'POST') {
      const { name } = req.body
      if (!name?.trim()) return res.status(400).json({ error: 'Name required' })
      const id = Date.now().toString()
      const player = { name: name.trim(), stats: {} }
      await hset('players', id, JSON.stringify(player))
      return res.status(201).json({ id, ...player })
    }

    if (req.method === 'PUT') {
      const { id, name } = req.body
      if (!id || !name?.trim()) return res.status(400).json({ error: 'id and name required' })
      const raw = await hget('players', id)
      if (!raw) return res.status(404).json({ error: 'Player not found' })
      const player = normalizePlayer(raw)
      player.name = name.trim()
      await hset('players', id, JSON.stringify(player))
      return res.status(200).json({ id, ...player })
    }

    if (req.method === 'DELETE') {
      const { id } = req.query
      if (!id) return res.status(400).json({ error: 'id required' })
      await hdel('players', id)
      return res.status(200).json({ ok: true })
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('[players] error:', err.message)
    res.status(500).json({ error: err.message })
  }
}
