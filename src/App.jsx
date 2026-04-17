import { useState } from 'react'
import SetupScreen from './screens/SetupScreen.jsx'
import OrderDrawScreen from './screens/OrderDrawScreen.jsx'
import TurnScreen from './screens/TurnScreen.jsx'
import TeamDrawScreen from './screens/TeamDrawScreen.jsx'
import PickPlayerScreen from './screens/PickPlayerScreen.jsx'
import TeamModeDrawScreen from './screens/TeamModeDrawScreen.jsx'
import FinalScreen from './screens/FinalScreen.jsx'
import { useGames } from './hooks/useProfiles.js'
import { NBA_TEAMS, getLogoUrl } from './data/teams.js'

// ── Small inline reveal screen for Teams mode stat ──────────────────────────
function TeamStatReveal({ entry, statMode, currentPlayer, onNext }) {
  const statVal  = statMode === 'wins' ? entry.w : entry.l
  const statName = statMode === 'wins' ? 'Wins' : 'Losses'
  const team     = NBA_TEAMS.find(t => String(t.id) === String(entry.teamId))
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ textAlign: 'center', maxWidth: '380px', width: '100%' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '20px' }}>
          {currentPlayer}'s pick
        </div>
        {team && (
          <img src={getLogoUrl(team.slug)} alt={entry.name}
            style={{ width: 80, height: 80, objectFit: 'contain', marginBottom: 12 }}
            onError={e => { e.target.style.display = 'none' }}
          />
        )}
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(1.6rem, 5vw, 2.2rem)', textTransform: 'uppercase', color: 'var(--white)', marginBottom: 4 }}>
          {entry.name}
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--gold)', marginBottom: 24, letterSpacing: '0.08em' }}>
          {entry.season}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '20px 32px', background: 'rgba(245,197,24,0.08)', border: '1px solid rgba(245,197,24,0.25)', borderRadius: 'var(--radius-lg)', marginBottom: 28 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '4rem', color: 'var(--gold)', lineHeight: 1 }}>{statVal}</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--white-50)' }}>{statName}</span>
        </div>
        <button onClick={onNext} style={{ width: '100%', background: 'var(--gold)', color: 'var(--navy)', fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '14px', borderRadius: 'var(--radius)', border: 'none', cursor: 'pointer' }}>
          Next →
        </button>
      </div>
    </div>
  )
}

const SCREENS = {
  SETUP: 'SETUP', ORDER_DRAW: 'ORDER_DRAW', TURN: 'TURN',
  TEAM_DRAW: 'TEAM_DRAW', PICK_PLAYER: 'PICK_PLAYER',
  TEAM_MODE_DRAW: 'TEAM_MODE_DRAW',
  TEAM_STAT_REVEAL: 'TEAM_STAT_REVEAL',
  FINAL: 'FINAL',
}

function buildEmptyRoster(size) { return Array(size).fill(null) }

