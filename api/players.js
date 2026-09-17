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

async function redisGet(key) {
  const res = await fetch(`${BASE}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
  return (await res.json()).result
}

async function redisSet(key, value) {
  await fetch(`${BASE}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
}

// Game-record stores for games added after Vercel's 12-function limit was reached
// (folded in here, like gameDefaults, instead of a new serverless function).
// Keyed by the player-stats key the game uses → the Redis list key.
const GAME_RECORD_KEYS = {
  whoDidTheyHave: 'who-did-they-have-games',
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
    // Game records for games folded in here (see GAME_RECORD_KEYS): same contract
    // as the dedicated /api/<game>-games endpoints, addressed by
    // ?scope=games&game=<statsKey>.
    if (req.query.scope === 'games') {
      const game = req.method === 'POST' ? req.body?.game : req.query.game
      const storeKey = GAME_RECORD_KEYS[game]
      if (!storeKey) return res.status(400).json({ error: 'unknown game' })

      const raw = await redisGet(storeKey)
      let games = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : []

      if (req.method === 'GET') {
        games.sort((a, b) => b.date - a.date)
        return res.status(200).json(games)
      }

      if (req.method === 'POST') {
        const { playerIds, playerNames, winnerId, winnerName } = req.body || {}
        if (!playerIds?.length) return res.status(400).json({ error: 'playerIds required' })
        const newGame = { id: Date.now().toString(), date: Date.now(), playerIds, playerNames, winnerId, winnerName }
        games.push(newGame)
        await redisSet(storeKey, JSON.stringify(games))
        for (const pid of playerIds) {
          const pRaw = await hget('players', pid)
          if (!pRaw) continue
          const player = normalizePlayer(pRaw)
          if (!player.stats[game]) player.stats[game] = { played: 0, wins: 0 }
          player.stats[game].played++
          if (pid === winnerId) player.stats[game].wins++
          await hset('players', pid, JSON.stringify(player))
        }
        return res.status(201).json(newGame)
      }

      if (req.method === 'DELETE') {
        const { id } = req.query
        if (!id) return res.status(400).json({ error: 'id required' })
        const record = games.find(g => g.id === id)
        if (!record) return res.status(404).json({ error: 'Game not found' })
        for (const pid of (record.playerIds || [])) {
          const pRaw = await hget('players', pid)
          if (!pRaw) continue
          const player = normalizePlayer(pRaw)
          if (!player.stats[game]) player.stats[game] = { played: 0, wins: 0 }
          player.stats[game].played = Math.max(0, player.stats[game].played - 1)
          if (pid === record.winnerId) player.stats[game].wins = Math.max(0, player.stats[game].wins - 1)
          await hset('players', pid, JSON.stringify(player))
        }
        games = games.filter(g => g.id !== id)
        await redisSet(storeKey, JSON.stringify(games))
        return res.status(200).json({ ok: true })
      }

      return res.status(405).json({ error: 'Method not allowed' })
    }

    // Per-game default settings live in the `gameDefaults` hash (folded in here to
    // stay under Vercel's 12-function limit). GET ?scope=defaults&game=X / POST {game,config}.
    if (req.query.scope === 'defaults') {
      if (req.method === 'GET') {
        const { game } = req.query
        if (!game) return res.status(400).json({ error: 'game required' })
        const raw = await hget('gameDefaults', game)
        const config = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null
        return res.status(200).json({ game, config })
      }
      if (req.method === 'POST') {
        const { game, config } = req.body || {}
        if (!game || config == null) return res.status(400).json({ error: 'game and config required' })
        await hset('gameDefaults', game, JSON.stringify(config))
        return res.status(200).json({ ok: true })
      }
      return res.status(405).json({ error: 'Method not allowed' })
    }

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
