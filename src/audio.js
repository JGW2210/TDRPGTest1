// Procedural audio, no assets: an always-running aetherial string drone that
// cycles three chords per region and morphs voice-by-voice as you cross
// causeways; a slow harp-pulse arpeggio and an occasionally wandering bass
// voice give the drone forward motion; quiet region leitmotifs on
// biome-flavored chimes, each echoed once a fifth up through the shimmer;
// battle percussion layered over the drone; and synthesized SFX for
// everything. Deep pockets sour gradually with region tier.

const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);

// Chord set per biome character (semitones over a root midi note): the drone
// sways a<->b with the passing chord c landing every fourth turn. `mode` is
// the scale its leitmotif and bass walks draw from; `pulse` is the harp
// arpeggio's seconds-per-pluck.
const MUSIC = {
  MEADOW:  { root: 48, a: [0, 2, 7, 9, 16],  b: [0, 5, 9, 12, 19],  c: [-3, 4, 9, 12, 16],
             mode: [0, 2, 4, 7, 9], timbre: 'pluck', pulse: 1.3 },        // sus2add6 warmth; c slips to the relative minor
  FOREST:  { root: 38, a: [0, 3, 7, 10, 14], b: [5, 8, 14, 17, 21], c: [-2, 5, 10, 14, 17],
             mode: [0, 2, 3, 5, 7, 9, 10], timbre: 'pluck', pulse: 1.6 }, // dorian minor 9ths; c leans on bVII
  MOUNTAIN:{ root: 45, a: [0, 2, 7, 12, 19], b: [0, 4, 8, 16, 20],  c: [5, 9, 12, 16, 21],
             mode: [0, 2, 4, 8, 9], timbre: 'bell', pulse: 1.8 },         // sus2 into augmented air; c lifts to IV
  VOLCANO: { root: 37, a: [0, 3, 7, 8, 15],  b: [0, 3, 6, 9, 12],   c: [-1, 3, 8, 11, 15],
             mode: [0, 2, 3, 5, 7, 8, 11], timbre: 'dark', pulse: 2.0 },  // minor b6 into dim7; c a neapolitan lean
  DESERT:  { root: 40, a: [0, 4, 10, 13, 16],b: [1, 5, 8, 13, 17],  c: [-2, 3, 8, 12, 15],
             mode: [0, 1, 4, 5, 7, 8, 10], timbre: 'pluck', pulse: 1.1 }, // phrygian dominant E<->F; c shadows bVII minor
  TUNDRA:  { root: 43, a: [0, 7, 11, 16, 19],b: [0, 8, 12, 15, 22], c: [4, 9, 14, 16, 21],
             mode: [0, 2, 4, 7, 11], timbre: 'bell', pulse: 2.1 },        // pale maj7 air; c drifts to iii
  SEA:     { root: 41, a: [0, 5, 10, 14, 19],b: [0, 5, 9, 16, 21],  c: [-2, 5, 10, 15, 19],
             mode: [0, 2, 5, 7, 10], timbre: 'breath', pulse: 2.3 },      // dreaming 9sus; c a bVII wash
  CRYSTAL: { root: 48, a: [0, 7, 11, 16, 18],b: [0, 2, 9, 14, 18],  c: [4, 11, 14, 18, 23],
             mode: [0, 2, 4, 6, 7, 9, 11], timbre: 'bell', pulse: 1.2 },  // lydian #11 shimmer; c climbs the upper structure
  ROAD:    { root: 38, a: [0, 7, 12, 19],    b: [0, 5, 12, 17],     c: [-2, 5, 10, 17],
             mode: [0, 2, 4, 7, 9], timbre: 'pluck', pulse: 0.95 },       // open causeway fifths; c opens onto bVII
  BRIDGE:  { root: 45, a: [0, 2, 9, 14, 21], b: [0, 7, 14, 16, 23], c: [5, 12, 14, 19, 23],
             mode: [0, 2, 7, 9], timbre: 'bell', pulse: 1.4 },            // star-bridge sus shimmer; c suspends higher still
  LUNAR:   { root: 47, a: [0, 4, 11, 18],    b: [0, 2, 9, 16],      c: [-1, 6, 11, 14],
             mode: [0, 2, 4, 6, 7, 9, 11], timbre: 'bell', pulse: 1.9 }, // c slips under to a maj7#11
  CRIMSON: { root: 38, a: [0, 1, 7, 10, 16], b: [0, 4, 10, 13],     c: [-2, 3, 8, 13, 16],
             mode: [0, 1, 4, 5, 7, 8, 10], timbre: 'dark', pulse: 1.7 }, // c broods on bVII
  VERDANT: { root: 39, a: [0, 4, 11, 14, 18],b: [0, 2, 9, 16, 18],  c: [4, 9, 14, 18, 21],
             mode: [0, 2, 4, 6, 7, 9, 11], timbre: 'pluck', pulse: 1.25 }, // c blooms on iii9
  SECRET:  { root: 42, a: [0, 3, 6, 9, 15],  b: [0, 3, 6, 10, 16],  c: [-3, 3, 6, 12, 15],
             mode: [0, 3, 6, 9], timbre: 'bell', pulse: 2.2 },            // c sinks the diminished floor
  // the three deep identities own their sound outright: `own` keeps the
  // tier>=4 DARK swap from erasing an authored palette (dread still applies)
  WOUND:   { root: 36, a: [0, 1, 6, 8, 13],  b: [0, 3, 6, 11, 13],  c: [-1, 1, 6, 12, 18],
             mode: [0, 1, 3, 6, 8, 10], timbre: 'dark', pulse: 2.8, own: true },  // the seam's key: b2 over a tritone floor
  CRASH:   { root: 39, a: [0, 2, 7, 12, 14], b: [-1, 5, 7, 12, 16], c: [0, 3, 7, 10, 14],
             mode: [0, 2, 3, 7, 10], timbre: 'bell', pulse: 2.6, own: true },     // the visitors' hum: sus2 bent flat at the edges
  ISLET:   { root: 57, a: [0, 4, 7, 12],     b: [0, 5, 9, 12],      c: [-3, 2, 7, 12],
             mode: [0, 2, 4, 7, 9], timbre: 'bell', pulse: 0.9, own: true },      // a music-box over near-silence
};
// deep pockets sour toward dread: tier >= 4 swaps the whole palette; below
// that, detune / filter dimming / the sub-rumble scale smoothly with `dread`
const DARK = { a: [0, 3, 7, 8, 14], b: [0, 3, 6, 9, 12], c: [-1, 2, 8, 11, 14],
               mode: [0, 2, 3, 5, 7, 8, 11], timbre: 'dark', pulse: 2.4 };

