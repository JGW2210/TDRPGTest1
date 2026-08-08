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
A run survives page reloads (saved per-seed in localStorage) and dies with
the wanderer.

## The run loop

You wake in **Starfall Vale** with five **Star Vessels** — your life, drawn
as stars that empty in halves — a staff, two star-charges and no dew to
spare. The disc of Vaeldrift (~6,300 hexes, radius 45) is an archipelago
carved by void rifts into ten region pockets, joined **only** by warded
shallows — each ford sealed by a Warden boss whose tier rises with graph
distance from home (a spanning web + a few cross-links, so routes branch).
Explore your pocket, gather relics, then challenge a Warden to break into
the next pocket; every fallen Warden's shattered ward condenses into a
whole new vessel. Die anywhere and the world burns: new seed, nothing kept.

- **Battles** — Pokémon-style dioramas: your paper token front-left, foes
  back-right on a biome-styled stage. Three attack stances with
  **Paper-Mario timing** — every bar *coalesces* into view before its
  marker flies, fast, and the stronger the stance the harder it reads:
  Swift Cut (generous; a perfect marks an *opening* that buffs your next
  attack), Star Strike (a 3-bar chain), Meteor Edge (a 3-bar chain of
  knife-slits at 1.5× each — skill pays up to 4.5×; perfects pierce wards
  and interrupt wind-ups, one miss shatters the chain). Blocking is a
  **falling-note rhythm**: shapes descend three lanes, press A / S / D as
  each crosses the hit-line — flurries fall as note runs, crushing blows as
  one wide shape you leap, and spiked **trap shapes** thread the pattern in
  the deep (spring one and the feint bites). Brace to slow the storm and
  riposte. Roles (brute, swift, mystic, guard), burn/chill/stun statuses,
  enraging bosses.
- **Star Vessels & Focus** — only genuine mistakes cost stars. A perfect
  *or* good block (and any dodge) nullifies the blow outright; damage
  comes solely from fully missed shapes, failed crush-leaps and sprung
  traps, in fixed half-star chunks that scale by region tier (½★ early,
  1½★ deep; heavies and crushes double it, capped at 3★). Sloppiness
  costs **Focus** instead: a 5-stage meter, full at every battle's start —
  good blocks chip it, misses and landed heavies drain it, perfect blocks
  restore it — and low focus narrows your *attack* windows (never the
  block lanes, so defense stays winnable at any depth). Burns, mystic
  siphons and hexes attack your focus too; vessels are for mistakes
  alone. Vessel gains are rare and deliberate: Warden hearts, a curated
  handful of relics, one errand for the sun.
- **Items** — Binding-of-Isaac-style blind draws from rune pedestals, boss
  drops, and shops. **~200 relics** in biome-linked pools across four
  visible rarities (Common / Uncommon / Rare / Astral, power-budgeted by
  tier), many with downsides (+dodge but less real, +shards but louder,
  a spare vessel traded for a sharper edge), each with a **painted
  sigil-icon** in the pack menu
  beside a portrait of your wanderer as the hoard re-inks them. Draw
  weights shift by source and region depth. Tag pairs ignite **synergies**
  (ember+glass → burning crits; sun+moon → Eclipse; bloom+water →
  Verdance…). Your build *is* your level — no XP.
- **The Constellation of Echoes** — persistent, cross-run progression:
  ~75 relics are in the pools from the start; the other 125 unlock forever
  through 25 feats (fell a deep Warden, stand on all three wandering
  worlds, die repeatedly, walk 600 hexes…). The ✴ Echoes panel tracks it.
- **Procedural audio** — no assets, all WebAudio. An aetherial string
  drone runs continuously, oscillating between two chords chosen for each
  region's character: sus2add6/9 shimmer in the meadows, Lydian #11 in the
  prism fields, Phrygian dominant over the glass dunes, pale maj7 air in
  the tundra, minor-b6 into diminished dread in the ember wastes and all
  tier-4+ pockets. Crossing a causeway morphs the voices over ~6 seconds.
  Each region owns a quiet 4–6 note leitmotif on a biome-flavored chime
  (glass bells, plucks, breath tones). Battles layer heartbeat drums —
  taiko patterns for bosses — over the drone, and every action has a
  synthesized sound. ♪ toggles it all.
