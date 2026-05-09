import { useState, useEffect, useRef } from 'react'
import styles from './WhoHasMoreGameScreen.module.css'
import { pickNWeightedPlayers } from '../utils/playerSelection.js'

const REEL_DURATION = 2800
const TICK_START    = 60
const TICK_END      = 220

const STAT_CONFIG = {
  ppg:  { key: 'pts',  label: 'PPG',   questionText: 'scored the most points per game',    format: v => v.toFixed(1) },
  rpg:  { key: 'reb',  label: 'RPG',   questionText: 'had the most rebounds per game',      format: v => v.toFixed(1) },
  apg:  { key: 'ast',  label: 'APG',   questionText: 'had the most assists per game',       format: v => v.toFixed(1) },
  stlg: { key: 'stl',  label: 'STL/G', questionText: 'had the most steals per game',        format: v => v.toFixed(1) },
  blkg: { key: 'blk',  label: 'BLK/G', questionText: 'had the most blocks per game',        format: v => v.toFixed(1) },
  ming: { key: 'min',  label: 'MIN/G', questionText: 'played the most minutes per game',    format: v => v.toFixed(1) },
  fg3m: { key: 'fg3m', label: 'FG3M',  questionText: 'made the most three-pointers',        format: v => String(Math.round(v)) },
}

function getHeadshotUrl(id) {
  return `https://cdn.nba.com/headshots/nba/latest/1040x760/${id}.png`
}

function formatSeason(s) {
  return s.replace('-', '/')
}

function getSeasonPlayers(rostersData, season) {
  const seasonData = rostersData[season] || {}
  const seen = new Set()
  const all = []
  for (const teamPlayers of Object.values(seasonData)) {
    for (const p of teamPlayers) {
      if (!seen.has(p.id)) { seen.add(p.id); all.push(p) }
    }
  }
  return all
}

// ── Player card button ───────────────────────────────────────────────────────
function PlayerCard({ player, statConf, onClick, highlight, dimmed, chosen, disabled }) {
  const [imgError, setImgError] = useState(false)
  const statVal = statConf ? player[statConf.key] ?? 0 : null

  return (
    <button
      className={[
        styles.playerCard,
        highlight  ? styles.playerCardWinner : '',
        dimmed && !highlight ? styles.playerCardDimmed : '',
        chosen && !highlight ? styles.playerCardWrong  : '',
      ].join(' ')}
      onClick={onClick}
      disabled={disabled}
    >
      <div className={styles.headshotWrap}>
        {!imgError ? (
          <img
            src={getHeadshotUrl(player.id)}
            alt={player.name}
            className={styles.headshot}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className={styles.headshotFallback}>{player.name[0]}</div>
        )}
        {highlight && <div className={styles.winnerBadge}>✓</div>}
      </div>
      <span className={styles.playerName}>{player.name}</span>
      {statVal !== null && (
        <span className={styles.statLabel}>{statConf.format(statVal)} {statConf.label}</span>
      )}
    </button>
  )
}

