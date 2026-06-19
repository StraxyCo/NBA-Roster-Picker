import React, { useState, useEffect } from 'react'
import { usePlayers } from '../hooks/useProfiles.js'
import { useGameDefaults } from '../hooks/useGameDefaults.js'
import SaveDefaultButton from '../components/SaveDefaultButton.jsx'
import { ALL_SEASONS } from '../data/seasons.js'
import { ATTRIBUTES, DEFAULT_ATTRIBUTES } from '../utils/playerdle.js'
import styles from './StatsOverUnderSetupScreen.module.css'

function Modal({ onClose, children }) {
  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal}>{children}</div>
    </div>
  )
}

function NameModal({ onSave, onClose, saving }) {
  const [val, setVal] = useState('')
  const ref = React.useRef(null)
  useEffect(() => { ref.current?.focus() }, [])
  return (
    <Modal onClose={onClose}>
      <h3 className={styles.modalTitle}>New player</h3>
      <input ref={ref} className={styles.modalInput} value={val} maxLength={20} placeholder="First name"
        onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && val.trim() && !saving) onSave(val.trim()) }} />
      <div className={styles.modalActions}>
        <button className={styles.btnPrimary} disabled={!val.trim() || saving} onClick={() => val.trim() && onSave(val.trim())}>{saving ? 'Saving…' : 'Save'}</button>
        <button className={styles.btnSecondary} onClick={onClose} disabled={saving}>Cancel</button>
      </div>
    </Modal>
  )
}

function AddPlayerModal({ players, slotsUsed, onSelect, onClose, onCreate }) {
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const available = players.filter(p => !slotsUsed.includes(p.id))
  async function create(name) { setSaving(true); try { await onCreate(name); onClose() } catch { setSaving(false) } }
  if (showCreate) return <NameModal saving={saving} onSave={create} onClose={() => setShowCreate(false)} />
  return (
    <Modal onClose={onClose}>
      <h3 className={styles.modalTitle}>Add player</h3>
      <div className={styles.playerPickList}>
        {available.length === 0 && <p className={styles.emptyNote}>All players are already added.</p>}
        {available.map(p => (
          <button key={p.id} className={styles.playerPickRow} onClick={() => { onSelect(p); onClose() }}>
            <span className={styles.playerPickName}>{p.name}</span>
          </button>
        ))}
      </div>
      <div className={styles.modalDivider} />
      <button className={styles.btnOutline} onClick={() => setShowCreate(true)}>+ Create new player</button>
    </Modal>
  )
}

function SeasonsModal({ selected, onSave, onClose }) {
  const [draft, setDraft] = useState(selected)
  const toggle = s => setDraft(prev => prev.includes(s) ? (prev.length > 1 ? prev.filter(x => x !== s) : prev) : [...prev, s])
  return (
    <Modal onClose={onClose}>
      <h3 className={styles.modalTitle}>Select seasons</h3>
      <div className={styles.seasonsGrid}>
        {ALL_SEASONS.map(s => (
          <button key={s} className={`${styles.seasonTag} ${draft.includes(s) ? styles.seasonTagOn : ''}`} onClick={() => toggle(s)}>{s}</button>
        ))}
      </div>
      <div className={styles.modalActions}>
        <button className={styles.btnPrimary} onClick={() => { onSave(draft); onClose() }}>Apply</button>
        <button className={styles.btnSecondary} onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  )
}

export default function PlayerdleSetupScreen(props) {
  const { initial, loaded, save, saving } = useGameDefaults('playerdle')
  if (!loaded) return null
  return <PlayerdleSetupInner {...props} savedDefault={initial} onSaveDefault={save} savingDefault={saving} />
}

