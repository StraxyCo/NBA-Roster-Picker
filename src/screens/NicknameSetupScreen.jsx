import React, { useState, useEffect } from 'react'
import styles from './NicknameSetupScreen.module.css'
import { usePlayers } from '../hooks/useProfiles.js'
import { ALL_SEASONS, PRE_2006 } from '../data/seasons.js'

function Modal({ onClose, children }) {
  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal}>{children}</div>
    </div>
  )
}

function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <Modal onClose={onCancel}>
      <p className={styles.confirmMsg}>{message}</p>
      <div className={styles.modalActions}>
        <button className={styles.btnDanger} onClick={onConfirm}>Delete</button>
        <button className={styles.btnSecondary} onClick={onCancel}>Cancel</button>
      </div>
    </Modal>
  )
}

function NameModal({ title, onSave, onClose, saving = false }) {
  const [val, setVal] = useState('')
  const inputRef = React.useRef(null)
  useEffect(() => { inputRef.current?.focus() }, [])
  return (
    <Modal onClose={onClose}>
      <h3 className={styles.modalTitle}>{title}</h3>
      <input
        ref={inputRef}
        className={styles.modalInput}
        value={val}
        onChange={e => setVal(e.target.value)}
        placeholder="First name"
        maxLength={20}
        onKeyDown={e => { if (e.key === 'Enter' && val.trim() && !saving) onSave(val.trim()) }}
      />
      <div className={styles.modalActions}>
        <button
          className={styles.btnPrimary}
          onClick={() => val.trim() && !saving && onSave(val.trim())}
          disabled={!val.trim() || saving}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button className={styles.btnSecondary} onClick={onClose} disabled={saving}>Cancel</button>
      </div>
    </Modal>
  )
}

