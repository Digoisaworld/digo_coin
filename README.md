# DIGO EVOLUTION

A portrait-first 3D arcade survival game. DIGO runs along the ground while coins, crystals,
treasure and legendary rewards fall from above — mixed with bombs, meteors, electric traps,
spikes and hostile creatures. Move left and right, collect value, survive the pressure,
and evolve.

Built with **React 19 + TypeScript + Three.js** for the game, **Express 5** for the API, and
**Vite 8** for the build. No clicker mechanics: you never tap individual coins. You hold a
control surface and slide.

---

## 1. Play

```bash
npm install
npm run dev          # http://localhost:5173
```

Production:

```bash
npm run build        # tsc --noEmit && vite build  -> dist/
npm start            # Express serves dist/ + API on 0.0.0.0:$PORT (default 3000)
```

### Controls

| Input | Action |
| --- | --- |
| Hold + slide anywhere in the bottom control area | DIGO follows your finger horizontally (pointer capture, multitouch-safe) |
| ◀ / ▶ buttons (optional, Settings → Controls) | Hold to move left / right |
| Pause button (HUD) | Pause / resume |
| `Esc` / `P` | Pause |

The control surface uses Pointer Events with `setPointerCapture`, `touch-action: none`,
non-passive listeners, and releases on `pointerup`, `pointercancel`, `pointerleave` and
`lostpointercapture`, so movement never sticks or gets cancelled by scrolling.

---

## 2. Game systems

**Objects.** Every spawn is procedurally modelled geometry with its own material, animation
and silhouette, so rewards and dangers are never confusable:

- Rewards — gold DIGO coin, diamond, energy crystal, treasure chest, legendary orb.
- Dangers — bomb (fuse + red warning glow), meteor (flame + smoke), electric hazard (arcs),
  spike obstacle, enemy creature.

Rewards glow, rotate and emit particle trails; dangers are dark, spiked or burning with red
warning pulses and pre-impact warning sounds.

**Gameplay.** Objects spawn above the view, fall at varying speeds and trajectories, and are
recycled through object pools. Collisions are circle-based with a per-object hit tracker, so a
single object can only damage you once, and each hit grants brief invulnerability. Rewards add
points exactly once.

**Progression.** Falling speed, spawn rate and simultaneous object count rise with level;
combo multipliers build on clean collection streaks and decay when you take damage. Waves,
survival milestones, boss encounters and rare reward events vary each run.

**Power-ups.** Shield, magnet, slow motion, double reward, speed boost and invincibility — each
with distinct geometry, colour and an activation burst.

**Modes.** Endless survival, time challenge, mission mode, boss survival, daily challenge
(seeded, so everyone gets the same run each day).

**Evolution.** Five DIGO stages unlocked by XP, each changing proportions, aura, accessories and
abilities. Persisted locally with the rest of the profile.

**Worlds.** Tropical Island, Cyberpunk Neon City, Ancient Treasure Temple, Space Galaxy,
Lava World, Crystal Kingdom, Frozen Mountain — each with its own palette, lighting, fog,
backdrop geometry, music and reward tint. Unlocked by best score.

**Meta.** Missions, achievements, leaderboard, profile, settings (music/SFX volume, control
scheme, quality, haptics) and per-mode best scores, all stored in `localStorage`.

---

## 3. Architecture

```
server/index.js                 Express: static dist/, wallet auth, scores, rewards
src/main.tsx                    bootstrap
src/App.tsx                     routing, wallet session, verified score submission
src/api/client.ts               typed HTTP client (config, nonce, verify, leaderboard, scores)
src/wallet/phantom.ts           Phantom provider detection, connect, signMessage
src/state/useProfile.ts         profile hook: run rewards, settings, mission claims
src/state/profileOps.ts         pure profile transitions (XP, unlocks, missions, achievements)
src/game/core/                  pure logic: types, rng, difficulty, collision, worlds,
                                modes, missions, evolution, profile
src/game/engine/Game.ts         game loop, spawning, physics, collision, power-ups, boss, modes
src/game/input/InputController.ts   pointer-capture drag + button axis
src/game/three/                 character, environment, objects, particles, textures
src/game/audio/AudioManager.ts  WebAudio SFX + per-world procedural music
src/ui/                         MainMenu, GameScreen, screens, components, CharacterPreview
src/ui/styles.css               portrait mobile-first design system
```

The renderer, input, spawning, collision, scoring, health, power-ups, audio and state layers
are separate modules; `src/game/core/*` is pure and unit-tested.

### The DIGO character

DIGO is modelled procedurally in `src/game/three/character.ts` — real geometry, not a flat
sprite: body, head, expressive eyes, limbs and stage accessories, with a skeletal-style
animation driver for idle, run, left, right, dodge, collect, damage, jump, victory and defeat.

Palette, proportions and eye shapes are constants at the top of that file. **No reference image
was present in the project**, so the current design is the default DIGO. When you supply the
image, adjust those constants (or swap in a GLTF via `GLTFLoader`) to match it exactly — the
animation rig and the rest of the game keep working unchanged.

---

## 4. Solana / Phantom preparation

- Phantom connect + `signMessage` only. No seed phrase, no private key, never requested.
- The server issues a nonce, the wallet signs it, and the server returns a signed session token
  (`POST /api/auth/nonce` → `/api/auth/verify`).
- Scores are submitted with that session and re-validated server-side (plausibility limits,
  per-run uniqueness, rate limiting). Only verified runs are listed on the leaderboard.
- `POST /api/rewards/claim` returns a **receipt** for a verified run. It deliberately does not
  mint or transfer tokens: no fake deposits, no fake withdrawals, no invented transactions.
- Game points (`coins`) are separate from any on-chain token. The game is fully playable with
  no wallet at all — linking only enables verified leaderboard entries.

Real token settlement would need a mint, an authority key held outside this repo, and explicit
user approval per transaction. That is intentionally out of scope here and is documented
rather than faked.

---

## 5. Environment

Copy `.env.example` to `.env`. Everything is optional:

| Variable | Purpose |
| --- | --- |
| `PORT` | Server port (AppJet injects this) |
| `AUTH_SECRET` | HMAC key for session tokens; generated per boot when unset |
| `DATA_FILE` | JSON store for scores/leaderboard (default `./data/db.json`) |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowlist (defaults to same-origin) |

---

## 6. Tests

```bash
npm run typecheck    # tsc --noEmit
npm test             # vitest run — pure logic suite
npm run build        # typecheck + production bundle
```

`src/game/core/core.test.ts` covers collision overlap + single-hit tracking, difficulty curves,
combo multipliers and decay, reward scoring, survival scoring, evolution thresholds and the
seeded RNG determinism used by the daily challenge.

---

## 7. Deployment

A `Dockerfile` is included: Node 24 Alpine, `npm ci`, `npm run build`, non-root user, static
`dist/` served by Express on `0.0.0.0:$PORT`.

```bash
docker build -t digo-evolution .
docker run -p 3000:3000 -e AUTH_SECRET=... digo-evolution
```

For AppJet hosting the build and deployment are handled by the platform; for large production
traffic, deploy this repository to https://qoddi.com on branch `appjet`.

---

## 8. Notes and honest limitations

- All 3D content (character, objects, environments, particles) and all audio are generated
  procedurally in code — there are no binary asset files to lose, and the project stays
  portable. Quality tiers adjust pixel ratio, shadows and particle counts for weaker phones.
- Leaderboard persistence uses a JSON file, suitable for a single app instance. A multi-instance
  deployment needs a shared database.
- Automated coverage targets the pure logic and the production build; the 3D scene is verified
  in a real browser session, not by unit tests.