function PlayerdleSetupInner({ onBack, onStart, savedDefault, onSaveDefault, savingDefault }) {
  const { players, loading, createPlayer } = usePlayers()
  const d = savedDefault || {}

  const [slots, setSlots] = useState([null, null, null, null])
  const [addingSlot, setAddingSlot] = useState(null)
  const [showSeasons, setShowSeasons] = useState(false)

  const [minSeasons, setMinSeasons]   = useState(d.minSeasons ?? 5)
  const [seasons, setSeasons]         = useState(d.seasons ?? [...ALL_SEASONS])
  const [rounds, setRounds]           = useState(d.rounds ?? 5)
  const [maxAttempts, setMaxAttempts] = useState(d.maxAttempts ?? 8)
  const [attributes, setAttributes]   = useState(d.attributes ?? { ...DEFAULT_ATTRIBUTES })

  useEffect(() => {
    if (!loading && players.length > 0) {
      const top = players.slice(0, 2)
      setSlots(prev => { const n = [...prev]; if (!n[0] && top[0]) n[0] = top[0]; if (!n[1] && top[1]) n[1] = top[1]; return n })
    }
  }, [loading, players])

  const buildDefaultConfig = () => ({ minSeasons, seasons, rounds, maxAttempts, attributes })

  const activePlayers = slots.filter(Boolean)
  const enabledCount = ATTRIBUTES.filter(a => attributes[a.key] !== false).length
  const canStart = activePlayers.length >= 1 && enabledCount >= 1
  const slotsUsedIds = slots.filter(Boolean).map(p => p.id)
  const seasonLabel = seasons.length === ALL_SEASONS.length ? 'All seasons' : seasons.length === 1 ? seasons[0] : `${seasons.length} seasons`

  const setSlot = (i, p) => setSlots(prev => { const n = [...prev]; n[i] = p; return n })
  const toggleAttr = key => setAttributes(prev => ({ ...prev, [key]: prev[key] === false ? true : false }))

  return (
    <div className={styles.container}>
      <button className={styles.backArrow} onClick={onBack}>←</button>
      <header className={styles.header}>
        <h1 className={styles.title}>Playerdle</h1>
        <p className={styles.subtitle}>Guess the mystery player — first to crack it wins the round</p>
      </header>

      <div className={styles.mainContainer}>
        <div className={styles.section}>
          <h2 className={styles.sectionLabel}>Players</h2>
          <div className={styles.slotsGrid}>
            {slots.map((player, i) => (
              <div key={i} className={`${styles.slot} ${player ? styles.slotFilled : styles.slotEmpty}`}>
                {player ? (
                  <><span className={styles.slotName}>{player.name}</span><button className={styles.slotTrash} onClick={() => setSlot(i, null)}>✕</button></>
                ) : (
                  <button className={styles.slotAdd} onClick={() => setAddingSlot(i)}><span className={styles.slotPlus}>+</span><span className={styles.slotAddLabel}>Add player</span></button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionLabel}>Options</h2>

          {[
            ['Rounds', 'Mystery players to play', rounds, setRounds, 1, 20],
            ['Min seasons played', 'Career length to be eligible', minSeasons, setMinSeasons, 1, 20],
            ['Max attempts', 'Guesses per mystery before a draw', maxAttempts, setMaxAttempts, 2, 20],
          ].map(([title, desc, val, setter, lo, hi]) => (
            <div key={title} className={styles.optionRow}>
              <div className={styles.optionLabel}><span className={styles.optionTitle}>{title}</span><span className={styles.optionDesc}>{desc}</span></div>
              <div className={styles.stepper}>
                <button className={styles.stepBtn} onClick={() => setter(v => Math.max(lo, v - 1))} disabled={val <= lo}>−</button>
                <span className={styles.stepValue}>{val}</span>
                <button className={styles.stepBtn} onClick={() => setter(v => Math.min(hi, v + 1))} disabled={val >= hi}>+</button>
              </div>
            </div>
          ))}

          <div className={styles.optionRow}>
            <div className={styles.optionLabel}><span className={styles.optionTitle}>Seasons</span><span className={styles.optionDesc}>Played in any selected season</span></div>
            <button className={styles.optionBtn} onClick={() => setShowSeasons(true)}>{seasonLabel}</button>
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionLabel}>Clues ({enabledCount}/{ATTRIBUTES.length})</h2>
          <div className={styles.statsToggleGrid}>
            {ATTRIBUTES.map(a => (
              <button key={a.key} className={`${styles.statToggle} ${attributes[a.key] !== false ? styles.statToggleOn : ''}`} onClick={() => toggleAttr(a.key)}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <SaveDefaultButton onSave={() => onSaveDefault(buildDefaultConfig())} saving={savingDefault} />
      <button className={styles.startBtn} disabled={!canStart} onClick={() => onStart({ players: activePlayers, minSeasons, seasons, rounds, maxAttempts, attributes })}>
        Start Game
      </button>

      {addingSlot !== null && <AddPlayerModal players={players} slotsUsed={slotsUsedIds} onSelect={p => setSlot(addingSlot, p)} onClose={() => setAddingSlot(null)} onCreate={createPlayer} />}
      {showSeasons && <SeasonsModal selected={seasons} onSave={setSeasons} onClose={() => setShowSeasons(false)} />}
    </div>
  )
}
