import { useState } from 'react'
import SetupScreen from './screens/SetupScreen.jsx'
import OrderDrawScreen from './screens/OrderDrawScreen.jsx'
import TurnScreen from './screens/TurnScreen.jsx'
import TeamDrawScreen from './screens/TeamDrawScreen.jsx'
import PickPlayerScreen from './screens/PickPlayerScreen.jsx'
import FinalScreen from './screens/FinalScreen.jsx'
import { useGames } from './hooks/useProfiles.js'

const SCREENS = {
  SETUP: 'SETUP', ORDER_DRAW: 'ORDER_DRAW', TURN: 'TURN',
  TEAM_DRAW: 'TEAM_DRAW', PICK_PLAYER: 'PICK_PLAYER', FINAL: 'FINAL',
}

function buildEmptyRoster(size) { return Array(size).fill(null) }

export default function App() {
  const [screen, setScreen] = useState(SCREENS.SETUP)
  const { games, saveGame, deleteGame } = useGames()

  // players is now [{ id, name }]
  const [players, setPlayers]                = useState([])
  const [rosterSize, setRosterSize]          = useState(6)
  const [eliminateTeams, setEliminate]       = useState(true)
  const [eliminateFranchises, setElimFranch] = useState(false)
  const [seasons, setSeasons]                = useState(['2025-26'])

  const [turnOrder, setTurnOrder]            = useState([]) // player names
  const [turnOrderFull, setTurnOrderFull]    = useState([]) // full {id, name} objects
  const [currentTurnIdx, setCurrentTurnIdx]  = useState(0)
  const [rosters, setRosters]                = useState({})
  const [drawnEntries, setDrawnEntries]      = useState([])
  const [currentTeam, setCurrentTeam]        = useState(null)
  const [currentRoster, setCurrentRoster]    = useState([])
  const [currentSeason, setCurrentSeason]    = useState(null)

  function handleSetupStart({ players, rosterSize, eliminateTeams, eliminateFranchises, seasons }) {
    setPlayers(players)
    setRosterSize(rosterSize)
    setEliminate(eliminateTeams)
    setElimFranch(eliminateFranchises)
    setSeasons(seasons)
    const emptyRosters = {}
    players.forEach(p => { emptyRosters[p.name] = buildEmptyRoster(rosterSize) })
    setRosters(emptyRosters)
    setScreen(SCREENS.ORDER_DRAW)
  }

  function handleOrderDrawn(order) {
    // order is array of names; rebuild full objects in that order
    const full = order.map(name => players.find(p => p.name === name)).filter(Boolean)
    setTurnOrder(order)
    setTurnOrderFull(full)
    setCurrentTurnIdx(0)
    setScreen(SCREENS.TURN)
  }

  function handleTeamDrawn(team, season, rosterPlayers) {
    setCurrentTeam(team)
    setCurrentSeason(season)
    setCurrentRoster(rosterPlayers)
    if (eliminateTeams) {
      setDrawnEntries(prev => [...prev, { teamId: team.id, season }])
    }
    setScreen(SCREENS.PICK_PLAYER)
  }

  function handlePickValidated(updatedUserRoster) {
    const currentPlayer = turnOrder[currentTurnIdx]
    const updatedRosters = { ...rosters, [currentPlayer]: updatedUserRoster }
    setRosters(updatedRosters)

    const allFull = turnOrder.every(p => updatedRosters[p]?.every(slot => slot !== null))
    if (allFull) {
      setScreen(SCREENS.FINAL)
    } else {
      setCurrentTurnIdx((currentTurnIdx + 1) % turnOrder.length)
      setCurrentTeam(null); setCurrentSeason(null); setCurrentRoster([])
      setScreen(SCREENS.TURN)
    }
  }

  async function handleDeclareWinner(winnerName) {
    const winner = players.find(p => p.name === winnerName)
    if (!winner) return
    await saveGame({
      playerIds: turnOrderFull.map(p => p.id),
      playerNames: turnOrderFull.map(p => p.name),
      winnerId: winner.id,
      winnerName: winner.name,
    })
  }

  function handleRestart() {
    setScreen(SCREENS.SETUP)
    setTurnOrder([]); setTurnOrderFull([])
    setCurrentTurnIdx(0); setRosters({})
    setDrawnEntries([])
    setCurrentTeam(null); setCurrentSeason(null); setCurrentRoster([])
  }

  const currentPlayer = turnOrder[currentTurnIdx] || ''
  const currentUserRoster = rosters[currentPlayer] || []
  const picksCount = currentUserRoster.filter(Boolean).length

  return (
    <>
      {screen === SCREENS.SETUP && (
        <SetupScreen
          onStart={handleSetupStart}
          savedGames={games}
          onDeleteGame={deleteGame}
        />
      )}
      {screen === SCREENS.ORDER_DRAW && (
        <OrderDrawScreen players={turnOrder.length ? turnOrder : players.map(p => p.name)} onOrderDrawn={handleOrderDrawn} />
      )}
      {screen === SCREENS.TURN && (
        <TurnScreen
          currentPlayer={currentPlayer} picksCount={picksCount}
          rosterSize={rosterSize} rosters={rosters} turnOrder={turnOrder}
          onDraw={() => setScreen(SCREENS.TEAM_DRAW)}
        />
      )}
      {screen === SCREENS.TEAM_DRAW && (
        <TeamDrawScreen
          drawnEntries={drawnEntries} eliminateTeams={eliminateTeams}
          eliminateFranchises={eliminateFranchises} seasons={seasons}
          onTeamDrawn={handleTeamDrawn}
        />
      )}
      {screen === SCREENS.PICK_PLAYER && (
        <PickPlayerScreen
          currentPlayer={currentPlayer} team={currentTeam} season={currentSeason}
          nbaRoster={currentRoster} userRoster={currentUserRoster}
          rosterSize={rosterSize} multiSeason={seasons.length > 1}
          onValidate={handlePickValidated}
        />
      )}
      {screen === SCREENS.FINAL && (
        <FinalScreen
          rosters={rosters} turnOrder={turnOrder} rosterSize={rosterSize}
          multiSeason={seasons.length > 1}
          onDeclareWinner={handleDeclareWinner}
          onRestart={handleRestart}
        />
      )}
    </>
  )
}