// ── Main game screen ─────────────────────────────────────────────────────────
export default function WhoHasMoreGameScreen({ players, seasons, stats, rounds, optionsPerQuestion, onBack, onSaveGame }) {
  const [rostersData, setRostersData] = useState(null)
  const [phase, setPhase]             = useState('loading')
  // season_draw sub-states
  const [drawAnim, setDrawAnim]       = useState('ready') // ready | spinning | done
  const [displaySeason, setDisplaySeason] = useState(null)

  const [roundIdx, setRoundIdx]           = useState(0)
  const [participantIdx, setParticipantIdx] = useState(0)
  const [currentSeason, setCurrentSeason] = useState(null)
  const [currentStat, setCurrentStat]     = useState(null)
  const [currentNbaPlayers, setCurrentNbaPlayers] = useState([])
  const [usedPlayerIds, setUsedPlayerIds] = useState(new Set())
  const [scores, setScores] = useState(() => Object.fromEntries(players.map(p => [p.name, 0])))
  const [isCorrect, setIsCorrect]   = useState(null)
  const [chosenPlayer, setChosenPlayer] = useState(null)

  const timerRef = useRef(null)

  useEffect(() => {
    fetch('/rosters.json')
      .then(r => r.json())
      .then(data => { setRostersData(data); setPhase('season_draw') })
    return () => clearTimeout(timerRef.current)
  }, [])

  function startSpin() {
    const chosenSeason = seasons[Math.floor(Math.random() * seasons.length)]
    const chosenStat   = stats[Math.floor(Math.random() * stats.length)]
    setDrawAnim('spinning')

    const startTime = Date.now()
    function tick() {
      const elapsed  = Date.now() - startTime
      const progress = Math.min(elapsed / REEL_DURATION, 1)
      const interval = TICK_START + (TICK_END - TICK_START) * Math.pow(progress, 2)
      if (progress < 1) {
        setDisplaySeason(seasons[Math.floor(Math.random() * seasons.length)])
        timerRef.current = setTimeout(tick, interval)
      } else {
        setDisplaySeason(chosenSeason)
        setCurrentSeason(chosenSeason)
        setCurrentStat(chosenStat)
        setDrawAnim('done')
        // Auto-advance to first question after a brief reveal
        timerRef.current = setTimeout(() => {
          const seasonPlayers = getSeasonPlayers(rostersData, chosenSeason)
          const picked = pickNWeightedPlayers(seasonPlayers, optionsPerQuestion, new Set())
          const newUsed = new Set(picked.map(p => p.id))
          setCurrentNbaPlayers(picked)
          setUsedPlayerIds(newUsed)
          setParticipantIdx(0)
          setPhase('question')
        }, 1200)
      }
    }
    tick()
  }

  function handleAnswer(nbaPlayer) {
    const statKey = STAT_CONFIG[currentStat].key
    const maxVal  = Math.max(...currentNbaPlayers.map(p => p[statKey] ?? 0))
    const correct = (nbaPlayer[statKey] ?? 0) >= maxVal
    setChosenPlayer(nbaPlayer)
    setIsCorrect(correct)
    if (correct) {
      const participant = players[participantIdx]
      setScores(prev => ({ ...prev, [participant.name]: prev[participant.name] + 1 }))
    }
    setPhase('feedback')
  }

  function handleNext() {
    const nextParticipant = participantIdx + 1
    if (nextParticipant < players.length) {
      // More participants left in this round — pick fresh players they haven't seen
      const seasonPlayers = getSeasonPlayers(rostersData, currentSeason)
      const picked  = pickNWeightedPlayers(seasonPlayers, optionsPerQuestion, usedPlayerIds)
      const newUsed = new Set([...usedPlayerIds, ...picked.map(p => p.id)])
      setCurrentNbaPlayers(picked)
      setUsedPlayerIds(newUsed)
      setParticipantIdx(nextParticipant)
      setPhase('question')
    } else {
      const nextRound = roundIdx + 1
      if (nextRound >= rounds) {
        // Save game before showing recap
        const finalScores = scores // captured in closure
        const sorted   = [...players].sort((a, b) => (finalScores[b.name] ?? 0) - (finalScores[a.name] ?? 0))
        const topScore = finalScores[sorted[0]?.name] ?? 0
        const isTie    = sorted.length > 1 && (finalScores[sorted[1].name] ?? 0) === topScore
        const winner   = isTie ? null : sorted[0]
        onSaveGame?.({
          playerIds:   players.map(p => p.id),
          playerNames: players.map(p => p.name),
          winnerId:    winner?.id ?? null,
          winnerName:  winner?.name ?? 'Tie',
        })
        setPhase('recap')
      } else {
        setRoundIdx(nextRound)
        setDrawAnim('ready')
        setDisplaySeason(null)
        setPhase('season_draw')
      }
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading players…</div>
      </div>
    )
  }

  // ── Recap ──────────────────────────────────────────────────────────────────
  if (phase === 'recap') {
    const sorted   = [...players].sort((a, b) => scores[b.name] - scores[a.name])
    const topScore = scores[sorted[0]?.name] ?? 0
    const isTie    = sorted.length > 1 && scores[sorted[1].name] === topScore
    return (
      <div className={styles.container}>
        <div className={styles.recap}>
          <div className={styles.recapEyebrow}>Game Over</div>
          <div className={styles.recapHeadline}>
            {isTie ? "It's a tie!" : `${sorted[0].name} wins!`}
          </div>
          <div className={styles.recapList}>
            {sorted.map((p, i) => (
              <div key={p.id} className={`${styles.recapRow} ${i === 0 && !isTie ? styles.recapRowTop : ''}`}>
                <span className={styles.recapRank}>{i === 0 && !isTie ? '🏆' : `#${i + 1}`}</span>
                <span className={styles.recapName}>{p.name}</span>
                <span className={styles.recapScore}>
                  {scores[p.name]} <span className={styles.recapScoreLabel}>/ {rounds}</span>
                </span>
              </div>
            ))}
          </div>
          <button className={styles.primaryBtn} onClick={onBack}>Back to menu</button>
        </div>
      </div>
    )
  }

  // ── Season draw ────────────────────────────────────────────────────────────
  if (phase === 'season_draw') {
    return (
      <div className={styles.container}>
        <div className={styles.drawScreen}>
          <div className={styles.eyebrow}>Round {roundIdx + 1} of {rounds}</div>
          <div className={[
            styles.seasonBox,
            drawAnim === 'spinning' ? styles.seasonBoxSpinning : '',
            drawAnim === 'done'     ? styles.seasonBoxLocked   : '',
          ].join(' ')}>
            {drawAnim === 'ready' ? (
              <span className={styles.questionMark}>?</span>
            ) : (
              <span className={styles.seasonText}>
                {displaySeason ? formatSeason(displaySeason) : ''}
              </span>
            )}
          </div>

          {drawAnim === 'done' && currentSeason && currentStat && (
            <div className={styles.drawnInfo}>
              <div className={styles.drawnSeason}>{formatSeason(currentSeason)}</div>
              <div className={styles.drawnStat}>{STAT_CONFIG[currentStat].label}</div>
            </div>
          )}

          {drawAnim === 'ready' && (
            <button className={styles.drawBtn} onClick={startSpin}>Draw Season</button>
          )}
        </div>
      </div>
    )
  }

  // ── Question / Feedback ────────────────────────────────────────────────────
  const participant = players[participantIdx]
  const statConf    = STAT_CONFIG[currentStat]
  const statKey     = statConf?.key
  const maxVal      = currentNbaPlayers.length > 0
    ? Math.max(...currentNbaPlayers.map(p => p[statKey] ?? 0))
    : 0

  const nextLabel = participantIdx + 1 < players.length
    ? `${players[participantIdx + 1].name}'s turn →`
    : roundIdx + 1 < rounds
      ? 'Next round →'
      : 'See results →'

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <button className={styles.backArrow} onClick={onBack} aria-label="Back">←</button>
        <div className={styles.roundInfo}>Round {roundIdx + 1} / {rounds}</div>
        <div className={styles.scorePills}>
          {players.map(p => (
            <span
              key={p.id}
              className={`${styles.scorePill} ${p.name === participant?.name ? styles.scorePillActive : ''}`}
            >
              {p.name} · {scores[p.name]}
            </span>
          ))}
        </div>
      </div>

      <div className={styles.turnLabel}>{participant?.name}'s turn</div>

      {phase === 'question' && (
        <div className={styles.questionText}>
          Who {statConf?.questionText} in the {formatSeason(currentSeason)} season?
        </div>
      )}

      {phase === 'feedback' && (
        <div className={`${styles.feedbackBanner} ${isCorrect ? styles.feedbackCorrect : styles.feedbackWrong}`}>
          {isCorrect ? `✓ Correct! +1 point for ${participant?.name}` : `✗ Wrong!`}
        </div>
      )}

      <div className={styles.playersGrid}>
        {currentNbaPlayers.map(nbaPlayer => {
          const val       = nbaPlayer[statKey] ?? 0
          const isWinner  = val >= maxVal
          const wasChosen = nbaPlayer.id === chosenPlayer?.id
          return (
            <PlayerCard
              key={nbaPlayer.id}
              player={nbaPlayer}
              statConf={phase === 'feedback' ? statConf : null}
              onClick={phase === 'question' ? () => handleAnswer(nbaPlayer) : undefined}
              highlight={phase === 'feedback' && isWinner}
              dimmed={phase === 'feedback' && !isWinner}
              chosen={phase === 'feedback' && wasChosen}
              disabled={phase === 'feedback'}
            />
          )
        })}
      </div>

      {phase === 'feedback' && (
        <button className={styles.primaryBtn} onClick={handleNext}>{nextLabel}</button>
      )}
    </div>
  )
}
