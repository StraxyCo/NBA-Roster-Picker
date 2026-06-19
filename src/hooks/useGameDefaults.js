// Per-game default settings (global, via /api/defaults -> Redis).
// A settings screen loads its saved default once, falls back to its hardcoded
// "factory" values when none is saved, and can overwrite the default with a button.

import { useEffect, useState } from 'react'

export function loadGameDefault(game) {
  return fetch(`/api/defaults?game=${encodeURIComponent(game)}`)
    .then(r => (r.ok ? r.json() : { config: null }))
    .then(d => d.config || null)
    .catch(() => null)
}

export function saveGameDefault(game, config) {
  return fetch('/api/defaults', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game, config }),
  })
    .then(r => r.ok)
    .catch(() => false)
}

// `initial` is undefined while loading, then the saved config object (or null).
// Gate the form render on `loaded` so useState initializers see the resolved default.
export function useGameDefaults(game) {
  const [initial, setInitial] = useState(undefined)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    loadGameDefault(game).then(c => { if (alive) setInitial(c || null) })
    return () => { alive = false }
  }, [game])

  async function save(config) {
    setSaving(true)
    const ok = await saveGameDefault(game, config)
    if (ok) setInitial(config)
    setSaving(false)
    return ok
  }

  return { initial, loaded: initial !== undefined, save, saving }
}
