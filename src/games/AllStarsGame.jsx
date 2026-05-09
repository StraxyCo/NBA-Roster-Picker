import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AllStarsSetupScreen from '../screens/AllStarsSetupScreen.jsx'
import OrderDrawScreen from '../screens/OrderDrawScreen.jsx'
import AllStarsGameScreen from '../screens/AllStarsGameScreen.jsx'
import { useAllStarsGames } from '../hooks/useProfiles.js'
import styles from './AllStarsGame.module.css'

const PHASES = {
  SETUP: 'setup',
  ORDER_DRAW: 'order_draw',
  SEASON_REVEAL: 'season_reveal',
  PLAYING: 'playing',
  RECAP: 'recap',
}

// Eastern Conference team abbreviations (for non-fantasy years)
const EAST_ABBRS = new Set([
  'ATL','BOS','BKN','CHA','CHI','CLE','DET','IND','MIA','MIL','NYK','ORL','PHI','TOR','WAS',
])

// Hardcoded actual conference for the captain-draft years (2017-18 → 2022-23)
// where allstars.json splits teams by captain (LBN/GNS/etc.) not by conference.
const CONFERENCE_HARDCODE = {
  '2017-18': {
    2544:'east', 200746:'west', 200768:'east', 201142:'west', 201143:'east',
    201566:'west', 201609:'east', 201935:'west', 201939:'west', 201942:'east',
    202331:'west', 202681:'east', 202689:'east', 202691:'west', 202710:'west',
    203076:'west', 203078:'east', 203081:'west', 203083:'east', 203110:'west',
    203506:'east', 203507:'east', 203954:'east', 1626157:'west',
  },
  '2018-19': {
    1717:'west', 2544:'west', 2548:'east', 200746:'west', 200768:'east',
    201142:'west', 201566:'west', 201933:'east', 201935:'west', 201939:'west',
    202331:'west', 202681:'east', 202689:'east', 202691:'west', 202695:'east',
    202696:'east', 203076:'west', 203078:'east', 203081:'west', 203114:'east',
    203506:'east', 203507:'east', 203954:'east', 203999:'west', 1626156:'east',
    1626157:'west', 1627732:'east',
  },
  '2019-20': {
    2544:'west', 101108:'west', 200768:'east', 201566:'west', 201935:'west',
    202689:'east', 202695:'west', 202710:'east', 203076:'west', 203081:'west',
    203114:'east', 203497:'west', 203507:'east', 203954:'east', 203999:'west',
    1626164:'west', 1627732:'east', 1627734:'east', 1627742:'west', 1627783:'east',
    1628369:'east', 1628378:'west', 1628389:'east', 1629027:'east', 1629029:'west',
  },
  '2020-21': {
    2544:'west', 101108:'west', 201144:'west', 201935:'west', 201939:'west',
    202331:'west', 202681:'east', 202695:'west', 202696:'east', 203078:'east',
    203081:'west', 203497:'west', 203507:'east', 203897:'east', 203944:'east',
    203999:'west', 1627734:'east', 1627759:'east', 1628369:'east', 1628378:'west',
    1629029:'west', 1629627:'west',
  },
  '2021-22': {
    2544:'west', 101108:'west', 201939:'west', 201942:'east', 202710:'east',
    203114:'east', 203497:'west', 203507:'east', 203897:'east', 203952:'west',
    203954:'east', 203999:'west', 1626157:'west', 1626164:'west', 1627749:'west',
    1627832:'east', 1628369:'east', 1628386:'east', 1629027:'east', 1629029:'west',
    1629630:'west', 1629636:'east', 1630163:'east',
  },
  '2022-23': {
    2544:'west', 201942:'east', 201950:'east', 202331:'west', 202681:'east',
    203081:'west', 203507:'east', 203944:'east', 203954:'east', 203999:'west',
    1627734:'west', 1627759:'east', 1627783:'east', 1628368:'west', 1628369:'east',
    1628374:'west', 1628378:'east', 1628389:'east', 1628983:'west', 1628991:'west',
    1629029:'west', 1629630:'west', 1630162:'west', 1630169:'east',
  },
}