export default function App() {
  const [screen, setScreen] = useState(SCREENS.SETUP)
  const { games, saveGame, deleteGame } = useGames()

  // Config
  const [gameMode, setGameMode]              = useState('players') // 'players' | 'teams'
  const [statMode, setStatMode]              = useState('standard') // standard|pts|reb|ast|stl|blk|fg3m|wins|losses
  const [keepHidden, setKeepHidden]          = useState(false)
  const [players, setPlayers]                = useState([])
  const [rosterSize, setRosterSize]          = useState(6)
  const [eliminateTeams, setEliminate]       = useState(true)
  const [eliminateFranchises, setElimFranch] = useState(false)
  const [seasons, setSeasons]                = useState(['2025-26'])

  // Game state
  const [turnOrder, setTurnOrder]            = useState([])
  const [turnOrderFull, setTurnOrderFull]    = useState([])
  const [currentTurnIdx, setCurrentTurnIdx]  = useState(0)
  const [rosters, setRosters]                = useState({})
  const [drawnEntries, setDrawnEntries]      = useState([])
  const [currentTeam, setCurrentTeam]        = useState(null)
  const [currentRoster, setCurrentRoster]    = useState([])
  const [currentSeason, setCurrentSeason]    = useState(null)
  const [lastPickedEntry, setLastPickedEntry] = useState(null) // for team stat reveal
  const [pendingRosters, setPendingRosters]  = useState(null) // rosters after team pick, before reveal

  function handleSetupStart({ players, rosterSize, eliminateTeams, eliminateFranchises, seasons, gameMode, statMode, keepHidden }) {
    setPlayers(players)
    setRosterSize(rosterSize)
    setEliminate(eliminateTeams)
    setElimFranch(eliminateFranchises)
    setSeasons(seasons)
    setGameMode(gameMode)
    setStatMode(statMode)
    setKeepHidden(keepHidden)
    const emptyRosters = {}
    players.forEach(p => { emptyRosters[p.name] = buildEmptyRoster(rosterSize) })
    setRosters(emptyRosters)
    setScreen(SCREENS.ORDER_DRAW)
  }

  function handleOrderDrawn(order) {
    const full = order.map(name => players.find(p => p.name === name)).filter(Boolean)
    setTurnOrder(order)
    setTurnOrderFull(full)
    setCurrentTurnIdx(0)
    setScreen(SCREENS.TURN)
  }

  // Players mode: team drawn → go pick players
  function handleTeamDrawn(team, season, rosterPlayers) {
    setCurrentTeam(team)
    setCurrentSeason(season)
    setCurrentRoster(rosterPlayers)
    if (eliminateTeams) {
      setDrawnEntries(prev => [...prev, { teamId: team.id, season }])
    }
    setScreen(SCREENS.PICK_PLAYER)
  }

  // Teams mode: franchise drawn → store it and stay on TEAM_MODE_DRAW for season pick
  function handleFranchiseDrawn(team) {
    setCurrentTeam(team)
    if (eliminateFranchises) {
      setDrawnEntries(prev => [...prev, { teamId: team.id, season: null }])
    }
    // Don't change screen — TeamModeDrawScreen handles both draw and season-pick phases internally
  }

  // Teams mode: season chosen for franchise → add directly to roster
  function handleTeamSeasonChosen(team, season, wl) {
    const currentPlayer = turnOrder[currentTurnIdx]
    const currentRoster = rosters[currentPlayer] || []
    const nextSlot = currentRoster.findIndex(s => s === null)
    if (nextSlot === -1) return

    const entry = { id: `${team.id}-${season}`, name: team.name, season, w: wl.w, l: wl.l, teamId: team.id }
    const newRoster = [...currentRoster]
    newRoster[nextSlot] = entry
    const updatedRosters = { ...rosters, [currentPlayer]: newRoster }
    setRosters(updatedRosters)

    // Show stat reveal if stat mode is active and not hidden
    if (statMode !== 'standard' && !keepHidden) {
      setLastPickedEntry(entry)
      setPendingRosters(updatedRosters)
      setScreen(SCREENS.TEAM_STAT_REVEAL)
      return
    }

    advanceAfterTeamPick(updatedRosters)
  }

  function advanceAfterTeamPick(updatedRosters) {
    const allFull = turnOrder.every(p => updatedRosters[p]?.every(slot => slot !== null))
    if (allFull) {
      setScreen(SCREENS.FINAL)
    } else {
      setCurrentTurnIdx((currentTurnIdx + 1) % turnOrder.length)
      setCurrentTeam(null); setCurrentSeason(null); setCurrentRoster([])
      setScreen(SCREENS.TURN)
    }
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
      playerIds:   turnOrderFull.map(p => p.id),
      playerNames: turnOrderFull.map(p => p.name),
      winnerId:    winner.id,
      winnerName:  winner.name,
    })
  }

  function handleRestart() {
    setScreen(SCREENS.SETUP)
    setTurnOrder([]); setTurnOrderFull([])
    setCurrentTurnIdx(0); setRosters({})
    setDrawnEntries([])
    setCurrentTeam(null); setCurrentSeason(null); setCurrentRoster([])
    setLastPickedEntry(null); setPendingRosters(null)
  }

  const currentPlayer     = turnOrder[currentTurnIdx] || ''
  const currentUserRoster = rosters[currentPlayer] || []
  const picksCount        = currentUserRoster.filter(Boolean).length
  const multiSeason       = seasons.length > 1

  return (
    <>
      {screen === SCREENS.SETUP && (
        <SetupScreen onStart={handleSetupStart} savedGames={games} onDeleteGame={deleteGame} />
      )}
      {screen === SCREENS.ORDER_DRAW && (
        <OrderDrawScreen
          players={turnOrder.length ? turnOrder : players.map(p => p.name)}
          onOrderDrawn={handleOrderDrawn}
        />
      )}
      {screen === SCREENS.TURN && (
        <TurnScreen
          currentPlayer={currentPlayer} picksCount={picksCount}
          rosterSize={rosterSize} rosters={rosters} turnOrder={turnOrder}
          multiSeason={multiSeason} gameMode={gameMode} statMode={statMode}
          keepHidden={keepHidden}
          onDraw={() => setScreen(gameMode === 'teams' ? SCREENS.TEAM_MODE_DRAW : SCREENS.TEAM_DRAW)}
        />
      )}
      {screen === SCREENS.TEAM_DRAW && (
        <TeamDrawScreen
          drawnEntries={drawnEntries} eliminateTeams={eliminateTeams}
          eliminateFranchises={eliminateFranchises} seasons={seasons}
          onTeamDrawn={handleTeamDrawn}
        />
      )}
      {screen === SCREENS.TEAM_MODE_DRAW && (
        <TeamModeDrawScreen
          team={currentTeam}
          seasons={seasons}
          drawnEntries={drawnEntries}
          eliminateFranchises={eliminateFranchises}
          statMode={statMode}
          keepHidden={keepHidden}
          onFranchiseDrawn={handleFranchiseDrawn}
          onSeasonChosen={handleTeamSeasonChosen}
        />
      )}
      {screen === SCREENS.PICK_PLAYER && (
        <PickPlayerScreen
          currentPlayer={currentPlayer} team={currentTeam} season={currentSeason}
          nbaRoster={currentRoster} userRoster={currentUserRoster}
          rosterSize={rosterSize} multiSeason={multiSeason}
          statMode={statMode} keepHidden={keepHidden}
          onValidate={handlePickValidated}
        />
      )}
      {screen === SCREENS.TEAM_STAT_REVEAL && lastPickedEntry && (
        <TeamStatReveal
          entry={lastPickedEntry}
          statMode={statMode}
          currentPlayer={turnOrder[currentTurnIdx]}
          onNext={() => {
            setLastPickedEntry(null)
            advanceAfterTeamPick(pendingRosters || rosters)
          }}
        />
      )}
      {screen === SCREENS.FINAL && (
        <FinalScreen
          rosters={rosters} turnOrder={turnOrder} rosterSize={rosterSize}
          multiSeason={multiSeason} gameMode={gameMode}
          statMode={statMode} keepHidden={keepHidden}
          onDeclareWinner={handleDeclareWinner}
          onRestart={handleRestart}
        />
      )}
    </>
  )
}
