import { useState, useMemo } from 'react'
import { getLogoUrl } from '../data/teams.js'
import { searchPlayers, MIN_QUERY } from '../utils/whoDidTheyHave.js'
// Play-screen chrome (top bar with lives, outcome banner, player picker) is the
// same sheet as Teammate Chain; only the team card + answer list are local.
import styles from './TeammateChainGameScreen.module.css'
import local from './WhoDidTheyHaveRoundScreen.module.css'

export default function WhoDidTheyHaveRoundScreen({
  team,             // { id, name, slug }
  season,
  record,           // { w, l } — team's win/loss for that season
  round,            // 1-based round number
  totalRounds,
  allPlayers,       // [{ id, name }] — every player in careers.json (search pool)
  roster,           // [{ id, name }] — the drawn team-season's roster
  players,          // [{ id, name }] — human players, in turn order
  lives,            // { [playerId]: livesLeft } for this round
  maxLives,
  currentPlayerId,
  answers,          // [{ id, name, guesserName, correct }] — this round, newest last
  wins,             // { [playerId]: rounds won }
  lastOutcome,
  onSubmit,         // ({ guessPlayer }) => void
  onBack,
}) {
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState(null)
  const filtered = useMemo(() => searchPlayers(allPlayers, query), [allPlayers, query])

  const alreadyNamed = picked && answers.some(a => String(a.id) === String(picked.id))
  const currentPlayerName = players.find(p => p.id === currentPlayerId)?.name || ''

  function handleValidate() {
    if (!picked || alreadyNamed) return
    onSubmit({ guessPlayer: picked })
    setQuery('')
    setPicked(null)
  }

  return (
    <div className={styles.screen}>
      <div className={styles.topBar}>
        {onBack && <button className={styles.backArrow} onClick={onBack}>←</button>}
        <div className={styles.players}>
          {players.map(p => {
            const left = lives?.[p.id] ?? 0
            const out = left === 0
            return (
              <div key={p.id} className={`${styles.playerChip} ${p.id === currentPlayerId ? styles.playerActive : ''} ${out ? styles.playerOut : ''}`}>
                <span className={styles.playerName}>{p.name} · {wins?.[p.id] || 0}W</span>
                <span className={styles.playerLives}>
                  {Array.from({ length: maxLives }, (_, i) => (
                    <span key={i} className={i < left ? styles.lifeFull : styles.lifeLost}>♥</span>
                  ))}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div className={styles.content}>
        {lastOutcome && (
          <div className={`${styles.outcome} ${lastOutcome.correct ? styles.outcomeCorrect : styles.outcomeWrong}`}>
            {lastOutcome.correct ? (
              <>✓ {lastOutcome.name} played for the {lastOutcome.teamName} in {lastOutcome.season}</>
            ) : (
              <>✗ {lastOutcome.name} never played for the {lastOutcome.teamName} in {lastOutcome.season} — {lastOutcome.livesLeft === 0 ? `${lastOutcome.guesserName} is out` : `${lastOutcome.guesserName} has ${lastOutcome.livesLeft} ${lastOutcome.livesLeft === 1 ? 'life' : 'lives'} left`}</>
            )}
          </div>
        )}

        <div className={styles.eyebrow}>Round {round} / {totalRounds} · {currentPlayerName}&apos;s turn</div>

        <div className={styles.chainCard}>
          <img
            className={local.logo}
            src={getLogoUrl(team.slug)}
            alt={team.name}
            onError={e => { e.target.style.opacity = '0.3' }}
          />
          <div className={styles.chainLabel}>Name a player from</div>
          <h2 className={styles.chainName}>{team.name}</h2>
          <div className={local.seasonRow}>
            <span className={local.season}>{season}</span>
            <span className={local.record}>{record ? `${record.w}–${record.l}` : '—'}</span>
          </div>
        </div>

        <div className={styles.pickerPanel}>
          <div className={`${styles.slot} ${picked ? styles.slotFilled : styles.slotEmpty}`}>
            {picked
              ? <><span className={styles.slotName}>{picked.name}</span><button className={styles.slotClear} onClick={() => { setPicked(null); setQuery('') }}>✕</button></>
              : <span className={styles.slotPlaceholder}>Search and select a player</span>
            }
          </div>

          <input
            className={styles.searchInput}
            autoFocus
            placeholder={`Search player… (${MIN_QUERY} letters)`}
            value={query}
            onChange={e => { setQuery(e.target.value); setPicked(null) }}
            onKeyDown={e => {
              // Enter takes the top match, so a full name can be played without the mouse.
              if (e.key !== 'Enter' || !filtered.length || picked) return
              setPicked(filtered[0])
              setQuery('')
            }}
          />

          {filtered.length > 0 && !picked && (
            <div className={styles.searchList}>
              {filtered.map(p => (
                <button key={p.id} className={styles.searchItem} onClick={() => { setPicked(p); setQuery('') }}>
                  {p.name}
                </button>
              ))}
            </div>
          )}
          {query.trim().length >= MIN_QUERY && filtered.length === 0 && (
            <p className={styles.hint}>No players match &quot;{query}&quot;</p>
          )}

          {alreadyNamed && <p className={styles.hint}>{picked.name} has already been named this round.</p>}

          {picked && (
            <button className={styles.validateBtn} onClick={handleValidate} disabled={alreadyNamed}>
              Submit →
            </button>
          )}
        </div>

        {answers.length > 0 && (
          <div className={local.answers}>
            <div className={local.answersLabel}>Named this round · {answers.filter(a => a.correct).length}/{roster.length} on the roster</div>
            {answers.map((a, i) => (
              <div key={i} className={`${local.answerRow} ${a.correct ? local.answerCorrect : local.answerWrong}`}>
                <span className={local.answerIcon}>{a.correct ? '✓' : '✗'}</span>
                <span className={local.answerName}>{a.name}</span>
                <span className={local.answerGuesser}>{a.guesserName}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
