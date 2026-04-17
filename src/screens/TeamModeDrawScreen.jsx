import { useState, useEffect, useRef } from 'react'
import { NBA_TEAMS, getLogoUrl } from '../data/teams.js'
import { fetchStandings } from '../hooks/useRoster.js'
import styles from './TeamModeDrawScreen.module.css'

const REEL_DURATION = 2800
const TICK_START    = 60
const TICK_END      = 220

function preloadLogos() {
  NBA_TEAMS.forEach(t => { const img = new Image(); img.src = getLogoUrl(t.slug) })
}

export default function TeamModeDrawScreen({
  seasons,
  drawnEntries,
  eliminateFranchises,
  statMode,
  keepHidden,
  onFranchiseDrawn,
  onSeasonChosen,
}) {
  const [phase, setPhase]           = useState('ready')
  const [displayTeam, setDisplay]   = useState(null)
  const [chosenTeam, setChosen]     = useState(null)
  const [selectedSeason, setSeason] = useState(seasons[0] || '')
  const [error, setError]           = useState(null)
  const rafRef = useRef(null)

  useEffect(() => { preloadLogos() }, [])

  const drawnFranchiseIds = new Set(drawnEntries.map(e => e.teamId))
  const availableTeams = eliminateFranchises
    ? NBA_TEAMS.filter(t => !drawnFranchiseIds.has(t.id))
    : NBA_TEAMS

  function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)] }

  function startSpin() {
    if (availableTeams.length === 0) { setError('All franchises have been drawn!'); return }
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
        setTimeout(() => {
          onFranchiseDrawn(winner)   // notify parent (for eliminate logic)
          setSeason(seasons[0] || '')
          setPhase('season')
        }, 700)
      }
    }
    tick()
  }

  async function confirmSeason() {
    const wl = statMode !== 'standard'
      ? await fetchStandings(chosenTeam.id, selectedSeason)
      : { w: 0, l: 0 }
    onSeasonChosen(chosenTeam, selectedSeason, wl)
  }

  useEffect(() => () => clearTimeout(rafRef.current), [])

  const displayedTeam = displayTeam || NBA_TEAMS[0]

  return (
    <div className={styles.screen}>
      <div className={styles.content}>

        {/* ── DRAW PHASE ── */}
        {(phase === 'ready' || phase === 'spinning' || phase === 'settling') && (
          <>
            <div className={styles.eyebrow}>Franchise Draw</div>
            {error && <div className={styles.error}>{error}</div>}

            <div className={`${styles.logoBox}
              ${phase === 'settling' ? styles.logoBoxLocked : ''}
              ${phase === 'spinning' ? styles.logoBoxSpinning : ''}`}
            >
              {phase === 'ready' ? (
                <div className={styles.logoPlaceholder}>
                  <span className={styles.questionMark}>?</span>
                </div>
              ) : (
                <img
                  key={displayedTeam.slug}
                  src={getLogoUrl(displayedTeam.slug)}
                  alt={displayedTeam.name}
                  className={styles.logo}
                  onError={e => { e.target.style.opacity = '0.3' }}
                />
              )}
            </div>

            {phase === 'settling' && chosenTeam && (
              <div className={`${styles.teamName} fade-up`}>{chosenTeam.name}</div>
            )}
            {phase === 'spinning' && displayTeam && (
              <div className={styles.spinningName}>{displayedTeam.name}</div>
            )}
            {phase === 'ready' && (
              <button className={styles.spinBtn} onClick={startSpin}>Draw Franchise</button>
            )}
          </>
        )}

        {/* ── SEASON PICK PHASE ── */}
        {phase === 'season' && chosenTeam && (
          <div className={`${styles.seasonPick} fade-up`}>
            <div className={styles.eyebrow}>Choose a season</div>

            <div className={styles.drawnTeam}>
              <img
                src={getLogoUrl(chosenTeam.slug)}
                alt={chosenTeam.name}
                className={styles.teamLogoSm}
                onError={e => { e.target.style.opacity = '0.3' }}
              />
              <span className={styles.teamNameSm}>{chosenTeam.name}</span>
            </div>

            <select
              className={styles.seasonSelect}
              value={selectedSeason}
              onChange={e => setSeason(e.target.value)}
            >
              {seasons.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <button className={styles.spinBtn} onClick={confirmSeason}>
              Confirm →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
