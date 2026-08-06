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
4. **PR #4** — Music pass: passing chords (a→b→a→c cycle) + harp-pulse
   arpeggio + wandering bass, stereo drift, gradual dread, town warmth,
   motif echo.
5. **Balance overhaul round** (branch `claude/music-suggestions-poll-om2hqi`):
   regional site budgets, roaming enemy packs, power-matched scaling
   floor, role battle specials, threat HUD, shard sinks, rarity
   smoothing. All four poll answers were the recommended options.

Branch workflow: develop on the session's designated `claude/*` branch
(it changes per session); reset it from `origin/main` (`git checkout -B
<branch> origin/main`) before new work. The user asks for PR + merge explicitly.
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
  neighbors only, crackHint on neighbors) → **regional site budgets**
  (pass 12: ~5-9 sites per region — 1-2 pedestals, 1 trader, 1-2 caches,
  2-4 events — flagged `t.hasSite`/`t.siteKind`; satellites get 3;
  everything else is empty wilderness, ~73 budget tiles map-wide) →
  **roamer spawns** (pass 13: `world.roamerSpawns`, 2-4 packs/region ≥6
  from start) → lazy `getSites()` (landmark tiles themed sets; budget
  tiles resolve by `siteKind`; shrine site carries 'Offer Star-Shards';
  ROAD/BRIDGE and plain wilderness are empty). `revealSecret(tile)`
  mutates a void tile into land.
- `items.js` — **exactly 150 items** (10/biome ×8, 43 ANY, 12 BOSS,
  15 ASTRAL; **42c/48u/43r/17a** after the smoothing retag — every biome
  pool now holds exactly one astral; 55 `core`). `drawItem(rng, pool,
  ownedIds, {source, tier, unlocked})` — source weights (pedestal/boss/
  secret/shop/astral) + tier shifts toward rare; falls back
  rarity→pool→any. RARITY colors. SYNERGIES (6, tag-pair). CONSUMABLES
  (charge/dew/feather).
- `run.js` — singleton `run`: items → recomputed stats/flags/abilities/
  synergies, hp, shards, consumables, cleared/opened/revealed sets,
  `power` score, `shrineHeals` (escalating paid-heal counter). Synergy
  stat effects applied in `_recompute`.
- `roamers.js` — `RoamerSystem`: packs from `world.roamerSpawns`; one
  `step(playerTile)` per player hop — aggro ≤3 hexes steps toward you,
  else 55% random drift, region-locked, blocked by landmarks/gates/
  BRIDGE. Contact (dist ≤1) returns the pack → battle. `kill` → 34-hop
  respawn ≥8 from player; `calm` after flee (loses scent 4 hops).
  `serialize/restore` for saves. Hooks `onMove/onRespawn` drive world3d
  sprites.
- `meta.js` — singleton `meta`, localStorage `vaeldrift_meta`: 20 FEATS
  with `check(m)` predicates; `bump(fn)` mutates stats, returns newly
  completed feats + items unlocked (in authored order via `_unlockNext`).
  `unlockedIds` = core + earned.
- `save.js` — per-seed run persistence (`vaeldrift_run_<seed>`), **v2**:
  saveRun/loadRun/clearSave/applySave (both now take the RoamerSystem).
  Saved: items(ids), consumables, shards, hp, shrineHeals, roamer state,
  cleared/gates/secrets/visited, explored fog, player pos. v1 saves are
  discarded. Death clears.
- `audio.js` — singleton `audio`. 5 drone voices (2 saws + triangle →
  lowpass → gain → stereo panner w/ slow drift), MUSIC table per biome:
  root midi + chord trio a/b/c (cycle a→b→a→c every ~14s, 5s morph; c is
  the passing chord) + motif mode + chime timbre + arp `pulse` (sec/note).
  Region change = 6s morph keyed `biome:tier:regionId`. Gradual dread
  from tier 2 (`currentDef.dread` 0–1): saw detune spread, filter
  dimming, sub-root rumble osc; tier ≥ 4 still swaps the full DARK
  palette (root −2). Harp-pulse arpeggio of current chord tones (biome
  tempo, slowed/quieted by dread, ducked in battle); bass voice
  occasionally walks two scale tones then settles home
  (`cancelScheduledValues` in `_applyChord` clears pending walks).
  Leitmotifs: deterministic 4-6 notes from region id, echoed once a
  fifth up / quieter / opposite pan through the delay; towns+capitals
  (`town` flag passed by main.js from `tile.landmark`) fade in a warm
  triangle voice and speed the motif rate. Chimes = additive-partial
  bells / filtered plucks / vibrato breath through feedback delay.
  Battle: interval-driven kick patterns (taiko for boss) on percBus.
  ~20 sfx methods. Init on first gesture; `♪` toggle persisted
  (`vaeldrift_audio`).
