// Procedural soundtrack: 120 BPM, locked to the beat grid used by src/cinematic.js
// (beat k lands at k * 0.5 s). Deterministic and loop-safe: sustained tones are
// quantized to whole cycles per loop, and reverb/delay run two passes over a
// circular buffer so the tail of the loop flows into its start.
const TAU = Math.PI * 2;

const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
};

function rng(seedValue) {
  let a = seedValue >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hash = text => [...text].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

export function renderSoundtrack(preset, duration = 15, sampleRate = 44100) {
  const sound = { root: 55, scale: 'minor', ...preset.sound };
  const theme = preset.group;
  const N = Math.round(duration * sampleRate), beat = .5, beats = Math.round(duration / beat);
  const L = new Float32Array(N), R = new Float32Array(N);
  const rand = rng(hash(preset.id));
  const scale = SCALES[sound.scale] || SCALES.minor;
  const midi = (degree, octave = 0) => sound.root * 2 ** ((scale[((degree % 7) + 7) % 7] + 12 * (Math.floor(degree / 7) + octave)) / 12);
  const loopFreq = f => Math.max(1, Math.round(f * duration)) / duration; // whole cycles per loop

  // Mix a mono sample stream into the (circular) stereo bus.
  const add = (start, length, fn, gain = 1, pan = 0) => {
    const s0 = Math.round(start * sampleRate), n = Math.round(length * sampleRate);
    const l = gain * Math.cos((pan + 1) * Math.PI / 4), r = gain * Math.sin((pan + 1) * Math.PI / 4);
    for (let i = 0; i < n; i++) {
      const v = fn(i / sampleRate, i);
      const j = (s0 + i) % N;
      L[j] += v * l; R[j] += v * r;
    }
  };
  const noiseFilter = (kind, coeff) => {            // one-pole filters on white noise
    let z = 0;
    return () => { const x = rand() * 2 - 1; z += coeff * (x - z); return kind === 'high' ? x - z : z; };
  };

  // Sidechain envelope: pad and bass duck on every kick.
  const duckEnv = new Float32Array(N).fill(1);
  for (let k = 0; k < beats; k++) {
    const s0 = Math.round(k * beat * sampleRate), n = Math.round(.32 * sampleRate);
    for (let i = 0; i < n; i++) { const j = (s0 + i) % N; duckEnv[j] = Math.min(duckEnv[j], 1 - .78 * Math.exp(-i / sampleRate * 9)); }
  }

  // Pad: slow-breathing chord, detuned left/right, periodic over the loop.
  const chord = [0, 2, 4, 6].map(d => loopFreq(midi(d, 2)));
  const pad = new Float32Array(N), padR = new Float32Array(N);
  chord.forEach((f, voice) => {
    const f1 = loopFreq(f * (1 + .003)), f2 = loopFreq(f * (1 - .003));
    for (let i = 0; i < N; i++) {
      const t = i / sampleRate, swell = .55 + .45 * Math.sin(TAU * (t / duration * 2 + voice * .21));
      const wave = (freq, ph) => Math.sin(TAU * freq * t + ph) + .35 * Math.sin(TAU * freq * 2 * t + ph * 1.3) + .15 * Math.sin(TAU * freq * 3 * t);
      pad[i] += wave(f1, voice) * swell * .035; padR[i] += wave(f2, voice + 1) * swell * .035;
    }
  });
  for (let i = 0; i < N; i++) { L[i] += pad[i] * duckEnv[i]; R[i] += padR[i] * duckEnv[i]; }

  // Drums on the beat grid.
  for (let k = 0; k < beats; k++) {
    const t0 = k * beat, down = k % 4 === 0;
    let ph = 0;
    add(t0, .38, (t) => { const f = 42 + 130 * Math.exp(-t * 28); ph += TAU * f / sampleRate; return Math.sin(ph) * Math.exp(-t * 8.5); }, down ? 1.0 : .88);
    if (down) { let p2 = 0; add(t0, 1.4, (t) => { p2 += TAU * (sound.root * .75) / sampleRate; return Math.sin(p2) * Math.exp(-t * 2.6) * Math.min(1, t * 80); }, .7); }
    if (k % 2 === 1) { const n = noiseFilter('high', .35), tone = noiseFilter('low', .12); add(t0, .26, (t) => (n() * .8 + tone() * .5) * Math.exp(-t * 17) * (1 - Math.exp(-t * 900)), .42, .05); }
    for (const off of [.25, .5, .75]) {
      const n = noiseFilter('high', .6), open = off === .5 && k % 2 === 0;
      add(t0 + beat * off, open ? .16 : .05, (t) => n() * Math.exp(-t * (open ? 18 : 70)), off === .5 ? .2 : .1, (k % 2 ? -.35 : .35));
    }
  }

  // Bass groove, ducked against the kick.
  const bassPattern = [0, 0, 4, 0, 5, 0, 4, 2];
  for (let k = 0; k < beats; k++) {
    const degree = bassPattern[k % bassPattern.length], f = midi(degree, -1);
    let ph = 0;
    const s0 = Math.round((k * beat + beat * .5) * sampleRate);
    add(k * beat + beat * .5, beat * .46, (t, i) => {
      ph += TAU * f / sampleRate; const env = Math.min(1, t * 200) * Math.exp(-t * 3.2);
      return Math.tanh((Math.sin(ph) + .45 * Math.sin(2 * ph) + .2 * Math.sin(3 * ph)) * 1.6) * env * duckEnv[(s0 + i) % N];
    }, .26);
  }

  // Arpeggio: sixteenth-note plucks climbing through the scale, panned wide.
  const steps = beats * 4, climb = [0, 2, 4, 7, 4, 2, 6, 9, 7, 4, 2, 4, 9, 7, 11, 9];
  for (let s = 0; s < steps; s++) {
    if (rand() < .18 && s % 4) continue;
    const bar = Math.floor(s / 16), degree = climb[s % 16] + (bar % 2 ? 2 : 0), f = midi(degree, 1);
    let ph = 0;
    const gain = (s % 4 === 0 ? .15 : .1) * (1 + .5 * Math.sin(s / steps * TAU * 2));
    add(s * beat / 4, .3, (t) => { ph += TAU * f / sampleRate; return (Math.sin(ph) + .4 * Math.sin(ph * 2.01)) * Math.exp(-t * 14) * Math.min(1, t * 400); }, gain, Math.sin(s * 1.7) * .7);
  }

  // Elemental layer per chapter.
  if (theme === 'fire') {
    for (let i = 0; i < 260; i++) {             // crackle: tiny filtered clicks
      const t = rand() * duration, loud = rand() ** 3, n = noiseFilter('high', .8);
      add(t, .03, (tt) => n() * Math.exp(-tt * 140), .06 + .28 * loud, rand() * 2 - 1);
    }
    for (let k = 0; k < beats; k += 2) {        // flare whoosh
      const n = noiseFilter('low', .08);
      add(k * beat - .05, .6, (t) => n() * Math.sin(Math.PI * Math.min(1, t / .6)) ** 2, .09, k % 4 ? .4 : -.4);
    }
  } else if (theme === 'tide') {
    for (let i = 0; i < 70; i++) {              // water bubbles
      const t = rand() * duration, base = 350 + 700 * rand(); let ph = 0;
      add(t, .14, (tt) => { ph += TAU * (base * (1 + 2.2 * tt)) / sampleRate; return Math.sin(ph) * Math.exp(-tt * 30); }, .05 + .09 * rand(), rand() * 2 - 1);
    }
    for (let k = 0; k < beats; k += 2) {        // glass bells, a fifth above the arp
      const f = midi([0, 4, 2, 6][(k / 2) % 4], 3); let a = 0, b = 0;
      add(k * beat, 1.6, (t) => { a += TAU * f / sampleRate; b += TAU * f * 2.756 / sampleRate; return (Math.sin(a) + .35 * Math.sin(b)) * Math.exp(-t * 2.8); }, .06, k % 4 ? .5 : -.5);
    }
  } else {
    for (let k = 0; k < beats; k++) {            // arc zaps
      if (k % 4 !== 0 && rand() > .25) continue;
      const t0 = k * beat + (k % 4 ? rand() * .2 : 0), n = noiseFilter('high', .5); let ph = 0;
      add(t0, .28, (t) => { ph += TAU * (3400 * Math.exp(-t * 14) + 180) / sampleRate; return ((ph % TAU) / Math.PI - 1) * .5 * Math.exp(-t * 11) + n() * Math.exp(-t * 28) * .6; }, k % 4 ? .1 : .2, rand() * 1.6 - .8);
    }
    for (let k = 0; k < beats; k += 8) {         // deep drone swell on the phrase
      const f = loopFreq(midi(0, 0) * .5);
      add(k * beat, 4, (t) => Math.sin(TAU * f * (k * beat + t)) * Math.sin(Math.PI * t / 4) ** 2, .12);
    }
  }

  // Riser into the loop point: the downbeat boom at t=0 releases it.
  {
    const s0 = N - Math.round(2 * sampleRate);
    for (let i = 0; i < N - s0; i++) {
      const p = i / (N - s0), y = (rand() * 2 - 1) * p ** 2.2 * .14;
      L[s0 + i] += y; R[s0 + i] -= y * .6;
    }
  }

  // Space: two-pass feedback delay + Schroeder reverb on a circular buffer.
  const delay = (buf, seconds, feedback, mixAmount) => {
    const d = Math.round(seconds * sampleRate);
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < N; i++) buf[i] += buf[(i - d + N) % N] * feedback * mixAmount;
  };
  const wet = (src, delays, g) => {
    const out = new Float32Array(N);
    for (const ms of delays) {
      const d = Math.round(ms / 1000 * sampleRate), line = new Float32Array(N);
      for (let pass = 0; pass < 2; pass++) for (let i = 0; i < N; i++) line[i] = src[i] + line[(i - d + N) % N] * g;
      for (let i = 0; i < N; i++) out[i] += line[i] * .22;
    }
    return out;
  };
  delay(L, beat * .75, .45, .55); delay(R, beat * .5 * 1.5 + .013, .45, .55);
  const wetL = wet(L, [29.7, 37.1, 41.1, 43.7], .62), wetR = wet(R, [30.9, 36.3, 42.5, 45.1], .62);
  for (let i = 0; i < N; i++) { L[i] += wetL[i] * .28; R[i] += wetR[i] * .28; }

  // Soft clip, normalize to roughly -14 LUFS for social platforms.
  let peak = 0;
  for (let i = 0; i < N; i++) { L[i] = Math.tanh(L[i] * 1.15); R[i] = Math.tanh(R[i] * 1.15); peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
  const norm = .66 / (peak || 1);
  for (let i = 0; i < N; i++) { L[i] *= norm; R[i] *= norm; }
  return { left: L, right: R, sampleRate };
}

export function toWav({ left, right, sampleRate }) {
  const n = left.length, data = Buffer.alloc(44 + n * 4);
  data.write('RIFF', 0); data.writeUInt32LE(36 + n * 4, 4); data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(2, 22);
  data.writeUInt32LE(sampleRate, 24); data.writeUInt32LE(sampleRate * 4, 28); data.writeUInt16LE(4, 32); data.writeUInt16LE(16, 34);
  data.write('data', 36); data.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i])) * 32767), 44 + i * 4);
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i])) * 32767), 46 + i * 4);
  }
  return data;
}
