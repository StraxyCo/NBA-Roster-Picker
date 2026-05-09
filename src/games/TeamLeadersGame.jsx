import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TeamLeadersSetupScreen from '../screens/TeamLeadersSetupScreen.jsx'
import OrderDrawScreen from '../screens/OrderDrawScreen.jsx'
import TeamDrawScreen from '../screens/TeamDrawScreen.jsx'
import TeamLeadersGuessScreen from '../screens/TeamLeadersGuessScreen.jsx'
import { useTeamLeadersGames } from '../hooks/useProfiles.js'
import { getLogoUrl } from '../data/teams.js'
import styles from './TeamLeadersGame.module.css'

const ALL_TEAM_STATS = [
  { key: 'pts',  label: 'Points',   stat: 'pts',  unit: 'PPG' },
  { key: 'reb',  label: 'Rebounds', stat: 'reb',  unit: 'RPG' },
  { key: 'ast',  label: 'Assists',  stat: 'ast',  unit: 'APG' },
  { key: 'stl',  label: 'Steals',   stat: 'stl',  unit: 'SPG' },
  { key: 'blk',  label: 'Blocks',   stat: 'blk',  unit: 'BPG' },
  { key: 'fg3m', label: '3PM',      stat: 'fg3m', unit: '3PM' },
]

const PHASES = {
  SETUP: 'setup',
  ORDER_DRAW: 'order_draw',
  BETWEEN_TURNS: 'between_turns',
  TEAM_DRAW: 'team_draw',
  GUESSING: 'guessing',
  FINAL: 'final',
}

// ── Between-turns interstitial ───────────────────────────────────────────────
function BetweenTurns({ currentPlayer, currentRound, totalRounds, scores, turnOrder, onDraw }) {
  const hasScores = turnOrder.some(name => (scores[name] || 0) > 0)
  return (
    <div className={styles.screen}>
      <div className={styles.content}>
        <div className={styles.eyebrow}>Round {currentRound} / {totalRounds}</div>
        <h2 className={styles.turnName}>{currentPlayer}</h2>
        <p className={styles.turnSubtitle}>Your turn — draw a team to guess!</p>

        {hasScores && (
          <div className={styles.scoreBoard}>
            <div className={styles.scoreBoardLabel}>Current Scores</div>
            {[...turnOrder]
              .sort((a, b) => (scores[b] || 0) - (scores[a] || 0))
              .map(name => (
                <div key={name} className={`${styles.scoreRow} ${name === currentPlayer ? styles.scoreRowActive : ''}`}>
                  <span className={styles.scorePlayerName}>{name}</span>
                  <span className={styles.scorePoints}>{scores[name] || 0} pts</span>
                </div>
              ))
            }
          </div>
        )}

        <button className={styles.drawBtn} onClick={onDraw}>Draw Team →</button>
      </div>
    </div>
  )
}

