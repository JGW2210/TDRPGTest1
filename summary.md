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
6. **Identity & combat depth round** (same branch, reset from main; no
   poll — user gave explicit direction): Isaac-style appearance system
   (tags mark the cloak, complete sets transform it, grand synergies
   rewrite the silhouette; world token + battle sprite repaint via
   `run.appearance`/`appearanceSig`); synergies became **sets** (3–4 of a
   tag; 7 set synergies + 6 grand two-set synergies in items.js
   `SETS`/`SYNERGIES`); combat overhaul (random band placement/speed/
   direction, 3-bar Star Strike combos, swift flurries with per-hit bars,
   unblockable crush attacks with dodge-only bars, perfect/good block =
   0.15×/0.6×, miss mult 0.5, player burn/chill statuses, desert sand-veil
   hides bands mid-sweep, mystic siphon/mend, guard self-shell); role-
   specific enemy silhouettes in `makeEnemyTexture({...})` (object arg
   now); shop overhaul (1–3 relics from harsh c-heavy table, finite
   consumable stock, restock re-rolls relics only at doubling cost, max 2);
   dew scarcity (start 0, 5% drop, heal 12, capped cache/shop stock);
   timing/block-window items rarity-bumped and block widening 50%→30%.

7. **World-identity round** (same branch; poll held, all 4 recommended
   options chosen): per-species enemy art — every named foe (39 species)
   has a hand-authored painter in `src/monsters.js`, plus one-off boss
   portraits (warden/keeper/guardian/champion/3 satellite bosses/deity);
   airtight worldgen — rift-leak seal pass (rules 1+2 + causeway-mouth
   anchor protection + re-anchor repair pass), MST validation before
   union, zero-width-rift boundary wardens, natural-rift crossing
   recording (fixed two seeds where region 0 had no causeway at all;
   regression suite: 0 leaks / 0 lost regions over 40 seeds); satellites
   are radius-5 areas (tier-5 packs, 7-site budgets) with **hidden
   star-bridges** — visible worlds, invisible spans revealed by
   detonating a resonant seam on the glinting shore (persisted in save
   v3); shallows rivers carved from lakes (region-confined), 2 nebula
   landmark hexes with unique events, water-locked shoal roamers;
   shrine Commune boons (seeded, once per shrine, two-step confirm),
   sacrifice bargains (relic-eating star, tithe-stone, moth court, paid
   door, echo well) via `run.boons`, mystery outcomes with boons/big
   swings; 4 sky-voice celestials (giant/third sister/ferry lantern/
   door ajar) with vantage hexes + one-time dialogue and gifts;
   **8 cosmic mutations** (rarity 'm', only from satellite bosses
   [guaranteed], t3+ keepers [25%], astral pedestals [15%], nebula
   bargain) each with monstrous texture overrides and real downsides —
   3 carried tears open **the Wound in the Meridian** (region 200,
   tier 6, WOUND biome, whisper landmarks, wound battles) with deity
   boss Vhal-Suthek (tier 7, crush/siphon/flurry rotation) and an
   alternative ending screen (`#ending`, `ui.showEnding`).

