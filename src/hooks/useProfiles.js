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
    setPlayers(prev => [...prev, player].sort((a, b) => totalPlayed(b) - totalPlayed(a)))
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

function totalPlayed(player) {
  return Object.values(player.stats || {}).reduce((sum, g) => sum + (g.played || 0), 0)
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

export function useWhoHasMoreGames() {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/who-has-more-games')
      const data = await res.json()
      setGames(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('useWhoHasMoreGames load error', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function saveGame({ playerIds, playerNames, winnerId, winnerName }) {
    const res = await fetch('/api/who-has-more-games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerIds, playerNames, winnerId, winnerName }),
    })
    if (!res.ok) throw new Error('Failed to save who-has-more game')
    const game = await res.json()
    setGames(prev => [game, ...prev])
    return game
  }

  async function deleteGame(id) {
    const res = await fetch(`/api/who-has-more-games?id=${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete who-has-more game')
    setGames(prev => prev.filter(g => g.id !== id))
  }

  return { games, loading, reload: load, saveGame, deleteGame }
}

export function useStatsOverUnderGames() {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/stats-over-under-games')
      const data = await res.json()
      setGames(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('useStatsOverUnderGames load error', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function saveGame({ playerIds, playerNames, winnerId, winnerName }) {
    const res = await fetch('/api/stats-over-under-games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerIds, playerNames, winnerId, winnerName }),
    })
    if (!res.ok) throw new Error('Failed to save stats-over-under game')
    const game = await res.json()
    setGames(prev => [game, ...prev])
    return game
  }

  async function deleteGame(id) {
    const res = await fetch(`/api/stats-over-under-games?id=${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete stats-over-under game')
    setGames(prev => prev.filter(g => g.id !== id))
  }

  return { games, loading, reload: load, saveGame, deleteGame }
}

export function useTeamLeadersGames() {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/team-leaders-games')
      const data = await res.json()
      setGames(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('useTeamLeadersGames load error', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function saveGame({ playerIds, playerNames, winnerId, winnerName }) {
    const res = await fetch('/api/team-leaders-games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerIds, playerNames, winnerId, winnerName }),
    })
    if (!res.ok) throw new Error('Failed to save team-leaders game')
    const game = await res.json()
    setGames(prev => [game, ...prev])
    return game
  }

  async function deleteGame(id) {
    const res = await fetch(`/api/team-leaders-games?id=${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete team-leaders game')
    setGames(prev => prev.filter(g => g.id !== id))
  }

  return { games, loading, reload: load, saveGame, deleteGame }
}

export function useWhosThatGuyGames() {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/whos-that-guy-games')
      const data = await res.json()
      setGames(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('useWhosThatGuyGames load error', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function saveGame({ playerIds, playerNames, winnerId, winnerName }) {
    const res = await fetch('/api/whos-that-guy-games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerIds, playerNames, winnerId, winnerName }),
    })
    if (!res.ok) throw new Error('Failed to save whos-that-guy game')
    const game = await res.json()
    setGames(prev => [game, ...prev])
    return game
  }

  async function deleteGame(id) {
    const res = await fetch(`/api/whos-that-guy-games?id=${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete whos-that-guy game')
    setGames(prev => prev.filter(g => g.id !== id))
  }

  return { games, loading, reload: load, saveGame, deleteGame }
}

export function useAllStarsGames() {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/all-stars-games')
      const data = await res.json()
      setGames(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('useAllStarsGames load error', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function saveGame({ playerIds, playerNames, winnerId, winnerName }) {
    const res = await fetch('/api/all-stars-games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerIds, playerNames, winnerId, winnerName }),
    })
    if (!res.ok) throw new Error('Failed to save all-stars game')
    const game = await res.json()
    setGames(prev => [game, ...prev])
    return game
  }

  async function deleteGame(id) {
    const res = await fetch(`/api/all-stars-games?id=${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete all-stars game')
    setGames(prev => prev.filter(g => g.id !== id))
  }

  return { games, loading, reload: load, saveGame, deleteGame }
}

export function useNicknameGames() {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/nickname-games')
      const data = await res.json()
      setGames(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('useNicknameGames load error', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function saveGame({ playerIds, playerNames, winnerId, winnerName }) {
    const res = await fetch('/api/nickname-games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerIds, playerNames, winnerId, winnerName }),
    })
    if (!res.ok) throw new Error('Failed to save nickname game')
    const game = await res.json()
    setGames(prev => [game, ...prev])
    return game
  }

  async function deleteGame(id) {
    const res = await fetch(`/api/nickname-games?id=${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete nickname game')
    setGames(prev => prev.filter(g => g.id !== id))
  }

  return { games, loading, reload: load, saveGame, deleteGame }
}

export function useJerseyGames() {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/jersey-games')
      const data = await res.json()
      setGames(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('useJerseyGames load error', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function saveGame({ playerIds, playerNames, winnerId, winnerName }) {
    const res = await fetch('/api/jersey-games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerIds, playerNames, winnerId, winnerName }),
    })
    if (!res.ok) throw new Error('Failed to save jersey game')
    const game = await res.json()
    setGames(prev => [game, ...prev])
    return game
  }

  async function deleteGame(id) {
    const res = await fetch(`/api/jersey-games?id=${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete jersey game')
    setGames(prev => prev.filter(g => g.id !== id))
  }

  return { games, loading, reload: load, saveGame, deleteGame }
}
