# Session Summary — Vaeldrift Development Handoff

Context handoff for the next working session on this repo. Read this before
continuing development.

## What this project is

**Vaeldrift, the Shattered Meridian** — a top-down hex-map roguelike RPG in a
runic cosmic fantasy world. Pure static site: vendored Three.js r160
(`vendor/three.module.js`), ES modules, **no build step, no dependencies**.
All art is canvas-painted at runtime; all audio is synthesized WebAudio.
Run with any static server from repo root (`python3 -m http.server 8080`).
`?seed=N` selects a world; runs persist per-seed in localStorage.

## Session history (all merged to main)

1. **PR #1** — Visual groundwork: hex world, fog of war, paper token, local
   diorama view, camera rig, procedural worldgen (radius 30).
2. **PR #2** — Battle prototype (Pokémon diorama + Paper-Mario timing),
   rift-carved region spiderweb with boss-gated causeways (radius 45),
   30-item Isaac layer, satellites + star-bridges, secrets, full-reset
   death, cosmic landmark objects (sun, planets, constellations, comet).
3. **PR #3** — Procedural audio engine, 150-item/4-rarity pools,
   Constellation of Echoes meta-progression, run persistence, dungeon
   gauntlets, out-of-battle consumables.

Branch workflow: develop on `claude/hex-map-rpg-game-9qu1nl`; after each PR
merges, reset the branch from `origin/main` (`git checkout -B <branch>
origin/main`) before new work. The user asks for PR + merge explicitly.
A stop-hook checks for unpushed commits — always push before ending a turn.

## User's locked design decisions (from poll rounds)

- Three.js WebGL, "Astral Glow" art (cosmic base plane + floating low-poly
  hex prisms with glowing runic edges), radius-45 world (~6,300 hexes)
- Camera-dive diorama for local hex view; animated path-hop movement
- Fog: vision + dim rim + explored "memory" + mist-capped unseen
- Kingdoms: four Celestial Courts (Solar/desert S, Pale Tarot/tundra N,
  Cometborne/mountains E, Umbral Choir/volcano W) as a flavor layer
- Battles: menu turns + **timing minigame** (click gold band to boost/block)
- World structure: **rift-carved pockets**, spanning-tree + extras causeway
  graph, tier = graph depth (0–5), Warden boss per gate
- Items: **blind single draw**, four **visible** rarities, biome pools
- Death: **full reset, new seed** (save deleted); farming capped by
  one-time sites + sparse glinted wilderness
- Audio: **morphing drone** engine + **region leitmotifs** (fixed per-region
  motifs, not generative)
- Meta: **feat unlocks** (Constellation of Echoes)
- More cosmic landmark objects dotted around (user explicitly asked)

## Architecture (src/)

- `config.js` — tunables: mapRadius 45, vision 4/rim 6, hop timings,
  region params (count 10, seedSpacing 15, riftWidth 1.7), secrets (26),
  battle timing windows/multipliers, camera bounds. Seed via `?seed=`.
- `rng.js` — mulberry32, hash2, value-noise fbm, pick.
- `hex.js` — axial math (pointy-top), disc coords, hexLine, A* `findPath`
  with `blocked` predicate (used for locked gates).
- `names.js` — all lore tables: BIOMES (14 incl. ROAD/BRIDGE/LUNAR/CRIMSON/
  VERDANT/SECRET), KINGDOMS, SATELLITES (luna/rubidus/viridian + bosses),
  CELESTIALS (sky landmarks), FOES rosters (roles: brute/swift/mystic/
  guard), wardenName, regionName, site/flavor generators.
- `worldgen.js` — deterministic passes: terrain fields → jittered-voronoi
  region pockets (border band → void rifts, `barrierBest` per pair) →
  biomes → satellites (axial coords beyond rim) → star-bridges (hexLine
  from best shore) → causeway selection (**MST + 3 extras, start-region
  penalized**) → gate tiles with tier/warden → connectivity BFS →
  kingdoms/towns/dungeons/shrines → sealed secrets (void tiles, same-region
  neighbors only, crackHint on neighbors) → lazy per-hex `getSites()`
  (sparse: ~45% wilderness hexes have sites; landmark tiles have themed
  sets; pedestal sites carry `pool`). `revealSecret(tile)` mutates a void
  tile into land.
