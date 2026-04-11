import { useState, useEffect, useRef } from 'react'
import { NBA_TEAMS, getLogoUrl } from '../data/teams.js'
import { fetchRoster } from '../hooks/useRoster.js'
import styles from './TeamDrawScreen.module.css'

const REEL_DURATION = 2800
const TICK_START    = 60
const TICK_END      = 220

// Preload all logos into the browser cache immediately
function preloadLogos() {
  NBA_TEAMS.forEach(team => {
    const img = new Image()
    img.src = getLogoUrl(team.slug)
  })
}

export default function TeamDrawScreen({ drawnTeams, eliminateTeams, onTeamDrawn }) {
  const [phase, setPhase]         = useState('ready')
  const [displayTeam, setDisplay] = useState(null)
  const [chosenTeam, setChosen]   = useState(null)
  const [error, setError]         = useState(null)
  const rafRef = useRef(null)

  // Kick off preload as soon as this screen mounts
  useEffect(() => { preloadLogos() }, [])

  const availableTeams = eliminateTeams
    ? NBA_TEAMS.filter(t => !drawnTeams.includes(t.id))
    : NBA_TEAMS

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)]
  }

  async function startSpin() {
    console.log('API KEY:', import.meta.env.VITE_BALLDONTLIE_KEY)
    if (availableTeams.length === 0) {
      setError('All teams have been drawn!')
      return
    }

    const winner = pickRandom(availableTeams)
    setChosen(winner)
    setPhase('spinning')

    const startTime = Date.now()

    function tick() {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / REEL_DURATION, 1)
      const interval = TICK_START + (TICK_END - TICK_START) * Math.pow(progress, 2)

      if (progress < 1) {
        setDisplay(pickRandom(availableTeams))
        rafRef.current = setTimeout(tick, interval)
      } else {
        setDisplay(winner)
        setPhase('settling')
        setTimeout(async () => {
          setPhase('loading')
          try {
            const result = await fetchRoster(winner.id)
            if (result?.error) {
              const msg = result.error === 'NO_API_KEY'
                ? 'An API key is required. Add yours on the setup screen.'
                : result.error === 'INVALID_KEY'
                ? 'Invalid API key. Check it on the setup screen.'
                : 'Could not load roster. Check your connection.'
              setError(msg)
              return
            }
            setPhase('done')
            setTimeout(() => onTeamDrawn(winner, result), 900)
          } catch {
            setError('Could not load roster. Check your connection.')
          }
        }, 600)
      }
    }

    tick()
  }

  useEffect(() => () => clearTimeout(rafRef.current), [])

  const team = displayTeam || NBA_TEAMS[0]

  return (
    <div className={styles.screen}>
      <div className={styles.content}>
        <div className={styles.eyebrow}>Team Draw</div>

        {error ? (
          <div className={styles.error}>{error}</div>
        ) : (
          <>
            <div className={`${styles.logoBox} ${phase === 'settling' || phase === 'loading' || phase === 'done' ? styles.logoBoxLocked : ''} ${phase === 'spinning' ? styles.logoBoxSpinning : ''}`}>
              {phase === 'ready' ? (
                <div className={styles.logoPlaceholder}>
                  <span className={styles.questionMark}>?</span>
                </div>
              ) : (
                <img
                  key={team.slug}
                  src={getLogoUrl(team.slug)}
                  alt={team.name}
                  className={styles.logo}
                  onError={e => { e.target.style.opacity = '0.3' }}
                />
              )}
            </div>

            {(phase === 'settling' || phase === 'loading' || phase === 'done') && chosenTeam && (
              <div className={`${styles.teamName} fade-up`}>
                {chosenTeam.name}
              </div>
            )}

            {phase === 'loading' && (
              <div className={styles.loadingMsg}>
                Loading roster<span className={styles.dots}></span>
              </div>
            )}

            {phase === 'done' && (
              <div className={styles.successMsg}>Roster loaded ✓</div>
            )}

            {phase === 'ready' && (
              <button className={styles.spinBtn} onClick={startSpin}>
                Draw Team
              </button>
            )}

            {phase === 'spinning' && displayTeam && (
              <div className={styles.spinningName}>{displayTeam.name}</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