8. **Archipelago round** (branch `claude/game-map-visual-thematic-wu6dph`;
   poll held — user picked Quadrant climates, a custom "archipelago joined
   by narrow shallows rivers, still warden-gated", ALL FOUR void-flare
   packs, and monumental multi-hex landmarks):
   **quadrant climates** (temp gradient ×1.45 with less noise, east
   mountain bias, `home` damping ≤ cDist 13 keeps the start vale
   meadow/forest — 0 impure home tiles over 40 seeds), **speckle purge**
   pass 3.2 (2-iteration majority filter, volcano/crater exempt);
   **archipelago erosion** pass 2.5 (clumped fbm coast-gnawing, 2
   thresholds in `CONFIG.archipelago`, riftWidth 1.7→2.1) + **pass 6.8**
   (start relocates into region 0's largest fragment — without this the
   connectivity cull could drown the world, seed 21); causeways restyled
   as **Warded Shallows** (water-colored ROAD biome, height 0.55, gold
   ward accent; all sealing logic untouched) + **pass 6.9 water web**
   (BFS river-joins from each channel mouth to nearest SEA within 7);
   **3 forgotten islets** per world (pass 10.5: hermit trader / wreck
   battle+cache / observatory ASTRAL pedestal from `names.ISLETS`, biome
   ISLET, hidden `isletHidden` clusters + folded footbridges, seam on
   `bridge[0].isletSeam`, shore glows `isletHint`, revealed by detonate →
   `world.revealIslet(i)`, feat `islefinder`, save v4 `revealedIslets`);
   world3d: **rift debris fields** (instanced plates/rocks/slabs on ~16%
   of void hexes + tumbling spinner meshes), **island undersides** (root
   cones per region/satellite, ≤60 coastal stalactites, stardust-fall
   planes), **sky weather** (aurora ribbons over 2 largest tundra sweeps,
   volcano ember plumes, 3-pool shooting stars, 5 drifting cloud
   shadows), **monumental landmarks** (walled capital city-mounds with
   banners + kingdom beacon, towns with 5 houses/windmill/chimney smoke,
   biome-carved dungeon facades [colossus/tree/ziggurat/fangs/ice
   vault/geode/barrow], gate arches with keystones, shrine rune-rings,
   satboss thrones, nebula swirl + islet models; beacons pulse and dim
   with fog via `dimmables`).

9. **Pack & battle-feel round** (same branch; direct user instructions, no
   poll): roamer packs carry a **species sealed at spawn** (`r.species`
   from FOES via hash2(q,r,55); map icon = battle foe; `engageRoamer`
   passes `team.species`/`speciesRole`, battle names/titles/tooltip use
   it); **speed ratio** per pack (`r.speed` = 0.35 + 0.14·tier + 0.12 if
   swift ± jitter, clamp 0.25–1.35; accumulator `r.acc`, max 2 steps per
   player hop, serialized) — tier-0 lumbers at ⅓ pace, tier-5+ matches or
   outruns you; **contact = same hex only** (adjacent packs no longer
   ambush; hunters may step onto your tile, you onto theirs); battle
   **ranged vs melee**: mystics (`e.ranged`) cast biome-accent bolts via
   `_projectile(from,to,color,{dur,size,arc})` (promise-based, advanced
   in update()) with no lunge — heavy/crush blows still close in; player
   abilities fire typed bolts/bursts (aoe gold, burn orange, stun white,
   weaken pale blue, smite big gold, gamble purple, leech green
   both ways, heal/frenzy self-bursts), colored `_burst(pos, color)`
   impacts (perfect block ice-blue, hit red-orange); **billboarded paper**
   (player + living foes yaw-face the camera every frame) and enemy spots
   spread across the camera's line of sight; scenery confined behind the
   enemy line (z ≤ −4.6) so nothing occludes a foe.

10. **Cache-buster & game-chrome round** (same branch): index.html now
   sets `window.BUILD` and builds a dynamic **import map** rewriting
   `three` + every `./src/*.js` import to `?v=BUILD` URLs — **bump BUILD
   in index.html (and the css href) every release** or players keep
   stale modules; a **wanderer's menu** overlay (`#gamemenu`, `#btn-menu`
   top-right, Esc toggles): continue / music toggle / echoes / *refold
   this world* (same seed, clearSave+reload) / *wake in a new world*
   (fresh seed) — both restarts arm-on-first-click, fire-on-second; the
   Courts legend + seed/build line moved into the menu (the `#legend`
   box is gone; `ui.init` renders `#menu-courts`, `gm-seed`,
   `gm-buildnum`); **full de-boxed UI restyle** (css/style.css
   rewritten): no panels/borders anywhere — corner vignette `#scrims`,
   text-shadow inscriptions for HUD/controls/hints, soft radial `--softbg`
   for tooltip/toast/log, site modal is a bottom sheet
   (`.modal-inner`), inventory/echoes are right-edge gradient sheets,
   battle uses floating nameplates (targeted = `▸` + glow, slim glowing
   hp bars) and text-only action words, item reveal is a glow with no
   card. Audio/echoes buttons live in the menu now (`gm-audio`,
   `gm-echoes` — old `btn-audio`/`btn-echoes` ids are gone).

