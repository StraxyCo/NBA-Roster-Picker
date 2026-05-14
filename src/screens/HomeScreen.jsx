import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayers } from '../hooks/useProfiles.js'
import StatsModal from '../components/StatsModal.jsx'
import styles from './HomeScreen.module.css'

const GAMES = [
  {
    path: '/roster-picker',
    name: 'Roster Picker',
    desc: 'Draft your ultimate roster from historical NBA seasons.',
    active: true,
  },
  {
    path: '/jersey-guesser',
    name: 'Jersey Number Guesser',
    desc: 'Guess the jersey number of current NBA players.',
    active: true,
  },
  {
    path: '/who-has-more',
    name: 'Who Has More?',
    desc: 'Guess which player had higher stats in a given season.',
    active: true,
  },
  {
    path: '/team-leaders',
    name: 'Team Leaders',
    desc: 'Guess who led a team in points, rebounds, and assists.',
    active: true,
  },
  {
    path: '/stats-over-under',
    name: 'Stats Over/Under',
    desc: 'Bet over or under on a player\'s season statistics.',
    active: true,
  },
  {
    path: '/all-stars',
    name: 'All Stars',
    desc: 'Sort All-Star players into their East or West conference.',
    active: true,
  },
  {
    path: '/whos-that-guy',
    name: "Who's That Guy?",
    desc: 'Identify a player from their career stat line.',
    active: true,
  },
  {
    path: '/nickname-game',
    name: 'The Nickname Game',
    desc: 'Guess the player from their nickname.',
    active: true,
  },
]

export default function HomeScreen() {
  const navigate = useNavigate()
  const { players, loading } = usePlayers()
  const [showStats, setShowStats] = useState(false)

  const activeGames  = GAMES.filter(g => g.active)
  const comingSoon   = GAMES.filter(g => !g.active)

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>NBA Party Games</h1>
          <button
            className={styles.statsBtn}
            onClick={() => setShowStats(true)}
            disabled={loading}
          >
            Stats
          </button>
        </div>
        <p className={styles.subtitle}>Select a game to play</p>
      </header>

      <div className={styles.section}>
        <div className={styles.gameList}>
          {activeGames.map(game => (
            <button
              key={game.path}
              className={styles.gameCard}
              onClick={() => navigate(game.path)}
            >
              <div className={styles.gameInfo}>
                <h2>{game.name}</h2>
                <p>{game.desc}</p>
              </div>
              <div className={styles.arrow}>→</div>
            </button>
          ))}
        </div>
      </div>

      {comingSoon.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Coming Soon</div>
          <div className={styles.gameList}>
            {comingSoon.map(game => (
              <div key={game.path} className={`${styles.gameCard} ${styles.gameCardDisabled}`}>
                <div className={styles.gameInfo}>
                  <h2>{game.name}</h2>
                  <p>{game.desc}</p>
                </div>
                <div className={styles.comingSoonBadge}>Soon</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showStats && (
        <StatsModal players={players} onClose={() => setShowStats(false)} />
      )}
    </div>
  )
}