- `items.js` — **exactly 150 items** (10/biome ×8, 43 ANY, 12 BOSS,
  15 ASTRAL; 34c/50u/51r/15a; 55 `core`). `drawItem(rng, pool, ownedIds,
  {source, tier, unlocked})` — source weights (pedestal/boss/secret/shop/
  astral) + tier shifts toward rare; falls back rarity→pool→any. RARITY
  colors. SYNERGIES (6, tag-pair). CONSUMABLES (charge/dew/feather).
- `run.js` — singleton `run`: items → recomputed stats/flags/abilities/
  synergies, hp, shards, consumables, cleared/opened/revealed sets,
  `power` score. Synergy stat effects applied in `_recompute`.
- `meta.js` — singleton `meta`, localStorage `vaeldrift_meta`: 20 FEATS
  with `check(m)` predicates; `bump(fn)` mutates stats, returns newly
  completed feats + items unlocked (in authored order via `_unlockNext`).
  `unlockedIds` = core + earned.
- `save.js` — per-seed run persistence (`vaeldrift_run_<seed>`): saveRun/
  loadRun/clearSave/applySave. Saved: items(ids), consumables, shards, hp,
  cleared/gates/secrets/visited, explored fog, player pos. Death clears.
- `audio.js` — singleton `audio`. 5 drone voices (2 saws + triangle →
  lowpass → gain), MUSIC table per biome: root midi + chord pair
  (semitone arrays) + motif mode + chime timbre. Chords flip every ~14s
  (5s morph); region change = 6s morph keyed `biome:lit|dark:regionId`
  (tier ≥ 4 → DARK minor-b6/dim override). Leitmotifs: deterministic 4-6
  notes from region id, chimes = additive-partial bells / filtered plucks
  / vibrato breath through feedback delay. Battle: interval-driven kick
  patterns (taiko for boss) on percBus. ~20 sfx methods. Init on first
  gesture; `♪` toggle persisted (`vaeldrift_audio`).
- `textures.js` — canvas art: player/trader/enemy(parametric)/mystery
  sprites, nebula, rune rings, mist, glow, labels (`userData.w/h`).
- `world3d.js` — WorldView: `layer` group (breathes) holds instanced
  tiles/rings/mist-caps/decos/glints + landmark groups (capital, town,
  dungeon, shrine, **gate** w/ tier barrier, satboss) + traders +
  highlight. `renderTiles = land + secrets` (secrets hidden until
  revealed → `revealSecretTile` pops them in). Fog states 0-3 recolor
  instances; glints mark unresolved-site hexes; crack sprites on
  secret-adjacent tiles (state 3, or state ≥1 with `crackSense` flag);
  `visionPlus` flag widens fog radii (reads `run.flags`). Base group:
  nebula disc, 4 rune rings, dust, starfield, sun. `_buildCelestials`:
  per-satellite planet bodies (moon/ringed rust/comet-tail), 4
  constellations + 2 shattermoons over void spots, ringed giant at
  angle −1.0 beyond rim, orbiting comet w/ 12-sprite tail. TIER_COLORS
  exported.
- `player.js` — paper token: yaw-billboard + parallax lean, hop tween
  (hopTime overridable), squash/stretch, burst pool, `layerY` rides the
  breathing layer, depthTest:false.
- `cameraRig.js` — pan(grab-point)/wheel-zoom/right-drag-orbit + inertia,
  keyboard pan, panTo tween, `wasDrag`/`dragMode` consumed by main.
