// The roguelike layer: ~190 relics in biome-linked pools, rarity-tiered
// (c common / u uncommon / r rare / a astral), drawn blind. `core` items are
// in the pools from the first run; the rest join via Echo feats (meta.js).
//
// stat keys: maxHP, atk, spd, luck (crit %), dodge (%), shardGain (%),
//            timingBonus, blockBonus
// flag keys are read by the battle engine / world systems. Combat-rhythm
// flags (round 12): noteSlow (block-shapes fall slower), riposte (perfect
// blocks strike back), trapWard (traps forgiven per battle), chainKeeper
// (chain-saves per battle), heavyPlus (bonus spread across the Meteor Edge
// chain), openingPlus (Swift Cut openings buff the next attack harder),
// gatherCalm (energy coalesces longer — easier reads), dodgePlus (wider
// crush leap-window), poiseful (good Swift Cuts grant poise), interruptGood
// (good Meteors interrupt), veilSight (the sand-veil cannot hide timing).

import { pick } from './rng.js';

const I = (id, pool, rarity, name, def) => ({ id, pool, rarity, name, ...def });

export const ITEMS = [
  // ════════════════════════════════════════════════════════ MEADOW (14) ═══
  I('clover_locket', 'MEADOW', 'u', 'Cloverheart Locket', {
    core: true, stats: { maxHP: 10, atk: -1 }, tags: ['bloom'], flags: { afterBattleHeal: 3 },
    desc: '+10 max HP, −1 ATK. Heal 3 after each battle.',
    flavor: 'Four leaves, three wishes, two owners, one heartbeat.' }),
  I('runeboar_tusk', 'MEADOW', 'c', 'Runeboar Tusk', {
    core: true, stats: { atk: 2 }, tags: [], flags: { chargeDropBonus: 0.15 },
    desc: '+2 ATK. Foes drop star-charges more often.',
    flavor: 'Still warm. Still stubborn.' }),
  I('dawn_thimble', 'MEADOW', 'a', 'Dawn Thimble', {
    core: true, stats: {}, tags: ['sun'], flags: { firstHitPerfect: true },
    desc: 'Your first strike each battle is automatically Perfect.',
    flavor: 'It fits the finger you point with.' }),
  I('lark_feather', 'MEADOW', 'c', 'Lark’s Tail-Feather', {
    core: true, stats: { spd: 2 }, tags: ['bloom'],
    desc: '+2 SPD.',
    flavor: 'The lark has more. The lark is showing off.' }),
  I('hearth_thread', 'MEADOW', 'c', 'Hearth-Spun Thread', {
    core: true, stats: { maxHP: 6 }, tags: ['bloom'],
    desc: '+6 max HP.',
    flavor: 'Wound from the last hour of a good evening.' }),
  I('scythe_charm', 'MEADOW', 'u', 'Little Scythe Charm', {
    stats: { atk: 2 }, tags: ['bloom'], flags: { executeBonus: true },
    desc: '+2 ATK. Deal +50% damage to foes below 30% health.',
    flavor: 'For harvests. Mostly.' }),
  I('dew_ladle', 'MEADOW', 'u', 'Dew-Ladle of the Vale', {
    stats: {}, tags: ['bloom'], flags: { dewPotency: 10 },
    desc: 'Star-dew restores +10 more HP.',
    flavor: 'Scoops deeper than its size suggests. Rude, physics-wise.' }),
  I('picnic_stone', 'MEADOW', 'c', 'The Picnic Stone', {
    stats: { maxHP: 4, spd: 1 }, tags: ['bloom'],
    desc: '+4 max HP, +1 SPD.',
    flavor: 'Every road is shorter after sitting on it.' }),
  I('wisp_lantern', 'MEADOW', 'r', 'Wisp-in-a-Lantern', {
    stats: { luck: 8 }, tags: ['bloom', 'sun'], flags: { visionPlus: 1 },
    desc: '+8% crit. Your vision reaches one hex further.',
    flavor: 'It only pretends to be trapped.' }),
  I('boar_saddle', 'MEADOW', 'u', 'Runeboar War-Saddle', {
    stats: { atk: 3, maxHP: 6, spd: -1 }, tags: ['bloom'],
    desc: '+3 ATK, +6 max HP, −1 SPD.',
    flavor: 'The boar is invisible, absent, or hypothetical. The saddle works regardless.' }),
  I('steady_teapot', 'MEADOW', 'c', 'The Unhurried Teapot', {
    core: true, stats: { maxHP: 4 }, tags: ['bloom'], flags: { noteSlow: 0.1 },
    desc: '+4 max HP. Falling block-shapes descend 10% slower.',
    flavor: 'It has never once boiled early. It will not start for a war.' }),
  I('scarecrow_glove', 'MEADOW', 'u', 'Scarecrow’s Spare Glove', {
    stats: { maxHP: 3 }, tags: ['bloom'], flags: { riposte: 2 },
    desc: '+3 max HP. Perfect blocks answer for 2 damage.',
    flavor: 'It held a pole for forty years. Your wrist is a promotion.' }),
  I('bee_metronome', 'MEADOW', 'r', 'Beekeeper’s Metronome', {
    stats: { timingBonus: 1 }, tags: ['bloom'], flags: { noteSlow: 0.08 },
    desc: 'Timing multipliers +0.15; block-shapes fall 8% slower.',
    flavor: 'The hive keeps 4/4. The honey keeps the metronome.' }),
  I('harvest_bell', 'MEADOW', 'u', 'Harvest Bell', {
    stats: { atk: 1 }, tags: ['sun'], flags: { heavyPlus: 0.3 },
    desc: '+1 ATK. A fully perfect Meteor Edge chain lands +0.3× harder.',
    flavor: 'Rung once at cutting time. Everything that stands, falls.' }),

  // ════════════════════════════════════════════════════════ FOREST (14) ═══
  I('owlbat_whistle', 'FOREST', 'u', 'Owlbat Whistle', {
    core: true, stats: {}, tags: [],
    ability: { id: 'echo_shriek', name: 'Echo Shriek', cd: 3, kind: 'aoe', mult: 0.7, desc: 'Strike every foe for 70% ATK.' },
    desc: 'Grants ability: Echo Shriek (all foes, 70% ATK, 3-turn cooldown).',
    flavor: 'Silent to you. Unforgettable to everyone else.' }),
  I('mosscloak', 'FOREST', 'c', 'Mosscloak', {
    core: true, stats: { dodge: 15, spd: -1 }, tags: ['bloom'],
    desc: '+15% dodge, −1 SPD.',
    flavor: 'Grows on you.' }),
  I('fernking_crown', 'FOREST', 'u', 'The Fern King’s Crown', {
    core: true, stats: { atk: 2, maxHP: 5 }, tags: ['bloom'], flags: { shopMarkup: 0.25 },
    desc: '+2 ATK, +5 max HP. Merchants resent royalty: shop prices +25%.',
    flavor: 'Heavy is the head. Itchy, also.' }),
  I('thorn_ring', 'FOREST', 'u', 'Ring of Patient Thorns', {
    core: true, stats: {}, tags: ['bloom'], flags: { thorns: 2 },
    desc: 'Foes that strike you take 2 damage back.',
    flavor: 'The forest forgives. The ring does not.' }),
  I('bark_shield', 'FOREST', 'r', 'Treant-Bark Buckler', {
    core: true, stats: { maxHP: 5, blockBonus: 1 }, tags: ['bloom'],
    desc: '+5 max HP. Your Block window is 30% wider.',
    flavor: 'Donated. Probably.' }),
  I('spore_pouch', 'FOREST', 'u', 'Sighing Spore Pouch', {
    stats: {}, tags: ['bloom'],
    ability: { id: 'spore_cloud', name: 'Spore Cloud', cd: 4, kind: 'weaken_all', atkDown: 2, desc: 'All foes lose 2 ATK.' },
    desc: 'Grants ability: Spore Cloud (all foes −2 ATK, 4-turn cooldown).',
    flavor: 'Inhale on the exhale. Never the reverse.' }),
  I('owl_eyes', 'FOREST', 'r', 'Borrowed Owl Eyes', {
    stats: { luck: 10 }, tags: ['moon'], flags: { seeIntent: true },
    desc: '+10% crit. You see what each foe intends.',
    flavor: 'The owl insisted. The owl is now a bat, professionally.' }),
  I('root_boots', 'FOREST', 'c', 'Rootbound Boots', {
    stats: { maxHP: 8, spd: -1 }, tags: ['bloom'],
    desc: '+8 max HP, −1 SPD.',
    flavor: 'They anchor beautifully. That is the problem and the point.' }),
  I('murmur_moth', 'FOREST', 'a', 'Murmuring Moth', {
    stats: { dodge: 10 }, tags: ['moon', 'bloom'], flags: { firstStrikeDodge: true },
    desc: '+10% dodge. You always dodge the first blow of each battle.',
    flavor: 'It whispers incoming trajectories, slightly ahead of schedule.' }),
  I('heartwood_flask', 'FOREST', 'u', 'Heartwood Flask', {
    stats: { maxHP: 12 }, tags: ['bloom'], flags: { killHeal: 3 },
    desc: '+12 max HP. Heal 3 whenever a foe falls.',
    flavor: 'Sap of a tree that outlived four empires and one very persistent beaver.' }),
  I('patient_stump', 'FOREST', 'c', 'The Patient Stump', {
    core: true, stats: { maxHP: 5, spd: -1 }, tags: ['bloom'], flags: { noteSlow: 0.12 },
    desc: '+5 max HP, −1 SPD. Block-shapes fall 12% slower.',
    flavor: 'Sit. Watch. The forest has seen every trick fall twice.' }),
  I('trapwise_fern', 'FOREST', 'u', 'Trap-Wise Fern', {
    stats: { dodge: 5 }, tags: ['bloom'], flags: { trapWard: 1 },
    desc: '+5% dodge. The first trap-shape you spring each battle fizzles.',
    flavor: 'It grew back after every deadfall. It knows the click by heart.' }),
  I('woodpecker_tempo', 'FOREST', 'u', 'Woodpecker’s Tempo', {
    stats: { spd: 1 }, tags: ['bloom'], flags: { poiseful: true, openingPlus: 0.15 },
    desc: '+1 SPD. A good Swift Cut counts as perfect (poise + opening), and your openings hit +15% harder.',
    flavor: 'Four beats to the bark, none of them wasted.' }),
  I('deadfall_lesson', 'FOREST', 'r', 'The Deadfall’s Lesson', {
    stats: {}, tags: ['bloom'], flags: { trapWard: 1, riposte: 3 },
    desc: 'Your first sprung trap each battle fizzles; Perfect blocks answer for 3.',
    flavor: 'Taught once, to whatever walked away.' }),

  // ══════════════════════════════════════════════════════ MOUNTAIN (14) ═══
  I('echo_hammer', 'MOUNTAIN', 'r', 'Echo Hammer', {
    core: true, stats: {}, tags: [], flags: { perfectEcho: 0.5 },
    desc: 'Perfect strikes echo, repeating for 50% damage.',
    flavor: 'Every blow lands twice: once on the foe, once on the mountain’s memory.' }),
  I('granite_skin', 'MOUNTAIN', 'u', 'Granite Skin', {
    core: true, stats: { spd: -2 }, tags: [], flags: { firstHitHalved: true },
    desc: 'The first blow you take each battle is halved. −2 SPD.',
    flavor: 'You are 4% gravel now. It suits you.' }),
  I('vertigo_charm', 'MOUNTAIN', 'c', 'Vertigo Charm', {
    core: true, stats: { spd: 3, luck: 5 }, tags: [],
    desc: '+3 SPD, +5% crit.',
    flavor: 'The trick is to fall upward, socially.' }),
  I('anvil_splinter', 'MOUNTAIN', 'c', 'Anvil Splinter', {
    core: true, stats: { atk: 3, spd: -1 }, tags: [],
    desc: '+3 ATK, −1 SPD.',
    flavor: 'A piece of the thing everything else is shaped on.' }),
  I('cairn_finger', 'MOUNTAIN', 'u', 'Cairn-Builder’s Finger', {
    stats: { maxHP: 8 }, tags: [], flags: { blockHeal: 2 },
    desc: '+8 max HP. Perfect Blocks restore 2 HP.',
    flavor: 'Stone remembers being stacked kindly.' }),
  I('eyrie_horn', 'MOUNTAIN', 'u', 'Eyrie Signal-Horn', {
    stats: {}, tags: [],
    ability: { id: 'rally', name: 'Rallying Note', cd: 4, kind: 'heal_self', amount: 10, desc: 'Restore 10 HP.' },
    desc: 'Grants ability: Rallying Note (heal 10, 4-turn cooldown).',
    flavor: 'Someone on some peak always answers. It helps.' }),
  I('avalanche_bell', 'MOUNTAIN', 'r', 'Avalanche Bell', {
    stats: { atk: 2 }, tags: [], flags: { stunOnPerfect: 25 },
    desc: '+2 ATK. Perfect strikes have a 25% chance to stun.',
    flavor: 'Rung once per winter, and never indoors.' }),
  I('summit_sigil', 'MOUNTAIN', 'u', 'Sigil of the Hollow Summit', {
    stats: { atk: 2, maxHP: 8, spd: -2 }, tags: [], flags: { shieldHits: 1 },
    desc: '+2 ATK, +8 max HP, −2 SPD. One extra halved hit each battle.',
    flavor: 'The stair down still goes down. Bring the sigil, not the question.' }),
  I('gremlin_contract', 'MOUNTAIN', 'u', 'Gremlin Toll Contract', {
    stats: { shardGain: 25 }, tags: [], flags: { shopMarkup: 0.15 },
    desc: 'Shard finds +25%, shop prices +15%. Gremlins take their cut both ways.',
    flavor: 'Clause 4 is just the word "slide" underlined heavily.' }),
  I('wyvern_scale_cape', 'MOUNTAIN', 'a', 'Echo Wyvern Scale-Cape', {
    stats: { dodge: 15, spd: 2, atk: 2 }, tags: [],
    desc: '+15% dodge, +2 SPD, +2 ATK.',
    flavor: 'Shed mid-shriek, caught mid-fall, worn mid-legend.' }),
  I('ram_gauntlet', 'MOUNTAIN', 'u', 'Ram-Horn Gauntlet', {
    stats: { atk: 1, spd: -1 }, tags: [], flags: { heavyPlus: 0.4 },
    desc: '+1 ATK, −1 SPD. A fully perfect Meteor Edge chain lands +0.4× harder.',
    flavor: 'The ram apologizes to nothing below the treeline.' }),
  I('ledge_chalk', 'MOUNTAIN', 'c', 'Ledge-Walker’s Chalk', {
    core: true, stats: { spd: 1 }, tags: [], flags: { dodgePlus: 1 },
    desc: '+1 SPD. The leap-window on crushing blows is 25% wider.',
    flavor: 'Marks the spot your feet will need before your eyes agree.' }),
  I('stone_metronome', 'MOUNTAIN', 'r', 'Metronome of Standing Stone', {
    stats: { timingBonus: 1 }, tags: [], flags: { gatherCalm: 0.35 },
    desc: 'Timing multipliers +0.15; your energy gathers 35% longer — more time to read each bar.',
    flavor: 'It ticks in geologic time, rounded down for you.' }),
  I('oxbell', 'MOUNTAIN', 'u', 'Ox-Bell of the High Pass', {
    stats: { atk: 2 }, tags: [], flags: { interruptGood: true },
    desc: '+2 ATK. A good Meteor Edge also knocks apart a gathering blow.',
    flavor: 'The avalanche hears it and, out of respect, waits.' }),

  // ═══════════════════════════════════════════════════════ VOLCANO (14) ═══
  I('emberheart', 'VOLCANO', 'r', 'Emberheart', {
    core: true, stats: {}, tags: ['ember'], flags: { burnOnHit: 2, waterWeak: 2 },
    desc: 'Your strikes Burn (2/turn, 2 turns). Take +2 damage from water foes.',
    flavor: 'A coal that chose you as its fireplace.' }),
  I('choir_coal', 'VOLCANO', 'u', 'Choir Coal', {
    core: true, stats: {}, tags: ['ember'],
    ability: { id: 'cinder_hymn', name: 'Cinder Hymn', cd: 4, kind: 'burn_all', burn: 3, desc: 'Set every foe Burning (3/turn, 3 turns).' },
    desc: 'Grants ability: Cinder Hymn (burn all foes, 4-turn cooldown).',
    flavor: 'It hums in your pack. The key is always dread-minor.' }),
  I('slag_plate', 'VOLCANO', 'c', 'Slag Plate', {
    core: true, stats: { maxHP: 12, spd: -2 }, tags: ['ember'],
    desc: '+12 max HP, −2 SPD.',
    flavor: 'Forged from the volcano’s discarded opinions.' }),
  I('ashen_knuckle', 'VOLCANO', 'c', 'Ashen Knuckle', {
    core: true, stats: { atk: 2, maxHP: 3 }, tags: ['ember'],
    desc: '+2 ATK, +3 max HP.',
    flavor: 'Shake hands with the mountain. Regret is optional.' }),
  I('magma_vein', 'VOLCANO', 'u', 'Bottled Magma Vein', {
    stats: { atk: 3, maxHP: -4 }, tags: ['ember'],
    desc: '+3 ATK, −4 max HP. It leaks warmth you can’t keep.',
    flavor: 'DO NOT SHAKE. Or do — who reads labels this deep?' }),
  I('cinder_censer', 'VOLCANO', 'u', 'Cinder Censer', {
    stats: {}, tags: ['ember'], flags: { burnOnHit: 1 },
    desc: 'Your strikes Burn (1/turn, 2 turns). Stacks with other embers.',
    flavor: 'Swing gently. The smoke writes cursive.' }),
  I('seraph_feather', 'VOLCANO', 'r', 'Magma Seraph’s Pinion', {
    stats: { atk: 2, spd: 2 }, tags: ['ember', 'sun'], flags: { burnDouble: true },
    desc: '+2 ATK, +2 SPD. Your Burn damage is doubled.',
    flavor: 'It fell upward when she molted. You had to climb for it.' }),
  I('obsidian_tongue', 'VOLCANO', 'r', 'Obsidian Tongue', {
    stats: {}, tags: ['ember'],
    ability: { id: 'smelt', name: 'Smelt', cd: 3, kind: 'smite', mult: 1.9, desc: 'One heavy molten strike at 190% ATK.' },
    desc: 'Grants ability: Smelt (one strike, 190% ATK, 3-turn cooldown).',
    flavor: 'Sharp enough to quote you back at yourself.' }),
  I('vesper_bellows', 'VOLCANO', 'u', 'Vesper Bellows', {
    stats: {}, tags: ['ember'], flags: { chargeDmg: 6 },
    desc: 'Star-charges thrown in battle deal +6 damage.',
    flavor: 'It breathes for the fire when the fire forgets.' }),
  I('caldera_crown', 'VOLCANO', 'a', 'Crown of the Caldera Organ', {
    stats: { atk: 4, maxHP: 8 }, tags: ['ember', 'card'], flags: { burnOnHit: 2 },
    desc: '+4 ATK, +8 max HP. Your strikes Burn (2/turn, 2 turns).',
    flavor: 'The Choir’s final chord, cast in cooling stone. Wear the crescendo.' }),
  I('quench_hiss', 'VOLCANO', 'c', 'Quench-Hiss Rhythm', {
    core: true, stats: { maxHP: 4 }, tags: ['ember'], flags: { noteSlow: 0.08 },
    desc: '+4 max HP. Block-shapes fall 8% slower.',
    flavor: 'The forge breathes in. The steel remembers the beat.' }),
  I('brand_iron', 'VOLCANO', 'u', 'Smith’s Branding Iron', {
    stats: { atk: 1 }, tags: ['ember'], flags: { heavyPlus: 0.35 },
    desc: '+1 ATK. A fully perfect Meteor Edge chain lands +0.35× harder.',
    flavor: 'It leaves the same mark on iron, oak and reputations.' }),
  I('slag_counter', 'VOLCANO', 'r', 'Counterweight of Slag', {
    stats: { spd: -1 }, tags: ['ember'], flags: { riposte: 4 },
    desc: '−1 SPD. Perfect blocks answer for 4 damage.',
    flavor: 'What the volcano discards still weighs an argument’s worth.' }),
  I('ash_bead', 'VOLCANO', 'u', 'Ashen Focus-Bead', {
    stats: { luck: 4 }, tags: ['ember'], flags: { gatherCalm: 0.3 },
    desc: '+4% crit. Your energy gathers 30% longer before every bar.',
    flavor: 'Worry it clockwise. The eruption postpones.' }),

  // ════════════════════════════════════════════════════════ DESERT (14) ═══
  I('glass_quill', 'DESERT', 'r', 'Glass Quill', {
    core: true, stats: { luck: 12 }, tags: ['glass'], flags: { critShatter: 2 },
    desc: '+12% crit. Crits shatter: your next strike gains +2 damage.',
    flavor: 'Writes only in past tense.' }),
  I('mirage_veil', 'DESERT', 'u', 'Mirage Veil', {
    core: true, stats: { dodge: 20, maxHP: -5 }, tags: ['glass'],
    desc: '+20% dodge, −5 max HP. You are slightly less real now.',
    flavor: 'Wear it and stand somewhere you are not.' }),
  I('sunbrand', 'DESERT', 'u', 'Sunbrand', {
    core: true, stats: {}, tags: ['sun'], flags: { fullHPAtk: 3 },
    desc: '+3 ATK while at full HP.',
    flavor: 'The mark of noon, which forgives nothing.' }),
  I('dune_compass', 'DESERT', 'c', 'Dune-Swimmer’s Compass', {
    core: true, stats: { spd: 2, luck: 3 }, tags: [],
    desc: '+2 SPD, +3% crit.',
    flavor: 'Points to the nearest exit from any conversation.' }),
  I('bleached_dice', 'DESERT', 'u', 'Sun-Bleached Dice', {
    stats: { luck: 8 }, tags: [],
    ability: { id: 'gamble', name: 'Revenant’s Gamble', cd: 3, kind: 'gamble', desc: 'Strike for anywhere between nothing and 300% ATK.' },
    desc: '+8% crit. Grants ability: Revenant’s Gamble (0–300% ATK, 3-turn cooldown).',
    flavor: 'Carved from something that also gambled.' }),
  I('glasscoil_fang', 'DESERT', 'c', 'Glasscoil Fang', {
    stats: { atk: 2, luck: 6 }, tags: ['glass'],
    desc: '+2 ATK, +6% crit.',
    flavor: 'Transparent about its intentions.' }),
  I('sirocco_skin', 'DESERT', 'c', 'Sirocco Waterskin', {
    stats: { maxHP: 5 }, tags: [], flags: { dewPotency: 5 },
    desc: '+5 max HP. Star-dew restores +5 more.',
    flavor: 'Holds water, wind, and grudges.' }),
  I('tomb_key', 'DESERT', 'r', 'Sun-Tomb Skeleton Key', {
    stats: { shardGain: 20 }, tags: ['sun'], flags: { crackSense: true },
    desc: 'Shard finds +20%. Cracks near sealed hexes glow from memory\'s distance.',
    flavor: 'Fits every lock that has already given up.' }),
  I('mirror_shard_pauldron', 'DESERT', 'r', 'Mirror-Shard Pauldron', {
    stats: { dodge: 10 }, tags: ['glass'], flags: { thorns: 3 },
    desc: '+10% dodge. Foes that strike you take 3 back.',
    flavor: 'They mostly hurt themselves, seeing what they are.' }),
  I('noon_anvil', 'DESERT', 'a', 'The Anvil of Noon', {
    stats: { atk: 5, spd: -2 }, tags: ['sun', 'glass'], flags: { fullHPAtk: 3 },
    desc: '+5 ATK, −2 SPD, +3 more ATK at full HP.',
    flavor: 'Whatever is hammered here keeps its shadow forever.' }),
  I('still_air_lens', 'DESERT', 'r', 'Lens of Still Air', {
    stats: { luck: 4 }, tags: ['glass'], flags: { veilSight: true },
    desc: '+4% crit. The sand-veil can no longer hide your timing.',
    flavor: 'Ground from a noon with no wind in it.' }),
  I('scorpion_hilt', 'DESERT', 'u', 'Scorpion-Hilt Dagger', {
    stats: { luck: 4 }, tags: [], flags: { riposte: 3 },
    desc: '+4% crit. Perfect blocks answer for 3 damage.',
    flavor: 'Strikes back on principle. The principle is spite.' }),
  I('dune_drum', 'DESERT', 'c', 'Dune-Skin Drum', {
    core: true, stats: { spd: 1 }, tags: [], flags: { noteSlow: 0.08 },
    desc: '+1 SPD. Block-shapes fall 8% slower.',
    flavor: 'The dunes march to it, a grain at a time.' }),
  I('viper_patience', 'DESERT', 'r', 'The Viper’s Patience', {
    stats: { spd: -1 }, tags: [], flags: { heavyPlus: 0.5 },
    desc: '−1 SPD. A fully perfect Meteor Edge chain lands +0.5× harder.',
    flavor: 'Hours of stillness, priced into one motion.' }),

  // ════════════════════════════════════════════════════════ TUNDRA (14) ═══
  I('frostmarrow_ring', 'TUNDRA', 'u', 'Frostmarrow Ring', {
    core: true, stats: {}, tags: ['moon'], flags: { chillOnHit: 1 },
    desc: 'Your strikes Chill, stacking −1 to the foe’s ATK.',
    flavor: 'Cold enough to slow an argument.' }),
  I('pale_hound_card', 'TUNDRA', 'r', 'Pale Card: “The Hound”', {
    core: true, stats: {}, tags: ['card', 'moon'], flags: { houndStrike: 6 },
    desc: 'As each battle begins, the Hound is dealt: 6 damage to a random foe.',
    flavor: 'It is drawn. It was always going to be drawn.' }),
  I('sleet_mantle', 'TUNDRA', 'r', 'Sleet Mantle', {
    core: true, stats: { blockBonus: 1 }, tags: ['moon'],
    desc: 'Your Block window is 30% wider.',
    flavor: 'The storm signs its work; this is a forgery good enough to fool it.' }),
  I('auroral_thread', 'TUNDRA', 'c', 'Auroral Thread', {
    core: true, stats: { maxHP: 5, dodge: 5 }, tags: ['moon'],
    desc: '+5 max HP, +5% dodge.',
    flavor: 'Sewn into your hem, the sky keeps half an eye on you.' }),
  I('pale_tower_card', 'TUNDRA', 'u', 'Pale Card: “The Tower”', {
    stats: { atk: 3, maxHP: -3 }, tags: ['card'],
    desc: '+3 ATK, −3 max HP. Something always falls.',
    flavor: 'Reversed, it means the same thing, faster.' }),
  I('hibernal_fat', 'TUNDRA', 'c', 'Hibernal Reserve', {
    stats: { maxHP: 14, spd: -2 }, tags: [],
    desc: '+14 max HP, −2 SPD.',
    flavor: 'The mammoths’ secret is that winter is a meal.' }),
  I('stag_antler_tip', 'TUNDRA', 'u', 'Frostmarrow Antler-Tip', {
    stats: { atk: 2 }, tags: ['moon'], flags: { chillOnHit: 1 },
    desc: '+2 ATK. Your strikes Chill (stacking −1 foe ATK).',
    flavor: 'Shed in courtship, gathered in war.' }),
  I('pale_moon_card', 'TUNDRA', 'u', 'Pale Card: “The Moon”', {
    stats: { luck: 8, dodge: 8 }, tags: ['card', 'moon'],
    desc: '+8% crit, +8% dodge.',
    flavor: 'The deck’s favorite. The deck denies having favorites.' }),
  I('white_silence', 'TUNDRA', 'r', 'A White Silence', {
    stats: {}, tags: ['moon'],
    ability: { id: 'hush', name: 'Hush', cd: 5, kind: 'stun', desc: 'A foe forgets its next turn in perfect quiet.' },
    desc: 'Grants ability: Hush (stun one foe, 5-turn cooldown).',
    flavor: 'Carried in a locket. Opened only outdoors, only once, only ever.' }),
  I('glacier_heart', 'TUNDRA', 'a', 'Heart of the Long White', {
    stats: { maxHP: 20 }, tags: ['moon'], flags: { firstHitHalved: true },
    desc: '+20 max HP. The first blow you take each battle is halved.',
    flavor: 'It beats once per season. That is enough.' }),
  I('icicle_chimes', 'TUNDRA', 'u', 'Icicle Chime-Row', {
    stats: {}, tags: ['moon'], flags: { noteSlow: 0.1 },
    desc: 'Block-shapes fall 10% slower.',
    flavor: 'Winter’s glockenspiel. Play gently or wear it.' }),
  I('long_white_stance', 'TUNDRA', 'r', 'Stance of the Long White', {
    stats: { blockBonus: 1 }, tags: ['moon'], flags: { poiseful: true, openingPlus: 0.15 },
    desc: 'Block windows 30% wider; a good Swift Cut counts as perfect, and your openings hit +15% harder.',
    flavor: 'The stillness between snowfalls, taught as footwork.' }),
  I('sleet_visor', 'TUNDRA', 'c', 'Sleet Visor', {
    core: true, stats: { maxHP: 3 }, tags: ['moon'], flags: { dodgePlus: 1 },
    desc: '+3 max HP. The leap-window on crushing blows is 25% wider.',
    flavor: 'See the storm the way the storm sees you: briefly.' }),
  I('held_breath', 'TUNDRA', 'u', 'A Breath, Held', {
    stats: { maxHP: 5 }, tags: ['moon'], flags: { gatherCalm: 0.3 },
    desc: '+5 max HP. Your energy gathers 30% longer before every bar.',
    flavor: 'Let out in spring, it will have opinions.' }),

  // ═══════════════════════════════════════════════════════════ SEA (14) ═══
  I('siren_scale', 'SEA', 'u', 'Siren Scale', {
    core: true, stats: {}, tags: ['water'], flags: { perfectHeal: 3 },
    desc: 'Perfect strikes restore 3 HP.',
    flavor: 'Still singing, very quietly, about you.' }),
  I('fathom_pearl', 'SEA', 'u', 'Fathom Pearl', {
    core: true, stats: { maxHP: 5, atk: 1, spd: 1, luck: 5, shardGain: -33 }, tags: ['water'],
    desc: '+5 HP, +1 ATK, +1 SPD, +5% crit — but shard finds −33%.',
    flavor: 'Everything the deep owns, it lends at interest.' }),
  I('anglers_lure', 'SEA', 'u', 'Void Angler’s Lure', {
    core: true, stats: {}, tags: ['water'], flags: { fewerFoes: true },
    desc: 'Wild battles muster one fewer foe (minimum 1).',
    flavor: 'Whatever it is fishing for, it is not you. Probably.' }),
  I('brine_censer', 'SEA', 'c', 'Brine Censer', {
    core: true, stats: { maxHP: 6, dodge: 4 }, tags: ['water'],
    desc: '+6 max HP, +4% dodge.',
    flavor: 'Smells like a storm deciding against it.' }),
  I('undertow_bottle', 'SEA', 'u', 'The Undertow, Bottled', {
    stats: {}, tags: ['water'],
    ability: { id: 'undertow', name: 'Undertow', cd: 4, kind: 'leech', mult: 0.9, desc: 'Strike for 90% ATK and drink the damage as HP.' },
    desc: 'Grants ability: Undertow (90% ATK, heal for damage dealt, 4-turn cooldown).',
    flavor: 'Uncork away from anything you plan to keep.' }),
  I('tide_ledger', 'SEA', 'c', 'Tide Ledger', {
    stats: { shardGain: 20 }, tags: ['water'],
    desc: 'Shard finds +20%.',
    flavor: 'What goes out comes back with arithmetic.' }),
  I('reflection_locket', 'SEA', 'c', 'Locket of Your Reflection', {
    stats: { dodge: 12 }, tags: ['water', 'glass'],
    desc: '+12% dodge.',
    flavor: 'It ducks a half-second before you need to.' }),
  I('drowned_star_chart', 'SEA', 'r', 'Drowned Star-Chart', {
    stats: { spd: 2 }, tags: ['water'], flags: { visionPlus: 1, fastTravel: true },
    desc: '+2 SPD, +1 vision, and you hop the world map much faster.',
    flavor: 'Maps the sky as the sea remembers it: upside down and grieving.' }),
  I('leviathan_tooth', 'SEA', 'r', 'Leviathan Milk-Tooth', {
    stats: { atk: 4 }, tags: ['water'], flags: { executeBonus: true },
    desc: '+4 ATK. Deal +50% damage to foes below 30% health.',
    flavor: 'From when it was small. It is not small.' }),
  I('abyssal_bell', 'SEA', 'a', 'The Abyssal Bell', {
    stats: { maxHP: 10, atk: 2 }, tags: ['water', 'moon'], flags: { houndStrike: 8 },
    desc: '+10 max HP, +2 ATK. Each battle opens with the Bell tolling 8 damage.',
    flavor: 'Rung at the bottom, heard at the top, answered in between.' }),
  I('tide_metronome', 'SEA', 'u', 'Metronome of the Tides', {
    stats: {}, tags: ['water'], flags: { noteSlow: 0.12 },
    desc: 'Block-shapes fall 12% slower.',
    flavor: 'Two beats a day, but such beats.' }),
  I('coral_comb', 'SEA', 'u', 'Coral Parrying-Comb', {
    stats: {}, tags: ['water'], flags: { riposte: 3 },
    desc: 'Perfect blocks answer for 3 damage.',
    flavor: 'The reef’s whole strategy: be sharp, be patient, be many.' }),
  I('divers_breath', 'SEA', 'c', 'Pearl-Diver’s Breath', {
    core: true, stats: { maxHP: 4 }, tags: ['water'], flags: { gatherCalm: 0.25 },
    desc: '+4 max HP. Your energy gathers 25% longer before every bar.',
    flavor: 'Measured in heartbeats you agreed not to spend.' }),
  I('undertow_answer', 'SEA', 'r', 'The Undertow’s Answer', {
    stats: { spd: -1 }, tags: ['water'], flags: { riposte: 5 },
    desc: '−1 SPD. Perfect blocks answer for 5 damage.',
    flavor: 'Pull it, and be pulled. Everyone signs the same wave.' }),

  // ═══════════════════════════════════════════════════════ CRYSTAL (14) ═══
  I('prism_core', 'CRYSTAL', 'r', 'Prism Core', {
    core: true, stats: { timingBonus: 1 }, tags: ['glass'],
    desc: 'All your timing multipliers are raised by +0.15.',
    flavor: 'Light enters confused and leaves determined.' }),
  I('chime_shard', 'CRYSTAL', 'u', 'Chime Shard', {
    core: true, stats: {}, tags: ['glass'],
    ability: { id: 'resonance', name: 'Resonance', cd: 4, kind: 'stun', desc: 'Ring a foe’s bones: it loses its next turn.' },
    desc: 'Grants ability: Resonance (stun one foe, 4-turn cooldown).',
    flavor: 'Struck once, it rings forever; the trick is aiming the forever.' }),
  I('facet_eye', 'CRYSTAL', 'r', 'Facet Eye', {
    core: true, stats: { luck: 10 }, tags: ['glass'], flags: { seeIntent: true },
    desc: '+10% crit. You see what each foe intends to do next.',
    flavor: 'Blink schedule: never.' }),
  I('tuning_spar', 'CRYSTAL', 'r', 'Tuning Spar', {
    core: true, stats: { timingBonus: 1 }, tags: ['glass'],
    desc: 'All your timing multipliers are raised by +0.15.',
    flavor: 'Hum first. It corrects you kindly.' }),
  I('refracted_coin', 'CRYSTAL', 'c', 'Refracted Coin', {
    stats: { luck: 6, shardGain: 10 }, tags: ['glass'],
    desc: '+6% crit, +10% shard finds.',
    flavor: 'Lands on all its edges at once.' }),
  I('widow_chime', 'CRYSTAL', 'u', 'The Widow’s Smallest Chime', {
    stats: { atk: 2 }, tags: ['glass'], flags: { stunOnPerfect: 20 },
    desc: '+2 ATK. Perfect strikes have a 20% chance to stun.',
    flavor: 'She has larger ones. Pray she keeps to the small.' }),
  I('lattice_veins', 'CRYSTAL', 'r', 'Lattice Veins', {
    stats: { maxHP: 8 }, tags: ['glass'], flags: { perfectHeal: 2 },
    desc: '+8 max HP. Perfect strikes restore 2 HP.',
    flavor: 'Your blood learns symmetry. Your heart keeps 4/4 anyway.' }),
  I('golem_kernel', 'CRYSTAL', 'u', 'Shard-Golem Kernel', {
    stats: { maxHP: 10, spd: -1 }, tags: ['glass'], flags: { thorns: 2 },
    desc: '+10 max HP, −1 SPD. Foes that strike you take 2 back.',
    flavor: 'It wants to be a golem again. For now, be its golem.' }),
  I('prophecy_prism', 'CRYSTAL', 'r', 'Prism of Mild Prophecy', {
    stats: { luck: 6, dodge: 6 }, tags: ['glass'], flags: { seeIntent: true, crackSense: true },
    desc: '+6% crit, +6% dodge, see foe intents, and sense sealed hexes further.',
    flavor: 'Foretells the next four seconds with total accuracy and no context.' }),
  I('facet_crown', 'CRYSTAL', 'a', 'The Facet Crown', {
    stats: { timingBonus: 2, luck: 8 }, tags: ['glass', 'card'],
    desc: 'Timing multipliers +0.30, +8% crit.',
    flavor: 'Refracts intention into execution. Kings wept for less.' }),
  I('facet_pendulum', 'CRYSTAL', 'r', 'Facet Pendulum', {
    stats: { timingBonus: 1 }, tags: ['glass'], flags: { noteSlow: 0.1 },
    desc: 'Timing multipliers +0.15; block-shapes fall 10% slower.',
    flavor: 'Swings forever; forgives once per swing.' }),
  I('chime_of_keys', 'CRYSTAL', 'u', 'Chime of Three Keys', {
    core: true, stats: { luck: 4 }, tags: ['glass'], flags: { trapWard: 1 },
    desc: '+4% crit. The first trap you spring each battle rings harmless.',
    flavor: 'A, S and D, tuned a hair apart, agreeing about you.' }),
  I('prism_edge', 'CRYSTAL', 'u', 'Prism Counter-Edge', {
    stats: {}, tags: ['glass'], flags: { riposte: 3 },
    desc: 'Perfect blocks answer for 3 damage.',
    flavor: 'Light enters an argument and leaves a verdict.' }),
  I('resonant_core', 'CRYSTAL', 'r', 'The Resonant Core', {
    stats: { timingBonus: 1 }, tags: ['glass'], flags: { gatherCalm: 0.3 },
    desc: 'Timing multipliers +0.15; your energy gathers 30% longer.',
    flavor: 'It hums the note before the note. Follow it in.' }),

  // ═══════════════════════════════════════════════════════════ ANY (49) ═══
  I('shard_purse', 'ANY', 'u', 'Star-Shard Purse', {
    core: true, stats: { shardGain: 50 }, tags: [], flags: { extraFoeChance: 0.25 },
    desc: 'Shard finds +50%. Trouble finds you too: +25% chance of an extra foe.',
    flavor: 'It jingles. Everything within a mile knows it jingles.' }),
  I('boots_remember', 'ANY', 'c', 'Boots That Remember', {
    core: true, stats: { spd: 2 }, tags: [], flags: { fastTravel: true },
    desc: '+2 SPD. You hop the world map much faster.',
    flavor: 'They know the way home. They are simply not telling.' }),
  I('patient_comet', 'ANY', 'r', 'The Patient Comet', {
    core: true, stats: {}, tags: ['sun'], flags: { extraActionEvery: 4 },
    desc: 'Every 4th turn, take a second action.',
    flavor: 'It has waited nine thousand years. It can wait for your turn.' }),
  I('reassuring_pebble', 'ANY', 'c', 'A Very Reassuring Pebble', {
    core: true, stats: { maxHP: 5 }, tags: [],
    desc: '+5 max HP. It’s going to be okay.',
    flavor: 'Smooth. Round. Unshakeably on your side.' }),
  I('travel_kettle', 'ANY', 'c', 'Traveller’s Kettle', {
    core: true, stats: { maxHP: 4 }, tags: [], flags: { afterBattleHeal: 2 },
    desc: '+4 max HP. Heal 2 after each battle.',
    flavor: 'Boils on spite alone.' }),
  I('spare_string', 'ANY', 'r', 'A Spare String', {
    core: true, stats: { timingBonus: 1 }, tags: [],
    desc: 'Timing multipliers +0.15.',
    flavor: 'For the instrument you are, apparently.' }),
  I('left_glove', 'ANY', 'c', 'The Left Glove', {
    core: true, stats: { atk: 1, luck: 4 }, tags: [],
    desc: '+1 ATK, +4% crit.',
    flavor: 'Its partner is out there, being right about everything.' }),
  I('rune_eraser', 'ANY', 'u', 'Rune Eraser', {
    core: true, stats: {}, tags: [], flags: { fleeSure: true },
    desc: 'Fleeing always succeeds. You un-write yourself from the fight.',
    flavor: 'Controversial among historians.' }),
  I('folded_map', 'ANY', 'c', 'A Map, Badly Folded', {
    core: true, stats: { spd: 1 }, tags: [], flags: { visionPlus: 1 },
    desc: '+1 SPD, +1 vision range.',
    flavor: 'The creases have become roads. Some of the roads work.' }),
  I('humble_knife', 'ANY', 'c', 'Humble Paring Knife', {
    core: true, stats: { atk: 2 }, tags: [],
    desc: '+2 ATK.',
    flavor: 'Peels apples, pretensions, and — at need — fates.' }),
  I('wax_seal', 'ANY', 'c', 'Unbroken Wax Seal', {
    core: true, stats: { maxHP: 3, dodge: 3 }, tags: [],
    desc: '+3 max HP, +3% dodge.',
    flavor: 'Whatever letter it kept shut, keep it shut.' }),
  I('chalk_stub', 'ANY', 'c', 'Surveyor’s Chalk Stub', {
    core: true, stats: { shardGain: 15 }, tags: [],
    desc: 'Shard finds +15%.',
    flavor: 'Marks what is owed. The world squares up eventually.' }),
  I('tin_soldier', 'ANY', 'u', 'Tin Soldier, Retired', {
    core: true, stats: { maxHP: 6, atk: 1 }, tags: [], flags: { shieldHits: 1 },
    desc: '+6 max HP, +1 ATK. One extra halved hit each battle.',
    flavor: 'Stands where you tell it. Falls where it chooses.' }),
  I('moth_lantern', 'ANY', 'c', 'Moth-Tender’s Lantern', {
    core: true, stats: { luck: 6 }, tags: ['moon'],
    desc: '+6% crit.',
    flavor: 'The moths do the aiming.' }),
  I('borrowed_time', 'ANY', 'r', 'Borrowed Time (Overdue)', {
    stats: { spd: 4 }, tags: [], flags: { extraFoeChance: 0.15 },
    desc: '+4 SPD, but trouble collects: +15% chance of an extra foe.',
    flavor: 'The interest compounds hourly, somewhere.' }),
  I('second_shadow', 'ANY', 'r', 'A Second Shadow', {
    stats: { dodge: 10 }, tags: ['moon'], flags: { doubleStrike: 20 },
    desc: '+10% dodge. 20% chance your strikes land twice (half damage echo).',
    flavor: 'It copies you a half-beat late, and better.' }),
  I('pocket_eclipse', 'ANY', 'r', 'Pocket Eclipse', {
    stats: { atk: 2, luck: 6 }, tags: ['sun', 'moon'],
    desc: '+2 ATK, +6% crit. Counts as both sun and moon.',
    flavor: 'Do not open both hands at once.' }),
  I('marching_drum', 'ANY', 'c', 'Ghost Marching-Drum', {
    stats: { atk: 1, spd: 2 }, tags: [],
    desc: '+1 ATK, +2 SPD.',
    flavor: 'Its regiment still keeps step, thinly.' }),
  I('glutton_tankard', 'ANY', 'u', 'Glutton’s Tankard', {
    stats: { maxHP: 8 }, tags: [], flags: { dewPotency: 8 },
    desc: '+8 max HP. Star-dew restores +8 more.',
    flavor: 'Bottomless is a strong word. Thorough, though.' }),
  I('bandolier', 'ANY', 'u', 'Firework Bandolier', {
    stats: {}, tags: ['ember'], flags: { chargeDropBonus: 0.2, chargeDmg: 4 },
    desc: 'Foes drop star-charges more often; charges deal +4 in battle.',
    flavor: 'Festive is a defensible legal category.' }),
  I('grave_bell_clapper', 'ANY', 'u', 'Grave-Bell Clapper', {
    stats: { atk: 2 }, tags: [], flags: { killHeal: 2 },
    desc: '+2 ATK. Heal 2 whenever a foe falls.',
    flavor: 'It rings inward now.' }),
  I('star_atlas_torn', 'ANY', 'c', 'Torn Page of a Star-Atlas', {
    stats: { luck: 5, spd: 1 }, tags: [],
    desc: '+5% crit, +1 SPD.',
    flavor: 'The missing half maps the mistakes.' }),
  I('vagrant_ring', 'ANY', 'c', 'Vagrant’s Iron Ring', {
    stats: { maxHP: 4, atk: 1 }, tags: [],
    desc: '+4 max HP, +1 ATK.',
    flavor: 'Passed hand to hand until hands improved.' }),
  I('lucky_bones', 'ANY', 'u', 'Lucky Knucklebones', {
    stats: { luck: 10, atk: -1 }, tags: [],
    desc: '+10% crit, −1 ATK. Fortune favors the light-fisted.',
    flavor: 'Whose? Theirs, once. Yours, now. Luck moves.' }),
  I('hourglass_cracked', 'ANY', 'r', 'Cracked Hourglass', {
    stats: {}, tags: [], flags: { extraActionEvery: 5 },
    desc: 'Every 5th turn, take a second action. Sand leaks sideways into now.',
    flavor: 'Time noticed the crack and politely says nothing.' }),
  I('debt_collector_badge', 'ANY', 'u', 'Debt-Collector’s Badge', {
    stats: { shardGain: 30 }, tags: [], flags: { killShard: 1 },
    desc: 'Shard finds +30%, +1 shard per felled foe.',
    flavor: 'The Meridian owes. You collect.' }),
  I('paper_armor', 'ANY', 'c', 'Folded Paper Armor', {
    stats: { maxHP: 9, dodge: -5 }, tags: [],
    desc: '+9 max HP, −5% dodge. Crinkles heroically.',
    flavor: 'Surprisingly effective, insultingly loud.' }),
  I('whetstone_quiet', 'ANY', 'c', 'Whetstone Made of Quiet', {
    stats: { atk: 2, spd: -1 }, tags: [],
    desc: '+2 ATK, −1 SPD.',
    flavor: 'Sharpens blades and attention spans.' }),
  I('third_lung', 'ANY', 'c', 'A Third Lung', {
    stats: { maxHP: 7, spd: 1 }, tags: [],
    desc: '+7 max HP, +1 SPD.',
    flavor: 'Where do you keep it? Wrong question. Where does it keep you?' }),
  I('nettle_wine', 'ANY', 'c', 'Nettle Wine, Vintage Rift', {
    stats: { atk: 2, maxHP: 4, dodge: -4 }, tags: ['bloom'],
    desc: '+2 ATK, +4 max HP, −4% dodge.',
    flavor: 'Bold, punishing, notes of regret and juniper.' }),
  I('clockwork_tick', 'ANY', 'r', 'Clockwork Cricket', {
    stats: { timingBonus: 1, spd: 1 }, tags: [], flags: { openingPlus: 0.1 },
    desc: 'Timing multipliers +0.15, +1 SPD, and your Swift Cut openings hit +10% harder.',
    flavor: 'Wind it and the whole world keeps better time.' }),
  I('gamblers_iou', 'ANY', 'u', 'A Gambler’s IOU', {
    stats: { luck: 14, shardGain: -20 }, tags: [],
    desc: '+14% crit, −20% shard finds.',
    flavor: 'Signed in someone else’s hand. Cash it carefully.' }),
  I('candle_endless', 'ANY', 'r', 'The Unlit Candle’s Twin', {
    stats: { maxHP: 10 }, tags: ['card'], flags: { blockHeal: 2 },
    desc: '+10 max HP. Perfect Blocks restore 2 HP.',
    flavor: 'It burns exactly when its sibling does not. So: now.' }),
  I('rumor_earring', 'ANY', 'c', 'Rumor-Catcher Earring', {
    stats: { luck: 4, shardGain: 8 }, tags: [],
    desc: '+4% crit, +8% shard finds.',
    flavor: 'Hears where the shards fell and what they said on the way down.' }),
  I('practice_sword', 'ANY', 'u', 'Practice Sword (Graduated)', {
    stats: { atk: 1, timingBonus: 1 }, tags: [], flags: { openingPlus: 0.1 },
    desc: '+1 ATK, timing multipliers +0.15, and your Swift Cut openings hit +10% harder.',
    flavor: 'Wood that studied. Wood that passed.' }),
  I('shoulder_gargoyle', 'ANY', 'u', 'Pocket Gargoyle', {
    stats: { maxHP: 5 }, tags: [], flags: { thorns: 2 },
    desc: '+5 max HP. Foes that strike you take 2 back.',
    flavor: 'Perches, glowers, bites precisely once per grievance.' }),
  I('festival_mask', 'ANY', 'u', 'Festival Mask of the Meridian', {
    stats: { dodge: 8, luck: 4 }, tags: [],
    desc: '+8% dodge, +4% crit.',
    flavor: 'Worn on the night the world broke. It remembers the dance steps.' }),
  I('needle_compass', 'ANY', 'r', 'Needle That Points at Trouble', {
    stats: { atk: 3 }, tags: [], flags: { seeIntent: true },
    desc: '+3 ATK. You see what each foe intends.',
    flavor: 'Never lost, frequently alarmed.' }),
  I('rust_locket', 'ANY', 'c', 'Rusted Locket (Stuck)', {
    stats: { maxHP: 6, luck: -3 }, tags: [],
    desc: '+6 max HP, −3% crit. Whatever is inside is staying inside.',
    flavor: 'Shake it and something inside shakes back, half a beat late.' }),
  I('star_snuffbox', 'ANY', 'r', 'Star-Snuff Box', {
    stats: { atk: 2 }, tags: ['sun'], flags: { perfectShard: 1 },
    desc: '+2 ATK. Perfect strikes shake loose 1 star-shard.',
    flavor: 'Sneezing constellations is considered good manners here.' }),
  I('hollow_die', 'ANY', 'u', 'Hollow Die', {
    stats: {}, tags: [],
    ability: { id: 'hollow_roll', name: 'Hollow Roll', cd: 4, kind: 'gamble', desc: 'Strike for 0–300% ATK. The die is honest about nothing.' },
    desc: 'Grants ability: Hollow Roll (0–300% ATK, 4-turn cooldown).',
    flavor: 'Six faces, no numbers, total conviction.' }),
  I('midnight_office', 'ANY', 'r', 'Seal of the Midnight Office', {
    stats: { atk: 2, maxHP: 6 }, tags: ['moon', 'card'],
    desc: '+2 ATK, +6 max HP. Counts as moon and card.',
    flavor: 'The bureaucracy that files eclipses. Terrifyingly punctual.' }),
  I('one_good_deed', 'ANY', 'a', 'One Good Deed (Unspent)', {
    stats: {}, tags: [], flags: { reviveOnce: true },
    desc: 'Once per run, death declines you: revive at half HP.',
    flavor: 'You did it long ago. The world has been carrying the change.' }),
  I('drummers_creed', 'ANY', 'u', 'Drummer’s Creed', {
    core: true, stats: { spd: 1 }, tags: [], flags: { chainKeeper: 1 },
    desc: '+1 SPD. Once per battle, a slipped Star Strike chain holds anyway.',
    flavor: 'The beat goes on. That is the entire creed.' }),
  I('metronome_heart', 'ANY', 'r', 'A Metronome Heart', {
    stats: { timingBonus: 1 }, tags: [], flags: { noteSlow: 0.1 },
    desc: 'Timing multipliers +0.15; block-shapes fall 10% slower.',
    flavor: 'It does not skip. It has never once skipped.' }),
  I('sparring_shadow', 'ANY', 'c', 'Invisible Sparring Partner', {
    core: true, stats: {}, tags: [], flags: { riposte: 2 },
    desc: 'Perfect blocks answer for 2 damage.',
    flavor: 'Twenty years of practice, none of it visible, all of it yours.' }),
  I('duellist_primer', 'ANY', 'c', 'Old Duellist’s Primer', {
    core: true, stats: { luck: 3 }, tags: [], flags: { dodgePlus: 1 },
    desc: '+3% crit. The leap-window on crushing blows is 25% wider.',
    flavor: 'Chapter one: be elsewhere. There is no chapter two.' }),
  I('juggler_gloves', 'ANY', 'u', 'Juggler’s Soft Gloves', {
    stats: { spd: 1 }, tags: [], flags: { trapWard: 1 },
    desc: '+1 SPD. The first trap you spring each battle fizzles.',
    flavor: 'They have caught worse than knives. They have caught opinions.' }),
  I('held_warhorn', 'ANY', 'r', 'Warhorn of the Held Breath', {
    stats: {}, tags: [], flags: { interruptGood: true, heavyPlus: 0.25 },
    desc: 'A good Meteor Edge interrupts a gathering blow; a fully perfect Meteor chain lands +0.25× harder.',
    flavor: 'Blown at the top of the charge, or never.' }),

  // ═════════════════════════════════════════════════════════ BOSS (14) ═══
  I('wardens_sigil', 'BOSS', 'u', 'Warden’s Sigil', {
    core: true, stats: { atk: 3, maxHP: 10 }, tags: [],
    desc: '+3 ATK, +10 max HP.',
    flavor: 'Authority, transferable upon defeat. See reverse for terms.' }),
  I('sundered_crown', 'BOSS', 'r', 'The Sundered Crown', {
    core: true, stats: { maxHP: -5 }, tags: ['card'], flags: { cooldownMinus: 1 },
    desc: 'Ability cooldowns −1 turn. −5 max HP: crowns are heavy, even broken.',
    flavor: 'Its former head insists this is all part of the plan.' }),
  I('meridian_compass', 'BOSS', 'r', 'Meridian Compass', {
    core: true, stats: { spd: 1 }, tags: [], flags: { revealRegion: true },
    desc: '+1 SPD. Entering a region charts it all into hazy memory.',
    flavor: 'It points to where you will eventually have been.' }),
  I('gate_splinter', 'BOSS', 'r', 'Splinter of a Broken Ward', {
    core: true, stats: { maxHP: 8, blockBonus: 1 }, tags: [],
    desc: '+8 max HP. Your Block window is 30% wider.',
    flavor: 'The ward remembers holding. Now it holds for you.' }),
  I('wardens_gavel', 'BOSS', 'r', 'The Warden’s Gavel', {
    stats: { atk: 4 }, tags: [], flags: { stunOnPerfect: 20 },
    desc: '+4 ATK. Perfect strikes have a 20% chance to stun.',
    flavor: 'Order! Order is what it hits you with.' }),
  I('toll_takers_till', 'BOSS', 'u', 'Toll-Taker’s Till', {
    stats: { shardGain: 40 }, tags: [], flags: { killShard: 1 },
    desc: 'Shard finds +40%, +1 shard per felled foe.',
    flavor: 'The causeway toll, redirected. The causeway does not miss it.' }),
  I('oath_unbroken', 'BOSS', 'r', 'An Oath, Unbroken', {
    stats: { maxHP: 12, atk: 2 }, tags: [], flags: { shieldHits: 1 },
    desc: '+12 max HP, +2 ATK. One extra halved hit each battle.',
    flavor: 'Sworn by someone stronger. Kept, now, by you.' }),
  I('keepers_ledger', 'BOSS', 'r', 'The Keeper’s Ledger', {
    stats: { luck: 8, shardGain: 20 }, tags: ['card'], flags: { crackSense: true },
    desc: '+8% crit, +20% shard finds, and sealed hexes whisper louder.',
    flavor: 'Every hoard it ever guarded, itemized. Yours are page one now.' }),
  I('champions_belt', 'BOSS', 'u', 'The Proving-Ring Belt', {
    stats: { atk: 2, maxHP: 6, spd: 1 }, tags: [],
    desc: '+2 ATK, +6 max HP, +1 SPD.',
    flavor: 'Undefeated, twice-defeated, thrice-reigning. The belt keeps its own count.' }),
  I('warden_last_word', 'BOSS', 'a', 'The Warden’s Last Word', {
    stats: { atk: 3 }, tags: [],
    ability: { id: 'last_word', name: 'The Last Word', cd: 5, kind: 'smite', mult: 2.6, desc: 'Say it. 260% ATK, once per argument.' },
    desc: '+3 ATK. Grants ability: The Last Word (260% ATK, 5-turn cooldown).',
    flavor: 'It was “no.” It is always “no.” Now it is your “no.”' }),
  I('tier_stone', 'BOSS', 'r', 'Tierstone', {
    stats: { maxHP: 5 }, tags: [], flags: { deepPower: true },
    desc: '+5 max HP, +1 ATK per region tier you stand in.',
    flavor: 'Heavier near home, lighter in the deep. It wants you out there.' }),
  I('frenzy_drum', 'BOSS', 'r', 'War-Drum of the Choir', {
    stats: {}, tags: ['ember'],
    ability: { id: 'frenzy', name: 'Crescendo', cd: 3, kind: 'frenzy', atkUp: 2, selfDmg: 3, desc: '+2 ATK for this battle; the drum takes 3 HP as payment.' },
    desc: 'Grants ability: Crescendo (+2 ATK stacking per use, costs 3 HP, 3-turn cooldown).',
    flavor: 'It only knows one direction.' }),
  I('wardens_tempo', 'BOSS', 'r', 'The Warden’s Tempo', {
    core: true, stats: { blockBonus: 1 }, tags: [], flags: { noteSlow: 0.15 },
    desc: 'Block windows 30% wider; block-shapes fall 15% slower.',
    flavor: 'A thousand years at one gate teaches you every rhythm that can approach it.' }),
  I('gatecrusher', 'BOSS', 'r', 'The Gatecrusher’s Memory', {
    stats: { atk: 1, spd: -1 }, tags: [], flags: { heavyPlus: 0.6 },
    desc: '+1 ATK, −1 SPD. A fully perfect Meteor Edge chain lands +0.6× harder.',
    flavor: 'Somewhere, a door is still falling.' }),

  // ═══════════════════════════════════════════════════════ ASTRAL (17) ═══
  I('lunar_grace', 'ASTRAL', 'a', 'Lunar Grace', {
    core: true, stats: {}, tags: ['moon'], flags: { reviveOnce: true },
    desc: 'Once per run, death becomes moonlight: revive at half HP.',
    flavor: 'The Pale Daughter keeps one promise per pilgrim.' }),
  I('crimson_mote', 'ASTRAL', 'r', 'Crimson Mote', {
    core: true, stats: { atk: 2 }, tags: ['ember'], flags: { burnDouble: true },
    desc: '+2 ATK. All Burn damage you inflict is doubled.',
    flavor: 'A spark from Rubidus, still furious about the rain.' }),
  I('cometborne_sail', 'ASTRAL', 'r', 'Cometborne Sail', {
    core: true, stats: { spd: 3, dodge: 10 }, tags: ['sun'], flags: { fastTravel: true },
    desc: '+3 SPD, +10% dodge, and you hop the world map much faster.',
    flavor: 'Catches a wind that blows only between worlds.' }),
  I('moon_moth_dust', 'ASTRAL', 'r', 'Moon-Moth Dust', {
    stats: { dodge: 14, luck: 6 }, tags: ['moon'],
    desc: '+14% dodge, +6% crit.',
    flavor: 'Shaken from wings that have never once been caught.' }),
  I('rust_engine_piston', 'ASTRAL', 'r', 'Piston of the Oxidized King', {
    stats: { atk: 4, spd: -1 }, tags: ['ember'], flags: { doubleStrike: 15 },
    desc: '+4 ATK, −1 SPD. 15% chance your strikes land twice.',
    flavor: 'Still cycling. Machines this angry do not idle.' }),
  I('rootmother_seed', 'ASTRAL', 'r', 'The Rootmother’s Spare Seed', {
    stats: { maxHP: 15 }, tags: ['bloom'], flags: { afterBattleHeal: 4 },
    desc: '+15 max HP. Heal 4 after each battle.',
    flavor: 'Plant it nowhere. It grows in you regardless.' }),
  I('errand_fragment', 'ASTRAL', 'r', 'A Fragment of the Errand', {
    stats: { spd: 4 }, tags: ['sun'], flags: { fleeSure: true },
    desc: '+4 SPD. Fleeing always succeeds — always going, never arriving.',
    flavor: 'It is late for something and takes you along.' }),
  I('sundial_night', 'ASTRAL', 'a', 'Sundial That Works at Night', {
    stats: { timingBonus: 2 }, tags: ['sun', 'moon'],
    desc: 'Timing multipliers +0.30. Counts as sun and moon.',
    flavor: 'It casts a shadow of light. Noon answers to it now.' }),
  I('giant_dream', 'ASTRAL', 'a', 'A Dream of Thal-Vaur', {
    stats: { maxHP: 25, spd: -2 }, tags: [], flags: { firstHitHalved: true },
    desc: '+25 max HP, −2 SPD. The first blow each battle is halved.',
    flavor: 'Sleep like something too large to be woken by history.' }),
  I('constellation_thread', 'ASTRAL', 'r', 'Constellation Thread', {
    stats: { luck: 10 }, tags: ['moon', 'glass'], flags: { perfectShard: 1 },
    desc: '+10% crit. Perfect strikes shake loose 1 star-shard.',
    flavor: 'Unpicked from the Spilled Cup. The sky has not noticed. Sew quickly.' }),
  I('void_anchor', 'ASTRAL', 'a', 'Void Anchor', {
    stats: { maxHP: 10, atk: 3, spd: -3 }, tags: [], flags: { thorns: 4 },
    desc: '+10 max HP, +3 ATK, −3 SPD. Foes that strike you take 4 back.',
    flavor: 'Holds you to a world that is mostly gaps. Holds hard.' }),
  I('hollow_sun_ember', 'ASTRAL', 'a', 'Ember of the Undying Sun', {
    stats: { atk: 5 }, tags: ['sun', 'ember'], flags: { burnOnHit: 2, fullHPAtk: 2 },
    desc: '+5 ATK, strikes Burn (2/turn), +2 more ATK at full HP.',
    flavor: 'Vael does not miss it. Vael is politely certain you will return it.' }),
  I('starlight_suture', 'ASTRAL', 'r', 'Starlight Suture', {
    stats: { maxHP: 8 }, tags: ['moon'], flags: { blockHeal: 3, perfectHeal: 2 },
    desc: '+8 max HP. Perfect Blocks restore 3 HP; Perfect strikes restore 2.',
    flavor: 'Stitches wounds with light that remembers being whole.' }),
  I('pale_daughter_tear', 'ASTRAL', 'a', 'The Pale Daughter’s Tear', {
    stats: { maxHP: 12, luck: 8 }, tags: ['moon', 'water'], flags: { dewPotency: 15 },
    desc: '+12 max HP, +8% crit. Star-dew restores +15 more.',
    flavor: 'She wept once, for the sea she was made to keep. It keeps you now.' }),
  I('zodiac_die', 'ASTRAL', 'a', 'The Bone Zodiac’s Die', {
    stats: { luck: 15 }, tags: ['card'],
    ability: { id: 'zodiac', name: 'Cast the Zodiac', cd: 4, kind: 'gamble', desc: '0–300% ATK, judged by beasts of bone.' },
    desc: '+15% crit. Grants ability: Cast the Zodiac (0–300% ATK, 4-turn cooldown).',
    flavor: 'Twelve faces, each a hungry constellation. All of them owe you one.' }),
  I('stilled_second', 'ASTRAL', 'a', 'A Second, Stilled', {
    stats: { timingBonus: 1 }, tags: ['moon'], flags: { noteSlow: 0.2, gatherCalm: 0.5 },
    desc: 'Timing +0.15, block-shapes fall 20% slower, and your energy gathers 50% longer.',
    flavor: 'Between one tick and the next, room was made. You keep what fits.' }),
  I('comet_hammer', 'ASTRAL', 'a', 'Hammerfall of the Comet', {
    stats: { atk: 2 }, tags: ['sun'], flags: { heavyPlus: 0.8 },
    desc: '+2 ATK. A fully perfect Meteor Edge chain lands +0.8× harder.',
    flavor: 'Aim like a millennium. Land like the end of one.' }),

  // ═════════════════════════════════════════════════════ MUTATIONS (8) ═══
  // Cosmic mutations never appear in ordinary draws — they come only from
  // the deep places (satellite bosses, tier-3+ keepers, astral pedestals,
  // nebulas). Each rewrites the wanderer's body: great power, real cost.
  // Carrying three tears open the Wound in the Meridian.
  I('maw_beneath', 'MUTATION', 'm', 'The Maw Beneath', {
    core: true, mutation: true, stats: { atk: 8, maxHP: -8 }, tags: [], flags: { shopMarkup: 0.4 },
    desc: '+8 ATK, −8 max HP. Merchants see the teeth: shop prices +40%.',
    flavor: 'Your gentle smile is still there. It is just no longer the outermost one.' }),
  I('thousand_eyes', 'MUTATION', 'm', 'A Thousand Unclosing Eyes', {
    core: true, mutation: true, stats: { luck: 15, dodge: 10, maxHP: -6 }, tags: [],
    flags: { seeIntent: true, noFirstDodge: true },
    desc: '+15% crit, +10% dodge, see all foe intents, −6 max HP. They never close: effects that auto-dodge first blows are lost.',
    flavor: 'You see everything now. Everything sees that you see it. Introductions are exhausting.' }),
  I('antler_deep', 'MUTATION', 'm', 'Antler Crown of the Deep', {
    core: true, mutation: true, stats: { maxHP: 20, atk: 2, spd: -3 }, tags: [], flags: { heavyGait: true },
    desc: '+20 max HP, +2 ATK, −3 SPD. The crown is heavy: you can never travel fast again.',
    flavor: 'Something old and drowned mistook you for its heir. It refuses to take the crown back.' }),
  I('tatter_wings', 'MUTATION', 'm', 'Wings of Torn Vellum', {
    core: true, mutation: true, stats: { spd: 4, dodge: 12, maxHP: -10, shardGain: -25 }, tags: [],
    flags: { fastTravel: true },
    desc: '+4 SPD, +12% dodge, fast travel everywhere — but −10 max HP and shard finds −25% as pieces of you scatter.',
    flavor: 'They unfolded out of your own margins. The wind reads you as it carries you.' }),
  I('tide_gills', 'MUTATION', 'm', 'Tidewrought Gills', {
    core: true, mutation: true, stats: { atk: 3, dodge: 8 }, tags: [], flags: { drylandAche: 2 },
    desc: '+3 ATK, +8% dodge. Dry land aches: after every battle outside the shallows, lose 2 HP.',
    flavor: 'The sea remembered you before you were paper. It wants its draft back.' }),
  I('starving_halo', 'MUTATION', 'm', 'The Starving Halo', {
    core: true, mutation: true, stats: { atk: 2 }, tags: [], flags: { killHeal: 4, dewMuted: true },
    desc: '+2 ATK, heal 4 whenever a foe falls — but star-dew only half-nourishes you now.',
    flavor: 'A ring of black light that eats what you defeat and tithes you the marrow.' }),
  I('hollow_chest', 'MUTATION', 'm', 'The Hollow Chest', {
    core: true, mutation: true, stats: { maxHP: -5 }, tags: [], flags: { cooldownMinus: 1, abilityToll: 2 },
    desc: 'Ability cooldowns −1 turn, −5 max HP, and every ability costs 2 HP. The hollow gives; the hollow takes.',
    flavor: 'Where your chest-rune sat there is now a small tidy absence with one star inside.' }),
  I('voice_wound', 'MUTATION', 'm', 'Voice of the Wound', {
    core: true, mutation: true, stats: { luck: 8, shardGain: -30 }, tags: [], flags: { chillOnHit: 1 },
    desc: '+8% crit, your strikes Chill — but the whispers cost you: shard finds −30%.',
    flavor: 'You speak your own language now. Only the rift speaks it back.' }),
];

