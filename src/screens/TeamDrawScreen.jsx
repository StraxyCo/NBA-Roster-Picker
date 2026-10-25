import { useState, useEffect, useRef } from 'react'
import { NBA_TEAMS, getLogoUrl } from '../data/teams.js'
import { fetchRoster } from '../hooks/useRoster.js'
import { hasEnoughGamesPlayed } from '../utils/leaderEligibility.js'
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
  pool: explicitPool,  // optional [{ team, season }] — pre-filtered pool (joker redraws)
  showSeason,          // optional bool — show the season label on the reel
  requireFullSample,   // optional bool — drop teams whose season is too young to judge
  onTeamDrawn,         // (team, season, players) => void
}) {
  const [phase, setPhase]       = useState('ready')
  const [displayEntry, setDisplay] = useState(null)  // { team, season }
  const [chosenEntry, setChosen]   = useState(null)
  const [error, setError]       = useState(null)
  const [pool, setPool]         = useState(null)
  const rafRef = useRef(null)
  const startedRef = useRef(false)
  const sampleBlockedRef = useRef(false)

  useEffect(() => { preloadLogos() }, [])

  // Use a pre-filtered pool when given (joker redraws), else build + filter the
  // full pool. Dropping teams by games played needs their rosters, so the pool
  // resolves asynchronously and the spin waits for it.
  useEffect(() => {
    if (explicitPool) { setPool(explicitPool); return }

    const fullPool = []
    for (const season of seasons) for (const team of NBA_TEAMS) fullPool.push({ team, season })
    const drawnTeamIds = new Set(drawnEntries.map(e => e.teamId))
    const remaining = fullPool.filter(entry => {
      if (eliminateFranchises && drawnTeamIds.has(entry.team.id)) return false
      if (eliminateTeams && drawnEntries.some(e => e.teamId === entry.team.id && e.season === entry.season)) return false
      return true
    })

    if (!requireFullSample) { setPool(remaining); return }

    let cancelled = false
    ;(async () => {
      // rosters.json is one cached blob, so these resolve from memory after
      // the first read.
      const checked = await Promise.all(remaining.map(async entry => {
        const roster = await fetchRoster(entry.team.id, entry.season)
        return hasEnoughGamesPlayed(roster) ? entry : null
      }))
      const playable = checked.filter(Boolean)
      sampleBlockedRef.current = remaining.length > 0 && playable.length === 0
      if (!cancelled) setPool(playable)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const showSeasonLabel = showSeason ?? (seasons.length > 1)

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)]
  }

  async function startSpin(availablePool) {
    if (availablePool.length === 0) {
      setError(sampleBlockedRef.current
        ? 'No team has played enough games this season yet — pick another season.'
        : 'All teams have been drawn!')
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

  // Auto-launch the draw as soon as the pool is known, so the recap screen's
  // "Draw team" button goes straight into the reel (no extra click here).
  useEffect(() => {
    if (pool === null || startedRef.current) return
    startedRef.current = true
    startSpin(pool)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool])

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
                {showSeasonLabel && (
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
            {phase === 'spinning' && displayEntry && (
              <div className={styles.spinningName}>
                {displayTeam.name}
                {showSeasonLabel && <span className={styles.spinningSeason}> · {displaySeason}</span>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
