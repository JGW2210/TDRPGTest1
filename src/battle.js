// The battle engine: a Pokémon-style diorama — your paper token front-left,
// foes back-right on a biome-styled stage — driven by menu turns with
// Paper-Mario timing: click the sliding marker to strike true or block.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { mulberry32, hash2, pick } from './rng.js';
import { BIOMES, FOES } from './names.js';
import { run } from './run.js';
import { audio } from './audio.js';
import {
  makeNebulaTexture, makePlayerTexture, makeEnemyTexture, makeGlowTexture, makeStarTexture,
} from './textures.js';

const $ = id => document.getElementById(id);
const wait = ms => new Promise(res => setTimeout(res, ms));

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
    });
    window.addEventListener('pointerdown', () => { if (this.timingActive) this._resolveTiming(); });
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
    this.hexTurns = 0;   // mystic hex: rounds of narrowed timing bands
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

    // scenery along the back edge
    const srng = mulberry32(hash2(team.tier, team.count, 4242) * 0xffffffff | 0);
    for (let i = 0; i < 6; i++) {
      const a = -0.6 - i * 0.35 + srng() * 0.2;
      const r = 7.5 + srng() * 2;
      const m = sceneryFor(team.biome, srng);
      m.position.set(Math.cos(a) * r * -1, 0, Math.sin(a) * r * -1);
      m.position.x += 4;
      scene.add(m);
    }

    // your paper self
    const token = new THREE.Mesh(
      new THREE.PlaneGeometry(1.7, 2.15),
      new THREE.MeshBasicMaterial({ map: this._shared('player', makePlayerTexture), transparent: true, fog: false })
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
    const spots = count === 1 ? [[3.4, -1.6]] : count === 2 ? [[2.8, -0.8], [4.4, -2.6]] : [[2.2, -0.3], [3.6, -1.7], [5.0, -3.1]];
    const biome = BIOMES[team.biome] || BIOMES.MEADOW;

    this.enemies = spots.map(([x, z], i) => {
      const spec = team.boss ? { n: team.bossName || 'The Warden', r: 'brute' } : pick(this.rng, roster);
      const mods = ROLE_MODS[spec.r] || ROLE_MODS.brute;
      const varr = 0.9 + this.rng() * 0.2;
      let hp = Math.round((13 + 8 * tier) * mods.hp * varr);
      let atk = Math.round((2.5 + 1.8 * tier) * mods.atk * 10) / 10;
      let spd = Math.round((4 + tier) * mods.spd);
      if (team.boss) { hp = Math.round(hp * 2.6); atk = Math.round(atk * 1.2 * 10) / 10; }

      const bodyC = '#' + new THREE.Color(biome.color).offsetHSL(0.02 * i, 0.12, -0.1).getHexString();
      const tex = makeEnemyTexture(bodyC, team.boss ? '#ff5a7a' : '#ffd24a', 1 + Math.floor(this.rng() * 3), this.rng());
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
        hp, maxHP: hp, atk, spd, boss: !!team.boss,
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
        e.chill ? `<span class="st chill">❄−${e.chill}</span>` : '',
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
    const pct = Math.max(0, run.hp / run.stats.maxHP * 100);
    $('b-player').innerHTML = `<div class="b-name">You, the Star-Wanderer</div>
      <div class="b-hpbar"><div class="b-hpfill player" style="width:${pct}%"></div></div>
      <div class="b-sub">${run.hp} / ${run.stats.maxHP} HP · ATK ${this._playerAtk()} · SPD ${run.stats.spd}${this.playerGuardBonus ? ' · <span class="st chill">guarded</span>' : ''}${this.hexTurns > 0 ? ' · <span class="st burn">hexed</span>' : ''}</div>`;
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
    addBtn('⚔ Star Strike', () => this._playerAttack());
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

  _startTiming(kind) {
    // kind: 'strike' | 'block'
    return new Promise(resolve => {
      this.timingActive = true;
      this.timingKind = kind;
      this.timingT = 0;
      this.timingResolve = resolve;
      const el = $('b-timing');
      el.classList.remove('hidden');
      $('b-timing-label').textContent = kind === 'strike' ? 'Strike! (click / space)' : 'Block!';
      const widen = kind === 'block' ? (run.stats.blockBonus ? 1.5 : 1) : 1;
      const shrink = this.hexTurns > 0 ? 0.55 : 1; // mystic hex narrows the gold band
      let [p0, p1] = CONFIG.battle.timing.perfect;
      if (run.hasSynergy('eclipse')) { p0 -= 0.04; }
      const mid = (p0 + p1) / 2, half = (p1 - p0) / 2 * widen * shrink;
      this.zones = { p0: mid - half, p1: mid + half, g0: CONFIG.battle.timing.good[0], g1: CONFIG.battle.timing.good[1] };
      const zp = el.querySelector('.bt-zone.perfect');
      zp.style.left = (this.zones.p0 * 100) + '%';
      zp.style.width = ((this.zones.p1 - this.zones.p0) * 100) + '%';
      const zg = el.querySelector('.bt-zone.good');
      zg.style.left = (this.zones.g0 * 100) + '%';
      zg.style.width = ((this.zones.g1 - this.zones.g0) * 100) + '%';
    });
  }

  _resolveTiming() {
    if (!this.timingActive) return;
    this.timingActive = false;
    $('b-timing').classList.add('hidden');
    const t = this.timingT;
    const bonus = (run.stats.timingBonus || 0) * 0.15;
    let grade, mult;
    if (t >= this.zones.p0 && t <= this.zones.p1) { grade = 'perfect'; mult = CONFIG.battle.perfectMult + bonus; }
    else if (t >= this.zones.g0 && t <= this.zones.g1) { grade = 'good'; mult = CONFIG.battle.goodMult + bonus; }
    else { grade = 'miss'; mult = CONFIG.battle.missMult + bonus * 0.5; }
    this.timingResolve({ grade, mult });
  }

  // ----------------------------------------------------------- player turn ---

  async _playerAttack() {
    if (this.state !== 'playerMenu') return;
    this.state = 'playerActing';
    this._hideMenu();
    const target = this.enemies[this.targetId]?.dead ? this._aliveEnemies()[0] : this.enemies[this.targetId];
    if (!target) return;

    // lunge toward the foe
    this._tween(this.playerMesh.position, { x: target.home.x - 1.6, z: target.home.z + 1.2 }, 0.32);
    await wait(300);
    let timing;
    if (run.flags.firstHitPerfect && !this.usedFirstPerfect) {
      this.usedFirstPerfect = true;
      timing = { grade: 'perfect', mult: CONFIG.battle.perfectMult + (run.stats.timingBonus || 0) * 0.15 };
      this._log('The Dawn Thimble guides your hand — Perfect!');
    } else {
      timing = await this._startTiming('strike');
    }
    await this._strike(target, timing, 1);
    if (timing.grade === 'perfect' && run.flags.perfectEcho && !target.dead) {
      await wait(220);
      this._log('The Echo Hammer rings!');
      await this._strike(target, { grade: 'echo', mult: timing.mult * run.flags.perfectEcho }, 1, true);
    }
    this._tween(this.playerMesh.position, { x: this.playerHome.x, z: this.playerHome.z }, 0.3);
    await wait(330);
    this._afterPlayerAction();
  }

  async _strike(target, timing, baseMult, silent = false) {
    let dmg = this._playerAtk() * timing.mult * baseMult * (0.92 + this.rng() * 0.16);
    let crit = false;
    let luck = run.stats.luck || 0;
    if (run.hasSynergy('stained_glass')) luck += 10;
    if (this.rng() * 100 < luck) { crit = true; dmg *= 2; }
    if (run.flags.critShatter && this.shatterNext) { dmg += this.shatterNext; this.shatterNext = 0; }
    if (run.flags.executeBonus && target.hp / target.maxHP < 0.3) dmg *= 1.5;
    if (target.role === 'guard') dmg *= 0.75;
    if (target.warded) {
      dmg *= 0.55;
      target.warded = false;
      this._log('The rune-wall takes the brunt and shatters.');
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
    if (timing.grade === 'perfect' && run.flags.perfectHeal) {
      run.hp = Math.min(run.stats.maxHP, run.hp + run.flags.perfectHeal);
    }
    if (timing.grade === 'perfect' && run.flags.perfectShard) run.gainShards(run.flags.perfectShard);
    if (timing.grade === 'perfect' && run.flags.stunOnPerfect && !target.dead
      && this.rng() * 100 < run.flags.stunOnPerfect) {
      target.stun = 1;
      this._log(`${target.name} reels, stunned!`);
    }
    if (target.dead) {
      audio.sfxEnemyDie();
      if (run.flags.killHeal) run.hp = Math.min(run.stats.maxHP, run.hp + run.flags.killHeal);
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
    this._log(`✧ ${ab.name}!`);
    const alive = this._aliveEnemies();
    if (ab.kind === 'aoe') {
      const timing = await this._startTiming('strike');
      for (const e of alive) await this._strike(e, timing, ab.mult, true);
      this._log(`${ab.name} sweeps the field!`);
    } else if (ab.kind === 'burn_all') {
      for (const e of alive) {
        e.burn = Math.max(e.burn, ab.burn * (run.flags.burnDouble ? 2 : 1));
        e.burnTurns = Math.max(e.burnTurns, 3);
        this._float(e.mesh.position.clone().add(new THREE.Vector3(0, 1.4, 0)), '🔥', 'burn');
      }
      this._log('The hymn takes hold — everything burns.');
    } else if (ab.kind === 'stun') {
      const target = this.enemies[this.targetId]?.dead ? alive[0] : this.enemies[this.targetId];
      if (target) {
        target.stun = 1;
        this._float(target.mesh.position.clone().add(new THREE.Vector3(0, 1.4, 0)), '✶', 'stun');
        this._log(`${target.name} rings like a bell and forgets its turn.`);
      }
    } else if (ab.kind === 'heal_self') {
      run.hp = Math.min(run.stats.maxHP, run.hp + ab.amount);
      this._float(this.playerMesh.position.clone().add(new THREE.Vector3(0, 2, 0)), `+${ab.amount}`, 'heal');
      audio.sfxHeal();
    } else if (ab.kind === 'weaken_all') {
      for (const e of alive) e.chill = (e.chill || 0) + ab.atkDown;
      this._log('The foes sag, weakened.');
    } else if (ab.kind === 'smite') {
      const target = this.enemies[this.targetId]?.dead ? alive[0] : this.enemies[this.targetId];
      if (target) {
        const timing = await this._startTiming('strike');
        await this._strike(target, timing, ab.mult, false);
      }
    } else if (ab.kind === 'gamble') {
      const target = this.enemies[this.targetId]?.dead ? alive[0] : this.enemies[this.targetId];
      if (target) {
        const mult = this.rng() * 3;
        if (mult < 0.25) this._log('The die comes up hollow — nothing!');
        else await this._strike(target, { grade: mult > 2.2 ? 'perfect' : 'good', mult }, 1, true);
      }
    } else if (ab.kind === 'leech') {
      const target = this.enemies[this.targetId]?.dead ? alive[0] : this.enemies[this.targetId];
      if (target) {
        const before = target.hp;
        await this._strike(target, { grade: 'good', mult: ab.mult }, 1, true);
        const dealt = before - Math.max(0, target.hp);
        run.hp = Math.min(run.stats.maxHP, run.hp + dealt);
        this._float(this.playerMesh.position.clone().add(new THREE.Vector3(0, 2, 0)), `+${dealt}`, 'heal');
      }
    } else if (ab.kind === 'frenzy') {
      this.frenzyAtk += ab.atkUp;
      run.hp = Math.max(1, run.hp - ab.selfDmg);
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
      this._burst(e.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)));
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
    const amount = 15 + (run.flags.dewPotency || 0);
    run.hp = Math.min(run.stats.maxHP, run.hp + amount);
    this._float(this.playerMesh.position.clone().add(new THREE.Vector3(0, 2, 0)), `+${amount}`, 'heal');
    this._log(`❋ The star-dew glows going down. +${amount} HP.`);
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
      e.enraged = true;
      e.atk = Math.round(e.atk * 1.3 * 10) / 10;
      this._log(`${e.name} is ENRAGED!`);
    } else if (!e.boss && e.role === 'brute' && !e.enraged && e.hp < e.maxHP * 0.4) {
      e.enraged = true;
      e.atk = Math.round(e.atk * 1.25 * 10) / 10;
      this._log(`${e.name} bellows and ENRAGES!`);
    }
  }

  _aliveEnemies() { return this.enemies.filter(e => !e.dead); }

  async _afterPlayerAction() {
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
        await this._enemyStrike(e, 2.0, true);
      } else if (e.role === 'mystic' && this.rng() < 0.3) {
        e.intent = 'special';
        if ((this.team.tier ?? 0) >= 2 && this.hexTurns === 0 && this.rng() < 0.5) {
          this.hexTurns = 2;
          this._log(`${e.name} knots the light around your hands — your timing bands narrow!`);
        } else {
          this._log(`${e.name} hexes you with cold starlight…`);
          run.hp -= Math.max(1, Math.round(e.atk * 0.5));
          this._float(this.playerMesh.position.clone().add(new THREE.Vector3(0, 2, 0)), `−${Math.max(1, Math.round(e.atk * 0.5))}`, 'dmg');
        }
        this._refreshCards();
        await wait(550);
      } else if (e.role === 'guard' && (this.team.tier ?? 0) >= 2 && this.rng() < 0.3
        && this._aliveEnemies().some(o => o !== e && !o.warded)) {
        const ally = this._aliveEnemies().filter(o => o !== e && !o.warded)
          .sort((a, b) => a.hp - b.hp)[0];
        ally.warded = true;
        e.intent = 'special';
        this._log(`${e.name} raises a rune-wall around ${ally.name}.`);
        this._refreshCards();
        await wait(550);
      } else if (this.rng() < (e.boss ? 0.1 + 0.05 * (this.team.tier || 1) : 0.13)) {
        e.charging = true;
        this._log(`${e.name} is gathering a heavy blow!`);
        this._refreshCards();
        await wait(600);
        continue;
      } else {
        await this._enemyStrike(e, 1);
        // swift foes dart in a second time, lighter but relentless
        if (e.role === 'swift' && (this.team.tier ?? 0) >= 2 && !e.dead && run.hp > 0 && this.rng() < 0.35) {
          this._log(`${e.name} darts in again!`);
          await this._enemyStrike(e, 0.5);
        }
      }
      if (run.hp <= 0) return this._defeat();
      this._refreshCards();
      await wait(280);
    }
    this.turn++;
    if (this.hexTurns > 0) this.hexTurns--;
    for (const k of Object.keys(this.abilityCds)) this.abilityCds[k] = Math.max(0, this.abilityCds[k] - 1);
    if (this._aliveEnemies().length === 0) return this._victory();
    if (run.hasSynergy('verdance') && run.hp < run.stats.maxHP) {
      run.hp = Math.min(run.stats.maxHP, run.hp + 2);
      this._float(this.playerMesh.position.clone().add(new THREE.Vector3(0, 2, 0)), '+2 ❀', 'heal');
    }
    this.state = 'playerMenu';
    this._showMenu();
    this._refreshCards();
  }

  async _enemyStrike(e, mult, heavy = false) {
    this._log(`${e.name}${heavy ? ' unleashes the heavy blow!' : ' attacks!'}`);
    this._tween(e.mesh.position, { x: this.playerHome.x + 1.6, z: this.playerHome.z - 1.0 }, 0.3);
    await wait(300);
    const timing = await this._startTiming('block');
    let dmg = Math.max(1, e.atk - (e.chill || 0)) * mult * (0.9 + this.rng() * 0.2);
    // dodge check
    const autoDodge = run.flags.firstStrikeDodge && !this.firstDodgeUsed;
    if (autoDodge || this.rng() * 100 < (run.stats.dodge || 0) + (run.hasSynergy('steamveil') ? 10 : 0)) {
      this.firstDodgeUsed = true;
      this._float(this.playerMesh.position.clone().add(new THREE.Vector3(0, 2, 0)), 'dodged!', 'heal');
      this._log('You flutter aside — dodged!');
      dmg = 0;
    } else {
      const blocked = timing.grade === 'perfect' || timing.grade === 'good';
      if (blocked) {
        dmg *= CONFIG.battle.blockMult;
        this._log('Blocked!');
        audio.sfxBlock();
        if (run.flags.blockHeal) run.hp = Math.min(run.stats.maxHP, run.hp + run.flags.blockHeal);
      } else {
        audio.sfxHurt();
      }
      if (this.shieldLeft > 0) { dmg *= 0.5; this.shieldLeft--; }
      if (run.flags.waterWeak && ['SEA', 'BRIDGE'].includes(this.team.biome)) dmg += run.flags.waterWeak;
      dmg = Math.max(1, Math.round(dmg));
      run.hp -= dmg;
      this._float(this.playerMesh.position.clone().add(new THREE.Vector3(0, 2, 0)), `−${dmg}`, 'dmg');
      this._shake(this.playerMesh);
      if (run.flags.thorns && !e.dead) {
        this._hurtEnemy(e, run.flags.thorns, '⟁');
      }
    }
    this._tween(e.mesh.position, { x: e.home.x, z: e.home.z }, 0.3);
    await wait(320);
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
    else if (this.rng() < 0.14) { run.consumables.dew++; drops.dew = 1; }
    if (run.flags.afterBattleHeal) run.hp = Math.min(run.stats.maxHP, run.hp + run.flags.afterBattleHeal);
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
    this.timingActive = false;
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

  _burst(pos) {
    for (const b of this.burstPool) {
      const a = Math.random() * Math.PI * 2;
      b.t = 0;
      b.sp.position.copy(pos);
      b.vx = Math.cos(a) * (1.2 + Math.random());
      b.vz = Math.sin(a) * (1.2 + Math.random());
      b.vy = 1 + Math.random() * 1.5;
    }
  }

  update(dt) {
    if (!this.active || !this.scene) return;
    this.time += dt;

    // timing marker
    if (this.timingActive) {
      this.timingT += dt / CONFIG.battle.timing.travel;
      if (this.timingT >= 1) { this.timingT = 1; this._resolveTiming(); }
      const marker = document.querySelector('#b-timing .bt-marker');
      if (marker) marker.style.left = (this.timingT * 100) + '%';
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