- `textures.js` — canvas art: player/trader/enemy(parametric)/mystery
  sprites, nebula, rune rings, mist, glow, labels (`userData.w/h`).
- `world3d.js` — WorldView: `layer` group (breathes) holds instanced
  tiles/rings/mist-caps/decos/glints + landmark groups (capital, town,
  dungeon, shrine, **gate** w/ tier barrier, satboss) + traders +
  highlight. `renderTiles = land + secrets` (secrets hidden until
  revealed → `revealSecretTile` pops them in). Fog states 0-3 recolor
  instances; glints mark unresolved-site hexes; crack sprites on
  secret-adjacent tiles (state 3, or state ≥1 with `crackSense` flag);
  `visionPlus` flag widens fog radii (reads `run.flags`). Glints come
  from `t.hasSite` (budget tiles) + secrets. `attachRoamers(sys)` builds
  fog-aware pack sprites (enemy texture tinted by biome, red-eyed at
  tier ≥ 3), hop-animates on `onMove`, snaps on `onRespawn`;
  `roamerOnTile` feeds the tooltip. Base group:
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
  frenzy). **Role specials** (tier ≥ 2): swift 35% second strike at ×0.5,
  guard rune-walls weakest ally (next hit ×0.55, chip `◈warded`), mystic
  50/50 timing hex (`hexTurns` = 2, perfect band ×0.55, player chip
  'hexed') vs starlight chip damage; non-boss brutes enrage <40% HP
  (+25% ATK). Rewards → shards/drops; revive (Lunar Grace); audio hooks.
  `body.in-battle` hides map UI chrome.
- `localview.js` — diorama builder: platform, site markers by type
  (battle/trader/pedestal/cache/ruins/etc.), cleared sites dimmed,
  billboards face camera, pick via invisible hitboxes.
- `ui.js` — DOM singleton `ui`: HUD (location/region+threat/stats/
  consumables — `setRegion(region, threat)` renders a colored
  calm/even/dire/deadly skull with the scaled tier),
  legend, tooltip, site modal (+`modalOutcome`), item card (rarity
  colors), inventory (+consumable Use buttons via `inventoryHandlers`),
  Echoes panel, death screen (takes meta), toasts, fades.
- `main.js` — wiring: mode machine ('world'|'transition'|'local'|'battle'|
  'dead'), activeScene render switch, travel (gate-blocked A*, fast hops
  >7 or fastTravel flag; **each hop steps the roamers** — engagement
  clears the path and starts the pack battle), `powerTier()` =
  floor((power−18)/12) and `threatFor(region)`, gate approach/challenge
  flow, `startBattle` (**hardens every team**: tier = max(authored,
  powerTier(+1 for bosses)); supports `waves` chaining for gauntlets,
  +4 HP between chambers; flee calms the pack),
  `startGauntlet` (2 fights + Keeper → boss draw), site action handler
  (battles/pedestals/caches/shop `renderShop` with paid ↻ restock row
  at escalating cost/mystery/rumors/'Offer Star-Shards' shrine full-heal
  at 10+6·n ☆; shop markup ×(1+items·0.04)), detonate,
  save/load boot + `saveNow` throttle, meta event bumps + `announceFeats`,
  audio boot on first gesture + `setRegionMusic` in `refreshHud`, buttons
  (inventory/echoes/detonate/recenter/audio/return), Esc handling, loop.

## Debug API (window.__vael) — used by all Playwright tests

`mode, playerTile, isMoving, run, world, battle, view, meta, audio,
roamers, powerTier(), announceFeats, pickAt(x,y), travel(q,r),
warp(q,r) (instant, saves; does NOT step roamers),
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
  region-key morphs, layer attach/detach, chord-step/arp/dread state).
  This includes the music-pass layer (passing chords, harp arp, bass
  walks, stereo drift, gradual dread, town warmth, motif echo): the
  authored `c` chords and all new mix levels follow intended theory but
  await a by-ear tuning pass once the user listens.
- Balance: the harsh-floor curve (`powerTier`), pack density/aggro, shard
  sink prices, and role-special chances are all fresh and untested by
  human play — expect a tuning pass. Boss ×2.6/×1.2 was softened once
  already.
- The rarity skew and MEADOW/FOREST astral holes were fixed this round
  (16 retags; totals now 42c/48u/43r/17a, one astral per biome pool).
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
