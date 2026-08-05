# Vaeldrift — the Shattered Meridian

A top-down, hex-map roguelike RPG prototype in a runic cosmic fantasy world.
Pure static site: vendored Three.js r160, ES modules, no build step. All art
is painted onto canvases at runtime.

![genre] hex-map roguelike RPG · WebGL (Three.js) · procedural worldgen · diorama battles

## Running it

Any static file server from the repo root:

```sh
python3 -m http.server 8080
# or: npx serve
```

Then open <http://localhost:8080>. (ES modules can't load from `file://`.)
`?seed=12345` regenerates the world; dying rolls a fresh seed automatically.

## The run loop

You wake in **Starfall Vale** with 30 HP, a staff, two star-charges and a
bottle of dew. The disc of Vaeldrift (~6,300 hexes, radius 45) is carved by
void rifts into ten organic region pockets, joined **only** by warded
causeways — each sealed by a Warden boss whose tier rises with graph
distance from home (a spanning web + a few cross-links, so routes branch).
Explore your pocket, gather relics, then challenge a Warden to break into
the next pocket. Die anywhere and the world burns: new seed, nothing kept.

- **Battles** — Pokémon-style dioramas: your paper token front-left, foes
  back-right on a biome-styled stage. Menu turns (strike / abilities /
  items / flee) with **Paper-Mario timing**: click as the marker crosses
  the gold band to strike true, or to block incoming blows. Roles (brute,
  swift, mystic, guard), burn/chill/stun statuses, telegraphed heavy blows,
  enraging bosses.
- **Items** — Binding-of-Isaac-style blind draws from rune pedestals, boss
  drops, and shops. ~30 relics in biome-linked pools, many with downsides
  (+HP but slower, +dodge but less real, +shards but louder). Tag pairs
  ignite **synergies** (ember+glass → burning crits; sun+moon → Eclipse…).
  Your build *is* your level — there is no XP.
- **The farming ceiling** — sites are one-time per run, wilderness hexes
  are sparse (glimmers mark the ones that hold anything), and each pocket
  holds a bounded haul. When a region is picked clean, the only way up is
  through a Warden.
- **Secrets** — ~26 sealed hexes hide inside the rifts. Faint gold cracks
  shimmer on adjacent tiles; stand there and **✸ Detonate** a star-charge
  (also a battle nuke — spend it wisely) to blast the hollow open for a
  pedestal, a shard cache, or a powder keg.
- **The astral layer** — **Vael, the Undying Sun** burns in a crater at the
  world's heart. Beyond the rim, three satellites orbit — the Pale
  Daughter, Rubidus, and the Viridian Comet — reached by star-bridges from
  the astral shallows, each holding an optional ☠☠☠☠ boss and an astral
  relic (a once-per-run revive among them).
- **Everything else from run one** — four Celestial Court kingdoms with
  capitals and towns, dungeons, wayshrines, wandering trader carts, fog of
  war with explored-memory, the local hex diorama view, and the parallax
  paper token.

## Layout

```
index.html          shell + import map + overlays (battle, inventory, death)
css/style.css       HUD, battle UI, item cards, modals
vendor/three.module.js
src/
  config.js         tunables (map radius, regions, battle timing, seed)
  rng.js            seeded PRNG + value noise
  hex.js            axial hex math, lines, A* with blockers
  names.js          lore tables: biomes, courts, foes, wardens, satellites
  items.js          the relic table, pools, synergies, consumables
  run.js            run state: build stats, inventory, cleared sites, gates
  worldgen.js       regions, rifts, causeways+gates, satellites, secrets
  textures.js       all art, painted onto canvases at runtime
  world3d.js        world scene: tiles, fog, gates, glints, sun, bridges
  battle.js         diorama battles: stage, timing minigame, statuses
  player.js         the paper token
  cameraRig.js      pan/zoom/orbit controls
  localview.js      the zoomed-in hex diorama (sites, pedestals, shops)
  ui.js             DOM layer: HUD, modals, item cards, death screen
  main.js           bootstrap + interaction wiring
```
