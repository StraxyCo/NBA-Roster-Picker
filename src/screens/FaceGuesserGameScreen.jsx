import { useState, useEffect, useRef } from 'react'
import styles from './FaceGuesserGameScreen.module.css'
import { normalizeName } from '../utils/normalizeName.js'
import { guessablePlayers, groupByTier, TIERS } from '../utils/playerRecognizability.js'
import {
  createMatch, resolveRound, drawRound, markFacesUsed,
  currentTier, isMatchOver, ROUND_SCHEDULE,
} from '../utils/faceGuessRounds.js'
import { headshotUrl, headshotSource, CREDITS } from '../data/backfilledHeadshots.js'

const TIER_LABEL = Object.fromEntries(TIERS.map(t => [t.key, t.label]))

// A guess counts if it is the whole name or just the surname. Surnames are accepted
// because typing "Giannis Antetokounmpo" on a phone is its own puzzle, and naming the
// face is the thing being tested. It does mean the Gasols, Morrises and
// Antetokounmpos pass for each other — acceptable in a party game, and a deliberate
// choice rather than an oversight.
function isCorrectGuess(guess, fullName) {
  const g = normalizeName(guess)
  if (!g) return false
  const full = normalizeName(fullName)
  if (g === full) return true
  const parts = full.split(' ').filter(Boolean)
  if (parts.length < 2) return false
  const surname = parts[parts.length - 1]
  // Trailing suffixes mean the real surname sits one word earlier.
  const SUFFIX = new Set(['jr', 'jr.', 'sr', 'ii', 'iii', 'iv'])
  const effective = SUFFIX.has(surname) && parts.length > 2 ? parts[parts.length - 2] : surname
  return g === effective || g === surname
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function Headshot({ face }) {
  const [imgError, setImgError] = useState(false)
  useEffect(() => { setImgError(false) }, [face.id])
  return imgError ? (
    <div className={styles.headshotFallback}>{face.name[0]}</div>
  ) : (
    <img
      src={headshotUrl(face.id)}
      alt="Guess this player"
      className={styles.headshot}
      onError={() => setImgError(true)}
    />
  )
}

// Backfilled portraits are press images from ESPN and Basketball-Reference rather
// than the NBA CDN, so they carry a credit. It appears only once the answer is out:
// on the guessing screen a source name would narrow down the era, which is a hint.
function PhotoCredit({ id }) {
  const credit = CREDITS.find(c => c.source === headshotSource(id))
  if (!credit) return null
  return (
    <a className={styles.photoCredit} href={credit.url} target="_blank" rel="noreferrer">
      Photo: {credit.label}
    </a>
  )
}

export default function FaceGuesserGameScreen({ players, startTier, onBack, onSaveGame }) {
  const activePlayers = players.filter(Boolean)
  const byName = Object.fromEntries(activePlayers.map(p => [p.id, p.name]))
  const solo = activePlayers.length === 1

  const [phase, setPhase] = useState('loading') // loading | handoff | guess | answer | round | final
  const [match, setMatch] = useState(null)
  const [faces, setFaces] = useState({})
  const [answers, setAnswers] = useState({})
  const [turnIdx, setTurnIdx] = useState(0)
  const [inputVal, setInputVal] = useState('')
  const [lastCorrect, setLastCorrect] = useState(false)
  const [choices, setChoices] = useState([])
  const [roundOutcome, setRoundOutcome] = useState(null)
  const [exhausted, setExhausted] = useState(false)
  const byTier = useRef({})
  const inputRef = useRef(null)
  const saved = useRef(false)

  useEffect(() => {
    let cancelled = false
    fetch('/rosters.json')
      .then(r => r.json())
      .then(rosters => {
        if (cancelled) return
        byTier.current = groupByTier(guessablePlayers(rosters))
        const m = createMatch(activePlayers.map(p => p.id), { startTier })
        beginRound(m)
      })
      .catch(e => console.error('FaceGuesser load error', e))
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (phase === 'guess' && !match?.multipleChoice) inputRef.current?.focus()
  }, [phase, turnIdx, match?.multipleChoice])

  function beginRound(m) {
    const dealt = drawRound(m, byTier.current, m.active)
    if (!dealt) { setExhausted(true); setMatch(m); setPhase('final'); return }
    setMatch(m)
    setFaces(dealt)
    setAnswers({})
    setTurnIdx(0)
    setInputVal('')
    setPhase('handoff')
  }

  const currentId = match?.active[turnIdx]
  const currentFace = currentId != null ? faces[currentId] : null

  function openGuess() {
    if (match.multipleChoice && currentFace) {
      const pool = (byTier.current[currentTier(match)] ?? [])
        .filter(p => p.id !== currentFace.id)
      const distractors = shuffle(pool).slice(0, 3).map(p => p.name)
      setChoices(shuffle([currentFace.name, ...distractors]))
    }
    setPhase('guess')
  }

  function submitAnswer(correct) {
    setAnswers(prev => ({ ...prev, [currentId]: correct }))
    setLastCorrect(correct)
    setPhase('answer')
  }

  function handleSubmit(e) {
    e?.preventDefault()
    if (!inputVal.trim()) return
    submitAnswer(isCorrectGuess(inputVal, currentFace.name))
  }

  function handleNextAnswer() {
    if (turnIdx + 1 < match.active.length) {
      setTurnIdx(turnIdx + 1)
      setInputVal('')
      setPhase('handoff')
      return
    }
    const { match: next, eliminated, split, advanced } = resolveRound(match, answers)
    const withUsed = markFacesUsed(next, faces)
    setMatch(withUsed)
    setRoundOutcome({ eliminated, split, advanced, tier: currentTier(match) })
    setPhase(isMatchOver(withUsed) ? 'final' : 'round')
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

  if (phase === 'final') {
    const winnerId = match.winner
    return (
      <div className={styles.container}>
        <div className={styles.recap}>
          <div className={styles.recapEyebrow}>
            {exhausted ? 'Out of faces' : 'Game over'}
          </div>
          <div className={styles.recapHeadline}>
            {winnerId != null
              ? `${byName[winnerId]} wins!`
              : solo
                ? `You lasted ${match.round} ${match.round === 1 ? 'round' : 'rounds'}`
                : exhausted
                  // Survivors but no faces left: a draw, not a wipeout.
                  ? `Draw — ${match.active.map(id => byName[id]).join(' & ')}`
                  : 'Nobody left standing'}
          </div>
          <div className={styles.recapMeta}>
            {match.round} {match.round === 1 ? 'round' : 'rounds'} · reached {TIER_LABEL[tier]}
          </div>
          <button className={styles.primaryBtn} onClick={onBack}>New game</button>
        </div>
      </div>
    )
  }

  if (phase === 'round') {
    const { eliminated, split } = roundOutcome
    return (
      <div className={styles.container}>
        <div className={styles.topBar}>
          <button className={styles.backArrow} onClick={onBack} aria-label="Back">←</button>
          <div className={styles.roundInfo}>Round {match.round}</div>
        </div>
        <div className={styles.roundResult}>
          <div className={styles.revealGrid}>
            {Object.entries(faces).map(([pid, face]) => (
              <div
                key={pid}
                className={`${styles.revealCard} ${answers[pid] ? styles.revealCardOk : styles.revealCardMiss}`}
              >
                <Headshot face={face} />
                <div className={styles.revealName}>{face.name}</div>
                <div className={styles.revealWho}>
                  {byName[pid]} {answers[pid] ? '✓' : '✗'}
                </div>
                <PhotoCredit id={face.id} />
              </div>
            ))}
          </div>

          {eliminated.length > 0 ? (
            <div className={styles.banner}>
              {eliminated.map(id => byName[id]).join(', ')}
              {eliminated.length === 1 ? ' is out' : ' are out'}
            </div>
          ) : split ? (
            <div className={styles.banner}>Everyone still standing</div>
          ) : Object.values(answers).every(Boolean) ? (
            <div className={styles.bannerQuiet}>
              All correct — {roundOutcome.advanced ? 'getting harder' : `${TIER_LABEL[tier]} continues`}
            </div>
          ) : (
            <div className={styles.bannerQuiet}>
              Nobody got it — staying on {TIER_LABEL[tier]}
            </div>
          )}

          <button className={styles.primaryBtn} onClick={() => beginRound(match)}>
            Next round →
          </button>
        </div>
      </div>
    )
  }

  // handoff / guess / answer all show the per-turn chrome
  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <button className={styles.backArrow} onClick={onBack} aria-label="Back">←</button>
        <div className={styles.roundInfo}>
          Round {match.round + 1} · {TIER_LABEL[tier]}
        </div>
        <div className={styles.tierPills}>
          {match.active.map(id => (
            <span
              key={id}
              className={`${styles.pill} ${id === currentId ? styles.pillActive : ''}`}
            >
              {byName[id]}
            </span>
          ))}
        </div>
      </div>

      {phase === 'handoff' && (
        <div className={styles.handoff}>
          <div className={styles.handoffEyebrow}>Pass the device</div>
          <h2 className={styles.handoffName}>{byName[currentId]}</h2>
          <p className={styles.handoffHint}>
            {ROUND_SCHEDULE[tier] > 1
              ? `${TIER_LABEL[tier]} faces — ${ROUND_SCHEDULE[tier]} rounds here`
              : `${TIER_LABEL[tier]} faces`}
          </p>
          <button className={styles.primaryBtn} onClick={openGuess}>I'm ready →</button>
        </div>
      )}

      {phase === 'guess' && currentFace && (
        <div className={styles.playArea}>
          <div className={styles.photoCard}>
            <Headshot face={currentFace} />
          </div>
          {match.multipleChoice ? (
            <div className={styles.choices}>
              <div className={styles.guessLabel}>Nobody got the last few — pick the name:</div>
              <div className={styles.choicesGrid}>
                {choices.map(name => (
                  <button
                    key={name}
                    className={styles.choiceBtn}
                    onClick={() => submitAnswer(name === currentFace.name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <form className={styles.guessArea} onSubmit={handleSubmit}>
              <div className={styles.guessLabel}>Who is this?</div>
              <input
                ref={inputRef}
                className={styles.nameInput}
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                placeholder="Surname is enough"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              <button type="submit" className={styles.primaryBtn} disabled={!inputVal.trim()}>
                Submit
              </button>
              <button
                type="button"
                className={styles.passBtn}
                onClick={() => submitAnswer(false)}
              >
                No idea
              </button>
            </form>
          )}
        </div>
      )}

      {phase === 'answer' && currentFace && (
        <div className={styles.playArea}>
          <div className={styles.photoCard}>
            <Headshot face={currentFace} />
          </div>
          <div className={styles.feedbackArea}>
            <div className={`${styles.feedbackIcon} ${lastCorrect ? styles.feedbackOk : styles.feedbackMiss}`}>
              {lastCorrect ? '✓' : '✗'}
            </div>
            <div className={styles.feedbackHeading}>{currentFace.name}</div>
            <div className={styles.feedbackSub}>
              {lastCorrect ? `${byName[currentId]} got it` : `${byName[currentId]} missed`}
            </div>
            <button className={styles.primaryBtn} onClick={handleNextAnswer}>
              {turnIdx + 1 < match.active.length ? 'Next player →' : 'See round →'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
