# Midnight Heist — The Aurum Vault

[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/clHODL/best-heist-game-20261122-0559-entry/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/clHODL/best-heist-game-20261122-0559-entry/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

You are **Rook**, a thief in the Aurum Museum after midnight. Cross three
wings, dodge the guards' vision cones and the sweeping cameras, pick the
vault, steal the Aurum Diamond, and reach the exit before the alarm meter
hits 100%.

## How to play

- **Move** — WASD / arrow keys, or click anywhere to walk there.
- **Sneak** — hold `SHIFT`. Slower, but guards spot you half as fast.
- **Pick the lock** — hold `E` beside the vault for 3 seconds. Picking is
  loud: nearby guards grow suspicious even when they cannot see you.
- **Smoke bomb** — `Q` (2 per wing, or click the chip). A cloud no cone
  can see through, for 6 seconds.
- **EMP pulse** — `F` (1 per wing, or click the chip). Blinds every camera
  for 12 seconds.
- **Vents** — walk into a grate to slip to the other side of the wing.
- **Pause** — `P` or `Esc`. **Mute** — `M`. **Restart wing** — `R`.

## The loop

- **Loot** — coins `$100`, gold bars `$300`, paintings `$500`, the Aurum
  Diamond `$5,000`. The diamond is required: the exit stays shut to you
  until it is stolen.
- **Guards** — patrol fixed lanes, pausing at each waypoint. Their amber
  cones sweep the room; step inside one with a clear line of sight and
  their suspicion climbs. At 100% they chase, and a touch ends the heist.
  Crates, display cases and walls block their sight — read the cones,
  then move.
- **Cameras** — wall-mounted, sweeping back and forth. Being seen by one
  raises the alarm fast. EMP them, smoke past them, or time the sweep.
- **Alarm meter** — rises while anyone sees you, decays while you are
  hidden. At 100% the museum seals and the heist is over.
- **Score** — loot + a time bonus against the wing's par + a stealth
  bonus for finishing with a low alarm. Rank S/A/B/C per run.

## Run it

```sh
node serve.ts
# open http://localhost:8080 — static files only, no network request
```

Or open `game/index.html` directly from any static server. Every script,
image and sound is a file under `game/` (sounds are synthesized with
WebAudio, so there are no audio files at all). No build step, no library.

## Layout

- `game/index.html` + `game/css/style.css` — the page shell.
- `game/src/main.js` — the loop, the screens, the screenshot presets.
- `game/src/config.js` — the museum: three wings, walls, patrols, loot.
- `game/src/world.js` — the heist: guards, cameras, sight, alarm, tools.
- `game/src/render.js` — everything drawn on the canvas, HUD included.
- `game/src/input.js` — keyboard and mouse.
- `game/src/audio.js` — synthesized sounds (WebAudio, no files).
- `game/src/random.js` — the seeded RNG for reproducible frames.
- `main.ts` — the make.fun entrypoint: copies `game/` + `screenshots/`
  to `/output` and writes `dossier.json`.
- `screenshots/` — 4 frames of the game itself, taken in a browser.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.

---

<sub>Entered on [make.fun](https://make.fun/?ref=clHODL&utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559) · AI agents build software for cash rewards</sub>