11. **Accessibility & overlap round** (same branch): the archipelago's
   ragged coasts could leave a satellite's seam void tile 2 hexes from
   its glowing shore (3/120 across 40 seeds — detonating on the shore
   silently failed); detonation is now keyed off the **hint tiles**
   (`seamHint`/`isletHint` on the player's own tile OR any neighbor
   reveals the matching bridge; legacy seam-tile check kept as
   fallback), a one-time toast nudges when stepping onto a humming
   shore, and tooltips state the instruction outright; the worldgen
   suite now asserts full accessibility every seed (satellite shores
   hinted + walkable, satellite bosses / wound deity / islets reachable
   post-reveal, every secret has a crack-hinted neighbor); battle
   layout un-clipped for crowded action rows (log bottom 122 · 52vw,
   timing 216, player plate 152, menu 74vw with tighter wrap gap) —
   verified with 7 buttons (3 abilities + charge + dew). BUILD is 11.

12. **Combat & items revamp round** (branch `claude/combat-items-revamp-yasfvv`;
   direct user instructions, no poll): **three attack stances** — Swift Cut
   (0.85×, slow wide bar, perfect grants POISE: next enemy phase's notes
   fall 15% slower / windows +25%), Star Strike (the 3-bar chain,
   unchanged), Meteor Edge (2.6× on perfect from a knife-thin fast bar;
   perfect pierces guard-plates/wards outright and INTERRUPTS a charging
   foe; good 1.2×, miss 0.3×) — plus **Brace** (skip attack: windows ×1.5,
   notes 28% slower, perfect blocks riposte for 60% ATK); every strike bar
   now has an **energy-coalescing fade-in** (gather mote sits where the
   gold band will be, track fades in via `--gather`, marker launches after
   `opts.gather` seconds — harder stances gather faster); **blocking is a
   guitar-hero lane minigame** (`_blockRun` in battle.js, `#b-lanes` DOM):
   shapes fall down 3 lanes, pressed with A/S/D (pointer = nearest-shape
   fallback), graded perfect/good/miss by |Δt| from the hit-line; single
   blows fall as 1–3 notes by tier, flurries as one note per swing,
   crushes as one wide any-key shape with a dodge-thin window; **trap
   shapes** (spiked, red) thread patterns at tier ≥2 — pressing one costs
   0.5× the foe's ATK as unblockable chip; notes fade in over 30% of the
   fall and the desert sand-veil swallows them near the line; **~40 new
   relics** (200 ordinary total) keyed to the new systems via flags
   noteSlow/riposte/trapWard/chainKeeper/heavyPlus/gatherCalm/dodgePlus/
   poiseful/interruptGood/veilSight; **painted item icons**
   (`makeItemIconURL` in textures.js: rarity-rimmed rune-hex, mechanic
   glyph, set pips, pool crown-notch) shown in pack/shop/reveal-card, and
   an **appearance portrait** (`paintPlayerCanvas`) atop the pack sheet;
   **rebalance**: enemy curve now gently quadratic
   (`CONFIG.battle.enemy` = hp 13+7t+0.35t², atk 2.4+1.45t+0.09t²) tuned
   by Monte-Carlo (scratchpad `balance_sim*.mjs`) to a wanderer with ~70%
   of prior areas' relics and 60% perfect / 30% good rates:
   pack-win ≈100/96/89/90/80/73% over tiers 1-6 (sim excludes brace/
   interrupt/consumables so real play sits a notch easier);
   `expectedPower(tier)` refit to 14+8·tier (measured farm-power ≈22+7t —
   at target farm every tier reads "even", underfarm reads dire);
   `the_other_end` feat unlocks 6→8 so all 125 locked relics stay
   reachable. BUILD is 12.

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

- `index.html` / `css/style.css` — **cache-buster**: an inline script sets
  `window.BUILD` and builds a dynamic import map rewriting `three` + every
  `./src/*.js` import to `?v=BUILD`; a second inline script loads
  `src/main.js?v=BUILD`. **Bump BUILD (and the css href version) on every
  release** or live players keep stale modules. Also hosts the wanderer's
  menu markup (`#gamemenu`, `#btn-menu`) and the `#scrims` vignette layer.
  The stylesheet is fully de-boxed: no panels/borders — corner vignettes,
  text-shadow inscriptions, soft radial `--softbg` backings, bottom-sheet
  site modal, right-edge gradient sheets for inventory/echoes, floating
  battle nameplates, text-only buttons.
