import React, { useState, useEffect } from 'react'
import styles from './JerseyGuesserScreen.module.css'
import { usePlayers } from '../hooks/useProfiles.js'
import { useGameDefaults } from '../hooks/useGameDefaults.js'
import SaveDefaultButton from '../components/SaveDefaultButton.jsx'

// ── Confirm delete dialog ───────────────────────────────────────────────────
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

// ── Stats view ──────────────────────────────────────────────────────────────
function StatsView({ players, onClose }) {
  const sorted = [...players]
    .filter(p => (p.stats?.jerseyGuesser?.played || 0) > 0)
    .sort((a, b) => (b.stats?.jerseyGuesser?.wins || 0) - (a.stats?.jerseyGuesser?.wins || 0))
  return (
    <Modal onClose={onClose}>
      <h3 className={styles.modalTitle}>Stats</h3>
      <div className={styles.statsTable}>
        <div className={styles.statsHeader}>
          <span className={styles.statsColPlayer}>Player</span>
          <span className={styles.statsCol}>GP</span>
          <span className={styles.statsCol}>Wins</span>
          <span className={styles.statsCol}>Win%</span>
        </div>
        {sorted.length === 0 && <p className={styles.emptyNote}>No games recorded yet.</p>}
        {sorted.map(p => {
          const gp = p.stats?.jerseyGuesser?.played || 0
          const w  = p.stats?.jerseyGuesser?.wins   || 0
          const pct = gp > 0 ? Math.round((w / gp) * 100) : 0
          return (
            <div key={p.id} className={styles.statsRow}>
              <span className={styles.statsColPlayer}>{p.name}</span>
              <span className={styles.statsCol}>{gp}</span>
              <span className={styles.statsCol}>{w}</span>
              <span className={styles.statsCol}>{pct}%</span>
            </div>
          )
        })}
      </div>
      <div className={styles.modalActions}>
        <button className={styles.btnSecondary} onClick={onClose}>Close</button>
      </div>
    </Modal>
  )
}

// ── View games played ───────────────────────────────────────────────────────
function GamesView({ games, onDelete, onClose }) {
  const [deletingId, setDeletingId] = useState(null)
  const game = games.find(g => g.id === deletingId)
  return (
    <>
      <Modal onClose={onClose}>
        <h3 className={styles.modalTitle}>Games played</h3>
        <div className={styles.gamesTable}>
          <div className={styles.gamesHeader}>
            <span className={styles.gamesColPlayers}>Players</span>
            <span className={styles.gamesColWinner}>Winner</span>
            <span className={styles.gamesColAction}></span>
          </div>
          {games.length === 0 && <p className={styles.emptyNote}>No games recorded yet.</p>}
          {games.map(g => (
            <div key={g.id} className={styles.gamesRow}>
              <span className={styles.gamesColPlayers}>{(g.playerNames || []).join(', ')}</span>
              <span className={styles.gamesColWinner}>{g.winnerName}</span>
              <button className={styles.iconBtn} onClick={() => setDeletingId(g.id)}>🗑️</button>
            </div>
          ))}
        </div>
        <div className={styles.modalActions}>
          <button className={styles.btnSecondary} onClick={onClose}>Close</button>
        </div>
      </Modal>
      {game && (
        <ConfirmModal
          message="Delete this game? Player stats will be updated."
          onConfirm={async () => { await onDelete(game.id); setDeletingId(null) }}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </>
  )
}

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

export default function JerseyGuesserScreen(props) {
  const { initial, loaded, save, saving } = useGameDefaults('jersey')
  if (!loaded) return null
  return <JerseyGuesserInner {...props} savedDefault={initial} onSaveDefault={save} savingDefault={saving} />
}

function JerseyGuesserInner({ onBack, onStart, savedGames, onDeleteGame, savedDefault, onSaveDefault, savingDefault }) {
  const d = savedDefault || {}
  const { players, loading, createPlayer } = usePlayers()

  // 4 player slots — each is null or a player object
  const [selectedPlayers, setSelectedPlayers] = useState([null, null, null, null])

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

  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false)
  const [addingSlot, setAddingSlot] = useState(null)
  const [view, setView] = useState(null) // null | 'stats' | 'games'

  const [rounds, setRounds] = useState(d.rounds ?? 5)
  const buildDefaultConfig = () => ({ rounds })

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

      <div className={styles.menu}>
        <button className={styles.menuBtn} onClick={() => setView('stats')}>Stats</button>
        <button className={styles.menuBtn} onClick={() => setView('games')}>View games played</button>
      </div>

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

      <SaveDefaultButton onSave={() => onSaveDefault(buildDefaultConfig())} saving={savingDefault} />
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
