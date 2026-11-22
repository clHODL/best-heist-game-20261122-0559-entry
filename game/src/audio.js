// audio.js — every sound is synthesized with WebAudio: no audio files,
// no network, nothing to load. Created lazily on the first user gesture,
// so the game stays silent until the player opts in by playing.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.alarmTimer = 0;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  tone(freq, dur, type = 'sine', gain = 0.08, when = 0, slideTo = null) {
    if (this.muted || !this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(amp).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  pickup(value) {
    // A bright two-note chime; richer loot rings higher.
    const base = value >= 500 ? 880 : value >= 300 ? 740 : 620;
    this.tone(base, 0.12, 'sine', 0.07);
    this.tone(base * 1.5, 0.18, 'sine', 0.06, 0.07);
  }

  diamond() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.08, i * 0.09));
  }

  alert() {
    // A short dissonant sting when a guard spots the thief.
    this.tone(220, 0.16, 'square', 0.05, 0, 311);
    this.tone(233, 0.16, 'square', 0.05, 0.02, 311);
  }

  caught() {
    [392, 311, 233, 175].forEach((f, i) => this.tone(f, 0.28, 'sawtooth', 0.06, i * 0.14));
  }

  win() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.08, i * 0.11));
  }

  smoke() {
    this.tone(300, 0.4, 'sine', 0.05, 0, 90);
  }

  emp() {
    this.tone(1200, 0.35, 'sawtooth', 0.04, 0, 120);
  }

  vent() {
    this.tone(180, 0.3, 'sine', 0.05, 0, 420);
  }

  click() {
    this.tone(660, 0.06, 'square', 0.04);
  }

  // A soft heartbeat pulse while the alarm is high; call every frame.
  alarmPulse(alarm, dt) {
    if (this.muted || !this.ctx || alarm < 70) return;
    this.alarmTimer -= dt;
    if (this.alarmTimer <= 0) {
      this.tone(98, 0.12, 'sine', 0.09);
      this.tone(98, 0.12, 'sine', 0.07, 0.18);
      this.alarmTimer = alarm > 90 ? 0.45 : 0.8;
    }
  }
}