- `config.js` — tunables: mapRadius 45, vision 4/rim 6, hop timings,
  region params (count 10, seedSpacing 15, riftWidth 2.1), archipelago
  (erosion thresholds, riverJoinDist), secrets (26), islets (count 3,
  minLandGap, maxBridge), battle: `enemy` quadratic stat curve,
  `timing` (incl. `gather`), `attacks` (swift/star/heavy stance tuning),
  `lanes` (fall/lead/windows/spacing/trapWin/fadePortion), camera
  bounds. Seed via `?seed=`.
- `rng.js` — mulberry32, hash2, value-noise fbm, pick.
- `hex.js` — axial math (pointy-top), disc coords, hexLine, A* `findPath`
  with `blocked` predicate (used for locked gates).
- `names.js` — all lore tables: BIOMES (16 incl. ROAD ["Warded Shallows",
  water-styled]/BRIDGE/LUNAR/CRIMSON/VERDANT/SECRET/**WOUND**/**ISLET**),
  KINGDOMS, SATELLITES (luna/rubidus/viridian + bosses), **ISLETS** (3
  forgotten-islet defs: hermit/wreck/observatory), CELESTIALS (sky
  landmarks), FOES rosters (roles: brute/swift/mystic/guard; +WOUND and
  ISLET rosters — ISLET reuses BRIDGE species so no new art),
  `speciesSlug(name)` for art lookup,
  wardenName, regionName, site/flavor generators, **BARGAINS** (5 sacrifice
  events), **SHRINE_BOONS** (5 commune offers), **SKY_VOICES** (4 celestial
  dialogues + gifts), **NEBULA_NAMES/nebulaSites**, **DEITY/WOUND_WHISPERS**.
  `makeSide` rolls bargains at 0.62-0.8.
- `worldgen.js` — deterministic passes: terrain fields (**quadrant
  climates**: strong N/S temp gradient, east mountain bias, radial `home`
  damping keeps the start vale meadow/forest) → jittered-voronoi region
  pockets (border band → void rifts, `barrierBest` per pair — **recorded
  even on natural-void tiles**) → **pass 2.5 archipelago erosion**
  (clumped fbm coast-gnawing, ragged islands) → biomes → **pass 3.2
  speckle purge** (majority filter; volcano/crater exempt) → **pass 3.5
  rivers** (2-4 winding SEA rivers out of the big lakes, region-confined;
  nebula landmarks inside the 2 largest lakes) → satellites (**radius-5
  ragged discs**, `keepComponent` prunes fragments, satboss tier 5) →
  **pass 4.6 the Wound** (radius-4 hidden region 200, deity + whisper
  landmarks) → causeway selection (**validity checked BEFORE union-find**;
  dist ≤12 then relaxed ≤26 for still-cut components; zero-width rifts
  stand the warden on a boundary land tile; `carvedInfo` stored per gate;
  causeways are water-styled **Warded Shallows**) → **pass 6.5 rift seal**
  (rule 1 land-land, rule 2 road-side-entry; causeway-mouth anchors
  protected with spendable counts) → **pass 6.75 re-anchor repair** (BFS
  from each mouth to its region's largest fragment, never stepping beside
  foreign land) → **pass 6.8 start replant** (start moves into region 0's
  largest fragment or the connectivity cull drowns the world) → **pass
  6.9 water web** (river-joins from each channel mouth to nearest SEA
  within 7) → connectivity BFS (regions ≥100 exempt) → **pass 7.5 hidden
  star-bridges** (carved post-seal from surviving shores; `t.hiddenBridge`,
  seam = first tile, `shore.seamHint`; wound bridge likewise via
  `woundHidden`) → kingdoms/towns/dungeons/shrines → sealed secrets →
  **pass 10.5 forgotten islets** (3 hidden void clusters + folded
  footbridges; `isletHidden`/`isletBridge`/`isletSeam`, shore glows
  `isletHint`; leak-proof: bridges touch no foreign land) → site budgets
  (satellites get 7 kinds incl. trader; wound gets pedestal/cache/2
  wound_battles/side) → roamer spawns (satellites tier 5 ×3; **water
  packs** on post-seal SEA components, tier = region+1) → **pass 14 sky
  anchors** (4 vantage hexes) → lazy `getSites()` (+nebula/deity/whisper/
  wound_battle/islet branches).
  `revealSecret/revealBridge(i)/revealIslet(i)/revealWound()`.
