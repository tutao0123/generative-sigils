import { geometry, poseAt, sampleCurve, gearOutline } from './core.js';
import { DEFAULT_PALETTE } from './palettes.js';
import { drawProceduralEffects } from './effects.js';

const TAU = Math.PI * 2;
const AMBER = '#ffc568';
const outlines = new Map();
function outline(teeth, radius, internal) {
  const key = `${teeth}:${radius}:${internal}`;
  if (!outlines.has(key)) outlines.set(key, gearOutline(teeth, radius, 2 / 96, internal));
  return outlines.get(key);
}
function path(ctx, points) { points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); }
function circle(ctx, x, y, radius) { ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); }

export function drawCurve(ctx, points, cx, cy, scale, progress = 1, color = AMBER, lineWidth = 1.3) {
  const end = Math.max(1, Math.min(points.length, Math.floor((points.length - 1) * progress) + 1));
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath();
  for (let i = 0; i < end; i++) {
    const p = points[i]; if (!i) ctx.moveTo(cx + p.x * scale, cy + p.y * scale); else ctx.lineTo(cx + p.x * scale, cy + p.y * scale);
  }
  ctx.stroke(); ctx.restore();
}

function spectrum(ctx, cx, cy, scale, pale = false, palette = DEFAULT_PALETTE) {
  // Spatial color keeps each part of a closed curve continuous as the pen moves.
  const gradient = ctx.createLinearGradient(cx - scale, cy - scale * .8, cx + scale, cy + scale * .8);
  const colors = pale ? palette.pale : palette.colors;
  [0, .15, .30, .50, .70, 1].forEach((stop, i) => gradient.addColorStop(stop, colors[i]));
  return gradient;
}

export function drawLuminousCurve(ctx, points, cx, cy, scale, progress = 1, strength = 1, palette = DEFAULT_PALETTE) {
  const color = spectrum(ctx, cx, cy, scale, false, palette);
  const glow = Math.max(3, scale * .065);
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = .42 * strength; ctx.shadowColor = palette.glowColor; ctx.shadowBlur = glow;
  drawCurve(ctx, points, cx, cy, scale, progress, color, Math.max(2, scale * .015));
  ctx.globalAlpha = strength; ctx.shadowBlur = glow * .25;
  drawCurve(ctx, points, cx, cy, scale, progress, color, Math.max(1.2, scale * .0065));
  ctx.globalAlpha = .4 * strength; ctx.shadowBlur = 0;
  drawCurve(ctx, points, cx, cy, scale, progress, spectrum(ctx, cx, cy, scale, true, palette), Math.max(.45, scale * .0018));
  ctx.restore();
}

export function drawScene(ctx, size, config, points, progress, showMechanism, palette = DEFAULT_PALETTE) {
  ctx.clearRect(0, 0, size, size);
  drawSceneBackdrop(ctx, size, palette);
  const center = size / 2, scale = size * .363;
  drawCurve(ctx, points, center, center, scale, 1, 'rgba(168,91,146,.23)', .65);
  drawLuminousCurve(ctx, points, center, center, scale, progress, 1, palette);
  drawSceneMotion(ctx, size, config, progress, showMechanism, palette);
}

export function drawSceneBackdrop(ctx, size, palette = DEFAULT_PALETTE) {
  const center = size / 2, scale = size * 0.363;

  const aura = ctx.createRadialGradient(center, center, 0, center, center, scale * 1.12);
  aura.addColorStop(0, palette.aura[0]);
  aura.addColorStop(.72, palette.aura[1]);
  aura.addColorStop(1, palette.aura[2]);
  ctx.fillStyle = aura; ctx.fillRect(0, 0, size, size);

  ctx.save();
  ctx.translate(center, center);
  // A fixed, graduated instrument bezel; tick spacing is tied to the 96-tooth ring.
  for (let i = 0; i < 96; i++) {
    const a = i / 96 * TAU;
    const major = i % 8 === 0;
    const radius = scale * 1.15;
    ctx.strokeStyle = major ? palette.amber : '#513129'; ctx.lineWidth = major ? 1.5 : 1;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * radius, Math.sin(a) * radius);
    ctx.lineTo(Math.cos(a) * (radius + (major ? 10 : 4)), Math.sin(a) * (radius + (major ? 10 : 4))); ctx.stroke();
  }
  circle(ctx, 0, 0, scale * 1.115); ctx.strokeStyle = '#49301b'; ctx.lineWidth = 1; ctx.stroke();
  ctx.strokeStyle = '#30231a'; ctx.lineWidth = 0.7; ctx.setLineDash([3, 8]);
  ctx.beginPath(); ctx.moveTo(-scale * 1.075, 0); ctx.lineTo(scale * 1.075, 0); ctx.moveTo(0, -scale * 1.075); ctx.lineTo(0, scale * 1.075); ctx.stroke(); ctx.setLineDash([]);
  circle(ctx, 0, 0, 2); ctx.fillStyle = '#805b33'; ctx.fill();
  ctx.restore();
}

