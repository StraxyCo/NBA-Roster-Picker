# 🏀 Roster Picker

A multiplayer NBA fantasy draft game for 1–4 players. Draw teams, pick players, build your 6-man (or more) roster.

## Setup

```bash
npm install
npm run dev
```

## Deploy to Vercel

1. Push this repo to GitHub
2. Import the repo in [vercel.com](https://vercel.com)
3. Vercel auto-detects Vite — just click Deploy

## Adding team logos

Place SVG logo files in `/public/media/` with this naming convention:

```
atlanta-hawks.svg
boston-celtics.svg
brooklyn-nets.svg
charlotte-hornets.svg
chicago-bulls.svg
cleveland-cavaliers.svg
dallas-mavericks.svg
denver-nuggets.svg
detroit-pistons.svg
golden-state-warriors.svg
houston-rockets.svg
indiana-pacers.svg
los-angeles-clippers.svg
los-angeles-lakers.svg
memphis-grizzlies.svg
miami-heat.svg
milwaukee-bucks.svg
minnesota-timberwolves.svg
new-orleans-pelicans.svg
new-york-knicks.svg
oklahoma-city-thunder.svg
orlando-magic.svg
philadelphia-76ers.svg
phoenix-suns.svg
portland-trail-blazers.svg
sacramento-kings.svg
san-antonio-spurs.svg
toronto-raptors.svg
utah-jazz.svg
washington-wizards.svg
```

> The app references logos from `/media/` at runtime. If a logo file is missing,
> the image gracefully fades out — the game still works.

## BallDontLie API key

The free tier (5 req/min) is sufficient for most games.  
For faster roster loading, get a free key at [balldontlie.io](https://www.balldontlie.io) and enter it on the setup screen.

## Game flow

| Screen | Description |
|--------|-------------|
| **Setup** | Enter 1–4 player names, set roster size (5–12), toggle team elimination |
| **Order Draw** | Animated draw to decide pick order |
| **Turn** | Shows whose pick it is + all current rosters |
| **Team Draw** | Animated logo reel draws a random NBA team |
| **Pick Player** | View team roster, drag-and-drop or click to assign players to slots |
| **Final** | All rosters shown side-by-side, declare a winner |

## Roster slots

Slots 1–5 are labelled **PG / SG / SF / PF / C**.  
Slots 6–12 are numbered (bench spots).

Players can be freely reassigned between slots before validating.