// Sets & synergies. Every tag is a set; carry enough relics of one set and
// its synergy ignites. Grand synergies demand TWO completed sets at once and
// transform accordingly.
export const SETS = {
  ember: { name: 'Ember', need: 3, color: '#ff7a45' },
  bloom: { name: 'Bloom', need: 3, color: '#8affc4' },
  glass: { name: 'Glass', need: 3, color: '#d79bff' },
  moon:  { name: 'Moon',  need: 4, color: '#bcd8ff' },
  sun:   { name: 'Sun',   need: 3, color: '#f5b942' },
  water: { name: 'Water', need: 3, color: '#6f9bff' },
  card:  { name: 'Card',  need: 3, color: '#d94f8e' },
};

// A synergy ignites when every listed set is complete (count >= need).
export const SYNERGIES = [
  // ---- set synergies: one completed set --------------------------------
  { id: 'cinderhost', sets: ['ember'], name: 'CINDERHOST',
    desc: 'Three embers make a hearth: +1 ATK and your strikes Burn (+1/turn).' },
  { id: 'fullbloom', sets: ['bloom'], name: 'FULL BLOOM',
    desc: 'The garden takes root in you: heal 2 at the start of your turns.' },
  { id: 'glassworks', sets: ['glass'], name: 'GLASSWORKS',
    desc: 'Everything refracts: +8% crit, and your crits cut 25% deeper.' },
  { id: 'moonbound', sets: ['moon'], name: 'MOONBOUND',
    desc: 'Four moons in one sky: +10% dodge, and you always dodge the first blow.' },
  { id: 'high_noon', sets: ['sun'], name: 'HIGH NOON',
    desc: 'The sun forgives nothing: +2 ATK, and Perfect strikes deal +20%.' },
  { id: 'tideborne', sets: ['water'], name: 'TIDEBORNE',
    desc: 'The sea keeps you: +5% dodge, heal 3 after every battle.' },
  { id: 'drawn_hand', sets: ['card'], name: 'THE DRAWN HAND',
    desc: 'The deck plays you first: a random card is dealt as each battle opens.' },
  // ---- grand synergies: two completed sets -----------------------------
  { id: 'fulgurite', sets: ['ember', 'glass'], grand: true, name: 'FULGURITE',
    desc: 'Fire through glass: +2 ATK, and your crits also Burn (3/turn, 3 turns).' },
  { id: 'pale_hand', sets: ['moon', 'card'], grand: true, name: 'THE PALE HAND',
    desc: 'The Hound hunts in moonlight: each battle opens with its bite (8 damage, Chill −2 ATK).' },
  { id: 'steamveil', sets: ['ember', 'water'], grand: true, name: 'STEAMVEIL',
    desc: 'Fire meets sea: water weakness annulled, +15% dodge, and Perfect Blocks restore 2 HP.' },
  { id: 'eclipse', sets: ['sun', 'moon'], grand: true, name: 'ECLIPSE',
    desc: 'Sun and moon align: +3 ATK, and Perfect windows widen.' },
  { id: 'verdance', sets: ['bloom', 'water'], grand: true, name: 'VERDANCE',
    desc: 'Rain on green: heal 3 more at the start of every one of your turns.' },
  { id: 'stained_glass', sets: ['glass', 'card'], grand: true, name: 'STAINED GLASS',
    desc: 'Fate refracted: +10% crit, and crits grant +1 star-shard.' },
];

