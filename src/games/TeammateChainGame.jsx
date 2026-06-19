import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import TeammateChainSetupScreen from '../screens/TeammateChainSetupScreen.jsx'
import TeammateChainGameScreen from '../screens/TeammateChainGameScreen.jsx'
import { useTeammateChainGames } from '../hooks/useProfiles.js'
import { validatePick, pickStartingPlayer, getAllPlayers, excludedConnections, hasAvailableOutside } from '../utils/teammateChain.js'
import styles from './WhosThatGuyGame.module.css'

const PHASES = { SETUP: 'setup', PLAYING: 'playing', FINAL: 'final' }

function FinalScreen({ winner, history, onFinish }) {
  return (
    <div className={styles.finalScreen}>
      <div className={styles.finalContent}>
        <div className={styles.eyebrow}>Game Over</div>
        <h2 className={styles.winnerName}>{winner} wins!</h2>
        <p className={styles.winnerSub}>The chain broke.</p>

        {/* Chain history */}
        <div className={styles.chainHistory}>
          <div className={styles.chainHistoryLabel}>The Chain</div>
          {history.map((h, i) => (
            <div key={i} className={`${styles.historyRow} ${h.correct ? styles.historyCorrect : styles.historyWrong}`}>
              <span className={styles.historyNum}>{i + 1}.</span>
              <div className={styles.historyBody}>
                <span className={styles.historyLink}>{h.prevPlayer} → {h.guesser}: {h.guessedPlayer}</span>
                {h.correct && (
                  <span style={{ color: 'var(--white-40)', fontSize: '0.75rem' }}>
                    via {h.connection.teamName} ({h.connection.season})
                  </span>
                )}
              </div>
              <span className={styles.historyIcon}>{h.correct ? '✓' : '✗'}</span>
            </div>
          ))}
        </div>

        <button className={styles.finishBtn} onClick={onFinish}>New Game</button>
      </div>
    </div>
  )
}

export default function TeammateChainGame() {
  const navigate = useNavigate()
  const { games, saveGame, deleteGame } = useTeammateChainGames()

  const [phase, setPhase]       = useState(PHASES.SETUP)
  const [config, setConfig]     = useState(null)
  const [careers, setCareers]   = useState(null)
  const [rosters, setRosters]   = useState(null)

  const [players, setPlayers]           = useState([])      // {id, name}[] — human players
  const [currentPlayerIdx, setCurrentPlayerIdx] = useState(0) // index in players array
  const [chainPlayer, setChainPlayer]   = useState(null)    // current player in chain
  const [excludedKeys, setExcludedKeys] = useState(new Set()) // team-season keys consumed by the last link
  const [lastConnections, setLastConnections] = useState([]) // the last link's team-seasons (display/history)
  const [history, setHistory]           = useState([])      // chain of guesses
  const [scores, setScores]             = useState({})      // player -> wins

  useEffect(() => {
    Promise.all([
      fetch('/careers.json').then(r => r.json()),
      fetch('/rosters.json').then(r => r.json()),
    ]).then(([c, r]) => { setCareers(c); setRosters(r) })
      .catch(e => console.error('data load', e))
  }, [])

  const allPlayers = useMemo(() => careers ? getAllPlayers(careers) : [], [careers])
  const dataLoaded = careers !== null && rosters !== null

  function handleStart(cfg) {
    setConfig(cfg)
    setPlayers(cfg.players)
    setScores(Object.fromEntries(cfg.players.map(p => [p.name, 0])))
    setCurrentPlayerIdx(0)

    const start = pickStartingPlayer(careers, rosters)
    setChainPlayer(start)
    setExcludedKeys(new Set())
    setLastConnections([])
    setHistory([])
    setPhase(PHASES.PLAYING)
  }

  const currentPlayerName = players[currentPlayerIdx]?.name || ''
  const nextPlayerIdx = (currentPlayerIdx + 1) % players.length
  const nextPlayerName = players[nextPlayerIdx]?.name || ''

  const noSameTeam = !!config?.noSameTeam
  const curExcluded = noSameTeam && chainPlayer && careers
    ? excludedConnections(excludedKeys, careers, chainPlayer.id) : []
  const exceptionActive = noSameTeam && chainPlayer && careers && excludedKeys.size > 0
    && !hasAvailableOutside(chainPlayer.id, careers, excludedKeys)

  function handleSubmit({ guessPlayer }) {
    const result = validatePick(
      chainPlayer.id,
      guessPlayer.id,
      careers,
      config.noSameTeam ? excludedKeys : new Set(),
      config.noSameTeam,
    )
    const correct = result !== null

    // Record the guess
    setHistory(prev => [...prev, {
      prevPlayer: chainPlayer.name,
      guesser: currentPlayerName,
      guessedPlayer: guessPlayer.name,
      correct,
      connection: correct ? result.connections[0] : null,
    }])

    if (correct) {
      // Chain continues — the team-seasons of this link are now excluded for the next pick.
      setChainPlayer(guessPlayer)
      setExcludedKeys(config.noSameTeam ? new Set(result.connections.map(c => c.key)) : new Set())
      setLastConnections(result.connections)
      setCurrentPlayerIdx(nextPlayerIdx)
    } else {
      // Chain breaks — next player wins
      setScores(prev => ({ ...prev, [nextPlayerName]: (prev[nextPlayerName] || 0) + 1 }))
      setPhase(PHASES.FINAL)
    }
  }

  async function handleFinish() {
    const winner = players[nextPlayerIdx]
    await saveGame({
      playerIds: players.map(p => p.id),
      playerNames: players.map(p => p.name),
      winnerId: winner.id,
      winnerName: winner.name,
    })
    setPhase(PHASES.SETUP)
  }

  return (
    <>
      {phase === PHASES.SETUP && (
        <TeammateChainSetupScreen
          onBack={() => navigate('/')}
          onStart={handleStart}
          savedGames={games}
          onDeleteGame={deleteGame}
        />
      )}
      {phase === PHASES.PLAYING && chainPlayer && (
        <TeammateChainGameScreen
          chainPlayer={chainPlayer}
          excluded={curExcluded}
          exceptionActive={exceptionActive}
          noSameTeam={noSameTeam}
          allPlayers={allPlayers}
          currentPlayer={currentPlayerName}
          nextPlayer={nextPlayerName}
          onSubmit={handleSubmit}
          onBack={() => setPhase(PHASES.SETUP)}
        />
      )}
      {phase === PHASES.FINAL && (
        <FinalScreen
          winner={nextPlayerName}
          history={history}
          onFinish={handleFinish}
        />
      )}
    </>
  )
}
