import { useState, useEffect, useRef } from 'react'
import styles from './SetupScreen.module.css'
import { getAvailableSeasons } from '../hooks/useRoster.js'
import { usePlayers } from '../hooks/useProfiles.js'

// ── Small shared modal shell ────────────────────────────────────────────────
function Modal({ onClose, children }) {
  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal}>{children}</div>
    </div>
  )
}

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

// ── Name input modal (create or edit) ──────────────────────────────────────
function NameModal({ title, initial = '', onSave, onClose, saving = false }) {
  const [val, setVal] = useState(initial)
  const inputRef = useRef(null)
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

// ── Add player to slot modal ────────────────────────────────────────────────
function AddPlayerModal({ players, slotsUsed, onCreate, onSelect, onClose }) {
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
          <p className={styles.emptyNote}>All players are already in the game.</p>
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

// ── Stats view ──────────────────────────────────────────────────────────────
function StatsView({ players, onClose }) {
  const sorted = [...players].sort((a, b) => (b.wins || 0) - (a.wins || 0))
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
        {sorted.length === 0 && <p className={styles.emptyNote}>No players yet.</p>}
        {sorted.map(p => {
          const gp = p.gamesPlayed || 0
          const w = p.wins || 0
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

// ── Manage players view ─────────────────────────────────────────────────────
function ManagePlayersView({ players, onUpdate, onDelete, onClose }) {
  const [editingId, setEditingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const editingPlayer = players.find(p => p.id === editingId)
  const deletingPlayer = players.find(p => p.id === deletingId)

  return (
    <>
      <Modal onClose={onClose}>
        <h3 className={styles.modalTitle}>Manage players</h3>
        <div className={styles.manageList}>
          {players.length === 0 && <p className={styles.emptyNote}>No players created yet.</p>}
          {players.map(p => (
            <div key={p.id} className={styles.manageRow}>
              <span className={styles.manageName}>{p.name}</span>
              <div className={styles.manageActions}>
                <button className={styles.iconBtn} title="Edit" onClick={() => setEditingId(p.id)}>
                  ✏️
                </button>
                <button className={styles.iconBtn} title="Delete" onClick={() => setDeletingId(p.id)}>
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className={styles.modalActions}>
          <button className={styles.btnSecondary} onClick={onClose}>Close</button>
        </div>
      </Modal>

      {editingPlayer && (
        <NameModal
          title="Edit player"
          initial={editingPlayer.name}
          onSave={async name => { await onUpdate(editingPlayer.id, name); setEditingId(null) }}
          onClose={() => setEditingId(null)}
        />
      )}

      {deletingPlayer && (
        <ConfirmModal
          message={`Delete "${deletingPlayer.name}"? This cannot be undone.`}
          onConfirm={async () => { await onDelete(deletingPlayer.id); setDeletingId(null) }}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </>
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

// ── Main SetupScreen ────────────────────────────────────────────────────────
export default function SetupScreen({ onStart, savedGames, onDeleteGame }) {
  const { players, loading, createPlayer, updatePlayer, deletePlayer } = usePlayers()

  // 4 slots — each is null or a player object
  const [slots, setSlots] = useState([null, null, null, null])

  // Season state
  const [allSeasons, setAllSeasons]    = useState(['2025-26'])
  const [selectedSeasons, setSelected] = useState(new Set(['2025-26']))
  const [showSeasonModal, setShowSeasonModal] = useState(false)

  // Game mode
  const [gameMode, setGameMode]   = useState('players') // 'players' | 'teams'
  const [statMode, setStatMode]   = useState('standard')
  const [keepHidden, setKeepHidden] = useState(false)

  // Game options
  const [rosterSize, setRosterSize]   = useState(6)
  const [eliminate, setEliminate]     = useState(true)
  const [elimFranch, setElimFranch]   = useState(false)

  // Popin state
  const [addingSlot, setAddingSlot]     = useState(null)
  const [view, setView]                 = useState(null)

  // Pre-fill top 2 slots with most-played players once loaded
  useEffect(() => {
    if (!loading && players.length > 0) {
      const top = players.slice(0, 2)
      setSlots(prev => {
        const next = [...prev]
        if (!next[0] && top[0]) next[0] = top[0]
        if (!next[1] && top[1]) next[1] = top[1]
        return next
      })
    }
  }, [loading, players])

  useEffect(() => {
    getAvailableSeasons().then(s => {
      setAllSeasons(s)
      setSelected(new Set([s[0]]))
    }).catch(() => {})
  }, [])

  const filledSlots = slots.filter(Boolean)
  const canStart = filledSlots.length >= 1
  const multiSeason = selectedSeasons.size >= 2
  const slotsUsedIds = slots.filter(Boolean).map(p => p.id)

  const PLAYER_STAT_OPTIONS = [
    { value: 'standard', label: 'Standard' },
    { value: 'pts',  label: 'Points' },
    { value: 'reb',  label: 'Rebounds' },
    { value: 'ast',  label: 'Assists' },
    { value: 'stl',  label: 'Steals' },
    { value: 'blk',  label: 'Blocks' },
    { value: 'fg3m', label: '3PM (season total)' },
  ]

  const TEAM_STAT_OPTIONS = [
    { value: 'standard', label: 'Standard' },
    { value: 'wins',   label: 'Wins' },
    { value: 'losses', label: 'Losses' },
  ]

  const statOptions = gameMode === 'teams' ? TEAM_STAT_OPTIONS : PLAYER_STAT_OPTIONS

  function fillSlot(idx, player) {
    setSlots(prev => { const next = [...prev]; next[idx] = player; return next })
  }

  function clearSlot(idx) {
    setSlots(prev => { const next = [...prev]; next[idx] = null; return next })
  }

  async function handleCreateAndFill(name) {
    const player = await createPlayer(name)
    if (addingSlot !== null) fillSlot(addingSlot, player)
  }

  function handleSeasonConfirm(draft) {
    setSelected(draft)
    setShowSeasonModal(false)
  }

  function seasonLabel() {
    if (selectedSeasons.size === 1) return [...selectedSeasons][0]
    if (selectedSeasons.size === allSeasons.length) return 'All seasons'
    return `${selectedSeasons.size} seasons`
  }

  function handleStart() {
    if (!canStart) return
    onStart({
      players: filledSlots.map(p => ({ id: p.id, name: p.name })),
      rosterSize,
      eliminateTeams: eliminate,
      eliminateFranchises: elimFranch,
      seasons: [...selectedSeasons],
      gameMode,
      statMode,
      keepHidden,
    })
  }

  return (
    <div className={styles.screen}>
      <div className={styles.courtLines} aria-hidden="true">
        <div className={styles.courtArc} />
        <div className={styles.courtCenter} />
      </div>

      <div className={styles.content}>
        <header className={styles.header}>
          <div className={styles.badge}>NBA</div>
          <h1 className={styles.title}>Roster<br />Picker</h1>
          <p className={styles.tagline}>Draft your dream squad</p>
        </header>

        {/* Menu */}
        <div className={styles.menu}>
          <button className={styles.menuBtn} onClick={() => setView('stats')}>Stats</button>
          <button className={styles.menuBtn} onClick={() => setView('manage')}>Manage players</button>
          <button className={styles.menuBtn} onClick={() => setView('games')}>View games played</button>
        </div>

        <div className={styles.form}>
          {/* Player slots */}
          <section className={styles.section}>
            <h2 className={styles.sectionLabel}>Players</h2>
            <div className={styles.slotsGrid}>
              {slots.map((player, i) => (
                <div key={i} className={`${styles.slot} ${player ? styles.slotFilled : styles.slotEmpty}`}>
                  {player ? (
                    <>
                      <span className={styles.slotName}>{player.name}</span>
                      <button className={styles.slotTrash} onClick={() => clearSlot(i)} title="Remove">
                        🗑️
                      </button>
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
          </section>

          {/* Season selector */}
          <section className={styles.section}>
            <h2 className={styles.sectionLabel}>Season</h2>
            <button className={styles.seasonTrigger} onClick={() => setShowSeasonModal(true)}>
              <span className={styles.seasonTriggerLabel}>{seasonLabel()}</span>
              <span className={styles.seasonTriggerCaret}>▾</span>
            </button>
          </section>

          {/* Options */}
          <section className={styles.section}>
            <h2 className={styles.sectionLabel}>Options</h2>

            {/* Game mode */}
            <div className={styles.optionRow}>
              <div className={styles.optionLabel}>
                <span className={styles.optionTitle}>Mode</span>
                <span className={styles.optionDesc}>Players or Teams</span>
              </div>
              <div className={styles.modeToggle}>
                <button
                  className={`${styles.modeBtn} ${gameMode === 'players' ? styles.modeBtnOn : ''}`}
                  onClick={() => { setGameMode('players'); setStatMode('standard'); setRosterSize(6) }}
                >Players</button>
                <button
                  className={`${styles.modeBtn} ${gameMode === 'teams' ? styles.modeBtnOn : ''}`}
                  onClick={() => { setGameMode('teams'); setStatMode('standard'); setRosterSize(3) }}
                >Teams</button>
              </div>
            </div>

            {/* Stat mode */}
            <div className={styles.optionRow}>
              <div className={styles.optionLabel}>
                <span className={styles.optionTitle}>Stat</span>
                <span className={styles.optionDesc}>Scoring criteria</span>
              </div>
              <select
                className={styles.select}
                value={statMode}
                onChange={e => setStatMode(e.target.value)}
              >
                {statOptions.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Keep hidden — only when stat mode is not standard */}
            {statMode !== 'standard' && (
              <div className={styles.optionRow}>
                <div className={styles.optionLabel}>
                  <span className={styles.optionTitle}>Keep stats hidden</span>
                  <span className={styles.optionDesc}>Reveal only at the end</span>
                </div>
                <button
                  className={`${styles.toggle} ${keepHidden ? styles.toggleOn : ''}`}
                  onClick={() => setKeepHidden(h => !h)}
                  aria-pressed={keepHidden}
                ><span className={styles.toggleKnob} /></button>
              </div>
            )}

            {/* Roster size — always shown, different range per mode */}
            <div className={styles.optionRow}>
              <div className={styles.optionLabel}>
                <span className={styles.optionTitle}>
                  {gameMode === 'teams' ? 'Number of teams' : 'Roster size'}
                </span>
                <span className={styles.optionDesc}>
                  {gameMode === 'teams' ? 'Teams per roster (1-10)' : 'Players per team'}
                </span>
              </div>
              <div className={styles.stepper}>
                <button className={styles.stepBtn} onClick={() => setRosterSize(s => Math.max(gameMode === 'teams' ? 1 : 5, s - 1))} disabled={rosterSize <= (gameMode === 'teams' ? 1 : 5)}>−</button>
                <span className={styles.stepValue}>{rosterSize}</span>
                <button className={styles.stepBtn} onClick={() => setRosterSize(s => Math.min(gameMode === 'teams' ? 10 : 12, s + 1))} disabled={rosterSize >= (gameMode === 'teams' ? 10 : 12)}>+</button>
              </div>
            </div>

            {/* Eliminate drawn teams — players mode only */}
            {gameMode === 'players' && (
              <div className={styles.optionRow}>
                <div className={styles.optionLabel}>
                  <span className={styles.optionTitle}>Eliminate drawn teams</span>
                  <span className={styles.optionDesc}>A team+season combo can't be drawn twice</span>
                </div>
                <button className={`${styles.toggle} ${eliminate ? styles.toggleOn : ''}`} onClick={() => setEliminate(e => !e)} aria-pressed={eliminate}>
                  <span className={styles.toggleKnob} />
                </button>
              </div>
            )}

            {/* Eliminate drawn franchises */}
            {(gameMode === 'teams' || multiSeason) && (
              <div className={styles.optionRow}>
                <div className={styles.optionLabel}>
                  <span className={styles.optionTitle}>Eliminate drawn franchises</span>
                  <span className={styles.optionDesc}>All seasons of a drawn team are removed</span>
                </div>
                <button className={`${styles.toggle} ${elimFranch ? styles.toggleOn : ''}`} onClick={() => setElimFranch(e => !e)} aria-pressed={elimFranch}>
                  <span className={styles.toggleKnob} />
                </button>
              </div>
            )}
          </section>
        </div>

        <button className={styles.startBtn} onClick={handleStart} disabled={!canStart}>
          Start Game
        </button>
      </div>

      {/* Modals */}
      {addingSlot !== null && (
        <AddPlayerModal
          players={players}
          slotsUsed={slotsUsedIds}
          onCreate={handleCreateAndFill}
          onSelect={p => fillSlot(addingSlot, p)}
          onClose={() => setAddingSlot(null)}
        />
      )}

      {showSeasonModal && (
        <SeasonModal
          allSeasons={allSeasons}
          current={selectedSeasons}
          onConfirm={handleSeasonConfirm}
          onClose={() => setShowSeasonModal(false)}
        />
      )}

      {view === 'stats' && (
        <StatsView players={players} onClose={() => setView(null)} />
      )}

      {view === 'manage' && (
        <ManagePlayersView
          players={players}
          onUpdate={updatePlayer}
          onDelete={deletePlayer}
          onClose={() => setView(null)}
        />
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