// ------------------------------------------------------------ rarity draw ---

export const RARITY = {
  c: { name: 'Common', color: '#9aa3cf' },
  u: { name: 'Uncommon', color: '#6fe0c8' },
  r: { name: 'Rare', color: '#b48aff' },
  a: { name: 'Astral', color: '#f0c46a' },
  m: { name: 'Mutation', color: '#a6ff57' },
};

const SOURCE_WEIGHTS = {
  pedestal: { c: 0.56, u: 0.30, r: 0.12, a: 0.02 },
  boss: { c: 0.08, u: 0.40, r: 0.38, a: 0.14 },
  secret: { c: 0.16, u: 0.42, r: 0.34, a: 0.08 },
  shop: { c: 0.62, u: 0.28, r: 0.09, a: 0.01 },   // harsh: traders rarely part with the good stock
  astral: { c: 0, u: 0.14, r: 0.44, a: 0.42 },
};

export function drawItem(rng, pool, ownedIds, opts = {}) {
  const { source = 'pedestal', tier = 0, unlocked = null } = opts;
  const w = { ...(SOURCE_WEIGHTS[source] || SOURCE_WEIGHTS.pedestal) };
  const shift = Math.min(0.2, tier * 0.045);   // deep pockets skew rare
  w.c = Math.max(0, w.c - shift);
  w.r += shift;
  let roll = rng(), rarity = 'c';
  for (const k of ['c', 'u', 'r', 'a']) { if (roll < w[k]) { rarity = k; break; } roll -= w[k]; }

  const ok = i => !ownedIds.has(i.id) && i.rarity !== 'm' && (!unlocked || unlocked.has(i.id));
  const tryPools = [pool, 'ANY'];
  const rarityOrder = [rarity, 'r', 'u', 'c', 'a'];
  for (const p of tryPools) {
    for (const rr of rarityOrder) {
      const cands = ITEMS.filter(i => i.pool === p && i.rarity === rr && ok(i));
      if (cands.length) return pick(rng, cands);
    }
  }
  const any = ITEMS.filter(ok);
  return any.length ? pick(rng, any) : null;
}

// Mutations come only from the deep places, never the ordinary draw.
export function drawMutation(rng, ownedIds) {
  const cands = ITEMS.filter(i => i.rarity === 'm' && !ownedIds.has(i.id));
  return cands.length ? pick(rng, cands) : null;
}

export const CONSUMABLES = {
  charge: {
    id: 'charge', name: 'Star-Charge', icon: '✸',
    desc: 'Detonate on the world map to blast open an adjacent sealed hex — or hurl in battle for heavy damage to all foes.',
  },
  dew: {
    id: 'dew', name: 'Star-Dew', icon: '❋',
    desc: 'Drink to restore 12 HP. Usable in and out of battle. Precious and scarce.',
  },
  feather: {
    id: 'feather', name: 'Homing Feather', icon: '➳',
    desc: 'Whisks you back to Starfall Vale from anywhere on the world map.',
  },
};