function buildConferenceAllStars(allstarsData, season, careers) {
  const data = allstarsData[season]
  if (!data) return { east: [], west: [] }

  const allPlayers = [...(data.east || []), ...(data.west || [])]
  const seen = new Set()
  const unique = allPlayers.filter(p => {
    if (seen.has(String(p.id))) return false
    seen.add(String(p.id))
    return true
  })

  const hardcode = CONFERENCE_HARDCODE[season]
  const east = []
  const west = []

  for (const p of unique) {
    let conf = null

    if (hardcode) {
      // Use hardcoded conference for captain-draft years
      conf = hardcode[Number(p.id)] || hardcode[String(p.id)] || null
    } else {
      // For classic East/West years: use careers.json team lookup
      const careerData = careers[String(p.id)]
      if (careerData) {
        const entry = careerData.seasons.find(s => s.season === season && s.teamAbbr !== 'TOT')
          || careerData.seasons.find(s => s.season === season)
        if (entry) conf = EAST_ABBRS.has(entry.teamAbbr) ? 'east' : 'west'
      }
    }

    if (conf === 'east') {
      east.push({ id: p.id, name: p.name })
    } else if (conf === 'west') {
      west.push({ id: p.id, name: p.name })
    } else {
      // Final fallback: trust the original allstars.json split
      if ((data.east || []).some(e => String(e.id) === String(p.id))) {
        east.push({ id: p.id, name: p.name })
      } else {
        west.push({ id: p.id, name: p.name })
      }
    }
  }
  return { east, west }
}

// ── Season Reveal ───────────────────────────────────────────────────────────
function SeasonRevealScreen({ season, onStart }) {
  return (
    <div className={styles.screen}>
      <div className={styles.content}>
        <div className={styles.eyebrow}>Tonight's All-Star Game</div>
        <div className={styles.seasonCard}>
          <span className={styles.seasonCardLabel}>Season</span>
          <h2 className={styles.seasonCardYear}>{season}</h2>
        </div>
        <button className={styles.drawBtn} onClick={onStart}>Let's play! →</button>
      </div>
    </div>
  )
}