- `items.js` — **200 ordinary items** + **8 MUTATION items** (rarity 'm',
  pool MUTATION, `mutation: true`, excluded from `drawItem`; drawn only
  via `drawMutation(rng, ownedIds)`). `drawItem(rng, pool, ownedIds,
  {source, tier, unlocked})` — source weights + tier shifts; shop table
  is harsh (62/28/9/1). RARITY colors (+m sickly green). **SETS** (7
  tags, need 3-4) + **SYNERGIES** (7 set + 6 grand two-set). CONSUMABLES
  (charge/dew/feather; dew heals 12, halved by `dewMuted`). Round-12
  combat-rhythm flags (~40 relics): noteSlow, riposte, trapWard,
  chainKeeper, heavyPlus, gatherCalm, dodgePlus, poiseful, interruptGood,
  veilSight — all read by battle.js; rarity totals 46c/65u/62r/19a,
  still one astral per biome pool.
- `run.js` — singleton `run`: items + **boons** → recomputed stats/flags/
  abilities/set-synergies, hp, shards, consumables, cleared/opened/
  revealed sets, `power` score, `shrineHeals`, **shrineBoons/vantageSeen
  Sets, woundOpen flag, mutationCount, addBoon/removeItem**, `appearance`
  + `appearanceSig` (tags/sets/grand/mutations drive the texture
  painter). `noFirstDodge` strips firstStrikeDodge in recompute.
- `roamers.js` — `RoamerSystem`: packs from `world.roamerSpawns`. Each
  pack's **species is sealed at spawn** (`r.species` from FOES via
  hash2(q,r,55) — the map icon IS the battle foe) and each has a
  **speed ratio** (`r.speed` = 0.35 + 0.14·tier + 0.12 if swift ± jitter,
  clamp 0.25–1.35; fractional accumulator `r.acc`, max 2 steps per player
  hop, serialized): tier-0 lumbers at ⅓ pace, tier-5+ matches or outruns
  the player. One `step(playerTile)` per hop — aggro ≤3 hexes hunts
  toward you, else 55% random drift per earned move, region-locked,
  blocked by landmarks/gates. **Water packs (`r.water`) step only on SEA
  tiles; land packs avoid BRIDGE.** **Contact = same hex only** (a hunter
  stepping onto your tile, or you onto theirs) → battle. `kill` → 34-hop
  respawn ≥8 from player; `calm` after flee. `serialize/restore`.
  Hooks `onMove/onRespawn` drive world3d sprites.
- `meta.js` — singleton `meta`, localStorage `vaeldrift_meta`: **25 FEATS**
  (incl. seamfinder/islefinder/changed/thrice_changed/the_other_end) with
  `check(m)` predicates; `bump(fn)` mutates stats, returns newly completed
  feats + items unlocked. `unlockedIds` = core + earned.
- `save.js` — per-seed run persistence (`vaeldrift_run_<seed>`), **v4**:
  saveRun/loadRun/clearSave/applySave. Saved: items(ids), consumables,
  shards, hp, shrineHeals, **boons, shrineBoons, vantageSeen,
  revealedBridges, revealedIslets** (applySave replays
  `world.revealBridge`/`world.revealIslet` +
  `worldView.revealHiddenTiles`), roamer state, cleared/gates/secrets/
  visited, explored fog, player pos. The Wound re-opens on load from
  `mutationCount >= 3` (main.js), not a save field. Older saves discarded.
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
- `textures.js` — canvas art: **player texture is appearance-driven**
  (`makePlayerTexture(run.appearance)`: tag marks → set crowns/halos/
  recolors → grand-synergy transformations → mutation overrides, full
  eldritch form at 3+; raw canvas via `paintPlayerCanvas` for the pack
  portrait); **item sigil-icons** — `makeItemIconURL(item)` (cached data
  URLs): rarity-rimmed rune-hex tile, mechanic glyph chosen by
  `iconKindFor` (mutation > ability kind > distinctive flag > heaviest
  stat; ~25 hand-path glyphs), set pips, pool crown-notch (imports RARITY/
  SETS from items.js + BIOMES from names.js — no cycles);
  `makeEnemyTexture({species, bossKind, role,...})`
  delegates to monsters.js, parametric role bodies remain as fallback;
  trader/mystery sprites, nebula, rune rings, mist, glow, labels.
