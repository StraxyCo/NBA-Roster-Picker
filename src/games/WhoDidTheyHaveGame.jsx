import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import WhoDidTheyHaveSetupScreen from '../screens/WhoDidTheyHaveSetupScreen.jsx'
import WhoDidTheyHaveRoundScreen from '../screens/WhoDidTheyHaveRoundScreen.jsx'
import OrderDrawScreen from '../screens/OrderDrawScreen.jsx'
import TeamDrawScreen from '../screens/TeamDrawScreen.jsx'
import { useWhoDidTheyHaveGames } from '../hooks/useProfiles.js'
import { fetchStandings } from '../hooks/useRoster.js'
import { getAllPlayers } from '../utils/teammateChain.js'
import { playedFor, teamSeasonRoster } from '../utils/whoDidTheyHave.js'
// Interstitial / final screens share the Team Leaders sheet.
import styles from './TeamLeadersGame.module.css'

const PHASES = {
  SETUP: 'setup',
  ORDER_DRAW: 'order_draw',
  TEAM_DRAW: 'team_draw',
  PLAYING: 'playing',
  ROUND_RESULT: 'round_result',
  FINAL: 'final',
}

// ── Round result interstitial ────────────────────────────────────────────────
function RoundResult({ round, totalRounds, team, season, winnerName, answers, roster, wins, players, isLastRound, onNext }) {
  const namedIds = new Set(answers.filter(a => a.correct).map(a => String(a.id)))
  const missed = roster.filter(p => !namedIds.has(String(p.id)))

  return (
    <div className={styles.screen}>
      <div className={styles.content}>
        <div className={styles.eyebrow}>Round {round} / {totalRounds} · {team.name} {season}</div>
        <h2 className={styles.turnName}>{winnerName || 'Draw'}</h2>
        <p className={styles.turnSubtitle}>
          {winnerName ? 'wins the round!' : 'the whole roster was named — nobody loses'}
        </p>

        <div className={styles.scoreBoard}>
          <div className={styles.scoreBoardLabel}>Rounds won</div>
          {[...players]
            .sort((a, b) => (wins[b.id] || 0) - (wins[a.id] || 0))
            .map(p => (
              <div key={p.id} className={styles.scoreRow}>
                <span className={styles.scorePlayerName}>{p.name}</span>
                <span className={styles.scorePoints}>{wins[p.id] || 0}</span>
              </div>
            ))
          }
        </div>

        {missed.length > 0 && (
          <div className={styles.playerHistory}>
            <div className={styles.playerHistoryHeader}>
              <span className={styles.playerHistoryName}>Not named</span>
              <span className={styles.playerHistoryScore}>{missed.length}</span>
            </div>
            <div className={styles.turnBlock}>
              {missed.map(p => (
                <div key={p.id} className={styles.turnRow}>
                  <span className={styles.turnRowPick}>{p.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button className={styles.drawBtn} onClick={onNext}>
          {isLastRound ? 'See results →' : 'Next round →'}
        </button>
      </div>
    </div>
  )
}

// ── Final screen ─────────────────────────────────────────────────────────────
function FinalScreen({ players, wins, roundResults, onFinish }) {
  const sorted  = [...players].sort((a, b) => (wins[b.id] || 0) - (wins[a.id] || 0))
  const topWins = wins[sorted[0]?.id] || 0
  const winners = sorted.filter(p => (wins[p.id] || 0) === topWins)
  const winnerLabel = winners.length === 1 ? winners[0].name : `Tie — ${winners.map(w => w.name).join(' & ')}`

  return (
    <div className={styles.finalScreen}>
      <div className={styles.finalContent}>
        <div className={styles.eyebrow}>Game Over</div>
        <h2 className={styles.winnerName}>{winnerLabel}</h2>
        <p className={styles.winnerSub}>{winners.length > 1 ? 'tied for the win!' : 'wins!'}</p>

        <div className={styles.finalScores}>
          {sorted.map((p, i) => (
            <div key={p.id} className={`${styles.finalScoreRow} ${(wins[p.id] || 0) === topWins ? styles.finalScoreWinner : ''}`}>
              <span className={styles.finalRank}>#{i + 1}</span>
              <span className={styles.finalPlayerName}>{p.name}</span>
              <span className={styles.finalPoints}>{wins[p.id] || 0} {(wins[p.id] || 0) === 1 ? 'round' : 'rounds'}</span>
            </div>
          ))}
        </div>

        {roundResults.map(r => (
          <div key={r.round} className={styles.playerHistory}>
            <div className={styles.playerHistoryHeader}>
              <span className={styles.playerHistoryName}>Round {r.round} — {r.teamName} {r.season}</span>
              <span className={styles.playerHistoryScore}>{r.winnerName || 'Draw'}</span>
            </div>
            <div className={styles.turnBlock}>
              {r.answers.map((a, i) => (
                <div key={i} className={`${styles.turnRow} ${a.correct ? styles.turnRowCorrect : styles.turnRowWrong}`}>
                  <span className={styles.turnRowIcon}>{a.correct ? '✓' : '✗'}</span>
                  <span className={styles.turnRowCat}>{a.guesserName}</span>
                  <span className={styles.turnRowPick}>{a.name}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        <button className={styles.finishBtn} onClick={onFinish}>Finish</button>
      </div>
    </div>
  )
}

// ── Main game orchestrator ───────────────────────────────────────────────────
export default function WhoDidTheyHaveGame() {
  const navigate = useNavigate()
  const { games, saveGame, deleteGame } = useWhoDidTheyHaveGames()

  const [phase, setPhase]   = useState(PHASES.SETUP)
  const [config, setConfig] = useState(null)
  const [careers, setCareers] = useState(null)

  const [players, setPlayers] = useState([])          // human players, in turn order
  const [wins, setWins]       = useState({})          // playerId -> rounds won
  const [round, setRound]     = useState(1)
  const [drawnEntries, setDrawnEntries] = useState([])
  const [drawAttempt, setDrawAttempt]   = useState(0) // remounts the draw reel on a redraw

  const [team, setTeam]       = useState(null)
  const [season, setSeason]   = useState(null)
  const [record, setRecord]   = useState(null)
  const [roster, setRoster]   = useState([])

  const [lives, setLives]           = useState({})    // playerId -> lives left this round
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers]       = useState([])    // this round's named players
  const [lastOutcome, setLastOutcome] = useState(null)
  const [roundWinner, setRoundWinner] = useState(null)
  const [roundResults, setRoundResults] = useState([])

  useEffect(() => {
    fetch('/careers.json').then(r => r.json()).then(setCareers).catch(e => console.error('careers load', e))
  }, [])

  const allPlayers = useMemo(() => careers ? getAllPlayers(careers) : [], [careers])
  const maxLives = config?.lives ?? 3

  function handleStart(cfg) {
    setConfig(cfg)
    setPhase(PHASES.ORDER_DRAW)
  }

  function handleOrderDrawn(order) {
    // Map the drawn name order back to player objects, consuming each name once
    // so duplicate first names still map 1:1.
    const pool = [...config.players]
    const ordered = order
      .map(name => { const i = pool.findIndex(p => p.name === name); return i >= 0 ? pool.splice(i, 1)[0] : null })
      .filter(Boolean)

    setPlayers(ordered)
    setWins(Object.fromEntries(ordered.map(p => [p.id, 0])))
    setRound(1)
    setDrawnEntries([])
    setRoundResults([])
    setPhase(PHASES.TEAM_DRAW)
  }

  async function handleTeamDrawn(drawnTeam, drawnSeason, drawnRoster) {
    setDrawnEntries(prev => [...prev, { teamId: drawnTeam.id, season: drawnSeason }])

    // rosters.json misses the odd signing, and one team-season entirely, so the
    // playable roster is the union with what careers.json records.
    const fullRoster = teamSeasonRoster(drawnTeam.id, drawnSeason, drawnRoster, careers)
    if (!fullRoster.length) {
      setDrawAttempt(n => n + 1)
      return
    }

    setTeam(drawnTeam)
    setSeason(drawnSeason)
    setRoster(fullRoster)
    setRecord(await fetchStandings(drawnTeam.id, drawnSeason))

    // Lives reset every round; the first drafter rotates one seat per round.
    setLives(Object.fromEntries(players.map(p => [p.id, maxLives])))
    setCurrentIdx((round - 1) % players.length)
    setAnswers([])
    setLastOutcome(null)
    setRoundWinner(null)
    setPhase(PHASES.PLAYING)
  }

  // Next player still holding a life, wrapping around. -1 when nobody is left.
  function nextAliveIdx(fromIdx, livesMap) {
    for (let step = 1; step <= players.length; step++) {
      const i = (fromIdx + step) % players.length
      if ((livesMap[players[i].id] || 0) > 0) return i
    }
    return -1
  }

  function endRound(winner, roundAnswers) {
    setRoundWinner(winner)
    if (winner) setWins(prev => ({ ...prev, [winner.id]: (prev[winner.id] || 0) + 1 }))
    setRoundResults(prev => [...prev, {
      round,
      teamName: team.name,
      season,
      winnerName: winner?.name ?? null,
      answers: roundAnswers,
    }])
    setPhase(PHASES.ROUND_RESULT)
  }

  function handleSubmit({ guessPlayer }) {
    const guesser = players[currentIdx]
    const correct = playedFor(guessPlayer.id, roster)
    const answer = { id: guessPlayer.id, name: guessPlayer.name, guesserName: guesser.name, correct }
    const nextAnswers = [...answers, answer]
    setAnswers(nextAnswers)

    if (correct) {
      setLastOutcome({ correct: true, name: guessPlayer.name, teamName: team.name, season })

      // Whole roster named — nobody can be caught out, so the round is a draw.
      if (nextAnswers.filter(a => a.correct).length >= roster.length) {
        endRound(null, nextAnswers)
        return
      }
      setCurrentIdx(nextAliveIdx(currentIdx, lives))
      return
    }

    const livesLeft = Math.max(0, (lives[guesser.id] || 0) - 1)
    const newLives  = { ...lives, [guesser.id]: livesLeft }
    setLives(newLives)
    setLastOutcome({ correct: false, name: guessPlayer.name, teamName: team.name, season, guesserName: guesser.name, livesLeft })

    if (livesLeft > 0) {
      setCurrentIdx(nextAliveIdx(currentIdx, newLives))
      return
    }

    // Out of lives — last player still holding a life wins the round.
    const survivors = players.filter(p => (newLives[p.id] || 0) > 0)
    if (survivors.length <= 1) {
      endRound(survivors[0] || null, nextAnswers)
      return
    }
    setCurrentIdx(nextAliveIdx(currentIdx, newLives))
  }

  function handleNextRound() {
    if (round >= config.rounds) {
      setPhase(PHASES.FINAL)
      return
    }
    setRound(r => r + 1)
    setDrawAttempt(n => n + 1)
    setPhase(PHASES.TEAM_DRAW)
  }

  async function handleFinish() {
    const sorted  = [...players].sort((a, b) => (wins[b.id] || 0) - (wins[a.id] || 0))
    const topWins = wins[sorted[0]?.id] || 0
    const winners = sorted.filter(p => (wins[p.id] || 0) === topWins)

    await saveGame({
      playerIds:   players.map(p => p.id),
      playerNames: players.map(p => p.name),
      winnerId:    winners.length === 1 ? winners[0].id : null,
      winnerName:  winners.length === 1 ? winners[0].name : `Tie (${winners.map(w => w.name).join(', ')})`,
    })

    navigate('/')
  }

  return (
    <>
      {phase === PHASES.SETUP && (
        <WhoDidTheyHaveSetupScreen
          onBack={() => navigate('/')}
          onStart={handleStart}
          savedGames={games}
          onDeleteGame={deleteGame}
        />
      )}

      {phase === PHASES.ORDER_DRAW && config && (
        <OrderDrawScreen
          players={config.players.map(p => p.name)}
          onOrderDrawn={handleOrderDrawn}
        />
      )}

      {phase === PHASES.TEAM_DRAW && config && (
        <TeamDrawScreen
          key={`${round}-${drawAttempt}`}
          drawnEntries={drawnEntries}
          eliminateFranchises
          eliminateTeams
          seasons={config.seasons}
          showSeason
          onTeamDrawn={handleTeamDrawn}
        />
      )}

      {phase === PHASES.PLAYING && team && (
        <WhoDidTheyHaveRoundScreen
          team={team}
          season={season}
          record={record}
          round={round}
          totalRounds={config.rounds}
          allPlayers={allPlayers}
          roster={roster}
          players={players}
          lives={lives}
          maxLives={maxLives}
          currentPlayerId={players[currentIdx]?.id}
          answers={answers}
          wins={wins}
          lastOutcome={lastOutcome}
          onSubmit={handleSubmit}
          onBack={() => setPhase(PHASES.SETUP)}
        />
      )}

      {phase === PHASES.ROUND_RESULT && team && (
        <RoundResult
          round={round}
          totalRounds={config.rounds}
          team={team}
          season={season}
          winnerName={roundWinner?.name ?? null}
          answers={answers}
          roster={roster}
          wins={wins}
          players={players}
          isLastRound={round >= config.rounds}
          onNext={handleNextRound}
        />
      )}

      {phase === PHASES.FINAL && (
        <FinalScreen
          players={players}
          wins={wins}
          roundResults={roundResults}
          onFinish={handleFinish}
        />
      )}
    </>
  )
}
