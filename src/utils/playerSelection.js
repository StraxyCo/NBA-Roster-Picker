export function playerWeight(p) {
  return (p.min ?? 0) * (p.gp ?? 0)
}

export function weightedPick(players, weights) {
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < players.length; i++) {
    r -= weights[i]
    if (r <= 0) return players[i]
  }
  return players[players.length - 1]
}

export function weightedShuffle(arr, weights) {
  // exclude zero-weight entries upfront so they are never selected
  const items = [], ws = []
  for (let i = 0; i < arr.length; i++) {
    if (weights[i] > 0) { items.push(arr[i]); ws.push(weights[i]) }
  }
  const result = []
  while (items.length > 0) {
    const total = ws.reduce((a, b) => a + b, 0)
    let r = Math.random() * total, i = 0
    while (i < ws.length - 1) { r -= ws[i]; if (r <= 0) break; i++ }
    result.push(items[i])
    items.splice(i, 1); ws.splice(i, 1)
  }
  return result
}

// Pick n unique players from pool weighted by minutes, excluding already-used IDs.
export function pickNWeightedPlayers(players, n, excludeIds = new Set()) {
  const available = players.filter(p => !excludeIds.has(p.id))
  const pool = available.length >= n ? available : players
  const weights = pool.map(playerWeight)
  return weightedShuffle(pool, weights).slice(0, n)
}
