// The battle engine: a Pokémon-style diorama — your paper token front-left,
// foes back-right on a biome-styled stage — driven by menu turns with
// Paper-Mario timing: click the sliding marker to strike true or block.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { mulberry32, hash2, pick } from './rng.js';
import { BIOMES, FOES, speciesSlug } from './names.js';
import { run } from './run.js';
import { audio } from './audio.js';
import { vesselStarsHTML } from './ui.js';
import {
  makeNebulaTexture, makePlayerTexture, makeEnemyTexture, makeGlowTexture, makeStarTexture,
} from './textures.js';

const $ = id => document.getElementById(id);
const wait = ms => new Promise(res => setTimeout(res, ms));

// half-vessels → "1½★" style text for floats and logs
export const fmtV = halves => {
  const whole = Math.floor(Math.abs(halves) / 2), half = Math.abs(halves) % 2;
  return (whole > 0 ? whole : '') + (half ? '½' : '') + '★';
};

const ROLE_MODS = {
  brute: { hp: 1.4, atk: 1.15, spd: 0.7 },
  swift: { hp: 0.75, atk: 0.85, spd: 1.5 },
  mystic: { hp: 0.85, atk: 1.0, spd: 1.0 },
  guard: { hp: 1.1, atk: 0.9, spd: 0.8 },
};

export class BattleSystem {
  constructor(renderer) {
    this.renderer = renderer;
    this.active = false;
    this.scene = null;
    this.camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 400);
    this.time = 0;
    this.tweens = [];
    this._tex = {};
    this._timingHandler = null;

