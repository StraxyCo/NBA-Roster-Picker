import React, { useState } from 'react'
import { usePlayers } from '../hooks/useProfiles.js'
import { ALL_SEASONS } from '../data/seasons.js'
import styles from './TeamLeadersSetupScreen.module.css'

// ── Shared modal shell ──────────────────────────────────────────────────────
function Modal({ onClose, children }) {
  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal}>{children}</div>
    </div>
  )
}

// ── Create / rename player ──────────────────────────────────────────────────
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
        <button className={styles.btnPrimary} onClick={() => val.trim() && !saving && onSave(val.trim())} disabled={!val.trim() || saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button className={styles.btnSecondary} onClick={onClose} disabled={saving}>Cancel</button>
      </div>
    </Modal>
  )
}

// ── Pick a player to add to a slot ─────────────────────────────────────────
function AddPlayerModal({ players, slotsUsed, onSelect, onClose, onCreate }) {
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const available = players.filter(p => !slotsUsed.includes(p.id))

  async function handleCreate(name) {
    setSaving(true)
    try { await onCreate(name); onClose() }
    catch { setSaving(false) }
  }

  if (showCreate) return <NameModal title="New player" saving={saving} onSave={handleCreate} onClose={() => setShowCreate(false)} />

  return (
    <Modal onClose={onClose}>
      <h3 className={styles.modalTitle}>Add player</h3>
      <div className={styles.playerPickList}>
        {available.length === 0 && <p className={styles.emptyNote}>All players are already in the game.</p>}
        {available.map(p => (
          <button key={p.id} className={styles.playerPickRow} onClick={() => { onSelect(p); onClose() }}>
            <span className={styles.playerPickName}>{p.name}</span>
            <span className={styles.playerPickStat}>{p.stats?.teamLeaders?.played || 0} games</span>
          </button>
        ))}
      </div>
      <div className={styles.modalDivider} />
      <button className={styles.btnOutline} onClick={() => setShowCreate(true)}>+ Create new player</button>
    </Modal>
  )
}

