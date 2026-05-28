import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import TeammateChainSetupScreen from '../screens/TeammateChainSetupScreen.jsx'
import TeammateChainGameScreen from '../screens/TeammateChainGameScreen.jsx'
import { useTeammateChainGames } from '../hooks/useProfiles.js'
import { findTeammateConnection, pickStartingPlayer, getAllPlayers } from '../utils/teammateChain.js'
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
  const [lastLink, setLastLink]         = useState(null)    // {from, to, team, season}
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
    setLastLink(null)
    setHistory([])
    setPhase(PHASES.PLAYING)
  }

  const currentPlayerName = players[currentPlayerIdx]?.name || ''
  const nextPlayerIdx = (currentPlayerIdx + 1) % players.length
  const nextPlayerName = players[nextPlayerIdx]?.name || ''

  function handleSubmit({ guessPlayer }) {
    const connection = findTeammateConnection(
      chainPlayer.id,
      guessPlayer.id,
      careers,
      rosters,
      config.noSameTeam && lastLink ? lastLink.teamAbbr : null
    )
    const correct = connection !== null

    // Record the guess
    setHistory(prev => [...prev, {
      prevPlayer: chainPlayer.name,
      guesser: currentPlayerName,
      guessedPlayer: guessPlayer.name,
      correct,
      connection,
    }])

    if (correct) {
      // Chain continues to next player's turn
      setChainPlayer(guessPlayer)
      setLastLink({ from: chainPlayer.id, to: guessPlayer.id, teamAbbr: connection.teamAbbr, team: connection.teamName, season: connection.season })
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
          lastLink={lastLink}
          noSameTeam={config.noSameTeam}
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