    window.addEventListener('keydown', e => {
      if (e.code === 'Space' && this.timingActive) { e.preventDefault(); this._resolveTiming(); }
      const lane = { KeyA: 0, KeyS: 1, KeyD: 2 }[e.code];
      if (lane != null && this.laneActive) this._lanePress(lane);
    });
    window.addEventListener('pointerdown', () => {
      if (this.timingActive) this._resolveTiming();
      else if (this.laneActive) this._lanePointer();
    });
  }

  _shared(name, maker) { return this._tex[name] ??= maker(); }

  // ------------------------------------------------------------- lifecycle ---

  start({ team, title, onEnd }) {
    this.active = true;
    document.body.classList.add('in-battle');
    this.onEnd = onEnd;
    this.turn = 0;
    this.timingActive = false;
    this.state = 'intro';
    this.playerGuardBonus = 0;
    this.usedFirstPerfect = false;
    this.firstDodgeUsed = false;
    this.frenzyAtk = 0;
    this.shieldLeft = (run.flags.firstHitHalved ? 1 : 0) + (run.flags.shieldHits || 0);
    this.playerBurn = null;   // { turns } — cinders in your folds burn your FOCUS
    this.playerChill = 0;     // frost stacks: the marker runs faster
    this.poise = 0;           // a swift perfect settles your stance for the next blocks
    this.opening = 0;         // …and marks an opening: bonus mult on your next attack
    this._openingNow = 0;     // the opening being spent by the current action
    this.braced = false;      // Brace: slower notes, wider windows, a riposte
    // Focus: full at the bell, drained by sloppy blocks, restored by perfect
    // ones. Low focus narrows your strike-bar windows — never the lanes.
    const F = CONFIG.battle.focus;
    this.focus = F.max;
    this._focusTold = false;
    // the gills ache on dry land: those battles start a stage down
    if (run.flags.drylandAche && !['SEA', 'BRIDGE'].includes(team.biome)) this.focus = F.max - 1;
    this.blockHealLeft = run.flags.blockHeal || 0;      // ½★ per perfect block, per battle
    this.perfectHealLeft = run.flags.perfectHeal || 0;  // ½★ per perfect strike, per battle
    this.laneActive = false;  // the falling-note block minigame is live
    this.lane = null;
    this.trapWardLeft = run.flags.trapWard || 0;      // traps forgiven per battle
    this.chainKeptLeft = run.flags.chainKeeper || 0;  // chain-saves per battle
    this.rng = mulberry32((run.battlesWon * 7919 + team.tier * 131 + 17) >>> 0);
    audio.battleStart({ boss: !!team.boss });

    this._buildScene(team);
    this._buildEnemies(team);
    this._buildDom(title || 'Battle');
    this._log(`${this.enemies.length > 1 ? 'Foes block' : 'A foe blocks'} the way!`);

    // opening effects
    if (run.flags.houndStrike) {
      setTimeout(() => {
        const target = this._aliveEnemies()[0];
        if (!target) return;
        let dmg = run.flags.houndStrike;
        this._hurtEnemy(target, dmg, 'The Hound!');
        if (run.hasSynergy('pale_hand')) { target.chill = (target.chill || 0) + 2; this._log('The Hound’s bite chills.'); }
        this._refreshCards();
      }, 700);
    }
    if (run.hasSynergy('drawn_hand')) {
      setTimeout(() => {
        const roll = this.rng();
        if (roll < 0.4) {
          const target = pick(this.rng, this._aliveEnemies());
          if (target) {
            this._hurtEnemy(target, 6 + (team.tier || 1) * 2, 'The Sword!');
            this._log('The deck deals THE SWORD — it falls edge-first.');
          }
        } else if (roll < 0.7) {
          this.frenzyAtk += 1;
          this._log('The deck deals THE BANNER — +1 ATK for this battle.');
        } else {
          this._healPlayer(1);
          this._log('The deck deals THE HEARTH — you are half a vessel warmer.');
        }
        this._refreshCards();
      }, 850);
    }
    setTimeout(() => { this.state = 'playerMenu'; this._showMenu(); }, 1000);
  }

  _buildScene(team) {
    const scene = new THREE.Scene();
    this.scene = scene;
    scene.fog = new THREE.FogExp2(0x0a0d24, 0.012);
    scene.add(new THREE.AmbientLight(0x9aa4d8, 0.9));
    const key = new THREE.DirectionalLight(0xfff2dd, 1.9);
    key.position.set(-6, 12, 8);
    scene.add(key);

    const biome = BIOMES[team.biome] || BIOMES.MEADOW;
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 45),
      new THREE.MeshBasicMaterial({ map: this._shared('neb', makeNebulaTexture), fog: false })
    );
    back.position.set(6, 8, -26);
    scene.add(back);

    const stage = new THREE.Mesh(
      new THREE.CylinderGeometry(8.2, 7.4, 0.8, 6),
      new THREE.MeshStandardMaterial({ color: biome.color, flatShading: true, roughness: 0.9 })
    );
    stage.rotation.y = Math.PI / 6;
    stage.position.y = -0.4;
    scene.add(stage);
    const rim = new THREE.Mesh(
      hexRingLocal(8.1, 7.7),
      new THREE.MeshBasicMaterial({
        color: biome.accent, transparent: true, opacity: 0.3,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide,
      })
    );
    rim.rotation.y = Math.PI / 6;
    rim.position.y = 0.03;
    scene.add(rim);

    // scenery keeps to the back edge, behind the enemy line — the paper foes
    // must never stand angled behind a tree
    const srng = mulberry32(hash2(team.tier, team.count, 4242) * 0xffffffff | 0);
    for (let i = 0; i < 6; i++) {
      const m = sceneryFor(team.biome, srng);
      m.position.set(-5.5 + (i / 5) * 11 + (srng() - 0.5) * 1.4, 0, -4.6 - srng() * 1.6);
      m.position.x += m.position.x > 0 ? 0 : -0.4;
      scene.add(m);
    }
    this.accent = '#' + new THREE.Color(biome.accent).getHexString();
    this.projectiles = [];

    // your paper self, painted fresh each battle to match the hoard's marks
    const token = new THREE.Mesh(
      new THREE.PlaneGeometry(1.7, 2.15),
      new THREE.MeshBasicMaterial({ map: makePlayerTexture(run.appearance), transparent: true, fog: false })
    );
    token.geometry.translate(0, 1.07, 0);
    token.position.set(-4.4, 0, 2.9);
    scene.add(token);
    this.playerMesh = token;
    this.playerHome = token.position.clone();
    const pShadow = shadowBlob(0.55);
    pShadow.position.set(-4.4, 0.03, 2.9);
    scene.add(pShadow);

    this.camera.position.set(-7.6, 4.3, 8.4);
    this.camera.lookAt(0.7, 1.3, -0.7);
    this.burstPool = [];
    for (let i = 0; i < 10; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this._shared('star', makeStarTexture), color: 0xffe9a0, transparent: true,
        opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      sp.scale.setScalar(0.5);
      scene.add(sp);
      this.burstPool.push({ sp, t: 2, vx: 0, vy: 0, vz: 0 });
    }
  }

  _buildEnemies(team) {
    const roster = FOES[team.biome] || FOES.MEADOW;
    let count = team.boss ? 1 : Math.min(3, team.count || 1);
    if (!team.boss && run.flags.fewerFoes) count = Math.max(1, count - 1);
    if (!team.boss && run.flags.extraFoeChance && this.rng() < run.flags.extraFoeChance) count = Math.min(3, count + 1);

    const tier = team.tier ?? 1;
    // spots spread ACROSS the camera's line of sight, so billboarded paper
    // never stacks one foe behind another
    const spots = count === 1 ? [[3.4, -1.6]]
      : count === 2 ? [[2.4, -2.6], [4.6, -0.6]]
      : [[1.9, -3.1], [3.5, -1.6], [5.1, -0.1]];
    const biome = BIOMES[team.biome] || BIOMES.MEADOW;

    this.enemies = spots.map(([x, z], i) => {
      // a roamer pack fights as the species its map icon promised
      const spec = team.boss ? { n: team.bossName || 'The Warden', r: 'brute' }
        : team.species
          ? (roster.find(f => f.n === team.species) || { n: team.species, r: team.speciesRole || 'brute' })
          : pick(this.rng, roster);
      const mods = ROLE_MODS[spec.r] || ROLE_MODS.brute;
      const varr = 0.9 + this.rng() * 0.2;
      const E = CONFIG.battle.enemy;
      let hp = Math.round((E.hp0 + E.hpT * tier + E.hpQ * tier * tier) * mods.hp * varr);
      let atk = Math.round((E.atk0 + E.atkT * tier + E.atkQ * tier * tier) * mods.atk * 10) / 10;
      let spd = Math.round((4 + tier) * mods.spd);
      if (team.boss) { hp = Math.round(hp * 2.6); atk = Math.round(atk * 1.2 * 10) / 10; }
      if (team.deity) { hp = Math.round(hp * 1.6); atk = Math.round(atk * 1.15 * 10) / 10; }

      const bodyC = '#' + new THREE.Color(biome.color).offsetHSL(0.02 * i, 0.12, -0.1).getHexString();
      const tex = makeEnemyTexture({
        base: bodyC,
        eye: team.boss ? '#ff5a7a' : '#ffd24a',
        role: spec.r,
        seed: this.rng(),
        boss: !!team.boss,
        species: team.boss ? null : speciesSlug(spec.n),
        bossKind: team.boss ? (team.bossKind || 'warden') : (team.bossKind || null),
        accent: '#' + new THREE.Color(biome.accent).getHexString(),
      });
      const s = team.boss ? 3.1 : 1.9 + (spec.r === 'brute' ? 0.35 : 0);
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(s, s),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, fog: false })
      );
      mesh.geometry.translate(0, s / 2, 0);
      mesh.position.set(x, 0, z);
      this.scene.add(mesh);
      const sh = shadowBlob(s * 0.32);
      sh.position.set(x, 0.03, z);
      this.scene.add(sh);

      return {
        id: i, name: spec.n + (count > 1 ? ` ${'ABC'[i]}` : ''), role: spec.r,
        ranged: !team.boss && spec.r === 'mystic',   // mystics cast; the rest close in
        hp, maxHP: hp, atk, spd, boss: !!team.boss, deity: !!team.deity,
        burn: 0, burnTurns: 0, chill: 0, stun: 0, charging: false, enraged: false,
        mesh, home: mesh.position.clone(), dead: false,
        intent: 'attack',
      };
    });
    this.team = team;
    this.targetId = 0;
  }

  // ------------------------------------------------------------------ DOM ---

  _buildDom(title) {
    $('battle').classList.remove('hidden');
    $('b-title').textContent = title;
    $('b-float').innerHTML = '';
    this.abilityCds = Object.fromEntries(run.abilities.map(a => [a.id, 0]));
    this._refreshCards();
    this._hideMenu();
  }

  _refreshCards() {
    const en = $('b-enemies');
    en.innerHTML = '';
    for (const e of this.enemies) {
      const card = document.createElement('div');
      card.className = 'b-card enemy' + (e.dead ? ' dead' : '') + (e.id === this.targetId ? ' targeted' : '');
      const pct = Math.max(0, e.hp / e.maxHP * 100);
      const status = [
        e.burnTurns > 0 ? `<span class="st burn">🔥${e.burn}</span>` : '',
        e.chill ? `<span class="st chill">❄×${e.chill}</span>` : '',
        e.stun ? `<span class="st stun">✶stun</span>` : '',
        e.charging ? `<span class="st charge">⚡charging</span>` : '',
        e.enraged ? `<span class="st charge">enraged</span>` : '',
        e.warded ? `<span class="st chill">◈warded</span>` : '',
      ].join('');
      const intent = (run.flags.seeIntent && !e.dead)
        ? `<div class="b-intent">${e.charging ? '⚡ unleashing a heavy blow' : e.intent === 'special' ? '☄ gathering power' : '🗡 will attack'}</div>` : '';
      card.innerHTML = `<div class="b-name">${e.name}${e.boss ? ' ☠' : ''}</div>
        <div class="b-hpbar"><div class="b-hpfill enemy" style="width:${pct}%"></div></div>
        <div class="b-sub">${e.hp > 0 ? e.hp + ' / ' + e.maxHP : 'defeated'} ${status}</div>${intent}`;
      card.addEventListener('click', () => {
        if (!e.dead) { this.targetId = e.id; this._refreshCards(); }
      });
      en.appendChild(card);
    }
    const pStatus = [
      this.playerGuardBonus ? '<span class="st chill">guarded</span>' : '',
      this.braced ? '<span class="st chill">⛨ braced</span>' : '',
      this.poise ? '<span class="st chill">✦ poised</span>' : '',
      this.opening > 0 ? `<span class="st charge">✦ opening +${Math.round(this.opening * 100)}%</span>` : '',
      this.playerBurn?.turns > 0 ? '<span class="st burn">🔥 focus burning</span>' : '',
      this.playerChill > 0 ? `<span class="st chill">❄×${this.playerChill}</span>` : '',
    ].filter(Boolean).join(' ');
    // focus pips: 5 stages, drawn in half-steps
    const F = CONFIG.battle.focus;
    const pips = Array.from({ length: F.max }, (_, i) => {
      const fill = Math.max(0, Math.min(1, this.focus - i));
      return `<span class="fpip${fill >= 1 ? ' full' : fill > 0 ? ' half' : ''}"></span>`;
    }).join('');
    $('b-player').innerHTML = `<div class="b-name">You, the Star-Wanderer</div>
      <div class="b-vstars">${vesselStarsHTML(run.hp, run.stats.maxHP)}</div>
      <div class="b-focus" title="Focus: sloppy blocks drain it, perfect blocks restore it — low focus narrows your strike windows">focus ${pips}</div>
      <div class="b-sub">ATK ${this._playerAtk()} · SPD ${run.stats.spd}${pStatus ? ' · ' + pStatus : ''}</div>`;
  }

  // ---- focus & vessels -----------------------------------------------------

  // Move focus by delta stages (halves allowed), clamped to [min, max].
  _focusShift(delta, why) {
    const F = CONFIG.battle.focus;
    const before = this.focus;
    this.focus = Math.max(F.min, Math.min(F.max, this.focus + delta));
    if (this.focus === before) return;
    if (delta < 0) {
      this._float(this.playerMesh.position.clone().add(new THREE.Vector3(0.6, 2.4, 0)),
        `−focus${why ? ' ' + why : ''}`, 'focus');
      if (this.focus <= F.min && !this._focusTold) {
        this._focusTold = true;
        this._log('Your focus FRAYS to nothing — the gold bands run knife-thin. Land perfect blocks to steady your hands.');
      }
    }
  }

  // how much the strike bands narrow as focus frays: 1.0 at full → minScale at 1
  _focusScale() {
    const F = CONFIG.battle.focus;
    return F.minScale + (1 - F.minScale) * (this.focus - F.min) / (F.max - F.min);
  }

  _healPlayer(halves) {
    if (halves <= 0 || run.hp >= run.stats.maxHP) return;
    run.hp = Math.min(run.stats.maxHP, run.hp + halves);
    this._float(this.playerMesh.position.clone().add(new THREE.Vector3(0, 2, 0)), `+${fmtV(halves)}`, 'heal');
  }

  _damagePlayer(halves, tag) {
    run.hp -= halves;
    this._float(this.playerMesh.position.clone().add(new THREE.Vector3(0, 2, 0)),
      `−${fmtV(halves)}${tag ? ' ' + tag : ''}`, 'dmg');
  }

  _playerAtk() {
    let atk = run.stats.atk + this.frenzyAtk;
    if (run.flags.fullHPAtk && run.hp >= run.stats.maxHP) atk += run.flags.fullHPAtk;
    if (run.flags.deepPower) atk += this.team.tier || 0;
    return atk;
  }

  _showMenu() {
    const menu = $('b-menu');
    menu.classList.remove('hidden');
    menu.innerHTML = '';
    const addBtn = (label, cb, cls = '', disabled = false) => {
      const b = document.createElement('button');
      b.innerHTML = label;
      b.className = cls;
      b.disabled = disabled;
      b.addEventListener('click', cb);
      menu.appendChild(b);
      return b;
    };
    addBtn('⚡ Swift Cut', () => this._playerAttack('swift'));
    addBtn('⚔ Star Strike', () => this._playerAttack('star'));
    addBtn('☄ Meteor Edge', () => this._playerAttack('heavy'));
    addBtn('⛨ Brace', () => this._brace(), 'guard');
    for (const a of run.abilities) {
      const cd = this.abilityCds[a.id] || 0;
      addBtn(`✧ ${a.name}${cd > 0 ? ` (${cd})` : ''}`, () => this._playerAbility(a), 'ability', cd > 0);
    }
    if (run.consumables.charge > 0) addBtn(`✸ Star-Charge ×${run.consumables.charge}`, () => this._useCharge(), 'item');
    if (run.consumables.dew > 0) addBtn(`❋ Star-Dew ×${run.consumables.dew}`, () => this._useDew(), 'item');
    addBtn('☁ Flee', () => this._flee(), 'ghost');
  }

  _hideMenu() { $('b-menu').classList.add('hidden'); }

  _log(msg) { $('b-log').innerHTML = msg; }

  _float(worldPos, text, cls) {
    const v = worldPos.clone().project(this.camera);
    const x = (v.x * 0.5 + 0.5) * innerWidth;
    const y = (-v.y * 0.5 + 0.5) * innerHeight;
    const d = document.createElement('div');
    d.className = 'b-num ' + cls;
    d.textContent = text;
    d.style.left = x + 'px';
    d.style.top = y + 'px';
    $('b-float').appendChild(d);
    setTimeout(() => d.remove(), 1100);
  }

  // --------------------------------------------------------- timing minigame ---
  // Strike bars: the gold band lands somewhere new every swing, the marker's
  // speed varies with the stance, and some sweeps run right-to-left. Every
  // bar COALESCES first — a mote of energy gathers where the band will be,
  // the track fades in around it, and only then does the marker fly.
  // Stronger stances gather faster and read harder.

  _startTiming(kind, opts = {}) {
    // kind: 'strike' | 'dodge'  (blocking is the falling-lane minigame now)
    return new Promise(resolve => {
      const T = CONFIG.battle.timing;
      this.timingActive = true;
      this.timingKind = kind;
      this.timingT = 0;
      this.timingSpeed = opts.speed || 1;
      this.timingReverse = this.rng() < T.reverseChance;
      this.timingVeil = !!opts.veil && !run.flags.veilSight;
      this.timingResolve = resolve;
      this.timingPhase = 'gather';
      this.gatherT = 0;
      this.gatherDur = Math.max(0.12, opts.gather ?? T.gather);
      this._strikeTarget = null;
      const el = $('b-timing');
      el.classList.remove('hidden');
      el.classList.add('gathering');
      el.style.setProperty('--gather', 0);
      $('b-timing-label').textContent = opts.label
        || (kind === 'strike' ? 'Strike! (click / space)' : '☄ DODGE!');

      // frayed focus narrows your attack windows — the lanes never suffer this
      const shrink = (opts.shrink || 1) * (kind === 'strike' ? this._focusScale() : 1);
      let half = (kind === 'dodge' ? T.dodgeHalf : T.perfectHalf) * shrink;
      if (run.hasSynergy('eclipse')) half += 0.015;
      const mid = 0.28 + this.rng() * 0.5;   // the band wanders every swing
      const pad = kind === 'dodge' ? 0 : T.goodPad * this._focusScale();
      this.zones = {
        p0: mid - half, p1: mid + half,
        g0: Math.max(0.02, mid - half - pad), g1: Math.min(0.98, mid + half + pad),
      };
      // draw the zones in screen space (mirrored when the sweep reverses)
      const show = (zEl, a, b) => {
        const [s0, s1] = this.timingReverse ? [1 - b, 1 - a] : [a, b];
        zEl.style.left = (s0 * 100) + '%';
        zEl.style.width = ((s1 - s0) * 100) + '%';
        zEl.style.opacity = 0;
        zEl.style.transition = 'none';
      };
      show(el.querySelector('.bt-zone.perfect'), this.zones.p0, this.zones.p1);
      const zg = el.querySelector('.bt-zone.good');
      if (pad > 0) { show(zg, this.zones.g0, this.zones.g1); }
      else { zg.style.width = '0%'; }
      // the marker waits at the gate; the mote settles over the band's heart
      const marker = el.querySelector('.bt-marker');
      if (marker) { marker.style.opacity = 0; marker.style.left = (this.timingReverse ? 100 : 0) + '%'; }
      const orb = el.querySelector('.bt-gather');
      if (orb) {
        orb.style.left = ((this.timingReverse ? 1 - mid : mid) * 100) + '%';
        orb.style.opacity = 0;
      }
    });
  }

  _resolveTiming() {
    if (!this.timingActive || this.timingPhase !== 'live') return;
    this.timingActive = false;
    const el = $('b-timing');
    el.classList.add('hidden');
    el.classList.remove('gathering');
    const t = this.timingT;
    const bonus = (run.stats.timingBonus || 0) * 0.15;
    let grade, mult;
    if (t >= this.zones.p0 && t <= this.zones.p1) { grade = 'perfect'; mult = CONFIG.battle.perfectMult + bonus; }
    else if (this.timingKind !== 'dodge' && t >= this.zones.g0 && t <= this.zones.g1) {
      grade = 'good'; mult = CONFIG.battle.goodMult + bonus;
    } else { grade = 'miss'; mult = CONFIG.battle.missMult + bonus * 0.5; }
    this.timingResolve({ grade, mult });
  }

  // how long your energy takes to coalesce — some relics grant a longer read
  _gatherCalm() { return 1 + Math.min(0.6, run.flags.gatherCalm || 0); }

  // ----------------------------------------------------------- player turn ---

  // Three stances, and the stronger the blow the harder it reads:
  //   Swift Cut  — one generous bar; a perfect settles you into POISE
  //                (slower, wider blocks next enemy phase) and marks an
  //                OPENING: your next attack lands harder. The consistent
  //                choice when frayed focus can't hold a chain.
  //   Star Strike — the 3-bar chain, each faster and tighter than the last.
  //   Meteor Edge — a 3-bar chain of knife-slits: each perfect lands 1.5×,
  //                pierces guard-plates and wards, and knocks a gathering
  //                (charging) blow apart; a good keeps the chain at 0.6×;
  //                a miss grazes and SHATTERS it. Skill pays up to 4.5×.
  async _playerAttack(kind = 'star') {
    if (this.state !== 'playerMenu') return;
    this.state = 'playerActing';
    this._hideMenu();
    const target = this.enemies[this.targetId]?.dead ? this._aliveEnemies()[0] : this.enemies[this.targetId];
    if (!target) return;
    const A = CONFIG.battle.attacks;

    // spend the opening Swift Cut marked — the whole action lands harder
    this._openingNow = this.opening;
    this.opening = 0;
    if (this._openingNow > 0) this._log(`The opening you cut — every blow lands +${Math.round(this._openingNow * 100)}% harder!`);

    // lunge toward the foe
    this._tween(this.playerMesh.position, { x: target.home.x - 1.6, z: target.home.z + 1.2 }, 0.32);
    await wait(300);

    if (kind === 'swift') {
      const timing = await this._startTiming('strike', {
        speed: A.swift.speed, shrink: A.swift.band, gather: A.swift.gather * this._gatherCalm(),
        label: '⚡ Swift Cut — an easy read',
      });
      await this._strike(target, timing, A.swift.mult);
      if (timing.grade === 'perfect' || (timing.grade === 'good' && run.flags.poiseful)) {
        this.poise = 1;
        this.opening = A.swift.opening + (run.flags.openingPlus || 0);
        this._log(`You land light and settle into stance — POISED, and an OPENING is marked (+${Math.round(this.opening * 100)}% next attack).`);
      }
    } else if (kind === 'heavy') {
      const tb = (run.stats.timingBonus || 0) * 0.15;
      const perBarPlus = (run.flags.heavyPlus || 0) / A.heavy.hits;
      for (let h = 0; h < A.heavy.hits && !target.dead; h++) {
        const timing = await this._startTiming('strike', {
          speed: A.heavy.speed * (1 + h * A.heavy.ramp),
          shrink: A.heavy.band * Math.pow(A.heavy.shrinkRamp, h),
          gather: (h === 0 ? A.heavy.gather : 0.18) * this._gatherCalm(),
          label: h === 0 ? '☄ METEOR EDGE 1/3 — knife-slits!' : `☄ METEOR ${h + 1}/3 — hold the fall!`,
        });
        const mult = timing.grade === 'perfect' ? A.heavy.mult + perBarPlus + tb
          : timing.grade === 'good' ? A.heavy.good + tb : A.heavy.miss;
        const interrupts = timing.grade === 'perfect' || (timing.grade === 'good' && run.flags.interruptGood);
        if (interrupts && target.charging) {
          target.charging = false;
          this._log(`The meteor lands mid-wind-up — ${target.name}'s gathered blow is KNOCKED APART!`);
        }
        await this._strike(target, { grade: timing.grade, mult }, 1, h > 0,
          { pierce: timing.grade === 'perfect' });
        if (timing.grade === 'miss') {
          this._log('The meteor grazes wide — the fall SHATTERS out of your hands.');
          break;
        }
        if (h < A.heavy.hits - 1 && !target.dead) await wait(150);
      }
    } else {
      const maxHits = CONFIG.battle.comboHits;
      let bestPerfect = null;
      for (let h = 0; h < maxHits && !target.dead; h++) {
        let timing;
        if (h === 0 && run.flags.firstHitPerfect && !this.usedFirstPerfect) {
          this.usedFirstPerfect = true;
          timing = { grade: 'perfect', mult: CONFIG.battle.perfectMult + (run.stats.timingBonus || 0) * 0.15 };
          this._log('The Dawn Thimble guides your hand — Perfect!');
        } else {
          timing = await this._startTiming('strike', {
            speed: A.star.speed * (1 + h * 0.22),
            shrink: A.star.band * Math.pow(0.88, h),
            gather: (h === 0 ? A.star.gather : 0.22) * this._gatherCalm(),
            label: h === 0 ? 'Strike! (click / space)' : `Strike ${h + 1} — keep the chain!`,
          });
        }
        await this._strike(target, timing, CONFIG.battle.comboMult, h > 0);
        if (timing.grade === 'perfect') bestPerfect = timing;
        if (timing.grade === 'miss') {
          if (this.chainKeptLeft > 0 && h < maxHits - 1 && !target.dead) {
            this.chainKeptLeft--;
            this._log('The chain slips — and the spare cord HOLDS it!');
          } else {
            if (h < maxHits - 1) this._log('The chain slips from your hands…');
            break;
          }
        }
        if (h < maxHits - 1 && !target.dead) await wait(170);
      }
      if (bestPerfect && run.flags.perfectEcho && !target.dead) {
        await wait(220);
        this._log('The Echo Hammer rings!');
        await this._strike(target, { grade: 'echo', mult: bestPerfect.mult * run.flags.perfectEcho }, CONFIG.battle.comboMult, true);
      }
    }
    this._tween(this.playerMesh.position, { x: this.playerHome.x, z: this.playerHome.z }, 0.3);
    await wait(330);
    this._afterPlayerAction();
  }

  // Brace: forgo the strike to read the incoming storm. Until your next
  // turn the falling shapes drop slower, every window widens, and a
  // PERFECT block answers with your blade.
  async _brace() {
    if (this.state !== 'playerMenu') return;
    this.state = 'playerActing';
    this._hideMenu();
    this.braced = true;
    this._focusShift(CONFIG.battle.focus.brace);   // stillness steadies the hands
    this._burst(this.playerMesh.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 0x9fb4ff);
    this._log('⛨ You plant your feet and watch the rhythm of the fight — braced, and your focus steadies.');
    audio.sfxBlock();
    await wait(600);
    this._afterPlayerAction();
  }

  async _strike(target, timing, baseMult, silent = false, opts = {}) {
    const { pierce = false } = opts;
    let dmg = this._playerAtk() * timing.mult * baseMult * (0.92 + this.rng() * 0.16);
    if (this._openingNow > 0) dmg *= 1 + this._openingNow;   // the marked opening pays off
    if (timing.grade === 'perfect' && run.hasSynergy('high_noon')) dmg *= 1.2;
    let crit = false;
    let luck = run.stats.luck || 0;
    if (run.hasSynergy('stained_glass')) luck += 10;
    if (this.rng() * 100 < luck) { crit = true; dmg *= run.hasSynergy('glassworks') ? 2.5 : 2; }
    if (run.flags.critShatter && this.shatterNext) { dmg += this.shatterNext; this.shatterNext = 0; }
    if (run.flags.executeBonus && target.hp / target.maxHP < 0.3) dmg *= 1.5;
    if (target.role === 'guard' && !pierce) dmg *= 0.75;
    if (target.warded) {
      if (!pierce) dmg *= 0.55;
      target.warded = false;
      this._log(pierce ? 'The meteor bursts the rune-wall outright!' : 'The rune-wall takes the brunt and shatters.');
    }
    dmg = Math.max(1, Math.round(dmg));

    this._burst(target.mesh.position.clone().add(new THREE.Vector3(0, 1, 0.3)));
    this._shake(target.mesh);
    this._hurtEnemy(target, dmg, crit ? 'CRIT!' : timing.grade === 'perfect' ? 'Perfect!' : timing.grade === 'echo' ? 'Echo!' : '');
    if (!silent) this._log(crit ? `Critical strike — ${dmg}!` : `You strike for ${dmg}.`);

    if (timing.grade === 'perfect') audio.sfxPerfect();
    else if (timing.grade === 'good') audio.sfxGood();
    if (crit && run.flags.critShatter) this.shatterNext = run.flags.critShatter;
    if (crit && run.hasSynergy('stained_glass')) run.gainShards(1);
    if (timing.grade === 'perfect' && this.perfectHealLeft > 0) {
      this.perfectHealLeft--;
      this._healPlayer(1);
    }
    if (timing.grade === 'perfect' && run.flags.perfectShard) run.gainShards(run.flags.perfectShard);
    if (timing.grade === 'perfect' && run.flags.stunOnPerfect && !target.dead
      && this.rng() * 100 < run.flags.stunOnPerfect) {
      target.stun = 1;
      this._log(`${target.name} reels, stunned!`);
    }
    if (target.dead) {
      audio.sfxEnemyDie();
      if (run.flags.killHeal) this._healPlayer(run.flags.killHeal);   // halves per felled foe
      if (run.flags.killShard) run.gainShards(run.flags.killShard);
    }
    if (!silent && run.flags.doubleStrike && !target.dead && this.rng() * 100 < run.flags.doubleStrike) {
      await wait(180);
      this._log('Your second shadow strikes!');
      await this._strike(target, { grade: 'echo', mult: timing.mult * 0.5 }, baseMult, true);
    }
    if (run.flags.burnOnHit && !target.dead) {
      target.burn = Math.max(target.burn, run.flags.burnOnHit * (run.flags.burnDouble ? 2 : 1));
      target.burnTurns = Math.max(target.burnTurns, 2);
    }
    if (crit && run.hasSynergy('fulgurite') && !target.dead) {
      target.burn = Math.max(target.burn, 3 * (run.flags.burnDouble ? 2 : 1));
      target.burnTurns = Math.max(target.burnTurns, 3);
    }
    if (run.flags.chillOnHit && !target.dead) target.chill = (target.chill || 0) + run.flags.chillOnHit;
    this._refreshCards();
  }

  async _playerAbility(ab) {
    if (this.state !== 'playerMenu') return;
    if ((this.abilityCds[ab.id] || 0) > 0) return;
    this.state = 'playerActing';
    this._hideMenu();
    this.abilityCds[ab.id] = ab.cd;
    // a marked opening sharpens abilities too
    this._openingNow = this.opening;
    this.opening = 0;
    if (this._openingNow > 0) this._log(`The opening you cut — the cast lands +${Math.round(this._openingNow * 100)}% harder!`);
    if (run.flags.abilityToll) {   // the Hollow Chest takes its cut — in focus now
      this._focusShift(-0.5, '(the hollow)');
    }
    this._log(`✧ ${ab.name}!`);
    const alive = this._aliveEnemies();
    // casts leave the wanderer's hands as bolts — the paper self stays put
    const castFrom = () => this.playerMesh.position.clone().add(new THREE.Vector3(0, 1.6, 0));
    const castAt = e => e.mesh.position.clone().add(new THREE.Vector3(0, 1.1, 0));
    if (ab.kind === 'aoe') {
      const timing = await this._startTiming('strike');
      for (const e of alive) {
        await this._projectile(castFrom(), castAt(e), '#ffe9a0', { dur: 0.2 });
        await this._strike(e, timing, ab.mult, true);
      }
      this._log(`${ab.name} sweeps the field!`);
    } else if (ab.kind === 'burn_all') {
      for (const e of alive) {
        await this._projectile(castFrom(), castAt(e), '#ff8a3a', { dur: 0.2 });
        this._burst(castAt(e), 0xff8a3a);
        e.burn = Math.max(e.burn, ab.burn * (run.flags.burnDouble ? 2 : 1));
        e.burnTurns = Math.max(e.burnTurns, 3);
        this._float(e.mesh.position.clone().add(new THREE.Vector3(0, 1.4, 0)), '🔥', 'burn');
      }
      this._log('The hymn takes hold — everything burns.');
    } else if (ab.kind === 'stun') {
      const target = this.enemies[this.targetId]?.dead ? alive[0] : this.enemies[this.targetId];
      if (target) {
        await this._projectile(castFrom(), castAt(target), '#ffffff', { dur: 0.24 });
        this._burst(castAt(target), 0xdfe6ff);
        target.stun = 1;
        this._float(target.mesh.position.clone().add(new THREE.Vector3(0, 1.4, 0)), '✶', 'stun');
        this._log(`${target.name} rings like a bell and forgets its turn.`);
      }
    } else if (ab.kind === 'heal_self') {
      this._healPlayer(ab.amount);   // ability amounts are half-vessels now
      this._burst(castFrom(), 0x8affc4);
      audio.sfxHeal();
    } else if (ab.kind === 'weaken_all') {
      for (const e of alive) {
        await this._projectile(castFrom(), castAt(e), '#9fb4ff', { dur: 0.18, size: 0.45 });
        e.chill = (e.chill || 0) + ab.atkDown;
      }
      this._log('The foes sag, weakened.');
    } else if (ab.kind === 'smite') {
      const target = this.enemies[this.targetId]?.dead ? alive[0] : this.enemies[this.targetId];
      if (target) {
        const timing = await this._startTiming('strike');
        await this._projectile(castFrom(), castAt(target), '#ffe9a0', { dur: 0.26, size: 0.9, arc: 1.4 });
        await this._strike(target, timing, ab.mult, false);
      }
    } else if (ab.kind === 'gamble') {
      const target = this.enemies[this.targetId]?.dead ? alive[0] : this.enemies[this.targetId];
      if (target) {
        await this._projectile(castFrom(), castAt(target), '#c79bff', { dur: 0.3, arc: 1.6 });
        const mult = this.rng() * 3;
        if (mult < 0.25) this._log('The die comes up hollow — nothing!');
        else await this._strike(target, { grade: mult > 2.2 ? 'perfect' : 'good', mult }, 1, true);
      }
    } else if (ab.kind === 'leech') {
      const target = this.enemies[this.targetId]?.dead ? alive[0] : this.enemies[this.targetId];
      if (target) {
        await this._projectile(castFrom(), castAt(target), '#8affc4', { dur: 0.24 });
        const before = target.hp;
        await this._strike(target, { grade: 'good', mult: ab.mult }, 1, true);
        const dealt = before - Math.max(0, target.hp);
        await this._projectile(castAt(target), castFrom(), '#8affc4', { dur: 0.28, size: 0.45 });
        if (dealt > 0) this._healPlayer(1);   // drink back half a vessel
      }
    } else if (ab.kind === 'frenzy') {
      this.frenzyAtk += ab.atkUp;
      if (run.hp > ab.selfDmg) this._damagePlayer(ab.selfDmg);   // selfDmg is half-vessels
      this._burst(castFrom(), 0xff6a5a);
      this._log(`The drum takes its due — +${ab.atkUp} ATK for this battle.`);
    }
    this._refreshCards();
    await wait(650);
    this._afterPlayerAction();
  }

  async _useCharge() {
    if (this.state !== 'playerMenu' || run.consumables.charge <= 0) return;
    this.state = 'playerActing';
    this._hideMenu();
    run.consumables.charge--;
    audio.sfxDetonate();
    const dmg = 10 + (this.team.tier || 1) * 2 + (run.flags.chargeDmg || 0);
    this._log(`✸ The star-charge detonates for ${dmg} to all foes!`);
    for (const e of this._aliveEnemies()) {
      this._burst(e.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xff9a4a);
      this._shake(e.mesh);
      this._hurtEnemy(e, dmg, '✸');
    }
    this._refreshCards();
    await wait(700);
    this._afterPlayerAction();
  }

  async _useDew() {
    if (this.state !== 'playerMenu' || run.consumables.dew <= 0) return;
    this.state = 'playerActing';
    this._hideMenu();
    run.consumables.dew--;
    audio.sfxHeal();
    let amount = Math.min(6, 4 + (run.flags.dewPotency || 0));   // 2★, relics push to 3★
    if (run.flags.dewMuted) amount = Math.ceil(amount / 2);   // the Starving Halo tithes it
    this._healPlayer(amount);
    this._log(`❋ The star-dew glows going down. +${fmtV(amount)}.`);
    this._refreshCards();
    await wait(650);
    this._afterPlayerAction();
  }

  async _flee() {
    if (this.state !== 'playerMenu') return;
    this.state = 'playerActing';
    this._hideMenu();
    const maxSpd = Math.max(...this._aliveEnemies().map(e => e.spd));
    const chance = run.flags.fleeSure ? 1 : Math.min(0.9, Math.max(0.3, 0.6 + (run.stats.spd - maxSpd) * 0.05));
    if (this.rng() < chance) {
      this._log('You fold sideways out of the fight.');
      await wait(700);
      this._end({ fled: true });
    } else {
      this._log('No escape — the way is blocked!');
      await wait(700);
      this._afterPlayerAction();
    }
  }

  _hurtEnemy(e, dmg, tag) {
    e.hp -= dmg;
    this._float(e.mesh.position.clone().add(new THREE.Vector3(0, 1.6, 0)), `−${dmg}${tag ? ' ' + tag : ''}`, 'dmg');
    if (e.hp <= 0 && !e.dead) {
      e.dead = true;
      e.hp = 0;
      this._tween(e.mesh.rotation, { z: Math.PI / 2 }, 0.4);
      this._tween(e.mesh.position, { y: -0.4 }, 0.4);
      setTimeout(() => { e.mesh.visible = false; }, 600);
    } else if (e.boss && !e.enraged && e.hp < e.maxHP / 2) {
      e.enraged = true;   // enraged blows land ½★ heavier
      this._log(`${e.name} is ENRAGED!`);
    } else if (!e.boss && e.role === 'brute' && !e.enraged && e.hp < e.maxHP * 0.4) {
      e.enraged = true;
      this._log(`${e.name} bellows and ENRAGES!`);
    }
  }

  _aliveEnemies() { return this.enemies.filter(e => !e.dead); }

  async _afterPlayerAction() {
    this._openingNow = 0;   // the opening is spent with the action
    this._refreshCards();
    if (!this._aliveEnemies().length) return this._victory();
    // extra action (Patient Comet)
    if (run.flags.extraActionEvery && !this._tookExtra
      && this.turn > 0 && (this.turn + 1) % run.flags.extraActionEvery === 0) {
      this._tookExtra = true;
      this._log('The Patient Comet lends you a moment — act again!');
      this.state = 'playerMenu';
      this._showMenu();
      return;
    }
    this._tookExtra = false;
    await this._enemyPhase();
  }

  // ------------------------------------------------------------ enemy turn ---

  async _enemyPhase() {
    this.state = 'enemyPhase';
    const tier = this.team.tier ?? 0;
    for (const e of this._aliveEnemies()) {
      // burn ticks at the start of the foe's action
      if (e.burnTurns > 0) {
        this._hurtEnemy(e, e.burn, '🔥');
        e.burnTurns--;
        this._refreshCards();
        await wait(420);
        if (e.dead) continue;
      }
      if (e.stun > 0) {
        e.stun--;
        this._log(`${e.name} is stunned and loses its turn.`);
        this._refreshCards();
        await wait(500);
        continue;
      }
      if (e.charging) {
        e.charging = false;
        // wound-up blows land as unblockable crushes in the deep (and always from bosses)
        const crush = e.boss || tier >= 2;
        await this._enemyStrike(e, crush ? { crush: true } : { heavy: true });
      } else if (e.deity && this.rng() < 0.65) {
        // the Wound made flesh fights with every voice at once
        const move = this.turn % 3;
        if (move === 0) {
          e.charging = true;
          this._log(`${e.name} folds the light back for a CRUSHING blow…`);
          this._refreshCards();
          await wait(600);
          continue;
        } else if (move === 1) {
          const mend = 4 + Math.round((this.team.tier || 6) * 0.8);
          await this._projectile(
            this.playerMesh.position.clone().add(new THREE.Vector3(0, 1.4, 0)),
            e.mesh.position.clone().add(new THREE.Vector3(0, 1.6, 0)),
            '#a6ff57', { dur: 0.35, size: 0.5 }
          );
          this._focusShift(-1, '(drunk away)');
          e.hp = Math.min(e.maxHP, e.hp + mend);
          this._float(e.mesh.position.clone().add(new THREE.Vector3(0, 1.6, 0)), `+${mend}`, 'heal');
          this._log(`${e.name} drinks your focus out through the seam between you and the world…`);
          this._refreshCards();
          await wait(550);
        } else {
          await this._enemyStrike(e, { hits: 2 });
        }
      } else if (e.role === 'mystic' && this.rng() < 0.42) {
        e.intent = 'special';
        const hurt = this._aliveEnemies().filter(o => o !== e && o.hp < o.maxHP * 0.7);
        const roll = this.rng();
        if (hurt.length && roll < 0.3) {
          const ally = hurt.sort((a, b) => a.hp / a.maxHP - b.hp / b.maxHP)[0];
          const mend = Math.round(ally.maxHP * 0.25);
          ally.hp = Math.min(ally.maxHP, ally.hp + mend);
          this._float(ally.mesh.position.clone().add(new THREE.Vector3(0, 1.6, 0)), `+${mend}`, 'heal');
          this._log(`${e.name} re-folds ${ally.name}'s wounds shut.`);
        } else if (tier >= 3 && roll < 0.55) {
          const mend = 3 + Math.round(tier * 0.7);
          await this._projectile(
            this.playerMesh.position.clone().add(new THREE.Vector3(0, 1.4, 0)),
            e.mesh.position.clone().add(new THREE.Vector3(0, 1.4, 0)),
            '#8affc4', { dur: 0.32, size: 0.45 }
          );
          this._focusShift(-1, '(siphoned)');
          e.hp = Math.min(e.maxHP, e.hp + mend);
          this._float(e.mesh.position.clone().add(new THREE.Vector3(0, 1.6, 0)), `+${mend}`, 'heal');
          this._log(`${e.name} siphons your focus into itself…`);
        } else if (tier >= 2 && roll < 0.75) {
          this._focusShift(-1, '(knotted)');
          this._log(`${e.name} knots the light around your hands — your focus frays!`);
        } else {
          this._log(`${e.name} hexes you with cold starlight…`);
          await this._projectile(
            e.mesh.position.clone().add(new THREE.Vector3(0, 1.4, 0)),
            this.playerMesh.position.clone().add(new THREE.Vector3(0, 1.2, 0)),
            this.accent, { dur: 0.28, size: 0.5 }
          );
          this._focusShift(-0.5, '(hexed)');
        }
        this._refreshCards();
        await wait(550);
      } else if (e.role === 'guard' && this.rng() < 0.32) {
        e.intent = 'special';
        const bare = this._aliveEnemies().filter(o => o !== e && !o.warded);
        if (tier >= 2 && bare.length && this.rng() < 0.6) {
          const ally = bare.sort((a, b) => a.hp - b.hp)[0];
          ally.warded = true;
          this._log(`${e.name} raises a rune-wall around ${ally.name}.`);
        } else if (!e.warded) {
          e.warded = true;
          this._log(`${e.name} locks its plates into a rune-shell.`);
        } else {
          await this._enemyStrike(e);
        }
        this._refreshCards();
        await wait(550);
      } else if (this.rng() < (e.boss ? 0.12 + 0.05 * (this.team.tier || 1) : 0.15)) {
        e.charging = true;
        this._log(`${e.name} is gathering a ${e.boss || tier >= 2 ? 'crushing' : 'heavy'} blow!`);
        this._refreshCards();
        await wait(600);
        continue;
      } else if (e.role === 'swift' && this.rng() < 0.3 + tier * 0.08) {
        // the flurry: every swing gets its own quickening bar
        await this._enemyStrike(e, { hits: tier >= 3 ? 3 : 2 });
      } else {
        await this._enemyStrike(e);
      }
      if (run.hp <= 0) return this._defeat();
      this._refreshCards();
      await wait(280);
    }
    this.turn++;
    if (this.playerChill > 0 && this.rng() < 0.5) this.playerChill--;
    for (const k of Object.keys(this.abilityCds)) this.abilityCds[k] = Math.max(0, this.abilityCds[k] - 1);
    if (this._aliveEnemies().length === 0) return this._victory();
    // cinders in your folds burn away focus, not vessels — mistakes alone cost stars
    if (this.playerBurn && this.playerBurn.turns > 0) {
      this.playerBurn.turns--;
      this._focusShift(-CONFIG.battle.focus.burnTick, '🔥');
    }
    // the bloom keeps you: ½★ every other turn, every turn under full verdance
    if ((run.hasSynergy('verdance') || (run.hasSynergy('fullbloom') && this.turn % 2 === 0))
      && run.hp < run.stats.maxHP) {
      this._healPlayer(1);
      this._float(this.playerMesh.position.clone().add(new THREE.Vector3(0.8, 1.6, 0)), '❀', 'heal');
    }
    this.braced = false;   // the stance and the poise are spent with the storm
    this.poise = 0;
    this.state = 'playerMenu';
    this._showMenu();
    this._refreshCards();
  }

  // One enemy attack action. opts.heavy: a wound-up blow. opts.crush: an
  // unblockable heavy — one wide shape falls and only a knife-thin leap (or
  // a passive dodge) saves you. opts.hits > 1: a flurry — one falling note
  // per swing, graded shape by shape.
  //
  // Star Vessel rules: perfect and good blocks NULLIFY the blow — a perfect
  // steadies your focus, a good chips it. Only a fully missed shape (or a
  // crush you fail to leap) costs vessels, in fixed half-star amounts from
  // the tier table. Heavies and crushes cost double, capped at 3★.
  async _enemyStrike(e, opts = {}) {
    const { heavy = false, crush = false, hits = 1 } = opts;
    const tier = this.team.tier || 1;
    const veil = ['DESERT', 'CRIMSON'].includes(this.team.biome);   // sand hides the shapes
    // mystics cast from where they stand; heavy and crushing blows are
    // bodily things and always close the distance
    const ranged = e.ranged && !crush && !heavy;
    this._log(`${e.name}${crush ? '’s CRUSHING blow falls — leap on the beat!'
      : heavy ? ' unleashes the heavy blow!'
      : hits > 1 ? (ranged ? ` looses a volley of ${hits}!` : ` strikes in a flurry of ${hits}!`)
      : ranged ? ' takes aim…' : ' attacks!'}`);
    if (ranged) {
      // a gathering flare where the bolt will leave from
      this._burst(e.mesh.position.clone().add(new THREE.Vector3(0, 1.3, 0)), this.accent);
      await wait(220);
    } else {
      this._tween(e.mesh.position, { x: this.playerHome.x + 1.6, z: this.playerHome.z - 1.0 }, 0.3);
      await wait(300);
    }

    const speed = 1 + tier * 0.04 + (crush ? 0.3 : heavy ? 0.2 : 0) + (this.playerChill || 0) * 0.08;
    const res = await this._blockRun({ swings: hits, tier, crush, speed, veil });

    // sprung traps bite before the blows land: ½★ each (focus already paid)
    if (res.trapsHit > 0) {
      this._damagePlayer(CONFIG.battle.damage.trap * res.trapsHit, '⚠');
      this._log('The feint bites — you moved to block a lie.');
      this._shake(this.playerMesh);
      audio.sfxHurt();
    }

    // what a landed hit costs, in half-vessels, from the tier table
    const D = CONFIG.battle.damage;
    const F = CONFIG.battle.focus;
    let base = tier < D.midTier ? D.low : tier < D.highTier ? D.mid : D.high;
    if (e.boss) base += D.bossPlus;
    if (e.enraged) base += D.enragePlus;
    base = Math.max(1, base - Math.floor((e.chill || 0) / D.chillPer));
    const perHitHalves = hits > 1 ? Math.max(1, Math.round(base / 2))
      : (heavy || crush) ? Math.min(D.heavyCap, base * D.heavyMult) : base;

    for (let h = 0; h < hits; h++) {
      if (run.hp <= 0) break;
      const grade = res.grades[h] || 'miss';
      if (ranged) {
        await this._projectile(
          e.mesh.position.clone().add(new THREE.Vector3(0, 1.3, 0)),
          this.playerMesh.position.clone().add(new THREE.Vector3(0, 1.2, 0)),
          this.accent, { dur: 0.24 }
        );
      }

      const autoDodge = run.flags.firstStrikeDodge && !this.firstDodgeUsed;
      const passiveDodge = this.rng() * 100 < (run.stats.dodge || 0);
      const playerPos = () => this.playerMesh.position.clone().add(new THREE.Vector3(0, 1.2, 0));
      if (crush && grade === 'perfect') {
        this._float(this.playerMesh.position.clone().add(new THREE.Vector3(0, 2, 0)), 'leapt clear!', 'heal');
        this._log('You fold sideways — the blow shatters empty ground!');
        audio.sfxBlock();
      } else if (autoDodge || passiveDodge) {
        this.firstDodgeUsed = true;
        this._float(this.playerMesh.position.clone().add(new THREE.Vector3(0, 2, 0)), 'dodged!', 'heal');
        this._log('You flutter aside — dodged!');
      } else if (!crush && grade === 'perfect') {
        // a PERFECT block turns the whole blow — and steadies your focus
        audio.sfxBlock();
        this._burst(playerPos(), 0x9fe8ff);
        this._focusShift(F.perfectBlock);
        if (this.blockHealLeft > 0) { this.blockHealLeft--; this._healPlayer(1); }
        // the braced blade (or a parrying relic) answers
        const riposte = (this.braced ? Math.round(this._playerAtk() * 0.6) : 0) + (run.flags.riposte || 0);
        if (riposte > 0 && !e.dead) {
          this._hurtEnemy(e, riposte, '⛨');
          this._log(this.braced ? 'PERFECT block — and your braced blade answers!' : 'PERFECT block — the parry bites back!');
        } else {
          this._log('PERFECT block — nothing lands, and your focus steadies!');
        }
      } else if (!crush && grade === 'good') {
        // a good block still turns the blow — the price is focus, not stars
        audio.sfxBlock();
        this._burst(playerPos(), 0x9fb4ff);
        this._focusShift(-F.good);
        this._log('Blocked — but the jolt chips your focus.');
      } else {
        // the blow lands whole: a missed shape, or a crush you failed to leap
        let halves = perHitHalves;
        this._focusShift(-F.missBlock);
        if (crush || heavy) this._focusShift(-F.heavyLanded);   // big blows shake you worse
        if (this.shieldLeft > 0) { halves = Math.ceil(halves / 2); this.shieldLeft--; }
        if (run.flags.waterWeak && ['SEA', 'BRIDGE'].includes(this.team.biome)) halves += 1;
        audio.sfxHurt();
        this._burst(playerPos(), crush ? 0xff6a4a : 0xff8a5a);
        this._damagePlayer(halves);
        this._shake(this.playerMesh);
        if (run.flags.thorns && !e.dead) {
          this._hurtEnemy(e, run.flags.thorns, '⟁');
        }
        // the land fights through its beasts
        this._applyBiomeAffliction(e);
      }
      if (hits > 1) { this._refreshCards(); await wait(200); }
    }
    if (ranged) {
      await wait(150);
    } else {
      this._tween(e.mesh.position, { x: e.home.x, z: e.home.z }, 0.3);
      await wait(320);
    }
  }

  // ---------------------------------------------------- block lanes (A/S/D) ---
  // Blocking is a falling rhythm now: shapes descend three lanes and you
  // press A, S or D as each crosses the hit-line. Notes coalesce out of the
  // dark as they fall. Traps thread between them in the deep — spring one
  // and the feint bites. Crushing blows fall as one wide shape: leap (any
  // key) inside a knife-thin window or take the blow whole.

  _blockRun({ swings = 1, tier = 1, crush = false, speed = 1, veil = false }) {
    return new Promise(resolve => {
      const L = CONFIG.battle.lanes;
      const el = $('b-lanes');
      const windowEl = el.querySelector('.bl-window');
      for (const n of windowEl.querySelectorAll('.bl-note, .bl-judge')) n.remove();
      el.classList.remove('hidden');
      el.classList.remove('coalesce');
      void el.offsetWidth;            // restart the coalesce animation
      el.classList.add('coalesce');

      const widen = (1 + 0.3 * (run.stats.blockBonus || 0))
        * (this.braced ? 1.5 : 1)
        * (this.poise ? 1.25 : 1)
        + (run.hasSynergy('eclipse') ? 0.15 : 0);
      const slow = (1 + Math.min(0.4, run.flags.noteSlow || 0))
        * (this.braced ? 1.28 : 1) * (this.poise ? 1.15 : 1);
      const fall = L.fall * slow / Math.max(0.6, speed);
      // pattern shape: flurries ride one note per swing; a single blow
      // falls as 1–3 notes with the depth of the region
      const perSwing = crush || swings > 1 ? 1 : 1 + (tier >= 2 ? 1 : 0) + (tier >= 4 ? 1 : 0);
      const spacing = (L.spacing / Math.max(0.7, speed)) * (swings > 1 ? 0.78 : 1) * slow;
      const notes = [];
      let prevLane = Math.floor(this.rng() * 3);
      let t = L.lead + fall;
      for (let s = 0; s < swings; s++) {
        for (let k = 0; k < perSwing; k++) {
          let lane = Math.floor(this.rng() * 3);
          if (tier >= 3 && this.rng() < 0.4) lane = (prevLane + 1) % 3;   // little runs
          prevLane = lane;
          notes.push({ swing: s, lane, hit: t, crush, trap: false, resolved: false, el: null });
          t += spacing;
        }
      }
      // traps thread between the true notes at depth
      const traps = [];
      if (!crush && tier >= 2) {
        let nTraps = this.rng() < Math.min(0.65, 0.18 + 0.09 * tier) ? 1 : 0;
        if (tier >= 5 && this.rng() < 0.35) nTraps++;
        for (let i = 0; i < nTraps && notes.length; i++) {
          const anchor = notes[Math.floor(this.rng() * notes.length)];
          let lane = Math.floor(this.rng() * 3);
          if (lane === anchor.lane) lane = (lane + 1 + Math.floor(this.rng() * 2)) % 3;
          traps.push({
            lane, hit: anchor.hit + spacing * (this.rng() < 0.5 ? 0.5 : -0.5),
            trap: true, crush: false, sprung: false, resolved: false, el: null,
          });
        }
      }
      this.lane = {
        notes, traps, t: 0, fall, veil: veil && !run.flags.veilSight,
        winP: (crush ? L.dodgeWin : L.perfectWin) * widen
          * (crush ? 1 + 0.25 * (run.flags.dodgePlus || 0) : 1),
        winG: crush ? 0 : L.goodWin * widen,
        winT: L.trapWin,
        end: t + fall * 0.35 + 0.3,
        grades: Array.from({ length: swings }, () => []),
        trapsHit: 0,
        resolve,
      };
      this.laneActive = true;
      $('b-lanes-label').textContent = crush
        ? '☄ CRUSHING BLOW — leap on the beat! (any key)'
        : swings > 1 ? 'Block the flurry — A · S · D' : 'Block! — A · S · D';
    });
  }

  _lanePress(lane) {
    const K = this.lane;
    if (!K) return;
    // nearest unresolved true note in this lane (a crush shape takes any lane)
    let best = null, bestD = Infinity;
    for (const n of K.notes) {
      if (n.resolved) continue;
      if (!n.crush && n.lane !== lane) continue;
      const d = Math.abs(K.t - n.hit);
      if (d < bestD) { best = n; bestD = d; }
    }
    if (best && bestD <= (best.crush ? K.winP : K.winG)) {
      best.resolved = true;
      const grade = bestD <= K.winP ? 'perfect' : 'good';
      K.grades[best.swing].push(grade === 'perfect' ? 1 : 0.55);
      this._laneJudge(best, grade);
      if (grade === 'perfect') audio.sfxPerfect(); else audio.sfxGood();
      return;
    }
    // a trap in reach? springing it is the mistake it was shaped to be
    let trap = null, trapD = Infinity;
    for (const tr of K.traps) {
      if (tr.resolved || tr.lane !== lane) continue;
      const d = Math.abs(K.t - tr.hit);
      if (d < trapD) { trap = tr; trapD = d; }
    }
    if (trap && trapD <= K.winT) {
      trap.resolved = true;
      trap.sprung = true;
      if (this.trapWardLeft > 0) {
        this.trapWardLeft--;
        this._laneJudge(trap, 'warded');
      } else {
        K.trapsHit++;
        this._focusShift(-CONFIG.battle.focus.trap);
        this._laneJudge(trap, 'trap');
        audio.sfxHurt();
      }
    }
    // a stray press otherwise: nothing bites, nothing blocks
  }

  _lanePointer() {
    // mouse/touch fallback: press the lane of whichever shape is nearest
    const K = this.lane;
    if (!K) return;
    let best = null, bestD = Infinity;
    for (const n of [...K.notes, ...K.traps]) {
      if (n.resolved) continue;
      const d = Math.abs(K.t - n.hit);
      if (d < bestD) { best = n; bestD = d; }
    }
    if (best) this._lanePress(best.crush ? 0 : best.lane);
  }

  _laneJudge(n, grade) {
    if (n.el) {
      n.el.classList.add(grade === 'trap' ? 'sprung' : grade === 'warded' ? 'sprung'
        : grade === 'miss' ? 'missed' : 'struck');
    }
    const windowEl = document.querySelector('#b-lanes .bl-window');
    if (!windowEl) return;
    const j = document.createElement('div');
    j.className = 'bl-judge ' + grade;
    j.textContent = grade === 'perfect' ? 'PERFECT' : grade === 'good' ? 'good'
      : grade === 'warded' ? 'warded!' : grade === 'trap' ? 'TRAP!' : 'miss';
    j.style.left = n.crush ? '50%' : (n.lane * 33.3 + 16.6) + '%';
    windowEl.appendChild(j);
    setTimeout(() => j.remove(), 700);
  }

  _laneFinish() {
    const K = this.lane;
    if (!K) return;
    this.laneActive = false;
    this.lane = null;
    $('b-lanes').classList.add('hidden');
    const grades = K.grades.map(list => {
      if (!list.length) return 'miss';
      const avg = list.reduce((a, b) => a + b, 0) / list.length;
      return avg >= 0.85 ? 'perfect' : avg >= 0.45 ? 'good' : 'miss';
    });
    K.resolve({ grades, trapsHit: K.trapsHit });
  }

  // The land fights through its beasts when a blow lands. Afflictions
  // pressure your FOCUS and your tempo — vessels are only ever lost to
  // missed blocks, failed leaps and sprung traps.
  _applyBiomeAffliction(e) {
    const biome = this.team.biome;
    if (biome === 'WOUND' && this.rng() < 0.35) {
      this.playerBurn = { turns: 2 };
      if ((this.playerChill || 0) < 3) this.playerChill = (this.playerChill || 0) + 1;
      this._log('Un-light seeps into your folds — it burns your focus cold.');
    } else if (['VOLCANO', 'CRIMSON'].includes(biome) && this.rng() < 0.4) {
      this.playerBurn = { turns: 2 };
      this._log('Cinders catch in your paper folds — your focus BURNS!');
    } else if (['TUNDRA', 'LUNAR'].includes(biome) && this.rng() < 0.4 && (this.playerChill || 0) < 3) {
      this.playerChill = (this.playerChill || 0) + 1;
      this._log('Frost stiffens your hands — the marker runs faster while you shiver.');
    } else if (['SEA', 'BRIDGE'].includes(biome) && !e.dead) {
      const drink = 2 + (this.team.tier || 1);
      e.hp = Math.min(e.maxHP, e.hp + drink);
      this._float(e.mesh.position.clone().add(new THREE.Vector3(0, 1.6, 0)), `+${drink}`, 'heal');
    }
  }

  // ---------------------------------------------------------------- ending ---

  async _victory() {
    this.state = 'won';
    const tier = this.team.tier || 1;
    const boss = !!this.team.boss;
    let shards = Math.round((4 + 2.5 * tier + this.rng() * 4) * this.enemies.length * (boss ? 3.5 : 1));
    shards = run.gainShards(shards);
    const drops = { shards };
    if (this.rng() < 0.18 + (run.flags.chargeDropBonus || 0)) { run.consumables.charge++; drops.charge = 1; }
    else if (this.rng() < 0.05) { run.consumables.dew++; drops.dew = 1; }   // dew is precious now
    if (run.flags.afterBattleHeal) this._healPlayer(run.flags.afterBattleHeal);   // halves
    run.battlesWon++;
    if (boss) run.bossesDown++;
    this._log(`Victory! +${shards} ☆${drops.charge ? ' · +1 ✸' : ''}${drops.dew ? ' · +1 ❋' : ''}`);
    await wait(1300);
    this._end({ won: true, drops });
  }

  async _defeat() {
    if (run.flags.reviveOnce && !run.reviveUsed) {
      run.reviveUsed = true;
      run.hp = Math.round(run.stats.maxHP / 2);
      this._log('☾ Lunar Grace! Moonlight re-folds your paper heart — you rise again!');
      this._refreshCards();
      await wait(1200);
      this.state = 'playerMenu';
      this._showMenu();
      return;
    }
    this.state = 'lost';
    run.hp = 0;
    this._log('Your paper form comes apart into drifting light…');
    this._tween(this.playerMesh.rotation, { z: -Math.PI / 2 }, 0.6);
    await wait(1600);
    this._end({ lost: true });
  }

  _end(result) {
    this.active = false;
    audio.battleEnd(!!result.won);
    if (result.lost) audio.sfxDefeat();
    document.body.classList.remove('in-battle');
    $('battle').classList.add('hidden');
    $('b-timing').classList.add('hidden');
    $('b-lanes').classList.add('hidden');
    this.timingActive = false;
    this.laneActive = false;
    this.lane = null;
    const cb = this.onEnd;
    this.onEnd = null;
    this._disposeScene();
    if (cb) cb(result);
  }

  _disposeScene() {
    if (!this.scene) return;
    const shared = new Set(Object.values(this._tex));
    this.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        if (m.map && !shared.has(m.map)) m.map.dispose();
        m.dispose();
      }
    });
    this.scene = null;
  }

  // ---------------------------------------------------------------- helpers ---

  _tween(obj, to, dur) {
    const from = {};
    for (const k of Object.keys(to)) from[k] = obj[k];
    this.tweens.push({ obj, from, to, t: 0, dur });
  }

  _shake(mesh) {
    this.shakes = this.shakes || [];
    this.shakes.push({ mesh, t: 0, base: mesh.position.x });
  }

  _burst(pos, color = 0xffe9a0) {
    for (const b of this.burstPool) {
      const a = Math.random() * Math.PI * 2;
      b.t = 0;
      b.sp.material.color.set(color);
      b.sp.position.copy(pos);
      b.vx = Math.cos(a) * (1.2 + Math.random());
      b.vz = Math.sin(a) * (1.2 + Math.random());
      b.vy = 1 + Math.random() * 1.5;
    }
  }

  // A bolt of light arcing from caster to target — ranged attacks and casts
  // fire one of these instead of lunging across the stage.
  _projectile(from, to, color, { size = 0.6, dur = 0.3, arc = 0.9 } = {}) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this._shared('bolt', () => makeGlowTexture('#ffffff')),
      color: new THREE.Color(color), transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    sp.scale.setScalar(size);
    sp.position.copy(from);
    this.scene.add(sp);
    return new Promise(resolve => {
      this.projectiles.push({ sp, from: from.clone(), to: to.clone(), t: 0, dur, arc, resolve });
    });
  }

  update(dt) {
    if (!this.active || !this.scene) return;
    this.time += dt;

    // strike bar: the energy coalesces first, then the marker flies
    if (this.timingActive) {
      const el = $('b-timing');
      if (this.timingPhase === 'gather') {
        this.gatherT += dt;
        const p = Math.min(1, this.gatherT / this.gatherDur);
        el.style.setProperty('--gather', p);
        const orb = el.querySelector('.bt-gather');
        if (orb) {
          orb.style.opacity = 0.2 + p * 0.75;
          orb.style.transform = `translate(-50%, -50%) scale(${2.6 - p * 1.7})`;
        }
        for (const z of el.querySelectorAll('.bt-zone')) {
          z.style.opacity = p * (z.classList.contains('perfect') ? 1 : 0.9);
        }
        if (p >= 1) {
          this.timingPhase = 'live';
          el.classList.remove('gathering');
          if (orb) orb.style.opacity = 0;
          const marker = el.querySelector('.bt-marker');
          if (marker) marker.style.opacity = 1;
          // headless playtests: battle.strikeAutoplay = {p, g} pre-rolls a
          // grade and presses at the matching moment of the sweep
          if (this.strikeAutoplay) {
            const r = Math.random();
            this._strikeTarget = r < this.strikeAutoplay.p ? (this.zones.p0 + this.zones.p1) / 2
              : r < this.strikeAutoplay.p + this.strikeAutoplay.g
                ? Math.min(0.97, this.zones.p1 + (this.zones.g1 - this.zones.p1) * 0.5)
                : null;
          }
        }
      } else {
        this.timingT += dt * this.timingSpeed / CONFIG.battle.timing.travel;
        if (this.strikeAutoplay && this._strikeTarget != null && this.timingT >= this._strikeTarget) {
          this._strikeTarget = null;
          this._resolveTiming();
        }
        if (this.timingActive && this.timingT >= 1) { this.timingT = 1; this._resolveTiming(); }
        const marker = document.querySelector('#b-timing .bt-marker');
        if (marker && this.timingActive) {
          const shown = this.timingReverse ? 1 - this.timingT : this.timingT;
          marker.style.left = (shown * 100) + '%';
        }
        // desert sand-veil: the zones fade from sight partway across
        if (this.timingVeil && this.timingT > 0.4) {
          for (const z of document.querySelectorAll('#b-timing .bt-zone')) {
            z.style.transition = 'opacity 0.25s';
            z.style.opacity = 0;
          }
        }
      }
    }

    // the falling block-lanes
    if (this.laneActive && this.lane) {
      const K = this.lane;
      K.t += dt;
      const windowEl = document.querySelector('#b-lanes .bl-window');
      const H = windowEl ? windowEl.clientHeight : 216;
      const hitY = H - 30;
      for (const n of [...K.notes, ...K.traps]) {
        const p = 1 - (n.hit - K.t) / K.fall;   // 0 at spawn → 1 on the hit-line
        if (p < -0.02) continue;
        if (!n.el && p < 1.35 && windowEl) {
          n.el = document.createElement('div');
          n.el.className = 'bl-note' + (n.crush ? ' wide' : ' l' + n.lane) + (n.trap ? ' trap' : '');
          windowEl.appendChild(n.el);
        }
        if (n.el) {
          n.el.style.top = (-26 + p * (hitY + 26)) + 'px';
          if (!n.resolved) {
            // notes coalesce out of the dark as they fall…
            let op = Math.min(1, Math.max(0, p) / CONFIG.battle.lanes.fadePortion);
            // …and the sand-veil swallows them again near the line
            if (K.veil && p > 0.55) op *= Math.max(0, 1 - (p - 0.55) / 0.3);
            n.el.style.opacity = op;
          }
          if (p > 1.5) { n.el.remove(); n.el = null; }
        }
        // headless playtests: battle.laneAutoplay = {p, g} pre-rolls each
        // note and presses its lane at the matching offset
        if (this.laneAutoplay && !n.trap && !n.resolved) {
          if (n._auto === undefined) {
            const r = Math.random();
            n._auto = r < this.laneAutoplay.p ? 0
              : r < this.laneAutoplay.p + this.laneAutoplay.g ? (K.winP + K.winG) / 2 : null;
          }
          if (n._auto != null && K.t - n.hit >= n._auto - K.winP * 0.4) {
            this._lanePress(n.crush ? 0 : n.lane);
          }
        }
        const late = K.t - n.hit;
        if (!n.resolved && !n.trap && late > (n.crush ? K.winP : K.winG)) {
          n.resolved = true;
          K.grades[n.swing].push(0);
          this._laneJudge(n, 'miss');
        }
        if (!n.resolved && n.trap && late > K.winT) {
          n.resolved = true;   // the feint sails past, harmless
          if (n.el) n.el.classList.add('passed');
        }
      }
      if (K.t >= K.end) this._laneFinish();
    }

    // tweens
    for (const tw of this.tweens) {
      tw.t += dt / tw.dur;
      const p = Math.min(1, tw.t);
      const e = p * p * (3 - 2 * p);
      for (const k of Object.keys(tw.to)) tw.obj[k] = tw.from[k] + (tw.to[k] - tw.from[k]) * e;
    }
    this.tweens = this.tweens.filter(tw => tw.t < 1);

    // shakes
    if (this.shakes) {
      for (const s of this.shakes) {
        s.t += dt / 0.3;
        s.mesh.position.x = s.base + Math.sin(s.t * 40) * 0.12 * Math.max(0, 1 - s.t);
      }
      this.shakes = this.shakes.filter(s => s.t < 1);
    }

    // idle bobs & camera sway
    if (this.playerMesh && this.state !== 'lost') {
      this.playerMesh.position.y = Math.sin(this.time * 2.2) * 0.05;
    }
    for (const e of this.enemies || []) {
      if (!e.dead) e.mesh.position.y = Math.sin(this.time * 1.8 + e.id * 1.7) * 0.06;
    }
    this.camera.position.x = -7.6 + Math.sin(this.time * 0.4) * 0.25;
    this.camera.lookAt(0.7, 1.3, -0.7);

    // bursts
    for (const b of this.burstPool) {
      if (b.t >= 1) { b.sp.material.opacity = 0; continue; }
      b.t += dt / 0.5;
      b.sp.position.x += b.vx * dt;
      b.sp.position.y += b.vy * dt;
      b.sp.position.z += b.vz * dt;
      b.sp.material.opacity = Math.max(0, 0.9 * (1 - b.t));
    }

    // projectiles in flight
    if (this.projectiles?.length) {
      for (const p of this.projectiles) {
        p.t += dt / p.dur;
        const e = Math.min(1, p.t);
        p.sp.position.lerpVectors(p.from, p.to, e);
        p.sp.position.y += Math.sin(e * Math.PI) * p.arc;
        if (p.t >= 1) {
          this.scene.remove(p.sp);
          p.sp.material.dispose();
          p.resolve();
        }
      }
      this.projectiles = this.projectiles.filter(p => p.t < 1);
    }

    // the paper stands square to the audience — yaw-billboard every token
    const face = m => {
      m.rotation.y = Math.atan2(this.camera.position.x - m.position.x, this.camera.position.z - m.position.z);
    };
    if (this.playerMesh && this.state !== 'lost') face(this.playerMesh);
    for (const e of this.enemies || []) if (!e.dead) face(e.mesh);
  }
}