// ── Stats view ──────────────────────────────────────────────────────────────
function StatsView({ players, onClose }) {
  const sorted = [...players]
    .filter(p => (p.stats?.teamLeaders?.played || 0) > 0)
    .sort((a, b) => (b.stats?.teamLeaders?.wins || 0) - (a.stats?.teamLeaders?.wins || 0))
  return (
    <Modal onClose={onClose}>
      <h3 className={styles.modalTitle}>Team Leaders Stats</h3>
      <div className={styles.statsTable}>
        <div className={styles.statsHeader}>
          <span className={styles.statsColPlayer}>Player</span>
          <span className={styles.statsCol}>GP</span>
          <span className={styles.statsCol}>W</span>
          <span className={styles.statsCol}>Win%</span>
        </div>
        {sorted.length === 0 && <p className={styles.emptyNote}>No games recorded yet.</p>}
        {sorted.map(p => {
          const gp  = p.stats?.teamLeaders?.played || 0
          const w   = p.stats?.teamLeaders?.wins   || 0
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

// ── Games history ───────────────────────────────────────────────────────────
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
        <Modal onClose={() => setDeletingId(null)}>
          <p className={styles.confirmMsg}>Delete this game? Player stats will be updated.</p>
          <div className={styles.modalActions}>
            <button className={styles.btnDanger} onClick={async () => { await onDelete(game.id); setDeletingId(null) }}>Delete</button>
            <button className={styles.btnSecondary} onClick={() => setDeletingId(null)}>Cancel</button>
          </div>
        </Modal>
      )}
    </>
  )
}

// ── Seasons picker ──────────────────────────────────────────────────────────
function SeasonsModal({ selected, onSave, onClose }) {
  const [draft, setDraft] = useState(selected)
  function toggle(s) {
    setDraft(prev => prev.includes(s) ? (prev.length > 1 ? prev.filter(x => x !== s) : prev) : [...prev, s])
  }
  return (
    <Modal onClose={onClose}>
      <h3 className={styles.modalTitle}>Select seasons</h3>
      <div className={styles.seasonsGrid}>
        {ALL_SEASONS.map(s => (
          <button
            key={s}
            className={`${styles.seasonTag} ${draft.includes(s) ? styles.seasonTagOn : ''}`}
            onClick={() => toggle(s)}
          >
            {s}
          </button>
        ))}
      </div>
      <div className={styles.modalActions}>
        <button className={styles.btnPrimary} onClick={() => { onSave(draft); onClose() }}>Apply</button>
        <button className={styles.btnSecondary} onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  )
}

// ── Main export ─────────────────────────────────────────────────────────────
export default function TeamLeadersSetupScreen({ onBack, onStart, savedGames, onDeleteGame }) {
  const { players, createPlayer } = usePlayers()

  const MAX_SLOTS = 6
  const [selectedPlayers, setSelectedPlayers] = useState(Array(MAX_SLOTS).fill(null))
  const [addingSlot, setAddingSlot] = useState(null)
  const [view, setView] = useState(null)

  const [rounds, setRounds]                     = useState(5)
  const [seasons, setSeasons]                   = useState(ALL_SEASONS)
  const [eliminateTeams, setEliminateTeams]     = useState(true)
  const [eliminateFranchises, setElimFranch]    = useState(true)
  const [showSeasons, setShowSeasons]           = useState(false)

  function clearSlot(idx) {
    setSelectedPlayers(prev => { const n = [...prev]; n[idx] = null; return n })
  }
  function handleAddPlayer(player) {
    if (addingSlot !== null) {
      setSelectedPlayers(prev => { const n = [...prev]; n[addingSlot] = player; return n })
      setAddingSlot(null)
    }
  }

  const slotsUsedIds  = selectedPlayers.filter(Boolean).map(p => p.id)
  const activePlayers = selectedPlayers.filter(Boolean)
  const canStart      = activePlayers.length >= 1

  const seasonLabel = seasons.length === ALL_SEASONS.length
    ? 'All seasons'
    : seasons.length === 1
      ? seasons[0]
      : `${seasons.length} seasons`

  return (
    <div className={styles.container}>
      <button className={styles.backArrow} onClick={onBack} aria-label="Back to home">←</button>

      <header className={styles.header}>
        <h1 className={styles.title}>Team Leaders</h1>
        <p className={styles.subtitle}>Who led the team in pts, reb & ast?</p>
      </header>

      <div className={styles.menu}>
        <button className={styles.menuBtn} onClick={() => setView('stats')}>Stats</button>
        <button className={styles.menuBtn} onClick={() => setView('games')}>Games played</button>
      </div>

      <div className={styles.mainContainer}>
        {/* Players */}
        <div className={styles.section}>
          <h2 className={styles.sectionLabel}>Players</h2>
          <div className={styles.slotsGrid}>
            {selectedPlayers.map((player, i) => (
              <div key={i} className={`${styles.slot} ${player ? styles.slotFilled : styles.slotEmpty}`}>
                {player ? (
                  <>
                    <span className={styles.slotName}>{player.name}</span>
                    <button className={styles.slotTrash} onClick={() => clearSlot(i)}>✕</button>
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

        {/* Options */}
        <div className={styles.section}>
          <h2 className={styles.sectionLabel}>Options</h2>

          <div className={styles.optionRow}>
            <div className={styles.optionLabel}>
              <span className={styles.optionTitle}>Rounds</span>
              <span className={styles.optionDesc}>Teams drawn per player</span>
            </div>
            <div className={styles.stepper}>
              <button className={styles.stepBtn} onClick={() => setRounds(r => Math.max(1, r - 1))} disabled={rounds <= 1}>−</button>
              <span className={styles.stepValue}>{rounds}</span>
              <button className={styles.stepBtn} onClick={() => setRounds(r => Math.min(10, r + 1))} disabled={rounds >= 10}>+</button>
            </div>
          </div>

          <div className={styles.optionRow}>
            <div className={styles.optionLabel}>
              <span className={styles.optionTitle}>Seasons</span>
              <span className={styles.optionDesc}>{seasonLabel}</span>
            </div>
            <button className={styles.optionBtn} onClick={() => setShowSeasons(true)}>Change</button>
          </div>

          <div className={styles.optionRow}>
            <div className={styles.optionLabel}>
              <span className={styles.optionTitle}>Eliminate drawn teams</span>
              <span className={styles.optionDesc}>No duplicate team + season</span>
            </div>
            <button
              className={`${styles.toggle} ${eliminateTeams ? styles.toggleOn : ''}`}
              onClick={() => setEliminateTeams(v => !v)}
            >
              {eliminateTeams ? 'Yes' : 'No'}
            </button>
          </div>

          <div className={styles.optionRow}>
            <div className={styles.optionLabel}>
              <span className={styles.optionTitle}>Eliminate drawn franchises</span>
              <span className={styles.optionDesc}>No same franchise across seasons</span>
            </div>
            <button
              className={`${styles.toggle} ${eliminateFranchises ? styles.toggleOn : ''}`}
              onClick={() => setElimFranch(v => !v)}
            >
              {eliminateFranchises ? 'Yes' : 'No'}
            </button>
          </div>
        </div>
      </div>

      <button className={styles.startBtn} disabled={!canStart} onClick={() => onStart({ players: activePlayers, rounds, seasons, eliminateTeams, eliminateFranchises })}>
        Start Game
      </button>

      {addingSlot !== null && (
        <AddPlayerModal players={players} slotsUsed={slotsUsedIds} onSelect={handleAddPlayer} onClose={() => setAddingSlot(null)} onCreate={createPlayer} />
      )}
      {showSeasons && <SeasonsModal selected={seasons} onSave={setSeasons} onClose={() => setShowSeasons(false)} />}
      {view === 'stats' && <StatsView players={players} onClose={() => setView(null)} />}
      {view === 'games' && <GamesView games={savedGames || []} onDelete={onDeleteGame} onClose={() => setView(null)} />}
    </div>
  )
}
