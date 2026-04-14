const { Redis } = require('@upstash/redis')

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
})

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  try {
    if (req.method === 'GET') {
      const raw = await redis.get('games')
      const games = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : []
      games.sort((a, b) => b.date - a.date)
      return res.status(200).json(games)
    }

    if (req.method === 'POST') {
      const { playerIds, playerNames, winnerId, winnerName } = req.body
      if (!playerIds?.length || !winnerId) {
        return res.status(400).json({ error: 'playerIds and winnerId required' })
      }
      const raw = await redis.get('games')
      const games = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : []
      const newGame = {
        id: Date.now().toString(),
        date: Date.now(),
        playerIds, playerNames, winnerId, winnerName,
      }
      games.push(newGame)
      await redis.set('games', JSON.stringify(games))

      // Update player stats
      for (const pid of playerIds) {
        const pRaw = await redis.hget('players', pid)
        if (!pRaw) continue
        const player = typeof pRaw === 'string' ? JSON.parse(pRaw) : pRaw
        player.gamesPlayed = (player.gamesPlayed || 0) + 1
        if (pid === winnerId) player.wins = (player.wins || 0) + 1
        await redis.hset('players', { [pid]: JSON.stringify(player) })
      }

      return res.status(201).json(newGame)
    }

    if (req.method === 'DELETE') {
      const { id } = req.query
      if (!id) return res.status(400).json({ error: 'id required' })
      const raw = await redis.get('games')
      let games = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : []
      const game = games.find(g => g.id === id)
      if (!game) return res.status(404).json({ error: 'Game not found' })

      // Revert player stats
      for (const pid of (game.playerIds || [])) {
        const pRaw = await redis.hget('players', pid)
        if (!pRaw) continue
        const player = typeof pRaw === 'string' ? JSON.parse(pRaw) : pRaw
        player.gamesPlayed = Math.max(0, (player.gamesPlayed || 0) - 1)
        if (pid === game.winnerId) player.wins = Math.max(0, (player.wins || 0) - 1)
        await redis.hset('players', { [pid]: JSON.stringify(player) })
      }

      games = games.filter(g => g.id !== id)
      await redis.set('games', JSON.stringify(games))
      return res.status(200).json({ ok: true })
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('Games API error:', err)
    res.status(500).json({ error: err.message })
  }
}