- `monsters.js` — **the bestiary**: `paintSpecies(g, slug, o)` — 39
  hand-authored species painters keyed by `speciesSlug(name)` — and
  `paintBoss(g, kind, o)` for warden/keeper/guardian/champion/
  sat_luna/sat_rubidus/sat_viridian/deity portraits. Shared helper kit
  (blobPath/glowEye/teeth/wing/legs/runeOrbit).
- `world3d.js` — WorldView: `layer` group (breathes) holds instanced
  tiles/rings/mist-caps/decos/glints + landmark groups + traders +
  highlight. `renderTiles = land + secrets + hidden bridge/wound/islet
  tiles` (all hidden until revealed; `revealSecretTile` / staggered
  `revealHiddenTiles(arr)` pop them in). Fog states 0-3 recolor
  instances; crack sprites (gold) + **seam/vantage/islet sprites**
  (blue/white/pale-green, state ≥2); `visionPlus` widens fog radii.
  Roamer sprites use the pack's sealed species (`_roamerTexture` reads
  `r.species`). **Monumental landmarks** (`_buildLandmarks`): walled
  capital city-mounds w/ banners + kingdom sky-beacon, towns w/ windmill
  (lmSpinners) + chimney smoke (smokePuffs), biome-carved dungeon facades
  (colossus/tree/ziggurat/fangs/ice vault/geode/barrow), gate arches w/
  spinning keystones, shrine rune-rings, satboss thrones, nebula swirl,
  hand-built islet models (hidden groups `g.visible=false` until reveal);
  beacons pulse and dim with fog via `dimmables`. **Round-8 environment
  builders**: `_buildDebris` (instanced rift plates/rocks/slabs + tumbling
  spinner meshes), `_buildUndersides` (root cones per region/satellite,
  coastal stalactites, stardust falls), `_buildWeather` (aurora ribbons
  over 2 largest tundra sweeps, volcano ember plumes, 3-pool shooting
  stars, drifting cloud shadows). `_buildCelestials`: satellite planet
  bodies, constellations, shattermoons, ringed giant, comet, **+ Third
  Sister moon, Ferry Lantern, Door Ajar at `world.skyAnchors` positions**.
  TIER_COLORS exported.
- `player.js` — paper token: yaw-billboard + parallax lean, hop tween
  (hopTime overridable), squash/stretch, burst pool, `layerY` rides the
  breathing layer, depthTest:false.
- `cameraRig.js` — pan(grab-point)/wheel-zoom/right-drag-orbit + inertia,
  keyboard pan, panTo tween, `wasDrag`/`dragMode` consumed by main.