- **The farming ceiling** — sites are one-time per run, wilderness hexes
  are sparse (glimmers mark the ones that hold anything), and each pocket
  holds a bounded haul. When a region is picked clean, the only way up is
  through a Warden.
- **Secrets** — ~26 sealed hexes hide inside the rifts. Faint gold cracks
  shimmer on adjacent tiles; stand there and **✸ Detonate** a star-charge
  (also a battle nuke — spend it wisely) to blast the hollow open for a
  pedestal, a shard cache, or a powder keg.
- **Dungeon descents** — every dungeon gate opens onto a three-chamber
  gauntlet: two escalating fights, then the Keeper, with only a breath of
  healing between chambers. The Keeper hoards a guaranteed relic and a
  heavy purse. Flee and you start the descent over.
- **Consumables** — star-dew restores two Star Vessels in or out of battle
  (three, with the right relics), star-charges detonate or nuke, and the
  homing feather whisks you back to Starfall Vale from anywhere.
- **The astral layer** — **Vael, the Undying Sun** burns in a crater at the
  world's heart. Beyond the rim, three satellites orbit — the Pale
  Daughter, Rubidus, and the Viridian Comet — reached by star-bridges from
  the astral shallows, each holding an optional ☠☠☠☠ boss and an astral
  relic (a once-per-run revive among them). Three forgotten islets hide in
  the void behind folded footbridges, and **cosmic mutations** from the
  deep places rewrite your paper body — great power, real cost; carry
  three and the **Wound in the Meridian** tears open, with a deity waiting
  inside and an alternative ending past it.
- **The speaking sky** — every named body above the disc can be *beheld*:
  stand on its vantage hex and the camera leaves your shoulder to go and
  look while it speaks. Sixteen speakers — the sun, the sleeping giant,
  the unshattered Third Sister, a lantern, a door ajar, four
  constellations, two shattered moons, a comet forever mid-errand, and
  the wandering worlds themselves — each cycling through 2–3 dialogue
  sets that never repeat back-to-back and together converge on the story
  of the world: how the daughters were folded from the sun's light, what
  leaned through the Door and snapped the Meridian, and what a paper
  wanderer with a binding-rune on its chest is actually for. Five
  **drowned celestials** rest in the rivers and lakes with voices of
  their own, and four of the sky's speakers hide **errands** in their
  first words — never prompted, only clued: find the keepsake, carry it
  back, and the story pays out (one of them in a whole Star Vessel).
- **Everything else** — four Celestial Court kingdoms with capitals and
  towns, roaming enemy packs with sealed species and their own gaits,
  dungeons, wayshrines, shrine boons and sacrifice bargains, wandering
  trader carts, fog of war with explored-memory, the local hex diorama
  view, and the parallax paper token, repainted as the hoard re-inks it.

## Layout

```
index.html          shell + import map + overlays (battle, inventory, death)
css/style.css       HUD, battle UI, item cards, modals
vendor/three.module.js
src/
  config.js         tunables (map radius, regions, vessels, damage, focus)
  rng.js            seeded PRNG + value noise
  hex.js            axial hex math, lines, A* with blockers
  names.js          lore tables: biomes, courts, foes, sky speakers,
                    drowned celestials, keepsakes, bargains, boons
  items.js          the relic table, pools, synergies, consumables
  run.js            run state: build stats, vessels, keepsakes, gates
  meta.js           the Constellation of Echoes (feats + unlocks)
  save.js           per-seed run persistence
  worldgen.js       regions, rifts, fords+gates, rivers, satellites,
                    islets, the Wound, drowned bodies, sky vantages
  monsters.js       the bestiary: hand-painted species + boss portraits
  textures.js       all other art, painted onto canvases at runtime
  world3d.js        world scene: tiles, fog, landmarks, celestials, labels
  roamers.js        roaming enemy packs
  battle.js         diorama battles: stances, lanes, vessels, focus
  player.js         the paper token
  cameraRig.js      pan/zoom/orbit controls
  localview.js      the zoomed-in hex diorama (sites, pedestals, shops)
  ui.js             DOM layer: HUD, star vessels, modals, item cards
  audio.js          procedural music + sfx (all WebAudio, no assets)
  main.js           bootstrap, travel, sky events, quests, wiring
```
