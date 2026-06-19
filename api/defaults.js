// Per-game default settings — global (not user-based), pure overwrite, no versioning.
// Stored in Upstash Redis under `default:<gameKey>`, same channel as scores (api/games.js).
//   GET  /api/defaults?game=rosterPicker   -> { game, config }   (config null if never saved)
//   POST /api/defaults  { game, config }   -> overwrite that game's default

const BASE = process.env.KV_REST_API_URL
const TOKEN = process.env.KV_REST_API_TOKEN

async function redisGet(key) {
  const res = await fetch(`${BASE}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
  const data = await res.json()
  return data.result
}

async function redisSet(key, value) {
  await fetch(`${BASE}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  try {
    if (req.method === 'GET') {
      const { game } = req.query
      if (!game) return res.status(400).json({ error: 'game required' })
      const raw = await redisGet(`default:${game}`)
      const config = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null
      return res.status(200).json({ game, config })
    }

    if (req.method === 'POST') {
      const { game, config } = req.body || {}
      if (!game || config == null) return res.status(400).json({ error: 'game and config required' })
      await redisSet(`default:${game}`, JSON.stringify(config))
      return res.status(200).json({ ok: true })
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('[defaults] error:', err.message)
    res.status(500).json({ error: err.message })
  }
}