// ── Final screen ─────────────────────────────────────────────────────────────
function FinalScreen({ scores, turnOrder, history, resultCats, onFinish }) {
  const sorted   = [...turnOrder].sort((a, b) => (scores[b] || 0) - (scores[a] || 0))
  const topScore = scores[sorted[0]] || 0
  const winners  = sorted.filter(name => (scores[name] || 0) === topScore)
  const winnerLabel = winners.length === 1 ? winners[0] : `Tie — ${winners.join(' & ')}`

  return (
    <div className={styles.finalScreen}>
      <div className={styles.finalContent}>
        <div className={styles.eyebrow}>Game Over</div>
        <h2 className={styles.winnerName}>{winnerLabel}</h2>
        <p className={styles.winnerSub}>{winners.length > 1 ? 'tied for the win!' : 'wins!'}</p>

        <div className={styles.finalScores}>
          {sorted.map((name, i) => (
            <div key={name} className={`${styles.finalScoreRow} ${(scores[name] || 0) === topScore ? styles.finalScoreWinner : ''}`}>
              <span className={styles.finalRank}>#{i + 1}</span>
              <span className={styles.finalPlayerName}>{name}</span>
              <span className={styles.finalPoints}>{scores[name] || 0} pts</span>
            </div>
          ))}
        </div>

        {sorted.map(name => {
          const turns = history.filter(h => h.humanPlayer === name)
          if (!turns.length) return null
          return (
            <div key={name} className={styles.playerHistory}>
              <div className={styles.playerHistoryHeader}>
                <span className={styles.playerHistoryName}>{name}</span>
                <span className={styles.playerHistoryScore}>{scores[name] || 0} pts</span>
              </div>
              {turns.map((t, ti) => (
                <div key={ti} className={styles.turnBlock}>
                  <div className={styles.turnHeader}>
                    <span className={styles.turnTeam}>{t.teamName} <span className={styles.turnSeason}>{t.season}</span></span>
                    <span className={styles.turnScore}>{t.score}/{resultCats.length + 1}</span>
                  </div>
                  {resultCats.map(({ key, label, stat, unit }) => {
                    const pick    = t.picks[key]
                    const correct = t.leaders[stat]
                    const isRight = pick?.id === correct?.id
                    return (
                      <div key={key} className={`${styles.turnRow} ${isRight ? styles.turnRowCorrect : styles.turnRowWrong}`}>
                        <span className={styles.turnRowIcon}>{isRight ? '✓' : '✗'}</span>
                        <span className={styles.turnRowCat}>{label}</span>
                        <span className={styles.turnRowPick}>{pick?.name ?? '—'}</span>
                        {!isRight && correct && (
                          <span className={styles.turnRowCorrectPlayer}>{correct.name}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )
        })}

        <button className={styles.finishBtn} onClick={onFinish}>Finish</button>
      </div>
    </div>
  )
}

// ── Main game orchestrator ───────────────────────────────────────────────────
export default function TeamLeadersGame() {
  const navigate = useNavigate()
  const { games, saveGame, deleteGame } = useTeamLeadersGames()
  const [phase, setPhase] = useState(PHASES.SETUP)

  // Config
  const [config, setConfig] = useState(null)

  // Game state
  const [turnOrder, setTurnOrder]         = useState([])   // player names in order
  const [playerObjects, setPlayerObjects] = useState([])   // full player objects
  const [turnIndex, setTurnIndex]         = useState(0)    // 0 … rounds*players-1
  const [scores, setScores]              = useState({})    // { playerName: totalPoints }
  const [history, setHistory]            = useState([])     // per-turn recap
  const [drawnEntries, setDrawnEntries]  = useState([])    // for eliminate logic
  const [currentTeam, setCurrentTeam]    = useState(null)
  const [currentSeason, setCurrentSeason] = useState(null)
  const [currentRoster, setCurrentRoster] = useState([])

  function handleStart(cfg) {
    setConfig(cfg)
    setPhase(PHASES.ORDER_DRAW)
  }

  function handleOrderDrawn(order) {
    setTurnOrder(order)
    setPlayerObjects(config.players.filter(p => order.includes(p.name)).sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name)))
    setTurnIndex(0)
    setScores(Object.fromEntries(order.map(n => [n, 0])))
    setDrawnEntries([])
    setHistory([])
    setPhase(PHASES.BETWEEN_TURNS)
  }

  function handleTeamDrawn(team, season, roster) {
    setCurrentTeam(team)
    setCurrentSeason(season)
    setCurrentRoster(roster)
    if (config.eliminateTeams) {
      setDrawnEntries(prev => [...prev, { teamId: team.id, season }])
    }
    setPhase(PHASES.GUESSING)
  }

  function handleResult({ score, picks, leaders }) {
    const playerName = turnOrder[turnIndex % turnOrder.length]
    setScores(prev => ({ ...prev, [playerName]: (prev[playerName] || 0) + score }))
    setHistory(prev => [...prev, {
      humanPlayer: playerName,
      teamName: currentTeam.name,
      season: currentSeason,
      picks,
      leaders,
      score,
    }])

    const nextIndex = turnIndex + 1
    if (nextIndex >= config.rounds * turnOrder.length) {
      setTurnIndex(nextIndex)
      setPhase(PHASES.FINAL)
    } else {
      setTurnIndex(nextIndex)
      setCurrentTeam(null)
      setCurrentSeason(null)
      setCurrentRoster([])
      setPhase(PHASES.BETWEEN_TURNS)
    }
  }

  async function handleFinish() {
    const sorted   = [...turnOrder].sort((a, b) => (scores[b] || 0) - (scores[a] || 0))
    const topScore = scores[sorted[0]] || 0
    const winners  = sorted.filter(n => (scores[n] || 0) === topScore)

    const winner = winners.length === 1
      ? playerObjects.find(p => p.name === winners[0])
      : null

    await saveGame({
      playerIds:   playerObjects.map(p => p.id),
      playerNames: playerObjects.map(p => p.name),
      winnerId:    winner?.id ?? null,
      winnerName:  winners.length > 1 ? `Tie (${winners.join(', ')})` : winners[0],
    })

    navigate('/')
  }

  const currentPlayerName  = turnOrder[turnIndex % turnOrder.length] || ''
  const currentRound       = Math.floor(turnIndex / (turnOrder.length || 1)) + 1
  const resultCats         = config ? ALL_TEAM_STATS.filter(s => (config.selectedStats || ['pts','reb','ast']).includes(s.key)) : []

  return (
    <>
      {phase === PHASES.SETUP && (
        <TeamLeadersSetupScreen
          onBack={() => navigate('/')}
          onStart={handleStart}
          savedGames={games}
          onDeleteGame={deleteGame}
        />
      )}

      {phase === PHASES.ORDER_DRAW && (
        <OrderDrawScreen
          players={config.players.map(p => p.name)}
          onOrderDrawn={handleOrderDrawn}
        />
      )}

      {phase === PHASES.BETWEEN_TURNS && (
        <BetweenTurns
          currentPlayer={currentPlayerName}
          currentRound={currentRound}
          totalRounds={config.rounds}
          scores={scores}
          turnOrder={turnOrder}
          onDraw={() => setPhase(PHASES.TEAM_DRAW)}
        />
      )}

      {phase === PHASES.TEAM_DRAW && (
        <TeamDrawScreen
          drawnEntries={drawnEntries}
          eliminateTeams={config.eliminateTeams}
          eliminateFranchises={config.eliminateFranchises}
          seasons={config.seasons}
          onTeamDrawn={handleTeamDrawn}
        />
      )}

      {phase === PHASES.GUESSING && currentTeam && (
        <TeamLeadersGuessScreen
          team={currentTeam}
          season={currentSeason}
          roster={currentRoster}
          categories={resultCats}
          currentPlayer={currentPlayerName}
          onResult={handleResult}
        />
      )}

      {phase === PHASES.FINAL && (
        <FinalScreen
          scores={scores}
          turnOrder={turnOrder}
          history={history}
          resultCats={resultCats}
          onFinish={handleFinish}
        />
      )}
    </>
  )
}
