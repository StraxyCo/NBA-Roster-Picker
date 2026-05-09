import React, { useState, useEffect } from 'react'
import styles from './WhoHasMoreScreen.module.css'
import { usePlayers } from '../hooks/useProfiles.js'
import { getAvailableSeasons } from '../hooks/useRoster.js'

// ── Confirm delete dialog ────────────────────────────────────────────────────
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

// ── Stats view ───────────────────────────────────────────────────────────────
function StatsView({ players, onClose }) {
  const sorted = [...players]
    .filter(p => (p.whoHasMoreGamesPlayed || 0) > 0 || (p.whoHasMoreWins || 0) > 0)
    .sort((a, b) => (b.whoHasMoreWins || 0) - (a.whoHasMoreWins || 0))
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
          const gp  = p.whoHasMoreGamesPlayed || 0
          const w   = p.whoHasMoreWins || 0
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

// ── Games view ───────────────────────────────────────────────────────────────
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

const STAT_OPTIONS = [
  { value: 'ppg', label: 'PPG' },
  { value: 'rpg', label: 'RPG' },
  { value: 'apg', label: 'APG' },
  { value: 'stlg', label: 'STL/G' },
  { value: 'blkg', label: 'BLK/G' },
  { value: 'ming', label: 'MIN/G' },
  { value: 'fg3m', label: 'FG3M' },
]
const DEFAULT_STATS = new Set(['ppg', 'rpg', 'apg'])

// ── Shared modal shell ──────────────────────────────────────────────────────
function Modal({ onClose, children }) {
  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal}>{children}</div>
    </div>
  )
}

// ── Name input modal ────────────────────────────────────────────────────────
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

// ── Add player to slot modal ────────────────────────────────────────────────
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

// ── Season picker modal ─────────────────────────────────────────────────────
function SeasonModal({ allSeasons, current, onConfirm, onClose }) {
  const [draft, setDraft] = useState(new Set(current))

  function toggle(s) {
    setDraft(prev => {
      const next = new Set(prev)
      if (next.has(s)) { if (next.size === 1) return prev; next.delete(s) }
      else next.add(s)
      return next
    })
  }

  return (
    <Modal onClose={onClose}>
      <h3 className={styles.modalTitle}>Select seasons</h3>
      <div className={styles.seasonModalLinks}>
        <button className={styles.textBtn} onClick={() => setDraft(new Set(allSeasons))}>Select all</button>
        <span className={styles.textBtnSep}>·</span>
        <button className={styles.textBtn} onClick={() => setDraft(new Set([allSeasons[0]]))}>Unselect all</button>
      </div>
      <div className={styles.seasonCheckList}>
        {allSeasons.map(s => (
          <label key={s} className={styles.seasonCheckRow}>
            <input
              type="checkbox"
              checked={draft.has(s)}
              onChange={() => toggle(s)}
              className={styles.seasonCheckbox}
            />
            <span className={styles.seasonCheckLabel}>{s}</span>
          </label>
        ))}
      </div>
      <div className={styles.modalActions}>
        <button className={styles.btnPrimary} onClick={() => onConfirm(draft)}>Confirm selection</button>
        <button className={styles.btnSecondary} onClick={onClose}>Back</button>
      </div>
    </Modal>
  )
}