// An independent phase lets a video keep its complete trace lit while gears move.
export function drawSceneMotion(ctx, size, config, phase, showMechanism, palette = DEFAULT_PALETTE, { spokes = true } = {}) {
  const center = size / 2, scale = size * .363;
  const model = geometry(config), pose = poseAt(phase * model.maxTheta, config);
  if (showMechanism) {
    ctx.save(); ctx.translate(center, center); ctx.scale(scale, scale);
    const fixed = outline(config.outerTeeth, 1, true);
    ctx.beginPath(); ctx.arc(0, 0, 1.07, 0, TAU); path(ctx, fixed); ctx.closePath();
    ctx.fillStyle = 'rgba(133,71,49,.15)'; ctx.fill('evenodd'); ctx.strokeStyle = '#b9804d'; ctx.lineWidth = 1.1 / scale; ctx.stroke();
    circle(ctx, 0, 0, 1); ctx.setLineDash([2 / scale, 6 / scale]); ctx.strokeStyle = '#644322'; ctx.lineWidth = .6 / scale; ctx.stroke(); ctx.setLineDash([]);

    ctx.save(); ctx.translate(pose.center.x, pose.center.y); ctx.rotate(pose.rotation);
    const wheel = outline(config.innerTeeth, model.r, false);
    ctx.beginPath(); path(ctx, wheel); ctx.closePath();
    ctx.fillStyle = 'rgba(24,15,29,.35)'; ctx.fill(); ctx.strokeStyle = palette.amber; ctx.lineWidth = 1.2 / scale; ctx.shadowColor = palette.glowColor; ctx.shadowBlur = 3 / scale; ctx.stroke(); ctx.shadowBlur = 0;
    circle(ctx, 0, 0, model.r * .76); ctx.strokeStyle = '#604123'; ctx.lineWidth = .7 / scale; ctx.stroke();
    for (let i = 0; spokes && i < 6; i++) {
      const a = i / 6 * TAU; ctx.beginPath();
      ctx.moveTo(Math.cos(a) * model.r * .13, Math.sin(a) * model.r * .13);
      ctx.lineTo(Math.cos(a) * model.r * .7, Math.sin(a) * model.r * .7); ctx.stroke();
    }
    circle(ctx, 0, 0, 4 / scale); ctx.fillStyle = '#c18d49'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(model.penRadius, 0); ctx.strokeStyle = '#ffe1a3'; ctx.lineWidth = 1.25 / scale; ctx.stroke();
    ctx.restore(); ctx.restore();
  }
  const px = center + pose.pen.x * scale, py = center + pose.pen.y * scale;
  ctx.save(); ctx.shadowColor = palette.penGlow; ctx.shadowBlur = 22;
  circle(ctx, px, py, 3.5); ctx.fillStyle = '#fff5e4'; ctx.fill();
  circle(ctx, px, py, 8); ctx.strokeStyle = palette.penGlow; ctx.lineWidth = 1.1; ctx.stroke(); ctx.restore();
}

export function drawDial(ctx, value) {
  const cx = 49, cy = 49;
  ctx.clearRect(0, 0, 98, 98);
  for (let i = 0; i <= 30; i++) {
    const a = (-225 + i * 9) * Math.PI / 180;
    ctx.strokeStyle = i / 30 <= value ? '#be8a46' : '#47321e';
    ctx.lineWidth = i % 5 === 0 ? 1.7 : 1;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 42, cy + Math.sin(a) * 42);
    ctx.lineTo(cx + Math.cos(a) * (i % 5 === 0 ? 47 : 45), cy + Math.sin(a) * (i % 5 === 0 ? 47 : 45)); ctx.stroke();
  }
  circle(ctx, cx, cy, 33); ctx.fillStyle = '#171410'; ctx.fill(); ctx.strokeStyle = '#89613a'; ctx.lineWidth = 1.2; ctx.stroke();
  circle(ctx, cx, cy, 28); ctx.strokeStyle = '#30251a'; ctx.lineWidth = 1; ctx.stroke();
  for (let i = 0; i < 40; i++) {
    const a = i / 40 * TAU; ctx.strokeStyle = i % 2 ? '#332719' : '#4b3620';
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 29, cy + Math.sin(a) * 29); ctx.lineTo(cx + Math.cos(a) * 32, cy + Math.sin(a) * 32); ctx.stroke();
  }
  const angle = (-225 + value * 270) * Math.PI / 180;
  ctx.save(); ctx.shadowColor = '#ffb449'; ctx.shadowBlur = 7; ctx.strokeStyle = AMBER; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx + Math.cos(angle) * 17, cy + Math.sin(angle) * 17); ctx.lineTo(cx + Math.cos(angle) * 25, cy + Math.sin(angle) * 25); ctx.stroke(); ctx.restore();
  circle(ctx, cx, cy, 4); ctx.fillStyle = '#4d3823'; ctx.fill();
}