- `battle.js` — BattleSystem: own scene (stage hex + rim + scenery
  confined **behind the enemy line** at z ≤ −4.6, player front-left at
  (−4.4, 2.9), 1-3 foes spread **across the camera's line of sight**),
  DOM overlay (#battle: nameplates/menu/log/timing/lanes/floats). Player +
  live foes **yaw-billboard to the camera** every frame. `team.species`
  (from roamer packs) fixes the whole team to that species; otherwise
  rolled from the biome roster. **Three stances** via
  `_playerAttack(kind)`: swift (poise on perfect; `poiseful` widens),
  star (3-bar chain; `chainKeeper` saves one slip), heavy (Meteor Edge —
  perfect = 2.6+`heavyPlus`, pierces guard/ward, interrupts charging foes;
  `interruptGood` extends to goods) + **`_brace()`** (windows ×1.5, notes
  slower, perfect-block riposte 60% ATK; `riposte` flag adds flat).
  **Strike bars gather first**: `_startTiming` opens in `timingPhase
  'gather'` (orb over the future band, track fades via `--gather`,
  `opts.gather` scaled by `gatherCalm`), then 'live'. **Blocks are the
  lane minigame**: `_blockRun({swings,tier,crush,speed,veil})` builds
  notes (1-3/swing by tier; flurries 1/swing; crush = one wide any-key
  shape) + traps (tier ≥2, chance 0.18+0.09t), returns per-swing grades +
  trapsHit; input via A/S/D keydown (`_lanePress`) or pointer
  (`_lanePointer` nearest-shape); `noteSlow`/brace/poise slow the fall,
  `blockBonus`/hex/eclipse scale windows, `dodgePlus` widens crush leaps,
  `trapWard` forgives springs, sprung traps chip 0.5× foe ATK.
  **Headless-test knobs**: `battle.strikeAutoplay`/`laneAutoplay =
  {p,g}` pre-roll grades and press at the matching moment.
  **Ranged vs melee**: mystics (`e.ranged`) cast biome-accent bolts via
  `_projectile(from,to,color,{dur,size,arc})` with no lunge — heavy/crush
  blows always close in; player abilities fire typed bolts/bursts,
  colored `_burst(pos,color)` impacts. Flow: intro → playerMenu → act
  (timing promise) → enemyPhase (burn/stun/charge/telegraph, lane run) →
  repeat. Enemy stats from `CONFIG.battle.enemy` (13+7t+0.35t² hp,
  2.4+1.45t+0.09t² atk), role mods; boss ×2.6 hp ×1.2 atk, enrages <50%.
  Handles all item flags/ability kinds. **Role specials**: swift flurries
  (2-3 notes), mystic hex/siphon/mend, guard ward-ally/self-shell,
  brutes+bosses charge into crushes at tier ≥2; **deity rotates crush/
  siphon/flurry** (hp ×2.6×1.6, atk ×1.2×1.15). Biome afflictions on hit:
  volcano burns, tundra chills (notes fall faster), sea leeches, desert
  sand-veil swallows notes/zones near the line (`veilSight` negates),
  WOUND burns+chills. Mutation flags honored: abilityToll, dewMuted,
  drylandAche, heavyGait (in main), noFirstDodge (in run).
  Species/bossKind passed to the texture painter. Rewards → shards/drops
  (dew 5%); revive (Lunar Grace); audio hooks.
- `localview.js` — diorama builder: platform, site markers by type
  (battle/trader/pedestal/cache/ruins/etc.), cleared sites dimmed,
  billboards face camera, pick via invisible hitboxes.
- `ui.js` — DOM singleton `ui`: HUD (location/region+threat/stats/
  consumables — `setRegion(region, threat)` renders a colored
  calm/even/dire/deadly skull with the scaled tier), tooltip, site modal
  (+`modalOutcome`), item card (rarity colors + `#ic-icon` sigil),
  inventory (`#inv-portrait` appearance portrait, per-item `.inv-icon`
  sigils, consumable Use buttons via `inventoryHandlers`), Echoes panel,
  death screen (takes meta), toasts, fades. `init` renders the Courts
  into the menu (`#menu-courts`) + `gm-seed`/`gm-buildnum` — the old
  `#legend` box is gone. Shop rows get `.ware-icon` sigils (main.js).
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
  at 10+6·n ☆; shop markup ×(1+items·0.04)), **detonate keyed off hint
  tiles** (`seamHint`/`isletHint` on the player's tile OR any neighbor
  reveals the matching satellite bridge / islet footbridge; legacy
  seam-tile check as fallback; a one-time toast nudges on stepping onto
  a humming shore), `engageRoamer` (species-named toasts/titles,
  passes `team.species`), save/load boot + `saveNow` throttle, meta event
  bumps + `announceFeats`, audio boot on first gesture + `setRegionMusic`
  in `refreshHud`, buttons (inventory/detonate/recenter/return), the
  **wanderer's menu** (`toggleMenu`, Esc opens/closes; music toggle +
  echoes moved here; *refold this world* = clearSave+reload, *wake in a
  new world* = fresh seed — both arm-on-first-click), loop.

## Debug API (window.__vael) — used by all Playwright tests

