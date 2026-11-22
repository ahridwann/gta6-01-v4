# Lumina City: Night Courier

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/ahridwann/gta6-01-v4/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/ahridwann/gta6-01-v4/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world night-driving crime game for the **Make GTA 6** bounty on [make.fun](https://make.fun/bounty/gta6-01). Built with Three.js (vendored, no network), seeded world generation, procedural WebAudio, and a full story campaign — all offline, all in your browser.

## The game

You are **Juno "Jinx" Reyes**, getaway driver for fixer **Mara Voss**, working one neon night in **Lumina City** — a low-poly city of five districts: Downtown, the Harbor, the Suburbs, the Beach Strip, and the North End.

- **Open world, on foot and by car** — WASD + mouse, steal any parked car with E, AI traffic on the road grid, pedestrians who flee danger.
- **5 story missions** — First Drop ($250), Heat Wave: survive 60 s at 3 stars ($400), The Armored Haul heist ($650), Midnight Grand Prix race ($850), The Escort ($1,200). Briefing, beacon, reward, rank progression from Street Rookie to Night Kingpin.
- **Side work** — taxi fares ($60–130) and 12 neon chips ($50 each) hidden around the city.
- **Wanted 0–5 stars** — police cruisers chase and ram, a helicopter with a searchlight joins at 4–5 stars, and a cop who stays close on foot arrests you: **BUSTED**.
- **Combat** — punch (F) and pistol (G, 24 rounds).
- **Feel & polish** — HUD with cash, rank, stars, health, speed and a live canvas minimap; skid marks, particles, engine / siren / gunshot / synthwave bassline WebAudio; start, pause, briefing and game-over menus; progress saved in `localStorage` (`lumina-city-save-v1`).
- **Deterministic screenshots** — `?shot=cover|street|chase|mission` stages a fixed scene from a fixed seed, with an autopilot, so every render is reproducible.

No Rockstar names or assets anywhere. No network requests — everything is local.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

Or serve `game/` with any static server and open `game/index.html`.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot / drive |
| Mouse | Look |
| Shift | Run |
| E | Enter / steal nearest car, exit car |
| M | Next mission (briefing) |
| T | Taxi fare (in car, near a waiting passenger) |
| F | Punch |
| G | Pistol |
| Space | Handbrake |
| Esc | Pause |

## Layout

- `game/` — the playable game (Three.js vendored under `game/vendor/three/`)
- `game/src/` — one-job modules: world gen, vehicles, police, helicopter, pedestrians, missions, combat, audio, HUD, saves, screenshots
- `screenshots/` — 4 deterministic renders (cover, street, chase, mission)
- `main.ts` — builds `/output` (copies `game/` + `screenshots/`, writes `dossier.json`)
- `serve.ts` — tiny local static server

## Referral

Play code: `kc98nxwf`
