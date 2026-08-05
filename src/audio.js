// Procedural audio, no assets: an always-running aetherial string drone that
// oscillates between two chords per region and morphs voice-by-voice as you
// cross causeways; quiet region leitmotifs on biome-flavored chimes; battle
// percussion layered over the drone; and synthesized SFX for everything.

const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);

// Two-chord pairs per biome character (semitones over a root midi note),
// plus the mode its leitmotif is drawn from.
const MUSIC = {
  MEADOW:  { root: 48, a: [0, 2, 7, 9, 16],  b: [0, 5, 9, 12, 19],  mode: [0, 2, 4, 7, 9],           timbre: 'pluck' },  // sus2add6 warmth
  FOREST:  { root: 38, a: [0, 3, 7, 10, 14], b: [5, 8, 14, 17, 21], mode: [0, 2, 3, 5, 7, 9, 10],    timbre: 'pluck' },  // dorian minor 9ths
  MOUNTAIN:{ root: 45, a: [0, 2, 7, 12, 19], b: [0, 4, 8, 16, 20],  mode: [0, 2, 4, 8, 9],           timbre: 'bell'  },  // sus2 into augmented air
  VOLCANO: { root: 37, a: [0, 3, 7, 8, 15],  b: [0, 3, 6, 9, 12],   mode: [0, 2, 3, 5, 7, 8, 11],    timbre: 'dark'  },  // minor b6 into dim7
  DESERT:  { root: 40, a: [0, 4, 10, 13, 16],b: [1, 5, 8, 13, 17],  mode: [0, 1, 4, 5, 7, 8, 10],    timbre: 'pluck' },  // phrygian dominant E<->F
  TUNDRA:  { root: 43, a: [0, 7, 11, 16, 19],b: [0, 8, 12, 15, 22], mode: [0, 2, 4, 7, 11],          timbre: 'bell'  },  // pale maj7 air
  SEA:     { root: 41, a: [0, 5, 10, 14, 19],b: [0, 5, 9, 16, 21],  mode: [0, 2, 5, 7, 10],          timbre: 'breath'},  // dreaming 9sus
  CRYSTAL: { root: 48, a: [0, 7, 11, 16, 18],b: [0, 2, 9, 14, 18],  mode: [0, 2, 4, 6, 7, 9, 11],    timbre: 'bell'  },  // lydian #11 shimmer
  ROAD:    { root: 38, a: [0, 7, 12, 19],    b: [0, 5, 12, 17],     mode: [0, 2, 4, 7, 9],           timbre: 'pluck' },  // open causeway fifths
  BRIDGE:  { root: 45, a: [0, 2, 9, 14, 21], b: [0, 7, 14, 16, 23], mode: [0, 2, 7, 9],              timbre: 'bell'  },  // star-bridge sus shimmer
  LUNAR:   { root: 47, a: [0, 4, 11, 18],    b: [0, 2, 9, 16],      mode: [0, 2, 4, 6, 7, 9, 11],    timbre: 'bell'  },
  CRIMSON: { root: 38, a: [0, 1, 7, 10, 16], b: [0, 4, 10, 13],     mode: [0, 1, 4, 5, 7, 8, 10],    timbre: 'dark'  },
  VERDANT: { root: 39, a: [0, 4, 11, 14, 18],b: [0, 2, 9, 16, 18],  mode: [0, 2, 4, 6, 7, 9, 11],    timbre: 'pluck' },
  SECRET:  { root: 42, a: [0, 3, 6, 9, 15],  b: [0, 3, 6, 10, 16],  mode: [0, 3, 6, 9],              timbre: 'bell'  },
};
// deep pockets sour toward dread regardless of biome
const DARK = { a: [0, 3, 7, 8, 14], b: [0, 3, 6, 9, 12], mode: [0, 2, 3, 5, 7, 8, 11], timbre: 'dark' };