function AddPlayerModal({ players, slotsUsed, onSelect, onClose, onCreate }) {
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const available = players.filter(p => !slotsUsed.includes(p.id))

  async function handleCreate(name) {
    setSaving(true)
    try { await onCreate(name); onClose() }
    catch (e) { console.error('Create player failed:', e); setSaving(false) }
  }

  if (showCreate) {
    return (
      <NameModal title="New player" saving={saving} onSave={handleCreate} onClose={() => setShowCreate(false)} />
    )
  }

  return (
    <Modal onClose={onClose}>
      <h3 className={styles.modalTitle}>Add player</h3>
      <div className={styles.playerPickList}>
        {available.length === 0 && <p className={styles.emptyNote}>All players are already added.</p>}
        {available.map(p => (
          <button key={p.id} className={styles.playerPickRow} onClick={() => { onSelect(p); onClose() }}>
            <span className={styles.playerPickName}>{p.name}</span>
            <span className={styles.playerPickStat}>{p.gamesPlayed || 0} games</span>
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
  function toggle(s) { setDraft(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]) }
  return (
    <Modal onClose={onClose}>
      <h3 className={styles.modalTitle}>Seasons</h3>
      <div className={styles.seasonModalLinks}>
        <button className={styles.textBtn} onClick={() => setDraft([...ALL_SEASONS, PRE_2006])}>Select all</button>
        <span className={styles.textBtnSep}>·</span>
        <button className={styles.textBtn} onClick={() => setDraft([...ALL_SEASONS])}>Modern only</button>
        <span className={styles.textBtnSep}>·</span>
        <button className={styles.textBtn} onClick={() => setDraft([])}>Clear</button>
      </div>
      <div className={styles.seasonCheckList}>
        <label className={styles.seasonCheckRow} style={{ borderBottom: '1px solid var(--white-10)', paddingBottom: 8, marginBottom: 4 }}>
          <input type="checkbox" className={styles.seasonCheckbox} checked={draft.includes(PRE_2006)} onChange={() => toggle(PRE_2006)} />
          <span className={styles.seasonCheckLabel}>Before 2005‑06 <span style={{ color: 'var(--white-40)', fontWeight: 400 }}>· legends</span></span>
        </label>
        {ALL_SEASONS.map(s => (
          <label key={s} className={styles.seasonCheckRow}>
            <input type="checkbox" className={styles.seasonCheckbox} checked={draft.includes(s)} onChange={() => toggle(s)} />
            <span className={styles.seasonCheckLabel}>{s}</span>
          </label>
        ))}
      </div>
      <div className={styles.modalActions}>
        <button className={styles.btnPrimary} onClick={() => { onSave(draft.length ? draft : [...ALL_SEASONS]); onClose() }}>Apply</button>
        <button className={styles.btnSecondary} onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  )
}

export default function NicknameSetupScreen({ onBack, onStart, savedGames, onDeleteGame }) {
  const { players, loading, createPlayer } = usePlayers()
  const [view, setView] = useState(null)

  const [selectedPlayers, setSelectedPlayers] = useState([null, null, null, null])
  const [addingSlot, setAddingSlot] = useState(null)


  const [rounds, setRounds] = useState(5)
  const [minSeasons, setMinSeasons] = useState(1)
  const [seasons, setSeasons] = useState([...ALL_SEASONS])
  const [showSeasons, setShowSeasons] = useState(false)

  const modernCount = seasons.filter(s => s !== PRE_2006).length
  const hasPre = seasons.includes(PRE_2006)
  const seasonLabel = modernCount === ALL_SEASONS.length
    ? (hasPre ? 'All-time' : 'All seasons')
    : `${seasons.length} selected`

  useEffect(() => {
    if (!loading && players.length > 0) {
      const top = players.slice(0, 2)
      setSelectedPlayers(prev => {
        const next = [...prev]
        if (!next[0] && top[0]) next[0] = top[0]
        if (!next[1] && top[1]) next[1] = top[1]
        return next
      })
    }
  }, [loading, players])


  function clearSlot(idx) {
    setSelectedPlayers(prev => { const next = [...prev]; next[idx] = null; return next })
  }

  function handleAddPlayer(player) {
    if (addingSlot !== null) {
      setSelectedPlayers(prev => { const next = [...prev]; next[addingSlot] = player; return next })
      setAddingSlot(null)
    }
  }

  const slotsUsedIds = selectedPlayers.filter(Boolean).map(p => p.id)
  const activePlayers = selectedPlayers.filter(Boolean)
  const canStart = activePlayers.length >= 1

  return (
    <div className={styles.container}>
      <button className={styles.backArrow} onClick={onBack} aria-label="Back to home">←</button>

      <header className={styles.header}>
        <h1 className={styles.title}>The Nickname Game</h1>
        <p className={styles.subtitle}>Guess the player from their nickname</p>
      </header>

      <div className={styles.menu}>
        <button className={styles.menuBtn} onClick={() => setView('stats')}>Stats</button>
        <button className={styles.menuBtn} onClick={() => setView('games')}>View games played</button>
      </div>

      <div className={styles.mainContainer}>

        <div className={styles.section}>
          <span className={styles.sectionLabel}>Players</span>
          <div className={styles.slotsGrid}>
            {selectedPlayers.map((player, i) => (
              <div key={i} className={`${styles.slot} ${player ? styles.slotFilled : styles.slotEmpty}`}>
                {player ? (
                  <>
                    <span className={styles.slotName}>{player.name}</span>
                    <button className={styles.slotTrash} onClick={() => clearSlot(i)} title="Remove player">✕</button>
                  </>
                ) : (
                  <button className={styles.slotAdd} onClick={() => setAddingSlot(i)}>
                    <span className={styles.slotPlus}>+</span>
                    <span className={styles.slotAddLabel}>Add player</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <span className={styles.sectionLabel}>Options</span>

          <div className={styles.optionRow}>
            <div className={styles.optionLabel}>
              <span className={styles.optionTitle}>Rounds</span>
              <span className={styles.optionDesc}>Number of nicknames per player</span>
            </div>
            <div className={styles.stepper}>
              <button className={styles.stepBtn} onClick={() => setRounds(r => Math.max(1, r - 1))} disabled={rounds <= 1}>−</button>
              <span className={styles.stepValue}>{rounds}</span>
              <button className={styles.stepBtn} onClick={() => setRounds(r => Math.min(50, r + 1))} disabled={rounds >= 50}>+</button>
            </div>
          </div>

          <div className={styles.optionRow}>
            <div className={styles.optionLabel}>
              <span className={styles.optionTitle}>Min seasons played</span>
              <span className={styles.optionDesc}>Career length to be eligible</span>
            </div>
            <div className={styles.stepper}>
              <button className={styles.stepBtn} onClick={() => setMinSeasons(s => Math.max(1, s - 1))} disabled={minSeasons <= 1}>−</button>
              <span className={styles.stepValue}>{minSeasons}</span>
              <button className={styles.stepBtn} onClick={() => setMinSeasons(s => Math.min(20, s + 1))} disabled={minSeasons >= 20}>+</button>
            </div>
          </div>

          <div className={styles.optionRow}>
            <div className={styles.optionLabel}>
              <span className={styles.optionTitle}>Seasons</span>
              <span className={styles.optionDesc}>Played in any selected season</span>
            </div>
            <button className={styles.seasonTrigger} style={{ width: 'auto', gap: '10px', flexShrink: 0 }} onClick={() => setShowSeasons(true)}>
              <span className={styles.seasonTriggerLabel}>{seasonLabel}</span>
              <span className={styles.seasonTriggerCaret}>▾</span>
            </button>
          </div>
        </div>

      </div>

      <button
        className={styles.startBtn}
        disabled={!canStart}
        onClick={() => onStart({ players: activePlayers, rounds, minSeasons, seasons })}
      >
        Start Game
      </button>

      {addingSlot !== null && (
        <AddPlayerModal
          players={players}
          slotsUsed={slotsUsedIds}
          onSelect={handleAddPlayer}
          onClose={() => setAddingSlot(null)}
          onCreate={createPlayer}
        />
      )}

      {showSeasons && (
        <SeasonsModal selected={seasons} onSave={setSeasons} onClose={() => setShowSeasons(false)} />
      )}

      {view === 'stats' && (
        <StatsView players={players} onClose={() => setView(null)} />
      )}

      {view === 'games' && (
        <GamesView
          games={savedGames || []}
          onDelete={onDeleteGame}
          onClose={() => setView(null)}
        />
      )}
    </div>
  )
}
