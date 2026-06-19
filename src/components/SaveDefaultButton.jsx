import { useState } from 'react'

// Shared "Save as default config" control for every minigame's settings screen.
// Inline-styled (navy/gold) so it drops into any screen without per-CSS-module work.
// onSave: () => Promise<boolean> — usually () => onSaveDefault(buildConfig()).
export default function SaveDefaultButton({ onSave, saving }) {
  const [saved, setSaved] = useState(false)

  async function handle() {
    if (saving) return
    const ok = await onSave()
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 2000) }
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={saving}
      style={{
        width: '100%', marginTop: '10px', padding: '10px',
        background: 'transparent', color: saved ? 'var(--gold)' : 'var(--white-50)',
        border: `1px solid ${saved ? 'var(--gold)' : 'var(--white-20)'}`,
        borderRadius: 'var(--radius)', fontFamily: 'var(--font-display)',
        fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.1em',
        textTransform: 'uppercase', cursor: saving ? 'default' : 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {saving ? 'Saving…' : saved ? '✓ Saved as default' : 'Save as default config'}
    </button>
  )
}
