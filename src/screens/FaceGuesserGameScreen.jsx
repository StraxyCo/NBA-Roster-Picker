import { useState, useEffect, useMemo, useRef } from 'react'
// Play-screen chrome (top bar, score pills, photo card, feedback, recap) is the same
// sheet as Jersey Guesser, which asks the same shape of question about the same
// headshot; the name search is Playerdle's. Nothing here needs CSS of its own.
import styles from './JerseyGuesserGameScreen.module.css'
import search from './PlayerdleGameScreen.module.css'
import { filterNames } from '../utils/playerdle.js'
import { buildPlayerIndex, groupByTier, TIERS } from '../utils/playerRecognizability.js'
import {
  createMatch, resolveRound, drawRound, markFacesUsed, currentTier, isMatchOver,
} from '../utils/faceGuessRounds.js'

function getHeadshotUrl(id) {
  return `https://cdn.nba.com/headshots/nba/latest/1040x760/${id}.png`
}

const TIER_LABEL = Object.fromEntries(TIERS.map(t => [t.key, t.label]))

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function FaceGuesserGameScreen({ players, startTier, onBack, onSaveGame }) {
  const activePlayers = players.filter(Boolean)
  const byName = Object.fromEntries(activePlayers.map(p => [p.id, p.name]))
  const solo = activePlayers.length === 1

  const [phase, setPhase] = useState('loading') // loading | guess | answer | final
  const [match, setMatch] = useState(null)
  const [faces, setFaces] = useState({})
  const [answers, setAnswers] = useState({})
  const [turnIdx, setTurnIdx] = useState(0)
  const [query, setQuery] = useState('')
  const [imgError, setImgError] = useState(false)
  const [outcome, setOutcome] = useState(null) // { correct, name, eliminated, resolved }
  const [choices, setChoices] = useState([])
  const [exhausted, setExhausted] = useState(false)
  const [allNames, setAllNames] = useState([])
  const byTier = useRef({})
  const saved = useRef(false)

  useEffect(() => {
    let cancelled = false
    fetch('/rosters.json')
      .then(r => r.json())
      .then(rosters => {
        if (cancelled) return
        const index = [...buildPlayerIndex(rosters).values()]
        byTier.current = groupByTier(index.filter(p => p.hasPhoto))
        // Suggest from every player in the data, not just the ones with a portrait,
        // so a wrong guess stays possible.
        setAllNames(index.map(p => ({ id: p.id, name: p.name })))
        beginRound(createMatch(activePlayers.map(p => p.id), { startTier }))
      })
      .catch(e => console.error('FaceGuesser load error', e))
    return () => { cancelled = true }
  }, [])

  const suggestions = useMemo(() => filterNames(allNames, query), [allNames, query])

  function beginRound(m) {
    const dealt = drawRound(m, byTier.current, m.active)
    if (!dealt) { setExhausted(true); setMatch(m); setPhase('final'); return }
    setMatch(m)
    setFaces(dealt)
    setAnswers({})
    setTurnIdx(0)
    setQuery('')
    setImgError(false)
    // `dealt`, not the faces state: setFaces has not flushed yet on this pass.
    openTurn(m, 0, dealt)
  }

  function openTurn(m, idx, facesMap) {
    const id = m.active[idx]
    const face = facesMap[id]
    if (m.multipleChoice) {
      const pool = (byTier.current[currentTier(m)] ?? []).filter(p => p.id !== face?.id)
      setChoices(shuffle([face?.name, ...shuffle(pool).slice(0, 3).map(p => p.name)].filter(Boolean)))
    }
    setPhase('guess')
  }

  const currentId = match?.active[turnIdx]
  const currentFace = currentId != null ? faces[currentId] : null

  function answer(correct) {
    const nextAnswers = { ...answers, [currentId]: correct }
    setAnswers(nextAnswers)
    setQuery('')

    // The feedback below is about the turn just taken, so it keeps its own copy of
    // the face and the guesser. Reading those from state instead would show the next
    // round's: settling the round drops whoever is out, and the screen would render
    // a blank name and a missing photo.
    const shown = { correct, face: currentFace, who: byName[currentId] }

    const isLast = turnIdx + 1 >= match.active.length
    if (!isLast) {
      setOutcome({ ...shown, eliminated: [], nextMatch: null })
      setPhase('answer')
      return
    }
    // Last answer of the round: settle it now so this same screen can report who is
    // out, instead of a separate recap nobody asked for. The settled match is held
    // until "Next", so the header still describes the round being reported.
    const { match: next, eliminated } = resolveRound(match, nextAnswers)
    setOutcome({ ...shown, eliminated, nextMatch: markFacesUsed(next, faces) })
    setPhase('answer')
  }

  function handleNext() {
    if (!outcome.nextMatch) {
      const idx = turnIdx + 1
      setTurnIdx(idx)
      setImgError(false)
      openTurn(match, idx, faces)
      return
    }
    const settled = outcome.nextMatch
    setMatch(settled)
    if (isMatchOver(settled)) { setPhase('final'); return }
    beginRound(settled)
  }

  useEffect(() => {
    if (phase !== 'final' || saved.current || !match) return
    saved.current = true
    const winnerId = match.winner ?? null
    onSaveGame?.({
      playerIds: activePlayers.map(p => p.id),
      playerNames: activePlayers.map(p => p.name),
      winnerId,
      winnerName: winnerId != null ? byName[winnerId] : solo ? 'Solo run' : 'No winner',
    })
  }, [phase, match])

  if (phase === 'loading' || !match) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading faces…</div>
      </div>
    )
  }

  const tier = currentTier(match)
  // While reporting an answer, the card shows that answer's face, not the next one.
  const shownFace = phase === 'answer' ? outcome?.face : currentFace

  if (phase === 'final') {
    const winnerId = match.winner
    return (
      <div className={styles.container}>
        <div className={styles.recap}>
          <div className={styles.recapEyebrow}>{exhausted ? 'Out of faces' : 'Game Over'}</div>
          <div className={styles.recapHeadline}>
            {winnerId != null
              ? `${byName[winnerId]} wins!`
              : solo
                ? `You lasted ${match.round} ${match.round === 1 ? 'round' : 'rounds'}`
                : exhausted
                  ? `Draw — ${match.active.map(id => byName[id]).join(' & ')}`
                  : 'Nobody left standing'}
          </div>
          <button className={styles.primaryBtn} onClick={onBack}>New Game</button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <button className={styles.backArrow} onClick={onBack} aria-label="Back">←</button>
        <div className={styles.roundInfo}>Round {match.round + 1} · {TIER_LABEL[tier]}</div>
        <div className={styles.scorePills}>
          {match.active.map(id => (
            <span
              key={id}
              className={`${styles.scorePill} ${id === currentId ? styles.scorePillActive : ''}`}
            >
              {byName[id]}
            </span>
          ))}
        </div>
      </div>

      <div className={styles.turnLabel}>{(phase === 'answer' ? outcome.who : byName[currentId])}'s turn</div>

      <div className={styles.playerCard}>
        {!imgError && shownFace ? (
          <img
            src={getHeadshotUrl(shownFace.id)}
            alt="Guess this player"
            className={styles.headshot}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className={styles.headshotFallback}>?</div>
        )}
      </div>

      {phase === 'guess' && (match.multipleChoice ? (
        <div className={styles.hintArea}>
          <div className={styles.hintLabel}>Nobody got the last few — pick the name:</div>
          <div className={styles.choicesGrid}>
            {choices.map(name => (
              <button key={name} className={styles.choiceBtn} onClick={() => answer(name === currentFace.name)}>
                {name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className={styles.guessArea}>
          <div className={styles.guessLabel}>Who is this?</div>
          <div className={search.search}>
            <input
              className={search.input}
              autoFocus
              placeholder="Search a player…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {suggestions.length > 0 && (
              <div className={search.suggestions}>
                {suggestions.map(p => (
                  <button
                    key={p.id}
                    className={search.suggestion}
                    onClick={() => answer(p.id === currentFace.id)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className={styles.primaryBtn} onClick={() => answer(false)}>No idea</button>
        </div>
      ))}

      {phase === 'answer' && (
        <div className={styles.feedbackArea}>
          <div className={`${styles.feedbackIcon} ${outcome.correct ? styles.feedbackIconCorrect : styles.feedbackIconWrong}`}>
            {outcome.correct ? '✓' : '✗'}
          </div>
          <div className={styles.feedbackHeading}>{outcome.face.name}</div>
          <div className={styles.feedbackSub}>
            {outcome.eliminated.length > 0
              ? `${outcome.eliminated.map(id => byName[id]).join(', ')} ${outcome.eliminated.length === 1 ? 'is' : 'are'} out`
              : outcome.correct ? `${outcome.who} got it` : `${outcome.who} missed`}
          </div>
          <button className={styles.primaryBtn} onClick={handleNext}>
            {!outcome.nextMatch ? 'Next player →' : isMatchOver(outcome.nextMatch) ? 'See result →' : 'Next round →'}
          </button>
        </div>
      )}
    </div>
  )
}
