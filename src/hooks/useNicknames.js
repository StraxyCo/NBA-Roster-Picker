// Nicknames: /nicknames.json — { "nickname": [{ player_id, player_name }] }

let nicknamesData = null
let nicknamesPromise = null

export async function loadNicknames() {
  if (nicknamesData) return nicknamesData
  if (!nicknamesPromise) {
    nicknamesPromise = fetch('/nicknames.json')
      .then(r => { if (!r.ok) throw new Error('Failed to load nicknames.json'); return r.json() })
      .then(d => { nicknamesData = d; return d })
  }
  return nicknamesPromise
}
