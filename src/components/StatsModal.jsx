import { useState } from 'react'
import styles from './StatsModal.module.css'

const GAME_TYPES = [
  { key: 'all',           label: 'All Games' },
  { key: 'rosterPicker',  label: 'Roster Picker' },
  { key: 'jerseyGuesser', label: 'Jersey Guesser' },
  { key: 'teamLeaders',   label: 'Team Leaders' },
  { key: 'statsOverUnder', label: 'Stats Over/Under' },
  { key: 'allStars',      label: 'All Stars' },
  { key: 'whosThatGuy',   label: "Who's That Guy?" },
]

function getPlayerStats(player, gameFilter) {
  const stats = player.stats || {}
  if (gameFilter === 'all') {
    const played = Object.values(stats).reduce((sum, g) => sum + (g.played || 0), 0)
    const wins   = Object.values(stats).reduce((sum, g) => sum + (g.wins  || 0), 0)
    return { played, wins }
  }
  const g = stats[gameFilter] || {}
  return { played: g.played || 0, wins: g.wins || 0 }
}

export default function StatsModal({ players, onClose }) {
  const [gameFilter, setGameFilter] = useState('all')

  const rows = players
    .map(p => ({ ...p, ...getPlayerStats(p, gameFilter) }))
    .filter(p => p.played > 0)
    .sort((a, b) => b.wins - a.wins || b.played - a.played || a.name.localeCompare(b.name))

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>Player Stats</h3>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.filterRow}>
          <label className={styles.filterLabel}>Game</label>
          <select
            className={styles.filterSelect}
            value={gameFilter}
            onChange={e => setGameFilter(e.target.value)}
          >
            {GAME_TYPES.map(g => (
              <option key={g.key} value={g.key}>{g.label}</option>
            ))}
          </select>
        </div>

        <div className={styles.tableWrap}>
          <div className={styles.tableHeader}>
            <span className={styles.colPlayer}>Player</span>
            <span className={styles.col}>GP</span>
            <span className={styles.col}>W</span>
            <span className={styles.col}>Win%</span>
          </div>
          {rows.length === 0 && (
            <p className={styles.empty}>No games recorded yet.</p>
          )}
          {rows.map(p => {
            const pct = p.played > 0 ? Math.round((p.wins / p.played) * 100) : 0
            return (
              <div key={p.id} className={styles.tableRow}>
                <span className={styles.colPlayer}>{p.name}</span>
                <span className={styles.col}>{p.played}</span>
                <span className={styles.col}>{p.wins}</span>
                <span className={styles.col}>{pct}%</span>
              </div>
            )
          })}
        </div>

        <div className={styles.footer}>
          <button className={styles.closeAction} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