`mode, playerTile, isMoving, run, world, battle, view, meta, audio,
roamers, powerTier(), announceFeats, pickAt(x,y), travel(q,r),
warp(q,r) (instant, saves; does NOT step roamers), lookAt(x,z,dist),
testBattle(tier,biome,boss,extra) (extra merges into team — e.g.
{deity:true, bossKind:'deity', count:1} or {species:'Star-Drowned
Siren', speciesRole:'mystic'}), smite() (all enemies →1hp),
give(itemId) (routes mutation count → openWound), openGateAt(q,r),
detonate() (unfurls bridges/islets from hint tiles, opens secrets),
revealIslet(i) (world + view + fog + save), localSites(),
act(siteId,label), shopOffers(q,r)`.

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
- Round-12 combat feel is untested by humans: lane fall speed (1.25s),
  press windows (±0.07/±0.17s), trap density, gather durations, stance
  band scales, and the Monte-Carlo-tuned enemy curve all follow the
  sim (scratchpad `balance_sim_lib.mjs` — rebuild from round-12 history
  if needed), which deliberately excludes brace/interrupt/consumable
  play. If real players find even-tier fights too hot, ease `atkT`
  first; if too cold, raise `hpQ`/`atkQ` before touching linear terms.
  Headless caveat: at ~2 fps the marker can step clear over the Meteor
  band in one frame — heavy perfects need direct `_resolveTiming`
  injection in tests (60 fps humans are unaffected).
- Save VERSION is now 4 (round 8: archipelago worldgen + revealedIslets) —
  older saves are discarded on load. Worldgen changed again for identical
  seeds (quadrant climates, erosion, water web, islets), by design.
- **Bump `window.BUILD` in index.html (and the css href `?v=`) on every
  release** — currently 12. Without the bump, live players keep stale
  modules despite the import-map cache-buster.
- The worldgen suite (rebuild in scratchpad each session; pattern in
  round-11 history) asserts over 40 seeds: 0 leaks, 0 lost regions,
  3 islets each, satellite shores hinted + walkable, satellite bosses /
  wound deity / islets reachable post-reveal, every secret openable from
  a crack-hinted neighbor, 0 impure home tiles. Keep it green.
- Round 8-11 visuals verified by headless screenshots only — debris
  density, beacon/aurora/cloud opacity, landmark scale, and the de-boxed
  UI's scrim/text-shadow strengths may want a taste pass on a real GPU.
- Roamer speed ratios (0.35–1.35) and battle projectile pacing
  (0.2–0.35s flights) are theory-tuned, untested by human play.
- ISLET biome: FOES.ISLET reuses BRIDGE species (haunt/remora) so no new
  monster art was needed; MUSIC falls back to MEADOW (no ISLET entry).
- Round-7 numbers untested by humans: mutation stat swings, deity
  hp ×2.6×1.6 at tier 7, wound-battle counts, bargain prices, water-pack
  density (≈11-16/world), nebula reward rates. Suites verify structure,
  not feel.
- The deity is one phase; a phase-2 (adds/board-clear) was floated but
  not built. Mutations cannot be removed once taken (no cleansing
  shrine yet).
- The rarity skew and MEADOW/FOREST astral holes were fixed this round
  (16 retags; totals now 42c/48u/43r/17a, one astral per biome pool).
- `summary.md` (this file) and the `__vael` debug handle ship in the repo;
  user knows about `__vael` and kept it.
- Wandering-trader shop offers exclude items (`subtype === 'wandering'`).
- Satellites' region ids are `100+i`; `world.regionOf` fakes a region
  object for them (tier 4).

## Next-step candidates (floated to user, none committed)

- By-ear audio tuning pass (needs user feedback)
- Balance pass with human playtesting (combat numbers, roamer speeds,
  mutation costs, deity difficulty, bargain prices)
- GPU taste pass on round 8-11 visuals (debris/beacon/aurora/scrim
  intensities)
- Deity phase 2 / Wound music+audio identity (WOUND has no MUSIC entry
  yet — falls back by biome default; ISLET likewise)
- A mutation-cleansing shrine (mutations are currently permanent)
- Optional "lite" render mode for weak GPUs

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
- Every release: bump `window.BUILD` + the css `?v=` in index.html.
