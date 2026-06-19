// Runtime loader for per-season grading shards (public/grading/<season>.json).
// Module-level cache so a season is fetched at most once. Prefetch at draw time
// (when a team-season is drawn) so the data is warm by the Final screen.

const cache = {} // season -> Promise<shard | null>

function fetchShard(season) {
  if (cache[season]) return cache[season]
  cache[season] = fetch(`/grading/${season}.json`)
    .then(r => (r.ok ? r.json() : null))
    .catch(() => null)
  return cache[season]
}

// Fire-and-forget warm-up for the given seasons (call when a season is drawn).
export function prefetchShards(seasons) {
  for (const s of seasons) if (s) fetchShard(s)
}

// Resolve to { <season>: shard } for the (deduped) seasons that loaded successfully.
export async function loadShards(seasons) {
  const uniq = [...new Set(seasons.filter(Boolean))]
  const pairs = await Promise.all(uniq.map(async s => [s, await fetchShard(s)]))
  const out = {}
  for (const [s, shard] of pairs) if (shard) out[s] = shard
  return out
}
