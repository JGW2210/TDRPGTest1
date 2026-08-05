# Vaeldrift — the Shattered Meridian

A visual groundwork test for a top-down, hex-map RPG set in a runic cosmic
fantasy world. A shattered disc of ~2,800 floating hex tiles drifts above a
nebula base plane ringed with slowly turning rune circles. No build step, no
runtime dependencies beyond a vendored copy of Three.js.

![genre] top-down hex-map RPG · WebGL (Three.js) · procedural worldgen

## Running it

Any static file server from the repo root works:

```sh
python3 -m http.server 8080
# or: npx serve
```

Then open <http://localhost:8080>. (ES modules can't load from `file://`,
so a server is required. GitHub Pages also works — point it at the repo root.)

Use `?seed=12345` in the URL (or the **✦ New World** button) to regenerate
the world.

## What's in the test

- **The world** — a radius-30 hexagonal disc (~2,800 tiles) of floating hex
  prisms above a separate cosmic base layer. Biomes: starlit meadows, sighing
  forests, cloudpiercer mountains, ember wastes (with a live volcano), glass
  dunes, the pale expanse, astral shallows, and prism fields. Rifts of void
  crack the disc; its rim crumbles into the star-sea.
- **The Celestial Courts** — four kingdoms, each bound to a celestial body:
  the Solar Dominion (south, desert), the Pale Tarot (north, tundra), the
  Cometborne Reaches (east, mountains), and the Umbral Choir (west, volcano).
  Their territory glows in banner colors along tile edges; each has a capital
  and towns, plus free towns in the unclaimed Driftlands.
- **Navigation** — drag to pan (with inertia), scroll to zoom, right-drag to
  orbit, WASD/arrows to pan. Click any hex to travel: the paper token hops
  hex-to-hex along an A* path, and clicking mid-journey re-routes.
- **The paper token** — a flat, canvas-painted "paper" character that
  billboards toward the camera and leans with parallax as the camera pans
  away from it, always drawn on top so it can never be lost behind terrain.
- **Fog of war** — full vision near the token, a dim rim at the edge of
  sight, desaturated "memory" for explored tiles, and drifting mist caps
  over the never-seen. The shroud peels back tile by tile as you travel.
- **Local view** — click the hex you stand on to dive into a diorama of that
  hex: 4–7 procedurally chosen sites (biome-flavored battles; wandering
  carts, stall clusters, or grand markets; ruins, shrines, mystery events,
  vistas, camps). Click a site for its detail card. Mystery events resolve
  with small star-shard outcomes; everything else is flavor for now — no
  progression gating anywhere.
- **Live world touches** — three wandering trader carts hop the map (visit
  their hex to find them in the local view), the volcano's glow pulses, the
  Hollow Star turns at the world's heart, and the whole tile layer breathes.

## Layout

```
index.html          shell + import map
css/style.css       HUD, tooltip, modal, transitions
vendor/three.module.js
src/
  config.js         tunables (map radius, vision range, camera bounds, seed)
  rng.js            seeded PRNG + value noise
  hex.js            axial hex math + A* pathfinding
  names.js          lore tables: biomes, kingdoms, every generated name
  worldgen.js       deterministic world generation
  textures.js       all art, painted onto canvases at runtime
  world3d.js        world-map scene: instanced tiles, fog, landmarks, base
  player.js         the paper token
  cameraRig.js      pan/zoom/orbit controls
  localview.js      the zoomed-in hex diorama
  ui.js             DOM layer
  main.js           bootstrap + interaction wiring
```
