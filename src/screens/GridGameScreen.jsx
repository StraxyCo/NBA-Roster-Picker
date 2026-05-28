import { useState, useMemo } from 'react'
import { filterPlayers, validateCell } from '../utils/gridCategories.js'
import styles from './GridGameScreen.module.css'

// ── Cell search overlay ───────────────────────────────────────────────────────
function CellSearch({ rowCat, colCat, allPlayers, careers, onSubmit, onClose }) {
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState(null)
  const [result, setResult] = useState(null) // null | 'correct' | 'wrong'

  const filtered = useMemo(() => filterPlayers(allPlayers, query), [allPlayers, query])

  function handleValidate() {
    if (!picked) return
    const ok = validateCell(picked.id, rowCat, colCat, careers)
    setResult(ok ? 'correct' : 'wrong')
    setTimeout(() => {
      onSubmit({ player: picked, correct: ok })
    }, 800)
  }

  return (
    <div className={styles.searchOverlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.searchModal}>
        <div className={styles.searchCategories}>
          <span className={styles.catPill}>{rowCat.label}</span>
          <span className={styles.catAnd}>×</span>
          <span className={styles.catPill}>{colCat.label}</span>
        </div>

        {result ? (
          <div className={`${styles.resultFlash} ${result === 'correct' ? styles.flashCorrect : styles.flashWrong}`}>
            {result === 'correct' ? '✓ Correct!' : '✗ Wrong'}
          </div>
        ) : (
          <>
            <div className={`${styles.searchSlot} ${picked ? styles.searchSlotFilled : ''}`}>
              {picked
                ? <><span className={styles.searchSlotName}>{picked.name}</span><button className={styles.searchSlotClear} onClick={() => { setPicked(null); setQuery('') }}>✕</button></>
                : <span className={styles.searchSlotEmpty}>Search for a player…</span>
              }
            </div>
            <input
              className={styles.searchInput}
              autoFocus
              placeholder="Type a name…"
              value={query}
              onChange={e => { setQuery(e.target.value); setPicked(null) }}
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
            {query.trim().length >= 2 && filtered.length === 0 && (
              <p className={styles.searchEmpty}>No matches for "{query}"</p>
            )}
            <div className={styles.searchActions}>
              <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
              <button className={styles.validateBtn} onClick={handleValidate} disabled={!picked}>
                Submit →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Main game screen ──────────────────────────────────────────────────────────
export default function GridGameScreen({
  rowCats, colCats, allPlayers, careers,
  currentPlayer, scores, turnOrder,
  cells,              // cells[r][c] = null | { playerName, pickedBy, correct }
  turnCount, maxTurns,
  onCellSubmit,       // (r, c, { player, correct }) => void
  onBack,
}) {
  const [selected, setSelected] = useState(null) // { row, col } | null

  const rows = rowCats.length
  const cols = colCats.length

  function handleCellClick(r, c) {
    if (cells[r][c]?.correct) return // already correctly claimed
    setSelected({ row: r, col: c })
  }

  function handleSubmit(result) {
    if (!selected) return
    onCellSubmit(selected.row, selected.col, result)
    setSelected(null)
  }

  return (
    <div className={styles.screen}>
      {/* Top bar */}
      <div className={styles.topBar}>
        {onBack && <button className={styles.backArrow} onClick={onBack}>←</button>}
        <div className={styles.scorePills}>
          {turnOrder.map(name => (
            <span key={name} className={`${styles.scorePill} ${name === currentPlayer ? styles.scorePillActive : ''}`}>
              {name} · {scores[name] || 0}
            </span>
          ))}
        </div>
        <div className={styles.turnBadge}>{currentPlayer}'s turn</div>
      </div>

      {/* Grid */}
      <div className={styles.gridWrap}>
        <div
          className={styles.grid}
          style={{ gridTemplateColumns: `80px repeat(${cols}, 1fr)` }}
        >
          {/* Top-left corner */}
          <div className={styles.cornerCell} />

          {/* Column headers */}
          {colCats.map((cat, c) => (
            <div key={c} className={styles.colHeader}>{cat.label}</div>
          ))}

          {/* Rows */}
          {rowCats.map((rowCat, r) => (
            <>
              <div key={`rh-${r}`} className={styles.rowHeader}>{rowCat.label}</div>
              {colCats.map((colCat, c) => {
                const cell = cells[r][c]
                return (
                  <button
                    key={`${r}-${c}`}
                    className={`${styles.cell}
                      ${cell?.correct ? styles.cellCorrect : ''}
                      ${cell && !cell.correct ? styles.cellWrong : ''}
                      ${!cell ? styles.cellEmpty : ''}
                    `}
                    onClick={() => handleCellClick(r, c)}
                    disabled={!!cell?.correct}
                  >
                    {cell ? (
                      <span className={styles.cellName}>{cell.playerName}</span>
                    ) : (
                      <span className={styles.cellPlus}>+</span>
                    )}
                    {cell && <span className={styles.cellOwner}>{cell.pickedBy}</span>}
                  </button>
                )
              })}
            </>
          ))}
        </div>
      </div>

      <div className={styles.footer}>
        <span className={styles.footerTurns}>{Math.max(0, maxTurns - turnCount)} turns remaining</span>
      </div>

      {selected && (
        <CellSearch
          rowCat={rowCats[selected.row]}
          colCat={colCats[selected.col]}
          allPlayers={allPlayers}
          careers={careers}
          onSubmit={handleSubmit}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
