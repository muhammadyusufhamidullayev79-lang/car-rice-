// Procedural audio engine using WebAudio API.
// All sounds are generated synthetically — no external audio assets needed.

export class GameAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private turboOsc: OscillatorNode | null = null;
  private turboGain: GainNode | null = null;
  private screechNoise: AudioBufferSourceNode | null = null;
  private screechGain: GainNode | null = null;
  private screechFilter: BiquadFilterNode | null = null;
  private windNoise: AudioBufferSourceNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private musicGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private musicEnabled = true;
  private currentPitch = 1.0;
  private currentRpm = 0.2;
  private musicPlaying = false;

  init() {
    if (this.ctx) return;
    try {
      const AC = (window.AudioContext || (window as any).webkitAudioContext);
      this.ctx = new AC();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.5;
      this.masterGain.connect(this.ctx.destination);
      this.createNoiseBuffer();
    } catch (e) {
      console.warn('Audio init failed', e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setEnabled(v: boolean) { if (this.masterGain) this.masterGain.gain.value = v ? 0.5 : 0; }
  setMusicEnabled(v: boolean) {
    this.musicEnabled = v;
    if (!v) this.stopMusic();
    else if (!this.musicPlaying) this.startMusic();
  }

  private createNoiseBuffer() {
    if (!this.ctx) return;
    const len = this.ctx.sampleRate * 2;
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  startEngine(basePitch = 1.0) {
    if (!this.ctx || !this.masterGain) return;
    this.stopEngine();
    this.currentPitch = basePitch;

    // Main engine: sawtooth with lowpass filter
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 60;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.08;
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 800;
    this.engineFilter.Q.value = 4;
    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);
    this.engineOsc.start();

    // Secondary oscillator for harmonic richness
    const sub = this.ctx.createOscillator();
    sub.type = 'square';
    sub.frequency.value = 30;
    const subGain = this.ctx.createGain();
    subGain.gain.value = 0.03;
    sub.connect(subGain);
    subGain.connect(this.masterGain);
    sub.start();
    (this as any)._subOsc = sub;
    (this as any)._subGain = subGain;

    // Wind noise
    if (this.noiseBuffer) {
      this.windNoise = this.ctx.createBufferSource();
      this.windNoise.buffer = this.noiseBuffer;
      this.windNoise.loop = true;
      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0;
      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = 'bandpass';
      this.windFilter.frequency.value = 800;
      this.windFilter.Q.value = 1;
      this.windNoise.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.masterGain);
      this.windNoise.start();
    }
  }

  stopEngine() {
    try { this.engineOsc?.stop(); } catch {}
    try { (this as any)._subOsc?.stop(); } catch {}
    try { this.windNoise?.stop(); } catch {}
    this.engineOsc = null; this.engineGain = null; this.engineFilter = null;
    this.windNoise = null; this.windGain = null; this.windFilter = null;
  }

  // RPM 0..1, throttle 0..1
  updateEngine(rpm: number, throttle: number, speedKmh: number) {
    if (!this.ctx || !this.engineOsc || !this.engineGain) return;
    const clamped = Math.max(0, Math.min(1, rpm));
    // Smooth RPM
    this.currentRpm += (clamped - this.currentRpm) * 0.15;
    const r = this.currentRpm;
    const baseFreq = 50 + r * 180;
    const pitch = this.currentPitch;
    this.engineOsc.frequency.setTargetAtTime(baseFreq * pitch, this.ctx.currentTime, 0.05);
    this.engineGain.gain.setTargetAtTime(0.06 + throttle * 0.09 + r * 0.08, this.ctx.currentTime, 0.05);
    if (this.engineFilter) {
      this.engineFilter.frequency.setTargetAtTime(600 + r * 2400, this.ctx.currentTime, 0.1);
    }
    const sub = (this as any)._subOsc as OscillatorNode;
    if (sub) sub.frequency.setTargetAtTime(baseFreq * pitch * 0.5, this.ctx.currentTime, 0.05);

    // Wind
    if (this.windGain && this.windFilter) {
      const speedFactor = Math.min(1, speedKmh / 400);
      this.windGain.gain.setTargetAtTime(speedFactor * 0.12, this.ctx.currentTime, 0.2);
      this.windFilter.frequency.setTargetAtTime(400 + speedFactor * 1500, this.ctx.currentTime, 0.2);
    }
  }

  playNitro(on: boolean) {
    if (!this.ctx || !this.masterGain) return;
    if (on && !this.turboOsc) {
      this.turboOsc = this.ctx.createOscillator();
      this.turboOsc.type = 'sawtooth';
      this.turboOsc.frequency.value = 1200;
      this.turboGain = this.ctx.createGain();
      this.turboGain.gain.value = 0;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1500;
      filter.Q.value = 3;
      this.turboOsc.connect(filter);
      filter.connect(this.turboGain);
      this.turboGain.connect(this.masterGain);
      this.turboOsc.start();
      this.turboGain.gain.setTargetAtTime(0.08, this.ctx.currentTime, 0.05);
    } else if (!on && this.turboOsc && this.turboGain) {
      this.turboGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      const o = this.turboOsc;
      setTimeout(() => { try { o.stop(); } catch {} }, 300);
      this.turboOsc = null; this.turboGain = null;
    }
  }

  setDrifting(on: boolean) {
    if (!this.ctx || !this.masterGain) return;
    if (on && !this.screechNoise && this.noiseBuffer) {
      this.screechNoise = this.ctx.createBufferSource();
      this.screechNoise.buffer = this.noiseBuffer;
      this.screechNoise.loop = true;
      this.screechGain = this.ctx.createGain();
      this.screechGain.gain.value = 0;
      this.screechFilter = this.ctx.createBiquadFilter();
      this.screechFilter.type = 'bandpass';
      this.screechFilter.frequency.value = 2500;
      this.screechFilter.Q.value = 5;
      this.screechNoise.connect(this.screechFilter);
      this.screechFilter.connect(this.screechGain);
      this.screechGain.connect(this.masterGain);
      this.screechNoise.start();
      this.screechGain.gain.setTargetAtTime(0.08, this.ctx.currentTime, 0.05);
    } else if (!on && this.screechGain) {
      this.screechGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      const n = this.screechNoise;
      setTimeout(() => { try { n?.stop(); } catch {} }, 300);
      this.screechNoise = null; this.screechGain = null;
    }
  }

  playCrash(intensity = 1) {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1000;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.4 * intensity, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    src.start(now);
    src.stop(now + 0.5);
  }

  playBeep(freq = 440, duration = 0.15, vol = 0.2) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(this.masterGain);
    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  playCountdown(final = false) {
    this.playBeep(final ? 880 : 440, final ? 0.4 : 0.2, 0.25);
  }

  playShift() {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 200;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(this.masterGain);
    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  playUIClick() { this.playBeep(660, 0.05, 0.1); }

  startMusic() {
    if (!this.ctx || !this.masterGain || this.musicPlaying || !this.musicEnabled) return;
    this.musicPlaying = true;
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.08;
    this.musicGain.connect(this.masterGain);

    // Bass line + kick + synth arpeggio loop
    const bpm = 140;
    const beatDur = 60 / bpm;
    const bassNotes = [55, 55, 82.4, 73.4, 55, 55, 82.4, 61.7]; // A1, A1, E2, D2, ...
    const arpNotes = [440, 554, 659, 880, 659, 554, 440, 330];

    const startTime = this.ctx.currentTime + 0.05;
    const loopBars = 16;
    const scheduleAhead = loopBars * beatDur;

    const schedule = (offset: number) => {
      for (let i = 0; i < 16 * loopBars; i++) {
        const t = startTime + offset + i * (beatDur / 4);
        // Kick on every beat
        if (i % 4 === 0) this.scheduleKick(t);
        // Bass on every 2 beats
        if (i % 8 === 0) {
          const n = bassNotes[(i / 8) % bassNotes.length];
          this.scheduleBass(t, beatDur * 1.8, n);
        }
        // Synth arp
        if (i % 2 === 0) {
          const n = arpNotes[(i / 2) % arpNotes.length];
          this.scheduleSynth(t, beatDur * 0.4, n);
        }
        // Hi-hat on offbeats
        if (i % 2 === 1) this.scheduleHat(t);
      }
    };
    schedule(0);
    // Re-schedule loop
    (this as any)._musicInterval = setInterval(() => {
      if (!this.musicPlaying) return;
      schedule(scheduleAhead);
    }, scheduleAhead * 1000 - 200);
  }

  stopMusic() {
    this.musicPlaying = false;
    if ((this as any)._musicInterval) {
      clearInterval((this as any)._musicInterval);
      (this as any)._musicInterval = null;
    }
    if (this.musicGain) {
      this.musicGain.gain.setTargetAtTime(0, this.ctx!.currentTime, 0.3);
    }
  }

  private scheduleKick(t: number) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(g); g.connect(this.musicGain);
    osc.start(t); osc.stop(t + 0.2);
  }

  private scheduleBass(t: number, dur: number, freq: number) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.25, t + 0.02);
    g.gain.linearRampToValueAtTime(0, t + dur);
    osc.connect(filter); filter.connect(g); g.connect(this.musicGain);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  private scheduleSynth(t: number, dur: number, freq: number) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, t);
    filter.frequency.exponentialRampToValueAtTime(400, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.01);
    g.gain.linearRampToValueAtTime(0, t + dur);
    osc.connect(filter); filter.connect(g); g.connect(this.musicGain);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  private scheduleHat(t: number) {
    if (!this.ctx || !this.musicGain || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(filter); filter.connect(g); g.connect(this.musicGain);
    src.start(t); src.stop(t + 0.08);
  }

  dispose() {
    this.stopEngine();
    this.stopMusic();
    this.setDrifting(false);
    this.playNitro(false);
    try { this.ctx?.close(); } catch {}
    this.ctx = null;
  }
}

export const audio = new GameAudio();