// ── Recap / Final ───────────────────────────────────────────────────────────
function RecapScreen({ season, eastAllStars, westAllStars, picks, scores, turnOrder, onFinish }) {
  const sorted   = [...turnOrder].sort((a, b) => (scores[b] || 0) - (scores[a] || 0))
  const topScore = scores[sorted[0]] || 0
  const winners  = sorted.filter(n => (scores[n] || 0) === topScore)
  const label    = winners.length === 1 ? winners[0] : `Tie — ${winners.join(' & ')}`

  const eastPicks = picks.filter(p => p.conference === 'east')
  const westPicks = picks.filter(p => p.conference === 'west')

  const pickedEastIds = new Set(eastPicks.filter(p => p.correct).map(p => String(p.playerId)))
  const pickedWestIds = new Set(westPicks.filter(p => p.correct).map(p => String(p.playerId)))
  const missingEast = eastAllStars.filter(p => !pickedEastIds.has(String(p.id)))
  const missingWest = westAllStars.filter(p => !pickedWestIds.has(String(p.id)))

  return (
    <div className={styles.finalScreen}>
      <div className={styles.finalContent}>
        <div className={styles.eyebrow}>Game Over — {season}</div>
        <h2 className={styles.winnerName}>{label}</h2>
        <p className={styles.winnerSub}>{winners.length > 1 ? 'tied for the win!' : 'wins!'}</p>

        {/* Scores */}
        <div className={styles.scoreBoard}>
          <div className={styles.scoreBoardLabel}>Final Scores</div>
          {sorted.map(n => (
            <div key={n} className={styles.scoreRow}>
              <span className={styles.scorePlayerName}>{n}</span>
              <span className={styles.scorePoints}>{scores[n] || 0} pts</span>
            </div>
          ))}
        </div>

        {/* East picks */}
        <div className={styles.confBlock}>
          <div className={styles.confHeader}>East</div>
          {eastPicks.map((p, i) => (
            <div key={i} className={`${styles.confRow} ${p.correct ? styles.confRowCorrect : styles.confRowWrong}`}>
              <span className={styles.confRowIcon}>{p.correct ? '✓' : '✗'}</span>
              <span className={styles.confRowName}>{p.playerName}</span>
              <span className={styles.confRowPicker}>{p.pickedBy}</span>
            </div>
          ))}
          {Array.from({ length: Math.max(0, eastAllStars.length - eastPicks.length) }).map((_, i) => (
            <div key={`empty-e-${i}`} className={`${styles.confRow} ${styles.confRowEmpty}`}>
              <span className={styles.confRowIcon}>—</span>
              <span className={styles.confRowName}>Empty slot</span>
            </div>
          ))}
        </div>

        {/* West picks */}
        <div className={styles.confBlock}>
          <div className={styles.confHeader}>West</div>
          {westPicks.map((p, i) => (
            <div key={i} className={`${styles.confRow} ${p.correct ? styles.confRowCorrect : styles.confRowWrong}`}>
              <span className={styles.confRowIcon}>{p.correct ? '✓' : '✗'}</span>
              <span className={styles.confRowName}>{p.playerName}</span>
              <span className={styles.confRowPicker}>{p.pickedBy}</span>
            </div>
          ))}
          {Array.from({ length: Math.max(0, westAllStars.length - westPicks.length) }).map((_, i) => (
            <div key={`empty-w-${i}`} className={`${styles.confRow} ${styles.confRowEmpty}`}>
              <span className={styles.confRowIcon}>—</span>
              <span className={styles.confRowName}>Empty slot</span>
            </div>
          ))}
        </div>

        {/* Missing all-stars */}
        {(missingEast.length > 0 || missingWest.length > 0) && (
          <div className={styles.missingBlock}>
            <div className={styles.missingLabel}>Unpicked All-Stars</div>
            {missingEast.map(p => (
              <div key={p.id} className={styles.missingRow}>
                <span className={styles.missingConf}>EAST</span>
                <span className={styles.missingName}>{p.name}</span>
              </div>
            ))}
            {missingWest.map(p => (
              <div key={p.id} className={styles.missingRow}>
                <span className={`${styles.missingConf} ${styles.missingConfWest}`}>WEST</span>
                <span className={styles.missingName}>{p.name}</span>
              </div>
            ))}
          </div>
        )}

        <button className={styles.finishBtn} onClick={onFinish}>Finish</button>
      </div>
    </div>
  )
}