- `battle.js` — BattleSystem: own scene (stage hex + rim + scenery,
  player front-left at (−4.4, 2.9), 1-3 foes back-right), DOM overlay
  (#battle: cards/menu/log/timing/floats). Flow: intro → playerMenu →
  act (timing promise) → enemyPhase (burn/stun/charge/telegraph, block
  timing) → repeat. Enemy stats: hp 13+8t, atk 2.5+1.8t, role mods; boss
  ×2.6 hp ×1.2 atk, enrages <50%. Handles all item flags/ability kinds
  (aoe, burn_all, stun, heal_self, weaken_all, smite, gamble, leech,
  frenzy). Rewards → shards/drops; revive (Lunar Grace); audio hooks.
  `body.in-battle` hides map UI chrome.
- `localview.js` — diorama builder: platform, site markers by type
  (battle/trader/pedestal/cache/ruins/etc.), cleared sites dimmed,
  billboards face camera, pick via invisible hitboxes.
- `ui.js` — DOM singleton `ui`: HUD (location/region/stats/consumables),
  legend, tooltip, site modal (+`modalOutcome`), item card (rarity
  colors), inventory (+consumable Use buttons via `inventoryHandlers`),
  Echoes panel, death screen (takes meta), toasts, fades.
- `main.js` — wiring: mode machine ('world'|'transition'|'local'|'battle'|
  'dead'), activeScene render switch, travel (gate-blocked A*, fast hops
  >7 or fastTravel flag), gate approach/challenge flow, `startBattle`
  (supports `waves` chaining for gauntlets, +4 HP between chambers),
  `startGauntlet` (2 fights + Keeper → boss draw), site action handler
  (battles/pedestals/caches/shop `renderShop`/mystery/rumors), detonate,
  save/load boot + `saveNow` throttle, meta event bumps + `announceFeats`,
  audio boot on first gesture + `setRegionMusic` in `refreshHud`, buttons
  (inventory/echoes/detonate/recenter/audio/return), Esc handling, loop.

## Debug API (window.__vael) — used by all Playwright tests

`mode, playerTile, isMoving, run, world, battle, view, meta, audio,
announceFeats, pickAt(x,y), travel(q,r), warp(q,r) (instant, saves),
lookAt(x,z,dist), testBattle(tier,biome,boss), smite() (all enemies →1hp),
give(itemId), openGateAt(q,r), detonate(), localSites(), act(siteId,label)`.

## Testing approach

- Playwright + `playwright-core` (installed in the session scratchpad, NOT
  in repo) with `executablePath: '/opt/pw-browsers/chromium'`.
- Start server first: `python3 -m http.server 8123` from repo root
  (background processes die between sessions — restart it).
- **Headless renders at ~2 fps** (SwiftShader, no GPU — it's the ~250k
  instanced vertices, not any single effect; fine on real GPUs). Therefore
  tests use `warp()` not `travel()`, `smite()` before battle loops, and
  generous timeouts. Clear `localStorage` between test runs (persistence
  will otherwise restore prior state and confuse assertions).
- Battle-loop test pattern: poll `battle.state`; click first `#b-menu
  button` on 'playerMenu'; `page.mouse.click(720,400)` to resolve timing
  bars; loop until `battle.active` false (gauntlets chain waves — keep
  polling while mode is battle/transition).

## Known caveats / open items

- **Audio has never been heard** — verified structurally only (ctx state,
  region-key morphs, layer attach/detach). Chord voicings follow the
  intended theory; expect a by-ear tuning pass (mix levels, motif
  frequency, morph time, dread intensity) once the user listens.
- Balance: tier curve beyond ~2 is untested by humans; boss ×2.6/×1.2 was
  softened once already. Item power at 12+ relics untested.
- Rarity authoring skew: 51 rare vs 34 common authored; draw weights
  compensate but a rebalance could smooth pity-fallbacks (e.g. MEADOW has
  no astral item — astral rolls fall back to rare there).
- `summary.md` (this file) and the `__vael` debug handle ship in the repo;
  user knows about `__vael` and kept it.
- Wandering-trader shop offers exclude items (`subtype === 'wandering'`).
- Satellites' region ids are `100+i`; `world.regionOf` fakes a region
  object for them (tier 4).

## Next-step candidates (floated to user, none committed)

- By-ear audio tuning pass (most likely next, needs user feedback)
- Satellite-specific mechanics (low gravity, rust storms)
- Balance pass on tiers/timing windows with human playtesting
- Optional "lite" render mode for weak GPUs
- More battle variety (enemy specials per role/biome)

## Conventions

- User prefers **poll-response (AskUserQuestion) before each major
  feature round** — options with one "(Recommended)"; they've picked the
  recommended option nearly every time, but the poll is part of the
  workflow they explicitly asked for.
- Verify with headless screenshots before pushing; send key screenshots
  to the user with SendUserFile after shipping.
- Commit style: imperative summary + detailed body; Co-Authored-By Claude
  trailer; no model IDs in artifacts. Push with `-u origin <branch>`.
- PR + merge only when the user asks (they have each round).