// ── Main screen ─────────────────────────────────────────────────────────────
export default function WhoHasMoreScreen({ onBack, onStart, savedGames, onDeleteGame }) {
  const { players, createPlayer } = usePlayers()
  const [view, setView] = useState(null) // null | 'stats' | 'games'

  const [selectedPlayers, setSelectedPlayers] = useState([null, null, null, null])
  const [addingSlot, setAddingSlot] = useState(null)

  const [allSeasons, setAllSeasons] = useState(['2025-26'])
  const [selectedSeasons, setSelectedSeasons] = useState(new Set(['2025-26']))
  const [showSeasonModal, setShowSeasonModal] = useState(false)

  const [selectedStats, setSelectedStats] = useState(new Set(DEFAULT_STATS))

  const [rounds, setRounds] = useState(5)
  const [optionsPerQuestion, setOptionsPerQuestion] = useState(4)

  useEffect(() => {
    getAvailableSeasons().then(s => {
      setAllSeasons(s)
      setSelectedSeasons(new Set(s))
    }).catch(() => {})
  }, [])

  function clearSlot(idx) {
    setSelectedPlayers(prev => { const next = [...prev]; next[idx] = null; return next })
  }

  function handleAddPlayer(player) {
    if (addingSlot !== null) {
      setSelectedPlayers(prev => { const next = [...prev]; next[addingSlot] = player; return next })
      setAddingSlot(null)
    }
  }

  function toggleStat(value) {
    setSelectedStats(prev => {
      const next = new Set(prev)
      if (next.has(value)) { if (next.size === 1) return prev; next.delete(value) }
      else next.add(value)
      return next
    })
  }

  function seasonLabel() {
    if (selectedSeasons.size === 1) return [...selectedSeasons][0]
    if (selectedSeasons.size === allSeasons.length) return 'All seasons'
    return `${selectedSeasons.size} seasons`
  }

  const slotsUsedIds = selectedPlayers.filter(Boolean).map(p => p.id)
  const activePlayers = selectedPlayers.filter(Boolean)
  const canStart = activePlayers.length >= 1

  return (
    <div className={styles.container}>
      <button className={styles.backArrow} onClick={onBack} aria-label="Back to home">←</button>

      <header className={styles.header}>
        <h1 className={styles.title}>Who Has More</h1>
        <p className={styles.subtitle}>Guess who had higher stats in a given season</p>
      </header>

      <div className={styles.menu}>
        <button className={styles.menuBtn} onClick={() => setView('stats')}>Stats</button>
        <button className={styles.menuBtn} onClick={() => setView('games')}>View games played</button>
      </div>

      <div className={styles.mainContainer}>

        {/* Players */}
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

        {/* Seasons */}
        <div className={styles.section}>
          <span className={styles.sectionLabel}>Season</span>
          <button className={styles.seasonTrigger} onClick={() => setShowSeasonModal(true)}>
            <span className={styles.seasonTriggerLabel}>{seasonLabel()}</span>
            <span className={styles.seasonTriggerCaret}>▾</span>
          </button>
        </div>

        {/* Stats */}
        <div className={styles.section}>
          <span className={styles.sectionLabel}>Stats</span>
          <div className={styles.statChips}>
            {STAT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={`${styles.statChip} ${selectedStats.has(opt.value) ? styles.statChipOn : ''}`}
                onClick={() => toggleStat(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Rounds + Options per question */}
        <div className={styles.section}>
          <div className={styles.optionRow}>
            <div className={styles.optionLabel}>
              <span className={styles.optionTitle}>Rounds</span>
              <span className={styles.optionDesc}>Number of matchups per player</span>
            </div>
            <div className={styles.stepper}>
              <button className={styles.stepBtn} onClick={() => setRounds(r => Math.max(1, r - 1))} disabled={rounds <= 1}>−</button>
              <span className={styles.stepValue}>{rounds}</span>
              <button className={styles.stepBtn} onClick={() => setRounds(r => Math.min(50, r + 1))} disabled={rounds >= 50}>+</button>
            </div>
          </div>
          <div className={styles.optionRow}>
            <div className={styles.optionLabel}>
              <span className={styles.optionTitle}>Options per question</span>
              <span className={styles.optionDesc}>Players to compare at once</span>
            </div>
            <div className={styles.stepper}>
              <button className={styles.stepBtn} onClick={() => setOptionsPerQuestion(n => Math.max(2, n - 1))} disabled={optionsPerQuestion <= 2}>−</button>
              <span className={styles.stepValue}>{optionsPerQuestion}</span>
              <button className={styles.stepBtn} onClick={() => setOptionsPerQuestion(n => Math.min(6, n + 1))} disabled={optionsPerQuestion >= 6}>+</button>
            </div>
          </div>
        </div>

      </div>

      <button
        className={styles.startBtn}
        disabled={!canStart}
        onClick={() => onStart({ players: activePlayers, seasons: [...selectedSeasons], stats: [...selectedStats], rounds, optionsPerQuestion })}
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

      {showSeasonModal && (
        <SeasonModal
          allSeasons={allSeasons}
          current={selectedSeasons}
          onConfirm={draft => { setSelectedSeasons(draft); setShowSeasonModal(false) }}
          onClose={() => setShowSeasonModal(false)}
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
