import { useState, useEffect, useRef } from 'react'
import styles from './SetupScreen.module.css'
import { getAvailableSeasons } from '../hooks/useRoster.js'
import { usePlayers } from '../hooks/useProfiles.js'
import { useGameDefaults } from '../hooks/useGameDefaults.js'
import SaveDefaultButton from '../components/SaveDefaultButton.jsx'

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
            <span className={styles.playerPickStat}>{(p.stats?.rosterPicker?.played || 0)} games</span>
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
  const sorted = [...players].sort((a, b) => (b.stats?.rosterPicker?.wins || 0) - (a.stats?.rosterPicker?.wins || 0))
  return (
    <Modal onClose={onClose}>
      <h3 className={styles.modalTitle}>Roster Picker Stats</h3>
      <div className={styles.statsTable}>
        <div className={styles.statsHeader}>
          <span className={styles.statsColPlayer}>Player</span>
          <span className={styles.statsCol}>GP</span>
          <span className={styles.statsCol}>Wins</span>
          <span className={styles.statsCol}>Win%</span>
        </div>
        {sorted.length === 0 && <p className={styles.emptyNote}>No players yet.</p>}
        {sorted.map(p => {
          const gp = p.stats?.rosterPicker?.played || 0
          const w  = p.stats?.rosterPicker?.wins   || 0
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
// Wrapper: resolve the saved default before the form mounts, then render the inner
// with it merged into initialConfig (session lastGameConfig wins for replay).
export default function SetupScreen(props) {
  const { initial, loaded, save, saving } = useGameDefaults('rosterPicker')
  if (!loaded) return null
  const merged = (initial || props.initialConfig)
    ? { ...(initial || {}), ...(props.initialConfig || {}) }
    : null
  return <SetupScreenInner {...props} initialConfig={merged} onSaveDefault={save} savingDefault={saving} />
}

function SetupScreenInner({ onStart, savedGames, onDeleteGame, onBack, initialConfig = null, onSaveDefault, savingDefault }) {
  const { players, loading, createPlayer, updatePlayer, deletePlayer } = usePlayers()

  // 4 slots — each is null or a player object
  const [slots, setSlots] = useState([null, null, null, null])

  // Season state
  const [allSeasons, setAllSeasons]    = useState(['2025-26'])
  const [selectedSeasons, setSelected] = useState(
    initialConfig ? new Set(initialConfig.seasons) : new Set(['2025-26'])
  )
  const [showSeasonModal, setShowSeasonModal] = useState(false)

  // Game mode
  const [gameMode, setGameMode]   = useState(initialConfig?.gameMode ?? 'players')
  const [statMode, setStatMode]   = useState(initialConfig?.statMode ?? 'standard')
  const [keepHidden, setKeepHidden] = useState(initialConfig?.keepHidden ?? false)

  // Game options
  const [rosterSize, setRosterSize]   = useState(initialConfig?.rosterSize ?? 6)
  const [eliminate, setEliminate]     = useState(initialConfig?.eliminateTeams ?? true)
  const [elimFranch, setElimFranch]   = useState(initialConfig?.eliminateFranchises ?? false)
  const [bans, setBans]               = useState(initialConfig?.bans ?? 3)

  // Bonuses (jokers) — players mode only
  const [playBonuses, setPlayBonuses] = useState(initialConfig?.bonuses?.enabled ?? true)
  const [bonusYear, setBonusYear]     = useState(initialConfig?.bonuses?.year ?? 1)
  const [bonusTeam, setBonusTeam]     = useState(initialConfig?.bonuses?.team ?? 1)
  const [bonusAll, setBonusAll]       = useState(initialConfig?.bonuses?.all ?? 1)

  // Popin state
  const [addingSlot, setAddingSlot]     = useState(null)
  const [view, setView]                 = useState(null)

  // Pre-fill slots from last game's players (by id match), or fall back to top 2 most-played
  useEffect(() => {
    if (!loading && players.length > 0) {
      if (initialConfig?.players?.length) {
        const configPlayers = initialConfig.players
        setSlots(prev => {
          const next = [...prev]
          configPlayers.forEach((cp, i) => {
            if (i < 4 && !next[i]) {
              const found = players.find(p => p.id === cp.id)
              if (found) next[i] = found
            }
          })
          return next
        })
      } else {
        const top = players.slice(0, 2)
        setSlots(prev => {
          const next = [...prev]
          if (!next[0] && top[0]) next[0] = top[0]
          if (!next[1] && top[1]) next[1] = top[1]
          return next
        })
      }
    }
  }, [loading, players])

  useEffect(() => {
    getAvailableSeasons().then(s => {
      setAllSeasons(s)
      // Only reset selected seasons if no initialConfig provided
      if (!initialConfig) setSelected(new Set(s))
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

  function bonusesPayload() {
    return playBonuses
      ? { enabled: true, year: multiSeason ? bonusYear : 0, team: bonusTeam, all: multiSeason ? bonusAll : 0 }
      : { enabled: false, year: 0, team: 0, all: 0 }
  }

  // Options only (no human players) — what "Save as default" persists.
  function buildDefaultConfig() {
    return {
      rosterSize,
      eliminateTeams: eliminate,
      eliminateFranchises: elimFranch,
      seasons: [...selectedSeasons],
      gameMode,
      statMode,
      keepHidden,
      bans,
      bonuses: bonusesPayload(),
    }
  }

  function handleStart() {
    if (!canStart) return
    onStart({ players: filledSlots.map(p => ({ id: p.id, name: p.name })), ...buildDefaultConfig() })
  }

  return (
    <div className={styles.screen}>
      <button className={styles.backArrow} onClick={onBack} aria-label="Back to home">
        ←
      </button>

      <div className={styles.courtLines} aria-hidden="true">
        <div className={styles.courtArc} />
        <div className={styles.courtCenter} />
      </div>

      <div className={styles.content}>

        {/* FULL WIDTH TOP — header + menu */}
        <div className={styles.top}>
          <header className={styles.header}>
            <div className={styles.badge}>NBA</div>
            <h1 className={styles.title}>Roster<br />Picker</h1>
            <p className={styles.tagline}>Draft your dream squad</p>
          </header>

          <div className={styles.menu}>
            <button className={styles.menuBtn} onClick={() => setView('stats')}>Stats</button>
            <button className={styles.menuBtn} onClick={() => setView('manage')}>Manage players</button>
            <button className={styles.menuBtn} onClick={() => setView('games')}>View games played</button>
          </div>
        </div>

        {/* TWO COLUMNS */}
        <div className={styles.cols}>

          {/* LEFT — players + season */}
          <div className={styles.colLeft}>
            <section className={styles.section}>
              <h2 className={styles.sectionLabel}>Players</h2>
              <div className={styles.slotsGrid}>
                {slots.map((player, i) => (
                  <div key={i} className={`${styles.slot} ${player ? styles.slotFilled : styles.slotEmpty}`}>
                    {player ? (
                      <>
                        <span className={styles.slotName}>{player.name}</span>
                        <button className={styles.slotTrash} onClick={() => clearSlot(i)} title="Remove">🗑️</button>
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

            <section className={styles.section}>
              <h2 className={styles.sectionLabel}>Season</h2>
              <button className={styles.seasonTrigger} onClick={() => setShowSeasonModal(true)}>
                <span className={styles.seasonTriggerLabel}>{seasonLabel()}</span>
                <span className={styles.seasonTriggerCaret}>▾</span>
              </button>
            </section>
          </div>

          {/* RIGHT — options */}
          <div className={styles.colRight}>
            <section className={styles.section}>
              <h2 className={styles.sectionLabel}>Options</h2>

              <div className={styles.optionRow}>
                <div className={styles.optionLabel}>
                  <span className={styles.optionTitle}>Mode</span>
                  <span className={styles.optionDesc}>Players or Teams</span>
                </div>
                <div className={styles.modeToggle}>
                  <button className={`${styles.modeBtn} ${gameMode === 'players' ? styles.modeBtnOn : ''}`} onClick={() => { setGameMode('players'); setStatMode('standard'); setRosterSize(6) }}>Players</button>
                  <button className={`${styles.modeBtn} ${gameMode === 'teams' ? styles.modeBtnOn : ''}`} onClick={() => { setGameMode('teams'); setStatMode('standard'); setRosterSize(3) }}>Teams</button>
                </div>
              </div>

              <div className={styles.optionRow}>
                <div className={styles.optionLabel}>
                  <span className={styles.optionTitle}>Stat</span>
                  <span className={styles.optionDesc}>Scoring criteria</span>
                </div>
                <select className={styles.select} value={statMode} onChange={e => setStatMode(e.target.value)}>
                  {statOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {statMode !== 'standard' && (
                <div className={styles.optionRow}>
                  <div className={styles.optionLabel}>
                    <span className={styles.optionTitle}>Keep stats hidden</span>
                    <span className={styles.optionDesc}>Reveal only at the end</span>
                  </div>
                  <button className={`${styles.toggle} ${keepHidden ? styles.toggleOn : ''}`} onClick={() => setKeepHidden(h => !h)} aria-pressed={keepHidden}>
                    <span className={styles.toggleKnob} />
                  </button>
                </div>
              )}

              <div className={styles.optionRow}>
                <div className={styles.optionLabel}>
                  <span className={styles.optionTitle}>{gameMode === 'teams' ? 'Number of teams' : 'Roster size'}</span>
                  <span className={styles.optionDesc}>{gameMode === 'teams' ? 'Teams per roster (1–10)' : 'Players per team'}</span>
                </div>
                <div className={styles.stepper}>
                  <button className={styles.stepBtn} onClick={() => setRosterSize(s => Math.max(gameMode === 'teams' ? 1 : 5, s - 1))} disabled={rosterSize <= (gameMode === 'teams' ? 1 : 5)}>−</button>
                  <span className={styles.stepValue}>{rosterSize}</span>
                  <button className={styles.stepBtn} onClick={() => setRosterSize(s => Math.min(gameMode === 'teams' ? 10 : 12, s + 1))} disabled={rosterSize >= (gameMode === 'teams' ? 10 : 12)}>+</button>
                </div>
              </div>

              <div className={styles.optionRow}>
                <div className={styles.optionLabel}>
                  <span className={styles.optionTitle}>Player bans</span>
                  <span className={styles.optionDesc}>Per player, per game</span>
                </div>
                <div className={styles.stepper}>
                  <button className={styles.stepBtn} onClick={() => setBans(b => Math.max(0, b - 1))} disabled={bans <= 0}>−</button>
                  <span className={styles.stepValue}>{bans}</span>
                  <button className={styles.stepBtn} onClick={() => setBans(b => Math.min(10, b + 1))} disabled={bans >= 10}>+</button>
                </div>
              </div>

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

              {gameMode === 'players' && (
                <div className={styles.optionRow}>
                  <div className={styles.optionLabel}>
                    <span className={styles.optionTitle}>Play with bonuses</span>
                    <span className={styles.optionDesc}>Jokers to redraw a team or season</span>
                  </div>
                  <button className={`${styles.toggle} ${playBonuses ? styles.toggleOn : ''}`} onClick={() => setPlayBonuses(b => !b)} aria-pressed={playBonuses}>
                    <span className={styles.toggleKnob} />
                  </button>
                </div>
              )}

              {gameMode === 'players' && playBonuses && multiSeason && (
                <div className={styles.optionRow}>
                  <div className={styles.optionLabel}>
                    <span className={styles.optionTitle}>Redraw season</span>
                    <span className={styles.optionDesc}>Keep the team, redraw the season</span>
                  </div>
                  <div className={styles.stepper}>
                    <button className={styles.stepBtn} onClick={() => setBonusYear(n => Math.max(0, n - 1))} disabled={bonusYear <= 0}>−</button>
                    <span className={styles.stepValue}>{bonusYear}</span>
                    <button className={styles.stepBtn} onClick={() => setBonusYear(n => Math.min(5, n + 1))} disabled={bonusYear >= 5}>+</button>
                  </div>
                </div>
              )}

              {gameMode === 'players' && playBonuses && (
                <div className={styles.optionRow}>
                  <div className={styles.optionLabel}>
                    <span className={styles.optionTitle}>Redraw team</span>
                    <span className={styles.optionDesc}>Keep the season, redraw the team</span>
                  </div>
                  <div className={styles.stepper}>
                    <button className={styles.stepBtn} onClick={() => setBonusTeam(n => Math.max(0, n - 1))} disabled={bonusTeam <= 0}>−</button>
                    <span className={styles.stepValue}>{bonusTeam}</span>
                    <button className={styles.stepBtn} onClick={() => setBonusTeam(n => Math.min(5, n + 1))} disabled={bonusTeam >= 5}>+</button>
                  </div>
                </div>
              )}

              {gameMode === 'players' && playBonuses && multiSeason && (
                <div className={styles.optionRow}>
                  <div className={styles.optionLabel}>
                    <span className={styles.optionTitle}>Redraw all</span>
                    <span className={styles.optionDesc}>Redraw a new team + season</span>
                  </div>
                  <div className={styles.stepper}>
                    <button className={styles.stepBtn} onClick={() => setBonusAll(n => Math.max(0, n - 1))} disabled={bonusAll <= 0}>−</button>
                    <span className={styles.stepValue}>{bonusAll}</span>
                    <button className={styles.stepBtn} onClick={() => setBonusAll(n => Math.min(5, n + 1))} disabled={bonusAll >= 5}>+</button>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>

        {/* FULL WIDTH BOTTOM — start button */}
        <SaveDefaultButton onSave={() => onSaveDefault(buildDefaultConfig())} saving={savingDefault} />
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