// ── Main orchestrator ───────────────────────────────────────────────────────
export default function AllStarsGame() {
  const navigate = useNavigate()
  const { games, saveGame, deleteGame } = useAllStarsGames()

  const [phase, setPhase]       = useState(PHASES.SETUP)
  const [config, setConfig]     = useState(null)
  const [allstars, setAllstars] = useState(null)
  const [careers, setCareers]   = useState(null)
  const [rosters, setRosters]   = useState(null)

  const [turnOrder, setTurnOrder]         = useState([])
  const [playerObjects, setPlayerObjects] = useState([])
  const [turnIndex, setTurnIndex]         = useState(0)
  const [scores, setScores]               = useState({})
  const [season, setSeason]               = useState(null)
  const [eastAllStars, setEastAllStars]   = useState([])
  const [westAllStars, setWestAllStars]   = useState([])
  const [picks, setPicks]                 = useState([])

  useEffect(() => {
    Promise.all([
      fetch('/allstars.json').then(r => r.json()),
      fetch('/careers.json').then(r => r.json()),
      fetch('/rosters.json').then(r => r.json()),
    ]).then(([a, c, r]) => { setAllstars(a); setCareers(c); setRosters(r) })
      .catch(e => console.error('data load error', e))
  }, [])

  const dataLoaded = allstars !== null && careers !== null && rosters !== null

  function handleStart(cfg) {
    setConfig(cfg)
    setPhase(PHASES.ORDER_DRAW)
  }

  function handleOrderDrawn(order) {
    setTurnOrder(order)
    setPlayerObjects(
      config.players
        .filter(p => order.includes(p.name))
        .sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name))
    )
    setTurnIndex(0)
    setScores(Object.fromEntries(order.map(n => [n, 0])))
    setPicks([])

    // Draw one season for the whole game
    const available = config.seasons.filter(s => allstars[s])
    const drawn = available[Math.floor(Math.random() * available.length)]
    setSeason(drawn)

    const { east, west } = buildConferenceAllStars(allstars, drawn, careers)
    setEastAllStars(east)
    setWestAllStars(west)

    setPhase(PHASES.SEASON_REVEAL)
  }

  function handlePick({ playerId, playerName, conference }) {
    const currentPlayerName = turnOrder[turnIndex % turnOrder.length]

    // Guard: can't overfill a conference
    const eastPicks = picks.filter(p => p.conference === 'east')
    const westPicks = picks.filter(p => p.conference === 'west')
    if (conference === 'east' && eastPicks.length >= eastAllStars.length) return
    if (conference === 'west' && westPicks.length >= westAllStars.length) return
    // Guard: no repeat picks
    if (picks.some(p => String(p.playerId) === String(playerId))) return

    const correct = conference === 'east'
      ? eastAllStars.some(p => String(p.id) === String(playerId))
      : westAllStars.some(p => String(p.id) === String(playerId))

    const newPick = { playerId, playerName, conference, pickedBy: currentPlayerName, correct }
    const newPicks = [...picks, newPick]
    setPicks(newPicks)

    if (correct) {
      setScores(prev => ({ ...prev, [currentPlayerName]: (prev[currentPlayerName] || 0) + 1 }))
    }

    const newEast = newPicks.filter(p => p.conference === 'east').length
    const newWest = newPicks.filter(p => p.conference === 'west').length
    if (newEast >= eastAllStars.length && newWest >= westAllStars.length) {
      setPhase(PHASES.RECAP)
    } else {
      setTurnIndex(prev => prev + 1)
    }
  }

  async function handleFinish() {
    const sorted   = [...turnOrder].sort((a, b) => (scores[b] || 0) - (scores[a] || 0))
    const topScore = scores[sorted[0]] || 0
    const winners  = sorted.filter(n => (scores[n] || 0) === topScore)
    const winner   = winners.length === 1 ? playerObjects.find(p => p.name === winners[0]) : null

    await saveGame({
      playerIds:   playerObjects.map(p => p.id),
      playerNames: playerObjects.map(p => p.name),
      winnerId:    winner?.id ?? null,
      winnerName:  winners.length > 1 ? `Tie (${winners.join(', ')})` : winners[0],
    })
    navigate('/')
  }

  const currentPlayerName = turnOrder[turnIndex % turnOrder.length] || ''

  // Compute per-conference slot fill state for the game screen
  const eastPicks = picks.filter(p => p.conference === 'east')
  const westPicks = picks.filter(p => p.conference === 'west')

  return (
    <>
      {phase === PHASES.SETUP && (
        <AllStarsSetupScreen
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

      {phase === PHASES.SEASON_REVEAL && season && (
        <SeasonRevealScreen
          season={season}
          onStart={() => setPhase(PHASES.PLAYING)}
        />
      )}

      {phase === PHASES.PLAYING && season && rosters && (
        <AllStarsGameScreen
          season={season}
          eastAllStars={eastAllStars}
          westAllStars={westAllStars}
          eastPicks={eastPicks}
          westPicks={westPicks}
          rosters={rosters}
          config={config}
          currentPlayer={currentPlayerName}
          onPick={handlePick}
          onFinishEarly={() => setPhase(PHASES.RECAP)}
        />
      )}

      {phase === PHASES.RECAP && (
        <RecapScreen
          season={season}
          eastAllStars={eastAllStars}
          westAllStars={westAllStars}
          picks={picks}
          scores={scores}
          turnOrder={turnOrder}
          onFinish={handleFinish}
        />
      )}
    </>
  )
}
