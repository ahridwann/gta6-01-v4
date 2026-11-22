// Procedural WebAudio for Lumina City — no audio files, everything is
// synthesized: engine hum, police siren, gunshot, punch thud, pickup blip,
// cash chime and a low synthwave bassline. Created lazily on first user
// gesture so browsers allow it; all calls are safe before init.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let bassTimer = null;
  let sirenNodes = null;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch (_) {
      return false;
    }
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    resume();
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure() || muted) return;
    resume();
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq || 1200;
    const g = ctx.createGain();
    g.gain.value = vol || 0.3;
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t);
  }

  return {
    init() {
      ensure();
      resume();
    },
    setMuted(v) {
      muted = v;
      if (master) master.gain.value = v ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    // continuous engine hum; speed 0..1 sets pitch + loudness
    engine(speed01, on) {
      if (!ensure()) return;
      resume();
      if (on && !engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineGain = ctx.createGain();
        engineGain.gain.value = 0;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 420;
        engineOsc.connect(f);
        f.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
      if (!engineOsc) return;
      if (!on) {
        engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
        return;
      }
      const s = Math.max(0, Math.min(1, speed01));
      engineOsc.frequency.setTargetAtTime(55 + s * 165, ctx.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(0.05 + s * 0.09, ctx.currentTime, 0.08);
    },
    // two-tone police siren while wanted >= 2; call with on=false to stop
    siren(on) {
      if (!on) {
        if (sirenNodes) {
          try {
            sirenNodes.osc.stop();
          } catch (_) {}
          sirenNodes = null;
        }
        return;
      }
      if (!ensure() || muted || sirenNodes) return;
      resume();
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      const g = ctx.createGain();
      g.gain.value = 0.045;
      const lfo = ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 0.9;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 220;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      osc.frequency.value = 880;
      osc.connect(g);
      g.connect(master);
      osc.start();
      lfo.start();
      sirenNodes = { osc, lfo };
    },
    gunshot() {
      noise(0.16, 0.5, 2800);
      tone(140, 0.1, 'square', 0.22, 50);
    },
    punch() {
      noise(0.09, 0.35, 500);
      tone(90, 0.09, 'sine', 0.3, 45);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.22);
      setTimeout(() => tone(990, 0.12, 'sine', 0.22), 70);
    },
    cash() {
      tone(880, 0.1, 'triangle', 0.25);
      setTimeout(() => tone(1174, 0.14, 'triangle', 0.25), 90);
      setTimeout(() => tone(1568, 0.2, 'triangle', 0.22), 180);
    },
    denied() {
      tone(180, 0.16, 'square', 0.18, 120);
    },
    busted() {
      tone(440, 0.5, 'sawtooth', 0.2, 110);
      setTimeout(() => tone(330, 0.6, 'sawtooth', 0.2, 82), 300);
    },
    // Looping synthwave bassline: Am – F – C – G roots, eighth notes.
    startBassline() {
      if (!ensure() || bassTimer) return;
      resume();
      const roots = [55, 43.65, 65.41, 49];
      let step = 0;
      bassTimer = setInterval(() => {
        if (muted || !ctx) return;
        const bar = Math.floor(step / 8) % 4;
        const root = roots[bar];
        const eighth = step % 8;
        const freq = eighth === 0 || eighth === 3 || eighth === 6 ? root : root * 2;
        tone(freq, 0.22, 'sawtooth', 0.07);
        if (eighth === 4) tone(root * 3, 0.18, 'triangle', 0.05);
        step++;
      }, 240);
    },
    stopBassline() {
      if (bassTimer) {
        clearInterval(bassTimer);
        bassTimer = null;
      }
    },
  };
}
