import { useMemo, useRef, useEffect } from 'react'
import { seasonAxis, playerSeasons } from '../utils/teammateChain.js'
import styles from './ChainTimeline.module.css'

/**
 * Career timeline for a teammate chain: one row per link, one square per season
 * the player spent in the league. The team-season(s) that justified the link to
 * the previous player are lit up, so the chain reads as a staircase of overlaps.
 *
 * chain: [{ id, name, linkSeasons: string[] }] — oldest link first
 */
export default function ChainTimeline({ chain, careers }) {
  const scrollRef = useRef(null)
  const focusRef = useRef(null)

  const axis = useMemo(() => (careers ? seasonAxis(careers) : []), [careers])

  const rows = useMemo(() => (chain || []).map(link => {
    const seasons = playerSeasons(link.id, careers || {})
    const played = axis.map(a => seasons.has(a.season))
    return {
      id: link.id,
      name: link.name,
      played,
      links: new Set(link.linkSeasons || []),
      count: played.filter(Boolean).length,
      first: played.indexOf(true),
    }
  }), [chain, careers, axis])

  // Bring the newest row into view — centred on where that career starts.
  useEffect(() => {
    const sc = scrollRef.current
    if (!sc) return
    const cell = focusRef.current
    if (cell) {
      sc.scrollTo({ left: Math.max(0, cell.offsetLeft - sc.clientWidth / 2), behavior: 'smooth' })
    }
    sc.scrollTop = sc.scrollHeight
  }, [rows.length])

  if (!careers || !axis.length || !rows.length) return null

  const lastIdx = rows.length - 1

  return (
    <section className={styles.wrap}>
      <div className={styles.head}>
        <span className={styles.title}>Career Timeline</span>
        <span className={styles.legend}>
          <span className={styles.legendItem}><i className={styles.swatchPlayed} />in the league</span>
          <span className={styles.legendItem}><i className={styles.swatchLink} />the link</span>
        </span>
      </div>

      <div className={styles.scroll} ref={scrollRef}>
        <div className={styles.grid} style={{ '--cols': String(axis.length) }}>
          <div className={styles.axis}>
            <div className={styles.corner} />
            {axis.map(a => (
              <div key={a.season} className={`${styles.tick} ${a.year % 5 === 0 ? styles.tickMajor : ''}`}>
                {a.label}
              </div>
            ))}
          </div>

          {rows.map((row, r) => (
            <Row
              key={`${row.id}-${r}`}
              row={row}
              axis={axis}
              index={r}
              isLast={r === lastIdx}
              focusRef={r === lastIdx ? focusRef : null}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function Row({ row, axis, index, isLast, focusRef }) {
  return (
    <>
      <div className={`${styles.name} ${isLast ? styles.nameLast : ''}`} title={row.name}>
        <span className={styles.nameNum}>{index + 1}</span>
        <span className={styles.nameText}>{row.name}</span>
        <span className={styles.nameCount}>{row.count}</span>
      </div>
      {axis.map((a, i) => {
        const played = row.played[i]
        const isLink = played && row.links.has(a.season)
        const cls = [
          styles.cell,
          a.year % 5 === 0 ? styles.cellGuide : '',
          played ? styles.played : styles.empty,
          isLink ? styles.link : '',
          isLast && played ? styles.playedLast : '',
        ].filter(Boolean).join(' ')
        return (
          <div
            key={a.season}
            className={cls}
            ref={focusRef && i === row.first ? focusRef : null}
            style={isLast && played ? { animationDelay: `${Math.min(i - row.first, 24) * 22}ms` } : undefined}
            title={played ? `${row.name} — ${a.season}${isLink ? ' · link' : ''}` : undefined}
          />
        )
      })}
    </>
  )
}
