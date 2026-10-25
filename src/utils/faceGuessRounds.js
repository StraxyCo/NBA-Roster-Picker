import { TIERS } from './playerRecognizability'

// Round progression for the face-guessing game.
//
// Rounds walk the recognizability tiers from easiest to hardest, spending one round
// on the first and one more on each tier after it. The ramp is deliberate: a round
// only decides anything when the players disagree, and at the top nobody disagrees —
// two decent fans split on a top-tier face a few percent of the time. The middle
// tiers split them closer to half the time, so that is where the rounds are spent.
export const ROUND_SCHEDULE = {
  icon: 1,
  star: 2,
  starter: 3,
  rotation: 4,
  fringe: 5,
  deepBench: 6, // terminal: there is nowhere to advance to, so this is a floor only
}

const TIER_ORDER = TIERS.map(t => t.key)

// Consecutive rounds everyone can miss before the tier is forced to multiple choice.
// Staying put is right — dropping to a harder tier when both players are already
// stumped makes agreement *more* likely, not less — but it has to end somewhere.
export const STALL_LIMIT = 3

// `startTier` skips part of the warm-up for a group that finds it trivial. Starting
// below `icon` shortens the match, since the easy tiers are what keep a weak guesser
// alive early.
export function createMatch(playerIds, { startTier } = {}) {
  const startIndex = startTier ? Math.max(0, TIER_ORDER.indexOf(startTier)) : 0
  return {
    tierIndex: startIndex,
    roundsInTier: 0,
    missedInARow: 0,
    multipleChoice: false,
    round: 0,
    active: [...playerIds],
    usedPlayerIds: new Set(),
    winner: null,
  }
}

export function currentTier(match) {
  return TIER_ORDER[Math.min(match.tierIndex, TIER_ORDER.length - 1)]
}

/** True once the match is settled, by a winner or by a solo run ending. */
export function isMatchOver(match) {
  return match.winner !== null && match.winner !== undefined ? true : match.active.length === 0
}

/** One unused face from the current tier, falling back to harder ones if it is dry. */
function drawOne(match, byTier, taken) {
  const order = [currentTier(match), ...TIER_ORDER.slice(match.tierIndex + 1)]
  for (const tier of order) {
    const fresh = (byTier[tier] ?? []).filter(p => !match.usedPlayerIds.has(p.id) && !taken.has(p.id))
    if (fresh.length) return fresh[Math.floor(Math.random() * fresh.length)]
  }
  return null
}

// A round deals each player their OWN face, all from the same tier.
//
// Not one shared face: play passes round the same device, so the second player would
// answer having just heard the first one's guess. Separate faces of equal standing
// keep the comparison fair — a round still asks everyone the same question ("can you
// name a face this famous?"), just not the same photo.
export function drawRound(match, byTier, playerIds = match.active) {
  const taken = new Set()
  const faces = {}
  for (const id of playerIds) {
    const face = drawOne(match, byTier, taken)
    if (!face) return null // pool exhausted; caller should end the match
    taken.add(face.id)
    faces[id] = face
  }
  return faces
}

/** Mark a round's faces used, so nobody sees them again this match. */
export function markFacesUsed(match, faces) {
  const usedPlayerIds = new Set(match.usedPlayerIds)
  for (const face of Object.values(faces)) usedPlayerIds.add(face.id)
  return { ...match, usedPlayerIds }
}

// Applies one round's results: `correctByPlayer` maps player id -> boolean.
//
// Missing your face in a round where somebody else named theirs is elimination,
// immediately — there are no second chances. Everyone is answering a different photo
// of the same standing, so what the round compares is the tier, not the picture.
//
// A round everyone gets right means the tier is too easy and, once its
// minimum is served, the game moves down. A round everyone misses settles nothing, so
// the tier repeats rather than descending further.
export function resolveRound(match, correctByPlayer) {
  const next = { ...match, usedPlayerIds: new Set(match.usedPlayerIds) }
  next.round += 1
  next.roundsInTier += 1

  const answers = next.active.map(id => ({ id, correct: !!correctByPlayer[id] }))
  const right = answers.filter(a => a.correct)
  const wrong = answers.filter(a => !a.correct)
  const split = right.length > 0 && wrong.length > 0

  let eliminated = []
  if (split) {
    eliminated = wrong.map(a => a.id)
    next.active = right.map(a => a.id)
    next.missedInARow = 0
    // `multipleChoice` deliberately survives a split: it describes a tier that is too
    // hard, not a single round. Clearing it would drop the deepest tier back to
    // free-text, where both players miss ~90% of faces, and start the stall over.
  } else if (wrong.length === answers.length) {
    // Solo play has no one to diverge from, so a miss simply ends the run.
    if (next.active.length === 1) {
      eliminated = next.active
      next.active = []
    } else {
      next.missedInARow += 1
      if (next.missedInARow >= STALL_LIMIT) next.multipleChoice = true
    }
  } else {
    next.missedInARow = 0
  }

  if (next.active.length === 1 && match.active.length > 1) next.winner = next.active[0]
  // `winner` holds a player id, and a valid id can be 0 or an empty string, so it is
  // never safe to test for truthiness. Use `isMatchOver` instead of `if (!winner)`.

  const everyoneRight = wrong.length === 0
  const servedMinimum = next.roundsInTier >= ROUND_SCHEDULE[currentTier(next)]
  if (!isMatchOver(next) && everyoneRight && servedMinimum) {
    next.tierIndex = Math.min(next.tierIndex + 1, TIER_ORDER.length - 1)
    next.roundsInTier = 0
    next.multipleChoice = false
  }

  return { match: next, eliminated, split, advanced: next.tierIndex !== match.tierIndex }
}
