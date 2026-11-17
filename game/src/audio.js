// All sound is synthesized with WebAudio — no audio files, no downloads.
// A small engine hum, a two-tone siren, and short blips for pickups,
// crashes, punches and mission completions.

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return false;
      ctx = new AudioContextClass();
      return true;
    } catch {
      return false;
    }
  }

  /** Call from a user gesture (click / key) so the browser allows audio. */
  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function startEngine() {
    if (!ensure() || engineOsc) return;
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    engineOsc.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(ctx.destination);
    engineOsc.start();
  }

  /** speed01: 0..1 — raises pitch and volume while driving. */
  function setEngine(speed01, on) {
    if (!engineOsc || !engineGain) return;
    const target = on && !muted ? 0.02 + speed01 * 0.05 : 0;
    engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
    engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, ctx.currentTime, 0.1);
  }

  function startSiren() {
    if (!ensure() || sirenOsc) return;
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 720;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = muted ? 0 : 0.025;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(ctx.destination);
    sirenOsc.start();
  }

  function stopSiren() {
    if (!sirenOsc) return;
    try {
      sirenOsc.stop();
    } catch {}
    sirenOsc = null;
    sirenGain = null;
  }

  /** Call every frame; flips the siren between its two tones. */
  function updateSiren(dt, active) {
    if (active) {
      startSiren();
      if (sirenOsc) {
        sirenTimer += dt;
        if (sirenTimer > 0.42) {
          sirenTimer = 0;
          sirenHigh = !sirenHigh;
          sirenOsc.frequency.setTargetAtTime(sirenHigh ? 950 : 720, ctx.currentTime, 0.05);
        }
      }
    } else {
      stopSiren();
      sirenTimer = 0;
    }
  }

  function blip(freq, duration, type, volume) {
    if (!ensure() || muted) return;
    try {
      const osc = ctx.createOscillator();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume || 0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {}
  }

  function noiseBurst(duration, volume) {
    if (!ensure() || muted) return;
    try {
      const length = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = volume || 0.2;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      source.start();
    } catch {}
  }

  return {
    unlock,
    startEngine,
    setEngine,
    updateSiren,
    pickup() {
      blip(660, 0.12, 'sine', 0.14);
      setTimeout(() => blip(990, 0.18, 'sine', 0.14), 90);
    },
    crash() {
      noiseBurst(0.25, 0.25);
    },
    punch() {
      noiseBurst(0.08, 0.15);
    },
    honk() {
      blip(370, 0.18, 'square', 0.06);
    },
    missionComplete() {
      blip(523, 0.14, 'sine', 0.14);
      setTimeout(() => blip(659, 0.14, 'sine', 0.14), 130);
      setTimeout(() => blip(784, 0.26, 'sine', 0.16), 260);
    },
    busted() {
      blip(220, 0.4, 'sawtooth', 0.12);
      setTimeout(() => blip(165, 0.6, 'sawtooth', 0.12), 250);
    },
    toggleMute() {
      muted = !muted;
      if (engineGain) engineGain.gain.value = 0;
      if (sirenGain) sirenGain.gain.value = 0;
      return muted;
    },
  };
}
