import { useState, useEffect, useRef } from 'react'
import { NBA_TEAMS, getLogoUrl } from '../data/teams.js'
import { fetchRoster } from '../hooks/useRoster.js'
import styles from './TeamDrawScreen.module.css'

const REEL_DURATION = 2800
const TICK_START    = 60
const TICK_END      = 220

function preloadLogos() {
  NBA_TEAMS.forEach(team => {
    const img = new Image()
    img.src = getLogoUrl(team.slug)
  })
}

export default function TeamDrawScreen({
  drawnEntries,        // [{ teamId, season }]
  eliminateTeams,      // bool — remove drawn team+season combo
  eliminateFranchises, // bool — remove all seasons of a drawn team
  seasons,             // string[] — selected seasons
  onTeamDrawn,         // (team, season, players) => void
}) {
  const [phase, setPhase]       = useState('ready')
  const [displayEntry, setDisplay] = useState(null)  // { team, season }
  const [chosenEntry, setChosen]   = useState(null)
  const [error, setError]       = useState(null)
  const rafRef = useRef(null)

  useEffect(() => { preloadLogos() }, [])

  // Build the full pool: one entry per team×season combination
  const fullPool = []
  for (const season of seasons) {
    for (const team of NBA_TEAMS) {
      fullPool.push({ team, season })
    }
  }

  // Filter out drawn entries
  const drawnTeamIds = new Set(drawnEntries.map(e => e.teamId))

  const availablePool = fullPool.filter(entry => {
    if (eliminateFranchises && drawnTeamIds.has(entry.team.id)) return false
    if (eliminateTeams && drawnEntries.some(e => e.teamId === entry.team.id && e.season === entry.season)) return false
    return true
  })

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)]
  }

  async function startSpin() {
    if (availablePool.length === 0) {
      setError('All teams have been drawn!')
      return
    }

    const winner = pickRandom(availablePool)
    setChosen(winner)
    setPhase('spinning')

    const startTime = Date.now()

    function tick() {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / REEL_DURATION, 1)
      const interval = TICK_START + (TICK_END - TICK_START) * Math.pow(progress, 2)

      if (progress < 1) {
        setDisplay(pickRandom(availablePool))
        rafRef.current = setTimeout(tick, interval)
      } else {
        setDisplay(winner)
        setPhase('settling')
        setTimeout(async () => {
          setPhase('loading')
          try {
            const result = await fetchRoster(winner.team.id, winner.season)
            if (result?.error) {
              setError('Could not load roster. Check your connection and try again.')
              return
            }
            setPhase('done')
            setTimeout(() => onTeamDrawn(winner.team, winner.season, result), 900)
          } catch {
            setError('Could not load roster. Check your connection.')
          }
        }, 600)
      }
    }

    tick()
  }

  useEffect(() => () => clearTimeout(rafRef.current), [])

  const displayTeam = displayEntry?.team || NBA_TEAMS[0]
  const displaySeason = displayEntry?.season || ''

  return (
    <div className={styles.screen}>
      <div className={styles.content}>
        <div className={styles.eyebrow}>Team Draw</div>

        {error ? (
          <div className={styles.error}>{error}</div>
        ) : (
          <>
            <div className={`${styles.logoBox}
              ${phase === 'settling' || phase === 'loading' || phase === 'done' ? styles.logoBoxLocked : ''}
              ${phase === 'spinning' ? styles.logoBoxSpinning : ''}`}
            >
              {phase === 'ready' ? (
                <div className={styles.logoPlaceholder}>
                  <span className={styles.questionMark}>?</span>
                </div>
              ) : (
                <img
                  key={displayTeam.slug}
                  src={getLogoUrl(displayTeam.slug)}
                  alt={displayTeam.name}
                  className={styles.logo}
                  onError={e => { e.target.style.opacity = '0.3' }}
                />
              )}
            </div>

            {(phase === 'settling' || phase === 'loading' || phase === 'done') && chosenEntry && (
              <div className={`${styles.teamName} fade-up`}>
                {chosenEntry.team.name}
                {seasons.length > 1 && (
                  <span className={styles.teamSeason}>{chosenEntry.season}</span>
                )}
              </div>
            )}

            {phase === 'loading' && (
              <div className={styles.loadingMsg}>Loading roster<span className={styles.dots}></span></div>
            )}
            {phase === 'done' && (
              <div className={styles.successMsg}>Roster loaded ✓</div>
            )}
            {phase === 'ready' && (
              <button className={styles.spinBtn} onClick={startSpin}>Draw Team</button>
            )}
            {phase === 'spinning' && displayEntry && (
              <div className={styles.spinningName}>
                {displayTeam.name}
                {seasons.length > 1 && <span className={styles.spinningSeason}> · {displaySeason}</span>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
