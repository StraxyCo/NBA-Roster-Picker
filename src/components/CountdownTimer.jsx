import { useState, useEffect, useRef } from 'react'
import styles from './CountdownTimer.module.css'

// Shared informative countdown (Option A): a thin sticky bar that depletes, gold →
// red in the last `warnAt` seconds, with a "0:45" label. Used by Who's That Guy and
// Playerdle. `resetKey` restarts the timer; `running` pauses it; `onExpire` fires once
// at zero (optional — the timer is purely informative by default). `flashOnExpire`
// flashes the screen red once at zero (cosmetic).
export default function CountdownTimer({ seconds = 45, running = true, resetKey, warnAt = 10, showLabel = true, onExpire, flashOnExpire = false }) {
  const [left, setLeft] = useState(seconds)
  const [flash, setFlash] = useState(false)
  const expired = useRef(false)

  useEffect(() => { setLeft(seconds); setFlash(false); expired.current = false }, [resetKey, seconds])

  useEffect(() => {
    if (flashOnExpire && running && left === 0) setFlash(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left])

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      setLeft(t => {
        const next = Math.max(0, t - 0.25)
        if (next === 0 && !expired.current) { expired.current = true; onExpire && onExpire() }
        return next
      })
    }, 250)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, resetKey])

  const frac = seconds > 0 ? Math.max(0, Math.min(1, left / seconds)) : 0
  const secs = Math.ceil(left)
  const warn = secs <= warnAt
  const fmt = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`

  return (
    <div className={styles.wrap}>
      {flash && <div className={styles.flash} aria-hidden="true" onAnimationEnd={() => setFlash(false)} />}
      <div className={styles.track}>
        <div className={`${styles.fill} ${warn ? styles.warn : ''}`} style={{ width: `${frac * 100}%` }} />
      </div>
      {showLabel && (
        <div className={styles.labelRow}>
          <span className={`${styles.label} ${warn ? styles.labelWarn : ''}`}>{fmt}</span>
        </div>
      )}
    </div>
  )
}