function hexRingLocal(outer, inner) {
  const shape = new THREE.Shape();
  const hole = new THREE.Path();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i / 6) * Math.PI * 2;
    const fx = Math.cos(a), fy = Math.sin(a);
    if (i === 0) { shape.moveTo(fx * outer, fy * outer); hole.moveTo(fx * inner, fy * inner); }
    else { shape.lineTo(fx * outer, fy * outer); hole.lineTo(fx * inner, fy * inner); }
  }
  shape.closePath(); hole.closePath();
  shape.holes.push(hole);
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

function shadowBlob(r) {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(r, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  return m;
}

function sceneryFor(biome, rng) {
  const std = c => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.9 });
  const s = 0.8 + rng() * 1.4;
  let mesh;
  switch (biome) {
    case 'FOREST': case 'VERDANT':
      mesh = new THREE.Mesh(new THREE.ConeGeometry(0.5 * s, 1.6 * s, 6), std(0x1d5c3c)); break;
    case 'MOUNTAIN':
      mesh = new THREE.Mesh(new THREE.ConeGeometry(0.7 * s, 2 * s, 5), std(0xbdbad4)); break;
    case 'VOLCANO':
      mesh = new THREE.Mesh(new THREE.ConeGeometry(0.6 * s, 1.4 * s, 5), std(0x4a3138)); break;
    case 'DESERT': case 'CRIMSON':
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.16 * s, 1.1 * s, 6), std(0x4c7a3c)); break;
    case 'TUNDRA': case 'LUNAR': {
      mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.4 * s), std(0xd7ecff));
      mesh.scale.y = 2.2; break;
    }
    case 'CRYSTAL': case 'SECRET': {
      mesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.4 * s),
        new THREE.MeshStandardMaterial({ color: 0xc79bff, flatShading: true, emissive: 0x7a3fd4, emissiveIntensity: 0.5 })
      );
      mesh.scale.y = 2.4; break;
    }
    default:
      mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4 * s, 0), std(0x565a86));
  }
  if (mesh.geometry.type === 'ConeGeometry' || mesh.geometry.type === 'CylinderGeometry') {
    mesh.position.y = (mesh.geometry.parameters.height || 1) / 2;
  } else {
    mesh.position.y = 0.5 * s * (mesh.scale.y || 1);
  }
  return mesh;
}
