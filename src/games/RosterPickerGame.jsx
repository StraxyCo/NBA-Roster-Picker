import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SetupScreen from '../screens/SetupScreen.jsx'
import OrderDrawScreen from '../screens/OrderDrawScreen.jsx'
import TurnScreen from '../screens/TurnScreen.jsx'
import TeamDrawScreen from '../screens/TeamDrawScreen.jsx'
import SeasonDrawScreen from '../screens/SeasonDrawScreen.jsx'
import PickPlayerScreen from '../screens/PickPlayerScreen.jsx'
import TeamModeDrawScreen from '../screens/TeamModeDrawScreen.jsx'
import FinalScreen from '../screens/FinalScreen.jsx'
import { useGames } from '../hooks/useProfiles.js'
import { fetchRoster } from '../hooks/useRoster.js'
import { NBA_TEAMS, getLogoUrl } from '../data/teams.js'
import { prefetchShards } from '../grading/shards.js'

const SCREENS = {
  SETUP: 'SETUP', ORDER_DRAW: 'ORDER_DRAW', TURN: 'TURN',
  TEAM_DRAW: 'TEAM_DRAW', PICK_PLAYER: 'PICK_PLAYER',
  TEAM_MODE_DRAW: 'TEAM_MODE_DRAW', TEAM_STAT_REVEAL: 'TEAM_STAT_REVEAL',
  REDRAW_TEAM: 'REDRAW_TEAM', REDRAW_SEASON: 'REDRAW_SEASON',
  FINAL: 'FINAL',
}

const EMPTY_BONUSES = { enabled: false, year: 0, team: 0, all: 0 }

function buildEmptyRoster(size) { return Array(size).fill(null) }

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