const SEGMENTS = { '0': 'abcedf', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd', '6': 'afgecd', '7': 'abc', '8': 'abcdefg', '9': 'abfgcd', '-': 'g' };
export function drawDigital(ctx, text, width, height) {
  ctx.clearRect(0, 0, width, height);
  const charWidth = 18, total = text.length * charWidth - 3;
  const x0 = (width - total) / 2, y0 = (height - 29) / 2;
  const coords = { a: [3, 0, 11, 3], b: [14, 3, 3, 11], c: [14, 16, 3, 10], d: [3, 27, 11, 3], e: [0, 16, 3, 10], f: [0, 3, 3, 11], g: [3, 13, 11, 3] };
  ctx.save();
  for (let i = 0; i < text.length; i++) {
    const x = x0 + i * charWidth, char = text[i];
    if (char === ':') { ctx.fillStyle = AMBER; ctx.fillRect(x + 7, y0 + 8, 2, 3); ctx.fillRect(x + 7, y0 + 20, 2, 3); continue; }
    for (const [s, [dx, dy, w, h]] of Object.entries(coords)) {
      const lit = (SEGMENTS[char] || '').includes(s);
      ctx.fillStyle = lit ? '#ffe3a3' : '#38232b'; ctx.shadowColor = '#ff9854'; ctx.shadowBlur = lit ? 7 : 0;
      const px = x + dx, py = y0 + dy; ctx.beginPath();
      if (w > h) { ctx.moveTo(px, py + h / 2); ctx.lineTo(px + 1.5, py); ctx.lineTo(px + w - 1.5, py); ctx.lineTo(px + w, py + h / 2); ctx.lineTo(px + w - 1.5, py + h); ctx.lineTo(px + 1.5, py + h); }
      else { ctx.moveTo(px + w / 2, py); ctx.lineTo(px + w, py + 1.5); ctx.lineTo(px + w, py + h - 1.5); ctx.lineTo(px + w / 2, py + h); ctx.lineTo(px, py + h - 1.5); ctx.lineTo(px, py + 1.5); }
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
}

export async function exportArtwork(config, name, palette = DEFAULT_PALETTE, effects = {}) {
  await document.fonts.ready;
  const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 1800;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = palette.background; ctx.fillRect(0, 0, 1600, 1800);
  try {
    const grain = new Image(); grain.src = '/assets/instrument-grain.png'; await grain.decode();
    ctx.save(); ctx.globalAlpha = .35; ctx.drawImage(grain, 0, 0, 1600, 1800); ctx.restore();
  } catch { /* The exported drawing remains usable if the optional texture is unavailable. */ }
  const aura = ctx.createRadialGradient(800, 940, 60, 800, 940, 780);
  aura.addColorStop(0, palette.aura[0]); aura.addColorStop(.7, palette.aura[1]); aura.addColorStop(1, palette.aura[2]);
  ctx.fillStyle = aura; ctx.fillRect(0, 0, 1600, 1800);
  ctx.strokeStyle = '#995353'; ctx.lineWidth = 2; ctx.strokeRect(70, 70, 1460, 1660);
  ctx.fillStyle = '#b1854c'; ctx.font = '22px "Chakra Petch", monospace'; ctx.textAlign = 'left';
  ctx.fillText('AMBER KINETIC INSTRUMENTS / NO. 001', 116, 136);
  ctx.fillStyle = palette.amber; ctx.font = '600 82px "Chakra Petch", monospace'; ctx.fillText('GEAR BLOOM', 112, 238);
  ctx.font = '22px "Chakra Petch", monospace'; ctx.textAlign = 'right'; ctx.fillText(name, 1482, 235);
  const points = sampleCurve(config), model = geometry(config);
  drawLuminousCurve(ctx, points, 800, 940, 635, 1, 1, palette);
  if (effects.effectId && effects.effectId !== 'none') {
    const effectSize = 635 / .363;
    ctx.save(); ctx.beginPath(); ctx.rect(110, 280, 1380, 1280); ctx.clip();
    ctx.translate(800 - effectSize / 2, 940 - effectSize / 2);
    drawProceduralEffects(ctx, { size: effectSize, config, palette, phase: effects.phase ?? .17, effectId: effects.effectId, intensity: effects.intensity ?? 1 });
    ctx.restore();
  }
  ctx.strokeStyle = '#4f371f'; ctx.beginPath(); ctx.moveTo(116, 1580); ctx.lineTo(1484, 1580); ctx.stroke();
  ctx.font = '24px "Chakra Petch", monospace'; ctx.fillStyle = '#c09153'; ctx.textAlign = 'left';
  ctx.fillText(`TEETH 96 : ${config.innerTeeth}     OFFSET ${Math.round(config.offset * 100)}%`, 116, 1640);
  ctx.textAlign = 'right'; ctx.fillText(`${model.symmetry}-FOLD / ${model.turns} ORBITS`, 1484, 1640);
  ctx.textAlign = 'left'; ctx.font = '18px "Chakra Petch", monospace'; ctx.fillStyle = '#84623b'; ctx.fillText('MOTION INTO MATHEMATICS. MATHEMATICS INTO ART.', 116, 1690);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Unable to encode PNG');
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = `gear-bloom-${palette.id}-${effects.effectId || 'none'}-96-${config.innerTeeth}-${Math.round(config.offset * 100)}.png`;
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
}
