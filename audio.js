// audio.js - Web Audio wrapper. Real mp3s are decoded by AssetManager; missing ones get a synthesized buffer from synth().
// Context starts suspended (autoplay policy) and resumes on the first click/key.
export class AudioSys {
  constructor() {
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { this.ctx = null; }
    this.buf = {};
    if (!this.ctx) return;
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6; // master volume
    this.master.connect(this.ctx.destination);
    const resume = () => this.ctx.resume();
    addEventListener('pointerdown', resume);
    addEventListener('keydown', resume);
  }
  set(key, b) { if (b) this.buf[key] = b; }
  // play('engine_loop',{loop:true,rate:1.2}) -> {src,gain,stop()} ; null if no audio
  play(key, { vol = 1, rate = 1, loop = false } = {}) {
    const b = this.buf[key];
    if (!this.ctx || !b) return null;
    const src = this.ctx.createBufferSource(), gain = this.ctx.createGain();
    src.buffer = b; src.loop = loop; src.playbackRate.value = rate; gain.gain.value = vol;
    src.connect(gain).connect(this.master);
    src.start();
    return { src, gain, stop: () => { try { src.stop(); } catch { /* already stopped */ } } };
  }
  // Placeholder sounds, generated sample by sample (22.05 kHz mono). Returns an AudioBuffer or null.
  synth(key) {
    if (!this.ctx) return null;
    const SR = 22050, TAU = 6.2832;
    const mk = (dur, fn) => {
      const n = (SR * dur) | 0, b = this.ctx.createBuffer(1, n, SR), d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = fn(i / SR);
      return b;
    };
    const saw = (f, t) => 2 * ((f * t) % 1) - 1;
    const sq = (f, t) => (Math.sin(TAU * f * t) > 0 ? 1 : -1);
    const nz = () => Math.random() * 2 - 1;
    const env = (t, d) => Math.exp(-t / d);
    const beat = (bpm, root) => mk(8, t => { // 8 s loop, kick + hats + bass
      const s = 30 / bpm, k = t % (s * 2), h = t % s;
      return 0.5 * (Math.sin(TAU * 50 * k) * env(k, 0.07) + 0.25 * nz() * env(h, 0.016) * (Math.floor(t / s) % 2)
        + 0.3 * sq(root * (1 + (Math.floor(t / (s * 8)) % 2) * 0.5), t) * env(h, 0.2));
    });
    let y = 0;
    const R = {
      engine_loop: () => mk(1, t => 0.4 * (saw(80, t) * 0.6 + saw(160, t) * 0.3)),
      car_horn: () => mk(0.5, t => (t < 0.45 ? 0.25 * (sq(420, t) + sq(520, t)) : 0)),
      tire_screech: () => mk(0.6, t => 0.25 * nz() * Math.sin(Math.PI * t / 0.6)),
      car_door: () => mk(0.2, t => 0.6 * nz() * env(t, 0.03)),
      car_crash: () => mk(0.6, t => 0.8 * nz() * env(t, 0.15)),
      gunshot_pistol: () => mk(0.3, t => 0.8 * nz() * env(t, 0.05)),
      gunshot_smg: () => mk(0.15, t => 0.6 * nz() * env(t, 0.03)),
      siren_police: () => mk(1.6, t => 0.3 * Math.sin(TAU * (Math.floor(t / 0.4) % 2 ? 900 : 700) * t)),
      bank_alarm: () => mk(1, t => (t % 0.5 < 0.25 ? 0.25 * sq(880, t) : 0)),
      vault_drill: () => mk(1, t => 0.3 * (saw(110, t) * 0.7 + nz() * 0.3)),
      footsteps_concrete: () => mk(0.5, t => 0.4 * nz() * env(t % 0.25, 0.02)),
      cash_pickup: () => mk(0.25, t => 0.4 * Math.sin(TAU * (600 + 1600 * t) * t) * env(t, 0.12)),
      pedestrian_scream: () => mk(0.7, t => 0.3 * Math.sin(TAU * (700 * t + 15 * Math.sin(12 * t))) * env(t, 0.5)),
      police_radio: () => mk(1, t => (Math.sin(t * 37) > 0.3 ? 0.2 * nz() : 0)),
      wasted: () => mk(1.5, t => 0.4 * Math.sin(TAU * (300 - 150 * t) * t) * env(t, 0.8)),
      busted: () => mk(1.5, t => 0.4 * saw(220 - 100 * t, t) * env(t, 0.8)),
      radio_01: () => beat(120, 55), radio_02: () => beat(90, 49), radio_03: () => beat(150, 65),
      city_loop: () => mk(4, () => { y += (nz() - y) * 0.02; return y * 0.8; }),
      ocean_waves: () => mk(4, t => { y += (nz() - y) * 0.01; return y * 1.2 * (0.6 + 0.4 * Math.sin(TAU * t / 4)); }),
    };
    return R[key] ? R[key]() : null;
  }
}