export default function RosterPickerGame() {
  const navigate = useNavigate()
  const { games, saveGame, deleteGame } = useGames()
  const [screen, setScreen] = useState(SCREENS.SETUP)

  const [gameMode, setGameMode]              = useState('players')
  const [statMode, setStatMode]              = useState('standard')
  const [keepHidden, setKeepHidden]          = useState(false)
  const [players, setPlayers]                = useState([])
  const [rosterSize, setRosterSize]          = useState(6)
  const [eliminateTeams, setEliminate]       = useState(true)
  const [eliminateFranchises, setElimFranch] = useState(false)
  const [seasons, setSeasons]                = useState(['2025-26'])

  const [turnOrder, setTurnOrder]            = useState([])
  const [turnOrderFull, setTurnOrderFull]    = useState([])
  const [currentTurnIdx, setCurrentTurnIdx]  = useState(0)
  const [rosters, setRosters]                = useState({})
  const [drawnEntries, setDrawnEntries]      = useState([])
  const [currentTeam, setCurrentTeam]        = useState(null)
  const [currentRoster, setCurrentRoster]    = useState([])
  const [currentSeason, setCurrentSeason]    = useState(null)
  const [lastPickedEntry, setLastPickedEntry] = useState(null)
  const [pendingRosters, setPendingRosters]  = useState(null)
  const [lastGameConfig, setLastGameConfig]  = useState(null)
  const [bans, setBans]                      = useState(0)
  const [bannedPlayers, setBannedPlayers]    = useState({}) // { playerId: true }
  const [bonuses, setBonuses]                = useState(EMPTY_BONUSES)
  const [jokersLeft, setJokersLeft]          = useState({}) // { [playerName]: { year, team, all } }
  const [redrawPool, setRedrawPool]          = useState(null)   // [{ team, season }] for REDRAW_TEAM
  const [redrawSeasons, setRedrawSeasons]    = useState(null)   // string[] for REDRAW_SEASON
  const [redrawShowSeason, setRedrawShowSeason] = useState(true)

  function handleSetupStart({ players, rosterSize, eliminateTeams, eliminateFranchises, seasons, gameMode, statMode, keepHidden, bans: banCount, bonuses: bonusCfg }) {
    setPlayers(players)
    setRosterSize(rosterSize)
    setEliminate(eliminateTeams)
    setElimFranch(eliminateFranchises)
    setSeasons(seasons)
    setGameMode(gameMode)
    setStatMode(statMode)
    setKeepHidden(keepHidden)
    setBans(banCount || 0)
    const cfg = bonusCfg || EMPTY_BONUSES
    setBonuses(cfg)
    const initialBans = {}
    const initialJokers = {}
    players.forEach(p => { initialBans[p.name] = {}; initialJokers[p.name] = { year: cfg.year, team: cfg.team, all: cfg.all } })
    setBannedPlayers(initialBans)
    setJokersLeft(initialJokers)
    setLastGameConfig({ players, rosterSize, eliminateTeams, eliminateFranchises, seasons, gameMode, statMode, keepHidden, bans: banCount, bonuses: cfg })
    const emptyRosters = {}
    players.forEach(p => { emptyRosters[p.name] = buildEmptyRoster(rosterSize) })
    setRosters(emptyRosters)
    setDrawnEntries([])
    setScreen(SCREENS.ORDER_DRAW)
  }

  function handleOrderDrawn(order) {
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
    // Warm the grading shard for this season while the user picks (players mode only).
    if (gameMode === 'players' && season) prefetchShards([season])
    if (eliminateTeams) {
      setDrawnEntries(prev => [...prev, { teamId: team.id, season }])
    }
    setScreen(SCREENS.PICK_PLAYER)
  }

  // ── Jokers / bonuses ────────────────────────────────────────────────────────
  // Build the allowed pool for a redraw, honouring the eliminate filters against a
  // given drawn-set (the current pairing is freed before this is called).
  function buildRedrawPool(type, baseDrawn) {
    const drawnTeamIds = new Set(baseDrawn.map(e => e.teamId))
    const blocked = (teamId, season) => {
      if (eliminateFranchises && drawnTeamIds.has(teamId)) return true
      if (eliminateTeams && baseDrawn.some(e => e.teamId === teamId && e.season === season)) return true
      return false
    }
    const out = []
    if (type === 'year') {
      for (const s of seasons) {
        if (s === currentSeason || blocked(currentTeam.id, s)) continue
        out.push({ team: currentTeam, season: s })
      }
    } else if (type === 'team') {
      for (const t of NBA_TEAMS) {
        if (t.id === currentTeam.id || blocked(t.id, currentSeason)) continue
        out.push({ team: t, season: currentSeason })
      }
    } else { // all — only the exact current pairing is excluded
      for (const s of seasons) for (const t of NBA_TEAMS) {
        if (t.id === currentTeam.id && s === currentSeason) continue
        if (blocked(t.id, s)) continue
        out.push({ team: t, season: s })
      }
    }
    return out
  }

  function handleJoker(type) {
    const player = turnOrder[currentTurnIdx]
    if (!currentTeam || (jokersLeft[player]?.[type] ?? 0) <= 0) return
    const freed = drawnEntries.filter(e => !(e.teamId === currentTeam.id && e.season === currentSeason))
    const pool = buildRedrawPool(type, freed)
    if (pool.length === 0) return
    setJokersLeft(prev => ({ ...prev, [player]: { ...prev[player], [type]: prev[player][type] - 1 } }))
    setDrawnEntries(freed) // the redrawn pairing no longer counts toward the filters
    if (type === 'year') {
      setRedrawSeasons(pool.map(e => e.season))
      setScreen(SCREENS.REDRAW_SEASON)
    } else {
      setRedrawPool(pool)
      setRedrawShowSeason(type === 'all' ? seasons.length > 1 : true)
      setScreen(SCREENS.REDRAW_TEAM)
    }
  }

  async function handleSeasonRedrawn(season) {
    const result = await fetchRoster(currentTeam.id, season)
    if (result?.error) { setScreen(SCREENS.PICK_PLAYER); return }
    setCurrentSeason(season)
    setCurrentRoster(result)
    if (eliminateTeams) setDrawnEntries(prev => [...prev, { teamId: currentTeam.id, season }])
    if (gameMode === 'players') prefetchShards([season])
    setScreen(SCREENS.PICK_PLAYER)
  }

  function handleFranchiseDrawn(team) {
    setCurrentTeam(team)
    if (eliminateFranchises) {
      setDrawnEntries(prev => [...prev, { teamId: team.id, season: null }])
    }
  }

  function handleTeamSeasonChosen(team, season, wl) {
    const currentPlayer = turnOrder[currentTurnIdx]
    const currentRosterSlots = rosters[currentPlayer] || []
    const nextSlot = currentRosterSlots.findIndex(s => s === null)
    if (nextSlot === -1) return

    const entry = { id: `${team.id}-${season}`, name: team.name, season, w: wl.w, l: wl.l, teamId: team.id }
    const newRoster = [...currentRosterSlots]
    newRoster[nextSlot] = entry
    const updatedRosters = { ...rosters, [currentPlayer]: newRoster }
    setRosters(updatedRosters)

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
    setTurnOrder([]); setTurnOrderFull([])
    setCurrentTurnIdx(0); setRosters({})
    setDrawnEntries([])
    setCurrentTeam(null); setCurrentSeason(null); setCurrentRoster([])
    setLastPickedEntry(null); setPendingRosters(null)
    setScreen(SCREENS.SETUP)
  }

  const currentPlayer     = turnOrder[currentTurnIdx] || ''
  const currentUserRoster = rosters[currentPlayer] || []
  const picksCount        = currentUserRoster.filter(Boolean).length
  const multiSeason       = seasons.length > 1

  const currJokers = jokersLeft[currentPlayer] || { year: 0, team: 0, all: 0 }
  const freedForRedraw = currentTeam ? drawnEntries.filter(e => !(e.teamId === currentTeam.id && e.season === currentSeason)) : []
  const canRedraw = {
    year: bonuses.year > 0 && !!currentTeam && buildRedrawPool('year', freedForRedraw).length > 0,
    team: bonuses.team > 0 && !!currentTeam && buildRedrawPool('team', freedForRedraw).length > 0,
    all:  bonuses.all  > 0 && !!currentTeam && buildRedrawPool('all',  freedForRedraw).length > 0,
  }

  return (
    <>
      {screen === SCREENS.SETUP && (
        <SetupScreen
          onStart={handleSetupStart}
          savedGames={games}
          onDeleteGame={deleteGame}
          onBack={() => navigate('/')}
          initialConfig={lastGameConfig}
        />
      )}
      {screen === SCREENS.ORDER_DRAW && (
        <OrderDrawScreen
          players={turnOrder.length ? turnOrder : players.map(p => p.name)}
          onOrderDrawn={handleOrderDrawn}
          confirmLabel="Start Drafting →"
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
          bans={bans} bannedPlayers={bannedPlayers}
          bonusConfig={{ year: bonuses.year, team: bonuses.team, all: bonuses.all }}
          jokersLeft={currJokers} canRedraw={canRedraw} onJoker={handleJoker}
          onValidate={handlePickValidated}
          onBanPlayer={(playerId) => setBannedPlayers(prev => ({
            ...prev,
            [currentPlayer]: { ...prev[currentPlayer], [playerId]: true }
          }))}
        />
      )}

      {screen === SCREENS.REDRAW_TEAM && (
        <TeamDrawScreen
          drawnEntries={drawnEntries} eliminateTeams={eliminateTeams}
          eliminateFranchises={eliminateFranchises} seasons={seasons}
          pool={redrawPool} showSeason={redrawShowSeason}
          onTeamDrawn={handleTeamDrawn}
        />
      )}

      {screen === SCREENS.REDRAW_SEASON && (
        <SeasonDrawScreen
          eyebrow="Redraw Season"
          seasons={redrawSeasons || seasons}
          onDrawn={handleSeasonRedrawn}
          autoStart
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
