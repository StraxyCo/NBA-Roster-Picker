const { Redis } = require('@upstash/redis')

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
})

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  try {
    if (req.method === 'GET') {
      const raw = await redis.hgetall('players')
      if (!raw) return res.status(200).json([])
      const players = Object.entries(raw).map(([id, val]) => ({
        id,
        ...(typeof val === 'string' ? JSON.parse(val) : val),
      }))
      players.sort((a, b) => (b.gamesPlayed || 0) - (a.gamesPlayed || 0))
      return res.status(200).json(players)
    }

    if (req.method === 'POST') {
      const { name } = req.body
      if (!name?.trim()) return res.status(400).json({ error: 'Name required' })
      const id = Date.now().toString()
      const player = { name: name.trim(), gamesPlayed: 0, wins: 0 }
      await redis.hset('players', { [id]: JSON.stringify(player) })
      return res.status(201).json({ id, ...player })
    }

    if (req.method === 'PUT') {
      const { id, name } = req.body
      if (!id || !name?.trim()) return res.status(400).json({ error: 'id and name required' })
      const raw = await redis.hget('players', id)
      if (!raw) return res.status(404).json({ error: 'Player not found' })
      const player = typeof raw === 'string' ? JSON.parse(raw) : raw
      player.name = name.trim()
      await redis.hset('players', { [id]: JSON.stringify(player) })
      return res.status(200).json({ id, ...player })
    }

    if (req.method === 'DELETE') {
      const { id } = req.query
      if (!id) return res.status(400).json({ error: 'id required' })
      await redis.hdel('players', id)
      return res.status(200).json({ ok: true })
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('Players API error:', err)
    res.status(500).json({ error: err.message })
  }
}
