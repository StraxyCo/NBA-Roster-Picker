import { useState } from 'react'

// Shared, deliberately discreet "save as default" — a small muted text link, not a
// full button, so it sits quietly under the primary Start CTA on every setup screen.
// onSave: () => Promise<boolean> — usually () => onSaveDefault(buildConfig()).
export default function SaveDefaultButton({ onSave, saving }) {
  const [saved, setSaved] = useState(false)
  const [hover, setHover] = useState(false)

  async function handle() {
    if (saving) return
    const ok = await onSave()
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 2000) }
  }

  const color = saved ? 'var(--gold)' : hover ? 'var(--white-70)' : 'var(--white-40)'

  return (
    <div style={{ textAlign: 'center', margin: '8px 0 2px' }}>
      <button
        type="button"
        onClick={handle}
        disabled={saving}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          background: 'transparent', border: 'none', padding: '4px 6px',
          color, fontFamily: 'var(--font-body)', fontSize: '0.74rem', fontWeight: 500,
          letterSpacing: '0.02em', cursor: saving ? 'default' : 'pointer', transition: 'color 0.15s',
        }}
      >
        {saving ? 'Saving…' : saved ? '✓ Saved as default' : 'Save as default config'}
      </button>
    </div>
  )
}
