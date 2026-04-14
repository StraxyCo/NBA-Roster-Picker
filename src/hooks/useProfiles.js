import { useState, useEffect, useCallback } from 'react'

export function usePlayers() {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/players')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setPlayers(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('usePlayers load error', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function createPlayer(name) {
    const res = await fetch('/api/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) throw new Error('Failed to create player')
    const player = await res.json()
    setPlayers(prev => [...prev, player].sort((a, b) => (b.gamesPlayed || 0) - (a.gamesPlayed || 0)))
    return player
  }

  async function updatePlayer(id, name) {
    const res = await fetch('/api/players', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name }),
    })
    if (!res.ok) throw new Error('Failed to update player')
    const updated = await res.json()
    setPlayers(prev => prev.map(p => p.id === id ? updated : p))
    return updated
  }

  async function deletePlayer(id) {
    const res = await fetch(`/api/players?id=${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete player')
    setPlayers(prev => prev.filter(p => p.id !== id))
  }

  return { players, loading, reload: load, createPlayer, updatePlayer, deletePlayer }
}

export function useGames() {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/games')
      const data = await res.json()
      setGames(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('useGames load error', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function saveGame({ playerIds, playerNames, winnerId, winnerName }) {
    const res = await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerIds, playerNames, winnerId, winnerName }),
    })
    if (!res.ok) throw new Error('Failed to save game')
    const game = await res.json()
    setGames(prev => [game, ...prev])
    return game
  }

  async function deleteGame(id) {
    const res = await fetch(`/api/games?id=${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete game')
    setGames(prev => prev.filter(g => g.id !== id))
  }

  return { games, loading, reload: load, saveGame, deleteGame }
}
