import { useState } from 'react'
import SetupScreen from './screens/SetupScreen.jsx'
import OrderDrawScreen from './screens/OrderDrawScreen.jsx'
import TurnScreen from './screens/TurnScreen.jsx'
import TeamDrawScreen from './screens/TeamDrawScreen.jsx'
import PickPlayerScreen from './screens/PickPlayerScreen.jsx'
import FinalScreen from './screens/FinalScreen.jsx'

const SCREENS = {
  SETUP: 'SETUP', ORDER_DRAW: 'ORDER_DRAW', TURN: 'TURN',
  TEAM_DRAW: 'TEAM_DRAW', PICK_PLAYER: 'PICK_PLAYER', FINAL: 'FINAL',
}

function buildEmptyRoster(size) { return Array(size).fill(null) }

export default function App() {
  const [screen, setScreen] = useState(SCREENS.SETUP)

  // Config
  const [players, setPlayers]               = useState([])
  const [rosterSize, setRosterSize]         = useState(6)
  const [eliminateTeams, setEliminate]      = useState(true)
  const [eliminateFranchises, setElimFranch] = useState(false)
  const [seasons, setSeasons]               = useState(['2025-26'])

  // Game state
  const [turnOrder, setTurnOrder]           = useState([])
  const [currentTurnIdx, setCurrentTurnIdx] = useState(0)
  const [rosters, setRosters]               = useState({})
  // drawnEntries: array of { teamId, season } — used for eliminate logic
  const [drawnEntries, setDrawnEntries]     = useState([])
  const [currentTeam, setCurrentTeam]       = useState(null)
  const [currentRoster, setCurrentRoster]   = useState([])
  const [currentSeason, setCurrentSeason]   = useState(null)

  function handleSetupStart({ players, rosterSize, eliminateTeams, eliminateFranchises, seasons }) {
    setPlayers(players)
    setRosterSize(rosterSize)
    setEliminate(eliminateTeams)
    setElimFranch(eliminateFranchises)
    setSeasons(seasons)
    const emptyRosters = {}
    players.forEach(p => { emptyRosters[p] = buildEmptyRoster(rosterSize) })
    setRosters(emptyRosters)
    setScreen(SCREENS.ORDER_DRAW)
  }

  function handleOrderDrawn(order) {
    setTurnOrder(order)
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

    const allFull = turnOrder.every(p =>
      updatedRosters[p]?.every(slot => slot !== null)
    )

    if (allFull) {
      setScreen(SCREENS.FINAL)
    } else {
      setCurrentTurnIdx((currentTurnIdx + 1) % turnOrder.length)
      setCurrentTeam(null)
      setCurrentSeason(null)
      setCurrentRoster([])
      setScreen(SCREENS.TURN)
    }
  }

  const currentPlayer = turnOrder[currentTurnIdx] || ''
  const currentUserRoster = rosters[currentPlayer] || []
  const picksCount = currentUserRoster.filter(Boolean).length

  return (
    <>
      {screen === SCREENS.SETUP && (
        <SetupScreen onStart={handleSetupStart} />
      )}
      {screen === SCREENS.ORDER_DRAW && (
        <OrderDrawScreen players={players} onOrderDrawn={handleOrderDrawn} />
      )}
      {screen === SCREENS.TURN && (
        <TurnScreen
          currentPlayer={currentPlayer}
          picksCount={picksCount}
          rosterSize={rosterSize}
          rosters={rosters}
          turnOrder={turnOrder}
          onDraw={() => setScreen(SCREENS.TEAM_DRAW)}
        />
      )}
      {screen === SCREENS.TEAM_DRAW && (
        <TeamDrawScreen
          drawnEntries={drawnEntries}
          eliminateTeams={eliminateTeams}
          eliminateFranchises={eliminateFranchises}
          seasons={seasons}
          onTeamDrawn={handleTeamDrawn}
        />
      )}
      {screen === SCREENS.PICK_PLAYER && (
        <PickPlayerScreen
          currentPlayer={currentPlayer}
          team={currentTeam}
          season={currentSeason}
          nbaRoster={currentRoster}
          userRoster={currentUserRoster}
          rosterSize={rosterSize}
          onValidate={handlePickValidated}
        />
      )}
      {screen === SCREENS.FINAL && (
        <FinalScreen
          rosters={rosters}
          turnOrder={turnOrder}
          rosterSize={rosterSize}
          onRestart={() => {
            setScreen(SCREENS.SETUP)
            setTurnOrder([])
            setCurrentTurnIdx(0)
            setRosters({})
            setDrawnEntries([])
            setCurrentTeam(null)
            setCurrentSeason(null)
            setCurrentRoster([])
          }}
        />
      )}
    </>
  )
}