const N_VOICES = 5;

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = localStorage.getItem('vaeldrift_audio') !== '0';
    this.started = false;
    this.regionKey = null;
    this.currentDef = null;
    this.chordFlip = false;
    this.motif = null;
    this.battleLayer = null;
    this._seedTick = 1;
  }

  // deterministic-ish light rng for scheduling jitter
  _rand() {
    this._seedTick = (this._seedTick * 16807) % 2147483647;
    return this._seedTick / 2147483647;
  }

  init() {
    if (this.started || !this.enabled) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch { return; }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.6;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    this.master.connect(comp).connect(ctx.destination);

    this.droneBus = ctx.createGain(); this.droneBus.gain.value = 0.5;
    this.chimeBus = ctx.createGain(); this.chimeBus.gain.value = 0.5;
    this.percBus = ctx.createGain(); this.percBus.gain.value = 0.0;
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 0.5;
    for (const b of [this.droneBus, this.chimeBus, this.percBus, this.sfxBus]) b.connect(this.master);

    // a soft space around everything: feedback-delay shimmer
    const delay = ctx.createDelay(1.0);
    delay.delayTime.value = 0.42;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const wet = ctx.createGain(); wet.gain.value = 0.25;
    delay.connect(fb).connect(delay);
    delay.connect(wet).connect(this.master);
    this.verbSend = delay;
    this.chimeBus.connect(delay);
    this.sfxBus.connect(delay);

    // the string voices: two detuned saws through a wandering lowpass each
    this.voices = [];
    for (let i = 0; i < N_VOICES; i++) {
      const g = ctx.createGain(); g.gain.value = 0;
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 500;
      filt.Q.value = 0.7;
      const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
      const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.detune.value = 7;
      const o3 = ctx.createOscillator(); o3.type = 'triangle'; o3.detune.value = -5;
      const oGain = ctx.createGain(); oGain.gain.value = 0.33;
      for (const o of [o1, o2, o3]) { o.connect(oGain); o.start(); }
      oGain.connect(filt).connect(g).connect(this.droneBus);
      this.voices.push({ o1, o2, o3, filt, gain: g, freq: 110 });
    }

    this.started = true;
    this._tick = setInterval(() => this._scheduler(), 1000);
    this._chordTimer = 0;
    if (this.currentDef) this._applyChord(this.currentDef, this.chordFlip, 4);
  }

  setEnabled(on) {
    this.enabled = on;
    localStorage.setItem('vaeldrift_audio', on ? '1' : '0');
    if (on && !this.started) this.init();
    if (this.started) {
      this.master.gain.setTargetAtTime(on ? 0.6 : 0, this.ctx.currentTime, 0.2);
      if (on) this.ctx.resume();
    }
  }

  // ------------------------------------------------------------ the drone ---

  setRegionMusic({ biome, tier = 0, id = 0, seed = 1 }) {
    const key = biome + ':' + (tier >= 4 ? 'dark' : 'lit') + ':' + id;
    if (key === this.regionKey) return;
    this.regionKey = key;
    const base = MUSIC[biome] || MUSIC.MEADOW;
    const dark = tier >= 4;
    this.currentDef = {
      root: base.root - (dark ? 2 : 0),
      a: dark ? DARK.a : base.a,
      b: dark ? DARK.b : base.b,
      mode: dark ? DARK.mode : base.mode,
      timbre: dark ? 'dark' : base.timbre,
    };
    this.motif = this._makeMotif(this.currentDef, id * 131 + seed);
    this.motifWait = 4 + this._rand() * 5;
    if (this.started) this._applyChord(this.currentDef, this.chordFlip, 6); // the region morph
  }

  _applyChord(def, flip, morphSec) {
    const ctx = this.ctx;
    const tones = flip ? def.b : def.a;
    const now = ctx.currentTime;
    for (let i = 0; i < N_VOICES; i++) {
      const v = this.voices[i];
      if (i < tones.length) {
        const f = midiHz(def.root + tones[i] + (i === 0 ? -12 : 0)); // lowest voice sinks an octave
        for (const o of [v.o1, v.o2, v.o3]) o.frequency.setTargetAtTime(f, now, morphSec / 3);
        v.filt.frequency.setTargetAtTime(f * (2.2 + this._rand() * 1.6), now, morphSec / 2);
        v.gain.gain.setTargetAtTime(0.05 + (i === 0 ? 0.02 : 0), now, morphSec / 2);
        v.freq = f;
      } else {
        v.gain.gain.setTargetAtTime(0, now, morphSec / 2);
      }
    }
  }

  _scheduler() {
    if (!this.started || !this.enabled) return;
    // chord oscillation: flip every ~14s with a 5s morph
    this._chordTimer = (this._chordTimer || 0) + 1;
    if (this._chordTimer >= 13 + Math.floor(this._rand() * 4)) {
      this._chordTimer = 0;
      this.chordFlip = !this.chordFlip;
      if (this.currentDef) this._applyChord(this.currentDef, this.chordFlip, 5);
    }
    // filters wander a little, like breathing
    for (const v of this.voices) {
      v.filt.frequency.setTargetAtTime(v.freq * (1.8 + this._rand() * 2.4), this.ctx.currentTime, 2.5);
    }
    // the leitmotif, occasionally
    if (this.motif && !this.battleLayer) {
      this.motifWait -= 1;
      if (this.motifWait <= 0) {
        this.motifWait = 10 + this._rand() * 8;
        this._playMotif();
      }
    }
  }

  // --------------------------------------------------------- the leitmotif ---

  _makeMotif(def, seedInt) {
    let s = (seedInt | 0) || 1;
    const rand = () => { s = (s * 16807) % 2147483647; return (s < 0 ? -s : s) / 2147483647; };
    const scale = def.mode;
    const n = 4 + Math.floor(rand() * 3);
    const notes = [];
    let idx = Math.floor(rand() * scale.length);
    for (let i = 0; i < n; i++) {
      const oct = idx >= scale.length ? 12 : 0;
      notes.push({
        semi: scale[idx % scale.length] + oct,
        dur: 0.5 + rand() * 0.7,
      });
      const step = rand() < 0.7 ? (rand() < 0.5 ? 1 : -1) : (rand() < 0.5 ? 2 : -2);
      idx = Math.max(0, Math.min(scale.length + 1, idx + step));
    }
    notes[n - 1].dur = 1.6; // let the last one ring
    return notes;
  }

  _playMotif() {
    const def = this.currentDef;
    if (!def) return;
    let t = this.ctx.currentTime + 0.1;
    for (const note of this.motif) {
      this._chime(midiHz(def.root + 24 + note.semi), t, def.timbre, 0.07);
      t += note.dur;
    }
  }

  _chime(freq, t, timbre = 'bell', vol = 0.08) {
    if (!this.started) return;
    const ctx = this.ctx;
    const out = this.chimeBus;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(vol, t + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t + (timbre === 'pluck' ? 1.2 : 2.8));
    env.connect(out);
    if (timbre === 'bell' || timbre === 'dark') {
      const partials = timbre === 'dark' ? [[1, 1], [2.1, 0.4], [3.9, 0.12]] : [[1, 1], [2.76, 0.35], [5.4, 0.12]];
      for (const [ratio, amp] of partials) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = freq * ratio;
        const g = ctx.createGain();
        g.gain.setValueAtTime(amp, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 2.4 / ratio);
        o.connect(g).connect(env);
        o.start(t); o.stop(t + 3);
      }
    } else if (timbre === 'pluck') {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = freq;
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.setValueAtTime(freq * 6, t);
      filt.frequency.exponentialRampToValueAtTime(freq * 1.2, t + 0.5);
      o.connect(filt).connect(env);
      o.start(t); o.stop(t + 1.5);
    } else { // breath
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5.2;
      const lfoG = ctx.createGain(); lfoG.gain.value = freq * 0.008;
      lfo.connect(lfoG).connect(o.frequency);
      o.connect(env);
      o.start(t); o.stop(t + 3);
      lfo.start(t); lfo.stop(t + 3);
    }
  }

  // ------------------------------------------------------------- battles ---

  battleStart({ boss = false } = {}) {
    if (!this.started) return;
    this.battleLayer = { boss, beat: 0 };
    this.percBus.gain.setTargetAtTime(boss ? 0.5 : 0.34, this.ctx.currentTime, 1.2);
    this._beatTimer = setInterval(() => this._beat(), boss ? 430 : 520);
  }

  battleEnd(won) {
    if (!this.started) return;
    clearInterval(this._beatTimer);
    this.battleLayer = null;
    this.percBus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.8);
    if (won) this.sfxVictory();
  }

  _beat() {
    if (!this.started || !this.battleLayer) return;
    const b = this.battleLayer.beat++;
    const t = this.ctx.currentTime;
    const pat = this.battleLayer.boss ? [1, 0, 0.7, 0, 1, 0.5, 0.7, 0] : [1, 0, 0, 0, 0.8, 0, 0, 0];
    const v = pat[b % pat.length];
    if (v) this._drum(t, 82, 0.16 * v);
    if (this.battleLayer.boss && b % 2 === 1) this._noiseHit(t, 3000, 0.02, 0.05);
  }

  _drum(t, startHz, vol) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(startHz, t);
    o.frequency.exponentialRampToValueAtTime(36, t + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(this.percBus);
    o.start(t); o.stop(t + 0.35);
  }

  _noiseHit(t, cutoff, vol, dur) {
    const ctx = this.ctx;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = cutoff;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(filt).connect(g).connect(this.percBus);
    src.start(t);
  }

  // ----------------------------------------------------------------- SFX ---

  _sfxChime(freq, vol = 0.1, timbre = 'bell') {
    if (!this.started || !this.enabled) return;
    this._chime(freq, this.ctx.currentTime, timbre, vol);
  }

  sfxHop() {
    if (!this.started || !this.enabled) return;
    this._noiseHit(this.ctx.currentTime, 900 + this._rand() * 500, 0.015, 0.05);
  }
  sfxPerfect() { this._sfxChime(1560, 0.1); this._sfxChime(2340, 0.06); }
  sfxGood() { this._sfxChime(1170, 0.07); }
  sfxBlock() { if (this.started) this._drum(this.ctx.currentTime, 200, 0.12); }
  sfxHurt() { if (this.started) this._noiseHit(this.ctx.currentTime, 500, 0.06, 0.12); }
  sfxEnemyDie() { this._sfxChime(520, 0.07, 'dark'); }
  sfxHeal() { this._sfxChime(880, 0.06); this._sfxChime(1320, 0.05); }
  sfxShard() { this._sfxChime(1980 + this._rand() * 300, 0.035); }
  sfxClick() { if (this.started) this._noiseHit(this.ctx.currentTime, 2400, 0.012, 0.03); }

  sfxPickup(rarity = 'c') {
    if (!this.started || !this.enabled) return;
    const def = this.currentDef || MUSIC.MEADOW;
    const base = midiHz(def.root + 36);
    const steps = { c: 2, u: 3, r: 4, a: 5 }[rarity] || 3;
    for (let i = 0; i < steps; i++) {
      this._chime(base * Math.pow(2, [0, 4, 7, 11, 14][i] / 12), this.ctx.currentTime + i * 0.09, 'bell', 0.09);
    }
  }

  sfxVictory() {
    if (!this.started || !this.enabled) return;
    const def = this.currentDef || MUSIC.MEADOW;
    const tones = (this.chordFlip ? def.b : def.a);
    tones.slice(0, 4).forEach((s, i) => {
      this._chime(midiHz(def.root + 24 + s), this.ctx.currentTime + i * 0.12, 'bell', 0.09);
    });
  }

  sfxDefeat() {
    if (!this.started || !this.enabled) return;
    const t = this.ctx.currentTime;
    [0, 3, 6, 9].forEach((s, i) => {
      this._chime(midiHz(49 - s), t + i * 0.3, 'dark', 0.1);
    });
  }

  sfxGate() {
    if (!this.started || !this.enabled) return;
    const t = this.ctx.currentTime;
    this._noiseHit(t, 1200, 0.1, 0.4);
    this._chime(midiHz(60), t + 0.1, 'bell', 0.14);
    this._chime(midiHz(67), t + 0.25, 'bell', 0.12);
    this._chime(midiHz(72), t + 0.4, 'bell', 0.12);
  }

  sfxDetonate() {
    if (!this.started || !this.enabled) return;
    const t = this.ctx.currentTime;
    this._drum(t, 160, 0.3);
    this._noiseHit(t, 700, 0.14, 0.5);
  }

  sfxReveal() {
    if (!this.started || !this.enabled) return;
    const t = this.ctx.currentTime;
    [0, 3, 6, 9, 12].forEach((s, i) => this._chime(midiHz(70 + s), t + i * 0.07, 'bell', 0.05));
  }

  sfxFeat() {
    if (!this.started || !this.enabled) return;
    const t = this.ctx.currentTime;
    [0, 7, 12, 16].forEach((s, i) => this._chime(midiHz(72 + s), t + i * 0.13, 'bell', 0.11));
  }
}

export const audio = new AudioEngine();