const N_VOICES = 5;
const CHORD_SEQ = ['a', 'b', 'a', 'c']; // the passing chord lands every fourth turn
const PAN_BASE = [-0.55, 0.4, -0.3, 0.5, 0.15]; // home stereo positions per voice

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = localStorage.getItem('vaeldrift_audio') !== '0';
    this.started = false;
    this.regionKey = null;
    this.currentDef = null;
    this.chordStep = 0;
    this.town = false;
    this.motif = null;
    this.battleLayer = null;
    this._seedTick = 1;
    this._arpIdx = 0;
    this._arpTime = 0;
    this._walkUntil = 0;
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

    // the string voices: two detuned saws + a triangle through a wandering
    // lowpass each, spread across the stereo field with a slow drift
    const canPan = !!ctx.createStereoPanner;
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
      oGain.connect(filt).connect(g);
      let pan = null;
      if (canPan) {
        pan = ctx.createStereoPanner();
        pan.pan.value = PAN_BASE[i];
        g.connect(pan).connect(this.droneBus);
      } else {
        g.connect(this.droneBus);
      }
      this.voices.push({ o1, o2, o3, filt, gain: g, pan, freq: 110 });
    }

    // a sub-root rumble that swells with region dread (kept center-stage)
    this.dreadOsc = ctx.createOscillator();
    this.dreadOsc.type = 'sine';
    this.dreadOsc.frequency.value = 55;
    this.dreadGain = ctx.createGain(); this.dreadGain.gain.value = 0;
    this.dreadOsc.connect(this.dreadGain).connect(this.droneBus);
    this.dreadOsc.start();

    // a warm settlement voice that fades in over towns and capitals
    this.warmGain = ctx.createGain(); this.warmGain.gain.value = 0;
    const w1 = ctx.createOscillator(); w1.type = 'triangle';
    const w2 = ctx.createOscillator(); w2.type = 'triangle'; w2.detune.value = 9;
    const wg = ctx.createGain(); wg.gain.value = 0.5;
    w1.connect(wg); w2.connect(wg);
    wg.connect(this.warmGain).connect(this.droneBus);
    w1.start(); w2.start();
    this.warmOscs = [w1, w2];

    // the visitors' hum: a deep detuned pair that swells near crash craters
    this.humGain = ctx.createGain(); this.humGain.gain.value = 0;
    const h1 = ctx.createOscillator(); h1.type = 'sine'; h1.frequency.value = 49;
    const h2 = ctx.createOscillator(); h2.type = 'triangle'; h2.frequency.value = 49; h2.detune.value = 14;
    const hg = ctx.createGain(); hg.gain.value = 0.5;
    h1.connect(hg); h2.connect(hg);
    hg.connect(this.humGain).connect(this.droneBus);
    h1.start(); h2.start();
    if (this._pendingHum) this.setVisitorHum(this._pendingHum);

    this.started = true;
    this._tick = setInterval(() => this._scheduler(), 1000);
    this._chordTimer = 0;
    if (this.currentDef) this._applyChord(this.currentDef, 4);
  }

  // How near the wanderer stands to something that fell: 0 = out of earshot,
  // 1 = at the crater floor. Called on every hop by main.js.
  setVisitorHum(level) {
    this._pendingHum = level;
    if (!this.started || !this.humGain) return;
    this.humGain.gain.setTargetAtTime(0.055 * Math.max(0, Math.min(1, level)), this.ctx.currentTime, 1.4);
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

  setRegionMusic({ biome, tier = 0, id = 0, seed = 1, town = false }) {
    if (town !== this.town) {
      this.town = town;
      if (this.started && this.currentDef) {
        this.warmGain.gain.setTargetAtTime(town ? 0.045 : 0, this.ctx.currentTime, 2.2);
        if (town) this.motifWait = Math.min(this.motifWait, 3); // a melody greets you
      }
    }
    const key = biome + ':' + tier + ':' + id;
    if (key === this.regionKey) return;
    this.regionKey = key;
    const base = MUSIC[biome] || MUSIC.MEADOW;
    const dark = tier >= 4 && !base.own;   // authored deep palettes stand
    const dread = Math.max(0, Math.min(1, (tier - 1) / 4)); // sours from tier 2 up
    this.currentDef = {
      root: base.root - (dark ? 2 : 0),
      a: dark ? DARK.a : base.a,
      b: dark ? DARK.b : base.b,
      c: dark ? DARK.c : base.c,
      mode: dark ? DARK.mode : base.mode,
      timbre: dark ? 'dark' : base.timbre,
      pulse: dark ? DARK.pulse : base.pulse,
      dread,
    };
    this.motif = this._makeMotif(this.currentDef, id * 131 + seed);
    this.motifWait = 4 + this._rand() * 5;
    if (this.started) this._applyChord(this.currentDef, 6); // the region morph
  }

  _chordTones(def = this.currentDef) {
    if (!def) return [0, 7, 12];
    return def[CHORD_SEQ[this.chordStep % CHORD_SEQ.length]] || def.a;
  }

  _applyChord(def, morphSec) {
    const ctx = this.ctx;
    const tones = this._chordTones(def);
    const now = ctx.currentTime;
    const dread = def.dread || 0;
    for (let i = 0; i < N_VOICES; i++) {
      const v = this.voices[i];
      if (i < tones.length) {
        const f = midiHz(def.root + tones[i] + (i === 0 ? -12 : 0)); // lowest voice sinks an octave
        for (const o of [v.o1, v.o2, v.o3]) {
          o.frequency.cancelScheduledValues(now); // clears any pending bass walk
          o.frequency.setTargetAtTime(f, now, morphSec / 3);
        }
        // dread pulls the saws apart and dims the light
        v.o2.detune.setTargetAtTime(7 + 14 * dread, now, morphSec / 2);
        v.o3.detune.setTargetAtTime(-5 - 11 * dread, now, morphSec / 2);
        v.filt.frequency.setTargetAtTime(f * (2.2 + this._rand() * 1.6) * (1 - 0.4 * dread), now, morphSec / 2);
        v.gain.gain.setTargetAtTime(0.05 + (i === 0 ? 0.02 : 0), now, morphSec / 2);
        v.freq = f;
      } else {
        v.gain.gain.setTargetAtTime(0, now, morphSec / 2);
      }
    }
    this.dreadOsc.frequency.setTargetAtTime(midiHz(def.root - 12), now, morphSec / 2);
    this.dreadGain.gain.setTargetAtTime(0.07 * dread, now, morphSec / 2);
    const warmTone = def.root + 12 + (tones[1] ?? 4); // a color tone above the chord
    for (const o of this.warmOscs) o.frequency.setTargetAtTime(midiHz(warmTone), now, morphSec / 3);
    this.warmGain.gain.setTargetAtTime(this.town ? 0.045 : 0, now, morphSec / 2);
    this._walkUntil = now;
  }

  _scheduler() {
    if (!this.started || !this.enabled) return;
    const now = this.ctx.currentTime;
    const def = this.currentDef;
    const dread = def ? def.dread : 0;
    // the chord cycle: advance a -> b -> a -> c every ~14s with a 5s morph
    this._chordTimer = (this._chordTimer || 0) + 1;
    if (this._chordTimer >= 13 + Math.floor(this._rand() * 4)) {
      this._chordTimer = 0;
      this.chordStep = (this.chordStep + 1) % CHORD_SEQ.length;
      if (def) this._applyChord(def, 5);
    }
    // filters wander a little, like breathing (dimmer in dread)
    for (const v of this.voices) {
      v.filt.frequency.setTargetAtTime(v.freq * (1.8 + this._rand() * 2.4) * (1 - 0.4 * dread), now, 2.5);
    }
    // stereo drift: each voice slowly re-aims within its home arc
    if (this.voices[0].pan) {
      for (let i = 0; i < N_VOICES; i++) {
        if (this._rand() < 0.25) {
          const p = Math.max(-0.75, Math.min(0.75, PAN_BASE[i] + (this._rand() - 0.5) * 0.6));
          this.voices[i].pan.pan.setTargetAtTime(p, now, 3);
        }
      }
    }
    // the harp pulse: keep the next beat or two of chord-tone plucks scheduled
    this._schedArp(now);
    // the bass wanders a few scale tones when the chord will hold a while
    if (def && now > this._walkUntil && this._chordTimer <= 5 && this._rand() < 0.12) this._bassWalk(now);
    // the leitmotif, occasionally (more talkative in settlements)
    if (this.motif && !this.battleLayer) {
      this.motifWait -= 1;
      if (this.motifWait <= 0) {
        this.motifWait = this.town ? 7 + this._rand() * 5 : 10 + this._rand() * 8;
        this._playMotif();
      }
    }
  }

  // a quiet arpeggio of the current chord tones, tempo set by the biome and
  // slowed by dread; alternating gently left and right of center
  _schedArp(now) {
    const def = this.currentDef;
    if (!def) return;
    if (this._arpTime < now) this._arpTime = now + 0.4;
    const step = def.pulse * (1 + 0.5 * def.dread);
    while (this._arpTime < now + 1.4) {
      const tones = this._chordTones(def);
      const semi = tones[this._arpIdx % tones.length] + (this._rand() < 0.22 ? 12 : 0);
      const vol = (this.battleLayer ? 0.02 : 0.032) * (1 - 0.3 * def.dread);
      const pan = (this._arpIdx % 2 ? 0.35 : -0.35) + (this._rand() - 0.5) * 0.2;
      this._chime(midiHz(def.root + 12 + semi), this._arpTime, 'pluck', vol, pan);
      this._arpIdx++;
      this._arpTime += step * (0.92 + this._rand() * 0.16);
    }
  }

  // the lowest voice steps through two nearby scale tones, then settles home
  _bassWalk(now) {
    const def = this.currentDef;
    const v = this.voices[0];
    const tones = this._chordTones(def);
    const home = def.root + (tones[0] || 0) - 12;
    const near = def.mode
      .map(m => def.root - 12 + m)
      .filter(f => f !== home && Math.abs(f - home) <= 7);
    if (!near.length) return;
    const p1 = near[Math.floor(this._rand() * near.length)];
    const p2 = near[Math.floor(this._rand() * near.length)];
    const path = [[p1, now + 0.2], [p2, now + 2.2], [home, now + 4.2]];
    for (const o of [v.o1, v.o2, v.o3]) {
      o.frequency.cancelScheduledValues(now);
      for (const [midi, t] of path) o.frequency.setTargetAtTime(midiHz(midi), t, 0.55);
    }
    this._walkUntil = now + 6;
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
    const side = this._rand() < 0.5 ? 0.4 : -0.4;
    let t = this.ctx.currentTime + 0.1;
    for (const note of this.motif) {
      this._chime(midiHz(def.root + 24 + note.semi), t, def.timbre, 0.07, side);
      t += note.dur;
    }
    // the echo: once more through the shimmer, a fifth up, from the far side
    let te = t + 0.35;
    for (const note of this.motif) {
      this._chime(midiHz(def.root + 31 + note.semi), te, def.timbre, 0.032, -side);
      te += note.dur * 0.9;
    }
  }

  _chime(freq, t, timbre = 'bell', vol = 0.08, pan = 0) {
    if (!this.started) return;
    const ctx = this.ctx;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(vol, t + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t + (timbre === 'pluck' ? 1.2 : 2.8));
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      env.connect(p).connect(this.chimeBus);
    } else {
      env.connect(this.chimeBus);
    }
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
    const tones = this._chordTones(def);
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
