# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install       # Install dependencies
npm run dev       # Start Vite dev server with hot reload
npm run build     # Production build → dist/
npm run preview   # Preview production build locally
```

There are no test or lint commands configured.

## Architecture

NBA Roster Picker is a multiplayer web app with three mini-games: a fantasy **Roster Picker** (the main game), a **Jersey Number Guesser**, and a **Who Has More** stat comparison game.

### Frontend

A single-page React app driven by one central state machine in [`src/App.jsx`](src/App.jsx). All game state (current screen, players, picks, config, turn order) lives in `App.jsx` via `useState`. There is no external state library. Navigation is controlled by a `screen` state string that renders one of 13 screen components.

Screens live in `src/screens/`, each paired with a `.module.css` file (CSS Modules, no component library). Global styles and CSS custom properties (navy/gold theme, Barlow fonts) are in [`src/index.css`](src/index.css).

Custom hooks abstract the two data concerns:
- [`src/hooks/useRoster.js`](src/hooks/useRoster.js) — loads and caches `rosters.json` + `standings.json` from `/public/`
- [`src/hooks/useProfiles.js`](src/hooks/useProfiles.js) — fetches/saves player profiles and game records via `/api/*`

[`src/data/teams.js`](src/data/teams.js) is the authoritative source for all 30 NBA teams, roster slot labels (PG, SG, SF, PF, C, bench), and logo URLs.

Player selection is weighted by `minutesPlayed × gamesPlayed` via [`src/utils/playerSelection.js`](src/utils/playerSelection.js) so realistic players are drafted more often.

### Backend

Vercel serverless functions in `/api/`. Each file is an independent Node.js handler:

| File | Purpose |
|---|---|
| `api/players.js` | CRUD for player profiles (stored as Redis hash) |
| `api/games.js` | Roster Picker game records + per-player stats |
| `api/jersey-games.js` | Jersey Guesser game records |
| `api/who-has-more-games.js` | Who Has More game records |
| `api/sync-rosters.js` | Weekly cron — fetches current season rosters from NBA.com Stats API |

Persistence is **Upstash Redis** via the KV REST API (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` env vars required). Without these, all API calls fail silently.

### Static Data

`/public/rosters.json` (~2.8 MB) contains player rosters for seasons 2005–2026, keyed as `season → team → players[]`. `/public/standings.json` contains win/loss records by season. These are fetched at runtime by the frontend and cached in the `useRoster` hook. The cron job (`vercel.json` — Mondays 4am UTC) updates the current season slice in Redis, but the static file covers historical seasons.

Team logo SVGs live in `/public/media/` named by team abbreviation (e.g. `LAL.svg`). Missing logos degrade gracefully.

### Roster Picker Game Flow

1. **Setup** — enter 1–4 player names, choose roster size (6–12), select seasons, pick game mode (Players or Teams)
2. **Order Draw** — animated random draw determines pick order
3. **Turn** — current drafter's name + all current rosters displayed
4. **Team Draw** — animated wheel draws a random team (and season in Players mode); drawn combos are eliminated
5. **Pick Player** — drafter assigns players from that team's roster to their open slots
6. **Final** — all rosters displayed; optional stat modes (points, rebounds, assists, wins) with reveal screen

### Deployment

Vercel auto-detects Vite. Push to GitHub, import in vercel.com, set the two Upstash env vars, deploy. `vercel.json` configures the build, output dir, and cron schedule.

Optional: set `BALLDONTLIE_API_KEY` for faster roster sync (unauthenticated requests are rate-limited).
