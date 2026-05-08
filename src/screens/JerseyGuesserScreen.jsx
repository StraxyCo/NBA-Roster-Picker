import React, { useState } from 'react'
import styles from './JerseyGuesserScreen.module.css'
import { usePlayers } from '../hooks/useProfiles.js'

// ── Small shared modal shell ────────────────────────────────────────────────
function Modal({ onClose, children }) {
  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal}>{children}</div>
    </div>
  )
}

// ── Name input modal (create or edit) ──────────────────────────────────────
function NameModal({ title, initial = '', onSave, onClose, saving = false }) {
  const [val, setVal] = useState(initial)
  const inputRef = React.useRef(null)
  React.useEffect(() => { inputRef.current?.focus() }, [])
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

// ── Add player to slot modal ────────────────────────────────────────────────
function AddPlayerModal({ players, slotsUsed, onSelect, onClose, onCreate }) {
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const available = players.filter(p => !slotsUsed.includes(p.id))

  async function handleCreate(name) {
    setSaving(true)
    try {
      await onCreate(name)
      onClose()
    } catch (e) {
      console.error('Create player failed:', e)
      setSaving(false)
    }
  }

  if (showCreate) {
    return (
      <NameModal
        title="New player"
        saving={saving}
        onSave={handleCreate}
        onClose={() => setShowCreate(false)}
      />
    )
  }

  return (
    <Modal onClose={onClose}>
      <h3 className={styles.modalTitle}>Add player</h3>
      <div className={styles.playerPickList}>
        {available.length === 0 && (
          <p className={styles.emptyNote}>All players are already added.</p>
        )}
        {available.map(p => (
          <button key={p.id} className={styles.playerPickRow} onClick={() => { onSelect(p); onClose() }}>
            <span className={styles.playerPickName}>{p.name}</span>
            <span className={styles.playerPickStat}>{p.gamesPlayed || 0} games</span>
          </button>
        ))}
      </div>
      <div className={styles.modalDivider} />
      <button className={styles.btnOutline} onClick={() => setShowCreate(true)}>
        + Create new player
      </button>
    </Modal>
  )
}

export default function JerseyGuesserScreen({ onBack, onStart }) {
  const { players, createPlayer } = usePlayers()
  
  // 4 player slots — each is null or a player object
  const [selectedPlayers, setSelectedPlayers] = useState([null, null, null, null])
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false)
  const [addingSlot, setAddingSlot] = useState(null)
  
  const [rounds, setRounds] = useState(5)

  function clearSlot(idx) {
    setSelectedPlayers(prev => {
      const next = [...prev]
      next[idx] = null
      return next
    })
  }

  function handleAddPlayer(player) {
    if (addingSlot !== null) {
      setSelectedPlayers(prev => {
        const next = [...prev]
        next[addingSlot] = player
        return next
      })
      setAddingSlot(null)
    }
  }

  const slotsUsedIds = selectedPlayers.filter(Boolean).map(p => p.id)
  const activePlayers = selectedPlayers.filter(Boolean)

  return (
    <div className={styles.container}>
      <button className={styles.backArrow} onClick={onBack} aria-label="Back to home">
        ←
      </button>
      <header className={styles.header}>
        <h1 className={styles.title}>Jersey Number Guesser</h1>
        <p className={styles.subtitle}>Test your NBA knowledge</p>
      </header>

      {/* Container for players + rounds */}
      <div className={styles.mainContainer}>
        {/* Player selection section */}
        <div className={styles.section}>
          <h2 className={styles.sectionLabel}>Players</h2>
          <div className={styles.slotsGrid}>
            {selectedPlayers.map((player, i) => (
              <div key={i} className={`${styles.slot} ${player ? styles.slotFilled : styles.slotEmpty}`}>
                {player ? (
                  <>
                    <span className={styles.slotName}>{player.name}</span>
                    <button 
                      className={styles.slotTrash} 
                      onClick={() => clearSlot(i)}
                      title="Remove player"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <button 
                    className={styles.slotAdd} 
                    onClick={() => setAddingSlot(i)}
                  >
                    <span className={styles.slotPlus}>+</span>
                    <span className={styles.slotAddLabel}>Add player</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Rounds section */}
        <div className={styles.section}>
          <div className={styles.optionRow}>
            <div className={styles.optionLabel}>
              <span className={styles.optionTitle}>Rounds</span>
              <span className={styles.optionDesc}>Number of players to guess</span>
            </div>
            <div className={styles.stepper}>
              <button className={styles.stepBtn} onClick={() => setRounds(r => Math.max(1, r - 1))} disabled={rounds <= 1}>−</button>
              <span className={styles.stepValue}>{rounds}</span>
              <button className={styles.stepBtn} onClick={() => setRounds(r => Math.min(50, r + 1))} disabled={rounds >= 50}>+</button>
            </div>
          </div>
        </div>
      </div>

      <button
        className={styles.startBtn}
        disabled={activePlayers.length === 0}
        onClick={() => onStart({ players: activePlayers, rounds })}
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
    </div>
  )
}
