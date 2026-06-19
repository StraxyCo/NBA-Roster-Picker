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
    featured: true,
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
    active: false,
    hidden: true, // masked from the menu (Vercel load) — route/code kept
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
  {
    path: '/the-grid',
    name: 'The Grid',
    desc: 'Fill a grid matching players to two categories at once.',
    active: true,
  },
  {
    path: '/teammate-chain',
    name: 'Teammate Chain',
    desc: 'Link NBA players through shared teammates.',
    active: true,
  },
]

export default function HomeScreen() {
  const navigate = useNavigate()
  const { players, loading } = usePlayers()
  const [showStats, setShowStats] = useState(false)

  const activeGames  = GAMES.filter(g => g.active && !g.hidden)
  const comingSoon   = GAMES.filter(g => !g.active && !g.hidden)

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
          {activeGames.map((game, i) => (
            <button
              key={game.path}
              className={`${styles.gameCard} ${game.featured ? styles.gameCardFeatured : ''}`}
              onClick={() => navigate(game.path)}
            >
              <div className={styles.cardTop}>
                <span className={styles.gameNum}>{String(i + 1).padStart(2, '0')}</span>
                {game.featured && <span className={styles.featuredChip}>Featured</span>}
              </div>
              <div className={styles.gameInfo}>
                <h2>{game.name}</h2>
                <p>{game.desc}</p>
              </div>
            </button>
          ))}

          {comingSoon.map(game => (
            <div key={game.path} className={`${styles.gameCard} ${styles.gameCardDisabled}`}>
              <div className={styles.cardTop}>
                <span className={styles.gameNum}>—</span>
                <span className={styles.comingSoonBadge}>Soon</span>
              </div>
              <div className={styles.gameInfo}>
                <h2>{game.name}</h2>
                <p>{game.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showStats && (
        <StatsModal players={players} onClose={() => setShowStats(false)} />
      )}
    </div>
  )
}
