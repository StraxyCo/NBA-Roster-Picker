import React, { useState, useEffect } from 'react'
import { usePlayers } from '../hooks/useProfiles.js'
import { ALL_SEASONS } from '../data/seasons.js'
import styles from './StatsOverUnderSetupScreen.module.css'
import { useGameDefaults } from '../hooks/useGameDefaults.js'
import SaveDefaultButton from '../components/SaveDefaultButton.jsx'

function Modal({ onClose, children }) {
  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal}>{children}</div>
    </div>
  )
}

function NameModal({ title, onSave, onClose, saving = false }) {
  const [val, setVal] = useState('')
  const ref = React.useRef(null)
  React.useEffect(() => { ref.current?.focus() }, [])
  return (
    <Modal onClose={onClose}>
      <h3 className={styles.modalTitle}>{title}</h3>
      <input ref={ref} className={styles.modalInput} value={val} onChange={e => setVal(e.target.value)}
        placeholder="First name" maxLength={20} onKeyDown={e => { if (e.key === 'Enter' && val.trim() && !saving) onSave(val.trim()) }} />
      <div className={styles.modalActions}>
        <button className={styles.btnPrimary} onClick={() => val.trim() && !saving && onSave(val.trim())} disabled={!val.trim() || saving}>{saving ? 'Saving…' : 'Save'}</button>
        <button className={styles.btnSecondary} onClick={onClose} disabled={saving}>Cancel</button>
      </div>
    </Modal>
  )
}

function AddPlayerModal({ players, slotsUsed, onSelect, onClose, onCreate }) {
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const available = players.filter(p => !slotsUsed.includes(p.id))
  async function handleCreate(name) { setSaving(true); try { await onCreate(name); onClose() } catch { setSaving(false) } }
  if (showCreate) return <NameModal title="New player" saving={saving} onSave={handleCreate} onClose={() => setShowCreate(false)} />
  return (
    <Modal onClose={onClose}>
      <h3 className={styles.modalTitle}>Add player</h3>
      <div className={styles.playerPickList}>
        {available.length === 0 && <p className={styles.emptyNote}>All players are already in the game.</p>}
        {available.map(p => (
          <button key={p.id} className={styles.playerPickRow} onClick={() => { onSelect(p); onClose() }}>
            <span className={styles.playerPickName}>{p.name}</span>
            <span className={styles.playerPickStat}>{p.stats?.teammateChain?.played || 0} games</span>
          </button>
        ))}
      </div>
      <div className={styles.modalDivider} />
      <button className={styles.btnOutline} onClick={() => setShowCreate(true)}>+ Create new player</button>
    </Modal>
  )
}

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
        <div className={styles.modalActions}><button className={styles.btnSecondary} onClick={onClose}>Close</button></div>
      </Modal>
      {game && (
        <Modal onClose={() => setDeletingId(null)}>
          <p className={styles.confirmMsg}>Delete this game?</p>
          <div className={styles.modalActions}>
            <button className={styles.btnDanger} onClick={async () => { await onDelete(game.id); setDeletingId(null) }}>Delete</button>
            <button className={styles.btnSecondary} onClick={() => setDeletingId(null)}>Cancel</button>
          </div>
        </Modal>
      )}
    </>
  )
}

export default function TeammateChainSetupScreen(props) {
  const { initial, loaded, save, saving } = useGameDefaults('teammateChain')
  if (!loaded) return null
  return <TeammateChainSetupInner {...props} savedDefault={initial} onSaveDefault={save} savingDefault={saving} />
}

function TeammateChainSetupInner({ onBack, onStart, savedGames, onDeleteGame, savedDefault, onSaveDefault, savingDefault }) {
  const d = savedDefault || {}
  const { players, loading, createPlayer } = usePlayers()
  const MAX_SLOTS = 6
  const [selectedPlayers, setSelectedPlayers] = useState(Array(MAX_SLOTS).fill(null))
  const [addingSlot, setAddingSlot] = useState(null)

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
  const [view, setView] = useState(null)
  const [rounds, setRounds] = useState(d.rounds ?? 5)
  const [noSameTeam, setNoSameTeam] = useState(d.noSameTeam ?? true)
  const buildDefaultConfig = () => ({ rounds, noSameTeam })

  function clearSlot(idx) { setSelectedPlayers(prev => { const n = [...prev]; n[idx] = null; return n }) }
  function handleAddPlayer(player) {
    if (addingSlot !== null) { setSelectedPlayers(prev => { const n = [...prev]; n[addingSlot] = player; return n }); setAddingSlot(null) }
  }

  const slotsUsedIds = selectedPlayers.filter(Boolean).map(p => p.id)
  const activePlayers = selectedPlayers.filter(Boolean)
  const canStart = activePlayers.length >= 1

  return (
    <div className={styles.container}>
      <button className={styles.backArrow} onClick={onBack}>←</button>
      <header className={styles.header}>
        <h1 className={styles.title}>Teammate Chain</h1>
        <p className={styles.subtitle}>Link players through shared teammates</p>
      </header>
      <div className={styles.menu}>
        <button className={styles.menuBtn} onClick={() => setView('games')}>Games played</button>
      </div>

      <div className={styles.mainContainer}>
        <div className={styles.section}>
          <h2 className={styles.sectionLabel}>Players</h2>
          <div className={styles.slotsGrid}>
            {selectedPlayers.map((player, i) => (
              <div key={i} className={`${styles.slot} ${player ? styles.slotFilled : styles.slotEmpty}`}>
                {player ? (
                  <><span className={styles.slotName}>{player.name}</span><button className={styles.slotTrash} onClick={() => clearSlot(i)}>✕</button></>
                ) : (
                  <button className={styles.slotAdd} onClick={() => setAddingSlot(i)}>
                    <span className={styles.slotPlus}>+</span><span className={styles.slotAddLabel}>Add player</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionLabel}>Options</h2>

          <div className={styles.optionRow}>
            <div className={styles.optionLabel}>
              <span className={styles.optionTitle}>Rounds</span>
              <span className={styles.optionDesc}>Turns per player</span>
            </div>
            <div className={styles.stepper}>
              <button className={styles.stepBtn} onClick={() => setRounds(r => Math.max(1, r - 1))} disabled={rounds <= 1}>−</button>
              <span className={styles.stepValue}>{rounds}</span>
              <button className={styles.stepBtn} onClick={() => setRounds(r => Math.min(15, r + 1))} disabled={rounds >= 15}>+</button>
            </div>
          </div>

          <div className={styles.optionRow}>
            <div className={styles.optionLabel}>
              <span className={styles.optionTitle}>No same team twice</span>
              <span className={styles.optionDesc}>Can't use the same franchise two links in a row</span>
            </div>
            <button className={`${styles.toggle} ${noSameTeam ? styles.toggleOn : ''}`} onClick={() => setNoSameTeam(v => !v)}>
              <span className={styles.toggleKnob} />
            </button>
          </div>
        </div>
      </div>

      <SaveDefaultButton onSave={() => onSaveDefault(buildDefaultConfig())} saving={savingDefault} />
      <button className={styles.startBtn} disabled={!canStart}
        onClick={() => onStart({ players: activePlayers, rounds, noSameTeam })}>
        Start Game
      </button>

      {addingSlot !== null && <AddPlayerModal players={players} slotsUsed={slotsUsedIds} onSelect={handleAddPlayer} onClose={() => setAddingSlot(null)} onCreate={createPlayer} />}
      {view === 'games' && <GamesView games={savedGames || []} onDelete={onDeleteGame} onClose={() => setView(null)} />}
    </div>
  )
}
