import { geometry, poseAt, sampleCurve, gearOutline } from './core.js';
import { drawSceneMotion } from './render.js';
import { drawProceduralEffects } from './effects.js';

// Cinematic video engine. Every frame is a pure function of the loop phase, so the
// result is repeatable and loops seamlessly: all motion uses whole cycles per loop.
const TAU = Math.PI * 2;
const wrap = v => ((v % 1) + 1) % 1;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = t => t * t * (3 - 2 * t);
function seed(index, channel = 0) {
  let value = Math.imul(index + 1, 374761393) + Math.imul(channel + 1, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}
const hex = h => h.match(/[a-f\d]{2}/gi).map(c => parseInt(c, 16));
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export const DEFAULT_LOOK = Object.freeze({
  laps: 2,        // pen laps around the full curve per loop
  tail: .5,       // fraction of the curve kept hot behind the pen
  flow: 2,        // color cycles along the curve
  chroma: 2.4,    // chromatic aberration in px at 1080
  rays: 24,       // god-ray wedges (0 = none)
  echoes: 2,      // ghost copies of the sigil
  spin: 1,        // direction of ghost and ray rotation
  drift: -1,      // mote drift: -1 rises, 1 falls
  bloom: 1,
  fx: 1.25,       // procedural effect intensity
  gears: 1,       // 0 hidden, 1 ring + rolling gear, 2-4 adds nested planetary layers
  mechanism: .5,  // visibility of the gears
  shake: 1,       // camera impact on strong beats
});

export function createCinematicScene({ preset, palette, size, duration, createCanvas, grain }) {
  const look = { ...DEFAULT_LOOK, ...preset.look };
  const S = size, u = S / 1080;
  const model = geometry(preset);
  const center = { x: S / 2, y: S * .53 };
  const scale = S * .375;
  const beats = Math.max(8, Math.round(duration * 2));      // 120 BPM
  const colors = palette.colors.map(hex), pale = palette.pale.map(hex);
  const glow = hex(palette.glowColor);
  // Ping-pong through the palette so the cyclic gradient has no seam.
  const cycle = [0, 1, 2, 3, 4, 5, 4, 3, 2, 1].map(i => colors[i]);
  const colorAt = t => {
    const f = wrap(t) * cycle.length, i = Math.floor(f);
    return mix(cycle[i], cycle[(i + 1) % cycle.length], smooth(f - i));
  };

  // Curve in pixel space, cut into chunks that are colored and heated individually.
  const points = sampleCurve(preset), n = points.length - 1;
  const px = new Float32Array(points.length * 2);
  points.forEach((p, i) => { px[i * 2] = p.x * scale; px[i * 2 + 1] = p.y * scale; });
  const K = 420;
  const strokeRange = (ctx, from, to) => {
    ctx.beginPath(); ctx.moveTo(px[from * 2], px[from * 2 + 1]);
    for (let i = from + 1; i <= to; i++) ctx.lineTo(px[i * 2], px[i * 2 + 1]);
    ctx.stroke();
  };

  const layer = () => { const c = createCanvas(S, S); return [c, c.getContext('2d')]; };
  const [canvas, out] = layer();
  const [sceneCanvas, scene] = layer();
  const [tmpCanvas, tmp] = layer();
  const levels = [2, 4, 8, 16].map(d => { const w = Math.round(S / d), c = createCanvas(w, w); return { c, x: c.getContext('2d'), w }; });

  // Static background: backdrop color, grain, instrument bezel, vignette.
  const [baseCanvas, base] = layer();
  base.fillStyle = palette.background; base.fillRect(0, 0, S, S);
  if (grain) { base.globalAlpha = .16; base.drawImage(grain, 0, 0, S, S); base.globalAlpha = 1; }
  const vignette = base.createRadialGradient(S / 2, S / 2, S * .30, S / 2, S / 2, S * .78);
  vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,0,0,.78)');
  base.fillStyle = vignette; base.fillRect(0, 0, S, S);
  base.save(); base.translate(center.x, center.y);
  for (let i = 0; i < 96; i++) {
    const a = i / 96 * TAU, major = i % 8 === 0, r = scale * 1.17;
    base.strokeStyle = rgba(major ? hex(palette.amber) : mix(hex(palette.amber), [0, 0, 0], .75), major ? .75 : .45);
    base.lineWidth = (major ? 2 : 1) * u;
    base.beginPath(); base.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    base.lineTo(Math.cos(a) * (r + (major ? 16 : 7) * u), Math.sin(a) * (r + (major ? 16 : 7) * u)); base.stroke();
  }
  base.restore();

  // Soft sprite used for motes and bokeh.
  const sprite = createCanvas(64, 64), sx = sprite.getContext('2d');
  const sg = sx.createRadialGradient(32, 32, 0, 32, 32, 32);
  sg.addColorStop(0, 'rgba(255,255,255,1)'); sg.addColorStop(.25, 'rgba(255,255,255,.55)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
  sx.fillStyle = sg; sx.fillRect(0, 0, 64, 64);
  const tints = colors.map(c => { const t = createCanvas(64, 64), x = t.getContext('2d'); x.drawImage(sprite, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = rgba(c, 1); x.fillRect(0, 0, 64, 64); return t; });
  const motes = Array.from({ length: 110 }, (_, i) => ({
    x: seed(i, 40), y: seed(i, 41), depth: .25 + .75 * seed(i, 42), color: i % 6,
    speed: 1 + Math.floor(seed(i, 43) * 2), sway: seed(i, 44) * TAU, twinkle: 2 + Math.floor(seed(i, 45) * 4),
  }));

  // Nested planetary layers: ring gear (36) + sun (12) + three planets (12). The tooth
  // counts satisfy ring = sun + 2 * planet, and the spins follow planetary kinematics.
  const outlineCache = new Map();
  const toothPath = (ctx, teeth, radius, module, internal) => {
    const key = `${teeth}|${radius.toFixed(2)}|${module.toFixed(3)}|${internal}`;
    if (!outlineCache.has(key)) outlineCache.set(key, gearOutline(teeth, radius, module, internal));
    ctx.beginPath(); outlineCache.get(key).forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.closePath();
  };
  function nest(ctx, R, depth, phase, level) {
    const Rr = R * .8, module = Rr / 18, planet = Rr / 3, orbit = Rr - planet;
    if (Rr < 9 * u) return;
    const dir = level % 2 ? 1 : -1, carrier = dir * phase * TAU * (level === 1 ? 3 : 2);
    const stroke = rgba(mix(colors[(level + 1) % 6], [255, 255, 255], .25), .5 + .12 * level);
    ctx.lineWidth = Math.max(.7, 1.3 * u / level ** .5); ctx.strokeStyle = stroke; ctx.fillStyle = rgba(colors[(level + 2) % 6], .05);
    toothPath(ctx, 36, Rr, module, true); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, Rr + 2.6 * module, 0, TAU); ctx.stroke();
    // Sun gear turns at (1 + ring / planet) times the carrier angle.
    ctx.save(); ctx.rotate(4 * carrier); toothPath(ctx, 12, planet, module, false); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, planet * .28, 0, TAU); ctx.stroke(); ctx.restore();
    for (let k = 0; k < 3; k++) {
      const a = carrier + k * TAU / 3;
      ctx.save(); ctx.translate(Math.cos(a) * orbit, Math.sin(a) * orbit); ctx.rotate(-2 * carrier + k * .5);
      toothPath(ctx, 12, planet, module, false); ctx.fill(); ctx.stroke();
      if (depth > 1) nest(ctx, planet - module * 1.6, depth - 1, phase, level + 1);
      else { ctx.beginPath(); ctx.arc(0, 0, planet * .25, 0, TAU); ctx.stroke(); }
      ctx.restore();
    }
  }

  function backdrop(ctx, phase, pulse, strong) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    // Drifting nebula clouds on closed orbits.
    for (let i = 0; i < 3; i++) {
      const a = phase * TAU + i * 2.1, r = S * (.5 + .14 * Math.sin(a * 2 + i));
      const x = S / 2 + Math.cos(a) * S * .22, y = S * .5 + Math.sin(a * 1 + i) * S * .2;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(colors[(i * 2 + 1) % 6], .13 + .05 * pulse)); g.addColorStop(1, rgba(colors[(i * 2 + 1) % 6], 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    }
    // Rotating light rays.
    if (look.rays) {
      ctx.save(); ctx.translate(center.x, center.y); ctx.rotate(phase * TAU / look.rays * look.spin * 2);
      ctx.beginPath();
      for (let i = 0; i < look.rays; i++) {
        const a = i / look.rays * TAU, w = TAU / look.rays * .10;
        ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a - w) * S, Math.sin(a - w) * S); ctx.lineTo(Math.cos(a + w) * S, Math.sin(a + w) * S); ctx.closePath();
      }
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, S * .72);
      g.addColorStop(0, rgba(colors[2], 0)); g.addColorStop(.42, rgba(colors[2], .02)); g.addColorStop(.62, rgba(colors[2], .10 + .06 * pulse)); g.addColorStop(1, rgba(colors[3], 0));
      ctx.fillStyle = g; ctx.fill(); ctx.restore();
    }
    // Concentric shock rings launched on every beat (stronger on the downbeat).
    for (let k = 0; k < 3; k++) {
      const age = wrap(phase * beats / 2 - k / 3), power = k === 0 ? 1 : .7;
      const alpha = (1 - age) ** 2 * .34 * power * (strong ? 1.3 : 1);
      ctx.strokeStyle = rgba(colorAt(phase * 2 + k * .13), alpha); ctx.lineWidth = (2 + 6 * (1 - age)) * u;
      ctx.beginPath(); ctx.arc(center.x, center.y, scale * (.25 + 1.45 * age ** .7), 0, TAU); ctx.stroke();
    }
    // Parallax motes and bokeh.
    for (const m of motes) {
      const y = wrap(m.y + look.drift * phase * m.speed * m.depth * 1) , x = wrap(m.x + .02 * Math.sin(phase * TAU * m.speed + m.sway));
      const tw = .35 + .65 * (.5 + .5 * Math.sin(phase * TAU * m.twinkle + m.sway));
      const r = (5 + 30 * m.depth * m.depth * (m.color % 2 ? 1 : .55)) * u;
      ctx.globalAlpha = tw * (.12 + .38 * m.depth * m.depth);
      ctx.drawImage(tints[m.color], x * S - r, y * S - r, r * 2, r * 2);
    }
    ctx.restore();
  }

  function sigil(ctx, phase, pulse, strong) {
    const head = wrap(phase * look.laps);
    const impact = pulse ** 2 * (strong ? 1 : .4);
    const zoom = 1 + .035 * Math.sin(phase * TAU * 2) + .02 * impact;
    ctx.save();
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, S, S);
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(center.x, center.y); ctx.scale(zoom, zoom);

    // Ghost copies slowly counter-rotate by one symmetry step: perfect loop.
    const step = TAU / model.symmetry;
    for (let e = 0; e < look.echoes; e++) {
      const dir = (e % 2 ? -1 : 1) * look.spin, size = e === 0 ? 1.0 + .08 * pulse : .62 + .1 * e;
      ctx.save(); ctx.rotate(dir * step * (phase * (e + 1)) + e * step * .5); ctx.scale(size, size);
      ctx.strokeStyle = rgba(colorAt(.2 + e * .3 + phase * 2), e === 0 ? .14 : .11); ctx.lineWidth = (e === 0 ? 1.4 : 1) * u;
      strokeRange(ctx, 0, n); ctx.restore();
    }

    // Gears behind the trace (hidden when look.gears is 0).
    if (look.gears > 0 && look.mechanism > 0) {
      const stage = scale / .363;
      ctx.save(); ctx.translate(-stage / 2, -stage / 2); ctx.globalAlpha = look.mechanism;
      drawSceneMotion(ctx, stage, preset, head, true, palette, { spokes: look.gears < 2 });
      ctx.restore();
      if (look.gears > 1) {
        const pose = poseAt(head * model.maxTheta, preset);
        ctx.save(); ctx.globalAlpha = Math.min(1, look.mechanism * 1.25);
        ctx.translate(pose.center.x * scale, pose.center.y * scale); ctx.rotate(pose.rotation);
        nest(ctx, model.r * scale - 16 * u, look.gears - 1, phase, 1);
        ctx.restore();
      }
    }

    // The sigil: dim persistent path + hot, color-flowing phosphor tail.
    ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
    const baseW = 1.5 * u;
    for (let k = 0; k < K; k++) {
      const from = Math.floor(k / K * n), to = Math.min(n, Math.floor((k + 1) / K * n) + 1);
      const mid = (k + .5) / K, behind = wrap(head - mid);
      const heat = behind < look.tail ? (1 - behind / look.tail) ** 1.6 : 0;
      const hue = colorAt(mid * look.flow - phase * 2 + .0);
      const hot = mix(hue, pale[3], heat * .6);
      ctx.strokeStyle = rgba(hue, .30 + .12 * pulse); ctx.lineWidth = baseW; strokeRange(ctx, from, to);
      if (heat > .02) {
        ctx.strokeStyle = rgba(hot, heat * .38); ctx.lineWidth = (4 + 3 * heat) * u; strokeRange(ctx, from, to);
        ctx.strokeStyle = rgba(mix(hot, [255, 255, 255], heat * .45), .25 + heat * .7); ctx.lineWidth = (1.5 + 1.3 * heat) * u; strokeRange(ctx, from, to);
      }
    }

    // Pen head: lens flare with anamorphic streak and cross glint.
    const pen = poseAt(head * model.maxTheta, preset).pen, hx = pen.x * scale, hy = pen.y * scale;
    const hc = mix(colorAt(head * look.flow - phase * 2), [255, 255, 255], .55);
    const flare = (r, a) => {
      const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, r);
      g.addColorStop(0, rgba([255, 255, 255], a)); g.addColorStop(.2, rgba(hc, a * .7)); g.addColorStop(1, rgba(hc, 0));
      ctx.fillStyle = g; ctx.fillRect(hx - r, hy - r, r * 2, r * 2);
    };
    flare(54 * u * (1 + .25 * pulse), .8); flare(17 * u, 1);
    ctx.save(); ctx.translate(hx, hy);
    for (const [w, h, a] of [[360, 4, .5], [120, 11, .3]]) {
      const g = ctx.createLinearGradient(-w * u, 0, w * u, 0);
      g.addColorStop(0, rgba(hc, 0)); g.addColorStop(.5, rgba([255, 255, 255], a * (.7 + .3 * pulse))); g.addColorStop(1, rgba(hc, 0));
      ctx.fillStyle = g; ctx.fillRect(-w * u, -h * u / 2, w * 2 * u, h * u);
    }
    ctx.rotate(Math.PI / 2);
    const gv = ctx.createLinearGradient(-90 * u, 0, 90 * u, 0);
    gv.addColorStop(0, rgba(hc, 0)); gv.addColorStop(.5, rgba([255, 255, 255], .5)); gv.addColorStop(1, rgba(hc, 0));
    ctx.fillStyle = gv; ctx.fillRect(-90 * u, -1.5 * u, 180 * u, 3 * u);
    ctx.restore();

    // Procedural particles / lightning etc. follow the same fast phase as the pen.
    ctx.save(); ctx.translate(-center.x, -center.y);
    ctx.translate(center.x - scale / .363 / 2, center.y - scale / .363 / 2);
    drawProceduralEffects(ctx, { size: scale / .363, config: preset, phase: head, palette, effectId: preset.effectId, intensity: (look.fx ?? 1.25) + .3 * impact });
    ctx.restore();
    ctx.restore();
  }

  function bloom(target, source, strength) {
    let prev = source;
    levels.forEach((l, i) => {
      l.x.clearRect(0, 0, l.w, l.w); l.x.imageSmoothingQuality = 'high';
      l.x.drawImage(prev, 0, 0, l.w, l.w); prev = l.c;
    });
    target.save(); target.globalCompositeOperation = 'lighter';
    const weights = [.55, .75, .9, 1.0], blurs = [0, 1.5, 3, 4];
    levels.forEach((l, i) => {
      target.globalAlpha = Math.min(1, weights[i] * strength * .62);
      target.filter = blurs[i] ? `blur(${blurs[i]}px)` : 'none';
      target.drawImage(l.c, 0, 0, S, S);
    });
    target.restore();
  }

  function aberrate(target, source, amount) {
    target.save(); target.globalCompositeOperation = 'lighter';
    [['#ff0000', amount], ['#00ff00', 0], ['#0000ff', -amount]].forEach(([color, dx]) => {
      tmp.globalCompositeOperation = 'source-over'; tmp.drawImage(source, 0, 0);
      tmp.globalCompositeOperation = 'multiply'; tmp.fillStyle = color; tmp.fillRect(0, 0, S, S);
      target.drawImage(tmpCanvas, dx, 0);
    });
    target.restore();
  }

  function hud(ctx, phase, pulse, strong) {
    const amber = hex(palette.amber), L = 38 * u;
    ctx.save();
    // Corner brackets.
    ctx.strokeStyle = rgba(colors[2], .55 + .3 * pulse); ctx.lineWidth = 2 * u;
    for (const [cx, cy, sx, sy] of [[L, L, 1, 1], [S - L, L, -1, 1], [L, S - L, 1, -1], [S - L, S - L, -1, -1]]) {
      ctx.beginPath(); ctx.moveTo(cx, cy + sy * 34 * u); ctx.lineTo(cx, cy); ctx.lineTo(cx + sx * 34 * u, cy); ctx.stroke();
    }
    // Loop progress arc around the bezel.
    const r = scale * 1.17 + 30 * u;
    ctx.strokeStyle = rgba(amber, .16); ctx.lineWidth = 1.5 * u; ctx.beginPath(); ctx.arc(center.x, center.y, r, 0, TAU); ctx.stroke();
    ctx.shadowColor = palette.penGlow; ctx.shadowBlur = 14 * u; ctx.strokeStyle = rgba(colorAt(phase * 2), .95); ctx.lineWidth = 3 * u;
    ctx.beginPath(); ctx.arc(center.x, center.y, r, -Math.PI / 2, -Math.PI / 2 + TAU * phase); ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    const text = (s, x, y, size, weight, color, alpha = 1, align = 'left') => {
      ctx.font = `${weight} ${size * u}px "Chakra Petch"`; ctx.textAlign = align; ctx.fillStyle = rgba(color, alpha); ctx.fillText(s, x, y);
    };
    const title = preset.title.toUpperCase();
    // Glitch: split title copies on strong beats.
    if (strong && pulse > .45) {
      const g = (pulse - .45) * 14 * u;
      ctx.globalCompositeOperation = 'lighter';
      text(title, 56 * u - g, 110 * u, 40, 600, [255, 0, 60], .8); text(title, 56 * u + g, 110 * u, 40, 600, [0, 220, 255], .8);
    }
    ctx.globalCompositeOperation = 'source-over';
    text('GEAR BLOOM / GENERATIVE SIGILS', 56 * u, 70 * u, 15, 400, amber, .8);
    ctx.shadowColor = palette.glowColor; ctx.shadowBlur = 16 * u;
    text(title, 56 * u, 110 * u, 40, 600, mix(pale[1], [255, 255, 255], .5), 1);
    ctx.shadowBlur = 0;
    text(`${preset.group.toUpperCase()} / ${String(preset.number).padStart(2, '0')}`, S - 56 * u, 70 * u, 17, 400, pale[3], .95, 'right');
    text(preset.effectName.toUpperCase(), S - 56 * u, 98 * u, 14, 400, colors[2], .9, 'right');

    const theta = (phase * look.laps % 1) * model.turns * 360;
    text(`96 : ${preset.innerTeeth}  TEETH   ${Math.round(preset.offset * 100)}%  OFFSET`, 56 * u, S - 86 * u, 16, 400, amber, .85);
    text(`ANGLE ${theta.toFixed(1).padStart(8, '0')} DEG`, 56 * u, S - 62 * u, 16, 600, pale[1], .95);
    text(`${model.symmetry}-FOLD  /  ${model.turns} ORBITS`, S - 56 * u, S - 86 * u, 16, 400, amber, .85, 'right');
    text(`${String(Math.floor(phase * duration)).padStart(2, '0')}:${String(Math.floor(phase * duration * 100 % 100)).padStart(2, '0')} / ${String(Math.round(duration)).padStart(2, '0')}:00`, S - 56 * u, S - 62 * u, 16, 600, pale[1], .95, 'right');
    text('MOTION INTO MATHEMATICS. MATHEMATICS INTO ART.', S / 2, S - 36 * u, 12, 400, amber, .5, 'center');
    ctx.restore();
  }

  function frame(rawPhase, frameIndex = 0) {
    const phase = wrap(rawPhase);
    const beatPhase = wrap(phase * beats), pulse = Math.exp(-beatPhase * 7);
    const strong = Math.floor(phase * beats) % 4 === 0;

    out.globalCompositeOperation = 'source-over'; out.globalAlpha = 1; out.filter = 'none';
    out.drawImage(baseCanvas, 0, 0);
    backdrop(out, phase, pulse, strong);

    sigil(scene, phase, pulse, strong);
    const kick = look.shake * pulse * (strong ? 1 : .35);
    aberrate(out, sceneCanvas, look.chroma * u * (.6 + 2.2 * kick));
    bloom(out, sceneCanvas, look.bloom * (1 + .35 * pulse));

    // Animated film grain and scanline sweep.
    if (grain) {
      out.save(); out.globalCompositeOperation = 'lighter'; out.globalAlpha = .05;
      const ox = seed(frameIndex, 1) * S * .4, oy = seed(frameIndex, 2) * S * .4;
      out.drawImage(grain, -ox, -oy, S * 1.4, S * 1.4); out.restore();
    }
    out.save(); out.globalCompositeOperation = 'lighter';
    const sy = wrap(phase * 2) * (S + 200 * u) - 100 * u, sg2 = out.createLinearGradient(0, sy - 90 * u, 0, sy + 90 * u);
    sg2.addColorStop(0, rgba(colors[3], 0)); sg2.addColorStop(.5, rgba(colors[3], .06)); sg2.addColorStop(1, rgba(colors[3], 0));
    out.fillStyle = sg2; out.fillRect(0, sy - 90 * u, S, 180 * u); out.restore();
    hud(out, phase, pulse, strong);
    return canvas;
  }
  return { canvas, frame, model, palette };
}
