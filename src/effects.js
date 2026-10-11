import { geometry, poseAt } from './core.js';
import { DEFAULT_PALETTE } from './palettes.js';

const TAU = Math.PI * 2;
const wrap = value => ((value % 1) + 1) % 1;
// A fixed integer hash gives repeatable variety without a random source.
function seed(index, channel = 0) {
  let value = Math.imul(index + 1, 374761393) + Math.imul(channel + 1, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}
const fade = age => Math.sin(Math.PI * age) ** 2;
const opacity = value => Math.max(0, Math.min(1, value));
function dot(ctx, x, y, radius) {
  ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.fill();
}
function line(ctx, x, y, endX, endY) {
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(endX, endY); ctx.stroke();
}

export const EFFECTS = Object.freeze([
  { id: 'none', name: 'Pure Geometry', description: 'The luminous curve without an effect layer.' },
  { id: 'sparks', name: 'Solar Sparks', description: 'Hot sparks escape along the moving pen.' },
  { id: 'molten-splash', name: 'Molten Splash', description: 'Luminous droplets scatter from the pen.' },
  { id: 'flame-corona', name: 'Flame Corona', description: 'A breathing crown of radial flame.' },
  { id: 'crystal-dust', name: 'Crystal Dust', description: 'Slowly orbiting shards catch the light.' },
  { id: 'ripple', name: 'Tidal Ripples', description: 'Expanding waves flow across the sigil.' },
  { id: 'fireflies', name: 'Alchemy Fireflies', description: 'Living points of green light drift in orbit.' },
  { id: 'lightning', name: 'Arc Lightning', description: 'Branching electrical arcs connect pen and ring.' },
  { id: 'plasma', name: 'Violet Plasma', description: 'Braided ribbons of light circulate around the form.' },
  { id: 'stardust', name: 'Nebula Stardust', description: 'Twinkling stars and passing comets surround the curve.' },
].map(effect => Object.freeze(effect)));

export function effectById(id) {
  const effect = EFFECTS.find(item => item.id === id);
  if (!effect) throw new RangeError(`Unknown effect: ${id}`);
  return effect;
}

// Each particle is evaluated from its age and birth phase rather than stored.
// Its opacity vanishes at both lifetime boundaries, hiding periodic respawns.
function emission(config, model, phase, age, cycles, scale) {
  const theta = wrap(phase - age / cycles) * model.maxTheta;
  const pose = poseAt(theta, config);
  const ratio = model.orbitRadius / model.r;
  const dx = -model.orbitRadius * Math.sin(theta) + model.penRadius * ratio * Math.sin(pose.rotation);
  const dy = model.orbitRadius * Math.cos(theta) - model.penRadius * ratio * Math.cos(pose.rotation);
  const length = Math.hypot(dx, dy) || 1;
  return { x: pose.pen.x * scale, y: pose.pen.y * scale, tx: dx / length, ty: dy / length };
}

function sparks(ctx, state) {
  const { config, model, phase, palette, scale, intensity } = state;
  ctx.shadowColor = palette.glowColor; ctx.shadowBlur = Math.min(12, scale * .035);
  for (let i = 0; i < 64; i++) {
    const age = wrap(phase * 3 + seed(i, 0));
    const origin = emission(config, model, phase, age, 3, scale);
    const spread = (seed(i, 1) - .5) * 2.1;
    const vx = origin.tx * Math.cos(spread) - origin.ty * Math.sin(spread);
    const vy = origin.ty * Math.cos(spread) + origin.tx * Math.sin(spread);
    const travel = scale * (.09 + .25 * seed(i, 2));
    const x = origin.x + vx * travel * age;
    const y = origin.y + vy * travel * age - scale * .11 * age * age;
    const tail = scale * (.025 + .06 * seed(i, 3)) * (1 - age * .5);
    ctx.globalAlpha = opacity(fade(age) * .95 * intensity);
    ctx.strokeStyle = palette.colors[i % 3]; ctx.lineWidth = Math.max(1, scale * .005);
    line(ctx, x, y, x - vx * tail, y - vy * tail);
    ctx.fillStyle = palette.pale[0]; dot(ctx, x, y, Math.max(.8, scale * .0035));
  }
}

function moltenSplash(ctx, state) {
  const { config, model, phase, palette, scale, intensity } = state;
  ctx.shadowColor = palette.glowColor; ctx.shadowBlur = Math.min(11, scale * .03);
  for (let i = 0; i < 52; i++) {
    const age = wrap(phase * 2 + seed(i, 7));
    const origin = emission(config, model, phase, age, 2, scale);
    const spread = (seed(i, 8) - .5) * 2.9;
    const vx = origin.tx * Math.cos(spread) - origin.ty * Math.sin(spread);
    const vy = origin.ty * Math.cos(spread) + origin.tx * Math.sin(spread);
    const travel = scale * (.17 + .37 * seed(i, 9));
    const x = origin.x + vx * travel * age;
    const y = origin.y + vy * travel * age + scale * .24 * age * age;
    const radius = scale * (.008 + .013 * seed(i, 10)) * (1 - .55 * age);
    ctx.globalAlpha = opacity(fade(age) * .9 * intensity);
    ctx.strokeStyle = palette.colors[1]; ctx.lineWidth = Math.max(.6, radius * .5);
    ctx.beginPath(); ctx.moveTo(x - vx * radius * 5, y - vy * radius * 5);
    ctx.quadraticCurveTo(x - vx * radius * 2, y - vy * radius * 2 + radius, x, y); ctx.stroke();
    ctx.fillStyle = palette.colors[i % 4];
    ctx.beginPath(); ctx.ellipse(x, y, Math.max(.6, radius * 1.65), Math.max(.6, radius), Math.atan2(vy, vx), 0, TAU); ctx.fill();
    ctx.fillStyle = palette.pale[0]; dot(ctx, x - radius * .3, y - radius * .25, Math.max(.4, radius * .28));
  }
  const pen = poseAt(phase * model.maxTheta, config).pen;
  const pulse = .5 + .5 * Math.sin(phase * TAU * 6);
  ctx.globalAlpha = opacity((.18 + .18 * pulse) * intensity);
  ctx.strokeStyle = palette.colors[0]; ctx.lineWidth = Math.max(1, scale * .004);
  ctx.beginPath(); ctx.arc(pen.x * scale, pen.y * scale, scale * (.022 + pulse * .018), 0, TAU); ctx.stroke();
}

function flameCorona(ctx, state) {
  const { phase, palette, scale, intensity } = state;
  const count = 36;
  ctx.shadowColor = palette.glowColor; ctx.shadowBlur = Math.min(14, scale * .045);
  for (let i = 0; i < count; i++) {
    const angle = i / count * TAU + phase * TAU;
    const breath = .5 + .5 * Math.sin(phase * TAU * 3 + i * 1.7);
    const base = scale * (1.02 + .010 * Math.sin(phase * TAU * 2 + i));
    const tip = base + scale * (.060 + .130 * breath);
    const width = .038 + .012 * seed(i, 12);
    const lean = .014 * Math.sin(phase * TAU * 4 + i * .8);
    ctx.globalAlpha = opacity((.32 + .48 * breath) * intensity);
    ctx.fillStyle = palette.colors[i % 4];
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle - width) * base, Math.sin(angle - width) * base);
    ctx.quadraticCurveTo(Math.cos(angle - width * .8) * (base + scale * .05), Math.sin(angle - width * .8) * (base + scale * .05), Math.cos(angle + lean) * tip, Math.sin(angle + lean) * tip);
    ctx.quadraticCurveTo(Math.cos(angle + width * .7) * (base + scale * .035), Math.sin(angle + width * .7) * (base + scale * .035), Math.cos(angle + width) * base, Math.sin(angle + width) * base);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = opacity((.6 + .4 * breath) * intensity);
    ctx.strokeStyle = palette.pale[1]; ctx.lineWidth = Math.max(.8, scale * .003);
    line(ctx, Math.cos(angle) * base, Math.sin(angle) * base, Math.cos(angle + lean * .6) * (tip - scale * .016), Math.sin(angle + lean * .6) * (tip - scale * .016));
  }
}

function crystalDust(ctx, state) {
  const { phase, palette, scale, intensity } = state;
  ctx.shadowColor = palette.penGlow; ctx.shadowBlur = Math.min(9, scale * .025);
  for (let i = 0; i < 60; i++) {
    const age = wrap(phase * 2 + seed(i, 15));
    const angle = seed(i, 16) * TAU + phase * TAU;
    const radius = scale * (.17 + .88 * seed(i, 17) + .035 * Math.sin(phase * TAU * 2 + i));
    const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
    const shard = scale * (.006 + .014 * seed(i, 18));
    const turn = phase * TAU * 2 + seed(i, 19) * TAU;
    ctx.save(); ctx.translate(x, y); ctx.rotate(turn);
    ctx.globalAlpha = opacity(fade(age) * .63 * intensity); ctx.fillStyle = palette.colors[i % 6];
    ctx.beginPath(); ctx.moveTo(0, -shard); ctx.lineTo(shard * .45, 0); ctx.lineTo(0, shard); ctx.lineTo(-shard * .45, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = palette.pale[i % 6]; ctx.lineWidth = Math.max(.5, scale * .0015); ctx.stroke();
    if (i % 6 === 0) {
      ctx.globalAlpha = opacity(fade(age) * .7 * intensity);
      line(ctx, -shard * .8, 0, shard * .8, 0);
      line(ctx, 0, -shard * 1.4, 0, shard * 1.4);
    }
    ctx.restore();
  }
}

function ripple(ctx, state) {
  const { config, model, phase, palette, scale, intensity } = state;
  ctx.shadowColor = palette.glowColor; ctx.shadowBlur = Math.min(9, scale * .025);
  for (let i = 0; i < 6; i++) {
    const age = wrap(phase * 2 + i / 6);
    const origin = poseAt(wrap(phase - age / 2) * model.maxTheta, config).pen;
    const radius = scale * (.08 + age * 1.06);
    ctx.globalAlpha = opacity(fade(age) * .36 * intensity);
    ctx.strokeStyle = palette.colors[(i + 1) % 6]; ctx.lineWidth = Math.max(.8, scale * .003);
    ctx.beginPath();
    for (let j = 0; j <= 96; j++) {
      const angle = j / 96 * TAU;
      const wave = radius + scale * .008 * Math.sin(angle * 5 + phase * TAU * 2 + i);
      const x = origin.x * scale * .10 + Math.cos(angle) * wave;
      const y = origin.y * scale * .10 + Math.sin(angle) * wave * .94;
      if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath(); ctx.stroke();
    ctx.globalAlpha *= .4; ctx.lineWidth = Math.max(.6, scale * .0016);
    ctx.beginPath(); ctx.ellipse(origin.x * scale * .10, origin.y * scale * .10, radius + scale * .015, (radius + scale * .015) * .94, 0, 0, TAU); ctx.stroke();
  }
}

function fireflies(ctx, state) {
  const { phase, palette, scale, intensity } = state;
  ctx.shadowColor = palette.glowColor; ctx.shadowBlur = Math.min(13, scale * .04);
  for (let i = 0; i < 72; i++) {
    const angle = seed(i, 22) * TAU + phase * TAU + .18 * Math.sin(phase * TAU * 2 + i);
    const radius = scale * (.17 + .87 * seed(i, 23) + .055 * Math.sin(phase * TAU * 3 + i * .7));
    const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
    const breath = (.5 + .5 * Math.sin(phase * TAU * (2 + i % 3) + seed(i, 24) * TAU)) ** 2;
    const size = scale * (.0035 + .0045 * seed(i, 25));
    ctx.globalAlpha = opacity((.10 + .70 * breath) * intensity);
    ctx.fillStyle = palette.colors[i % 4]; dot(ctx, x, y, Math.max(.8, size));
    if (i % 4 === 0) {
      ctx.globalAlpha = opacity(breath * .13 * intensity);
      dot(ctx, x, y, Math.max(2, size * 3));
    }
  }
}

function lightningPath(x1, y1, x2, y2, phase, offset, scale, count = 38) {
  const points = [], dx = x2 - x1, dy = y2 - y1;
  const length = Math.hypot(dx, dy) || 1;
  for (let i = 0; i <= count; i++) {
    const along = i / count;
    const envelope = Math.sin(Math.PI * along);
    const wiggle = envelope * scale * (.038 * Math.sin(along * 31 + phase * TAU * 3 + offset) + .019 * Math.sin(along * 71 - phase * TAU * 2 + offset * 1.7));
    points.push({ x: x1 + dx * along - dy / length * wiggle, y: y1 + dy * along + dx / length * wiggle });
  }
  return points;
}
function strokePoints(ctx, points) {
  ctx.beginPath(); points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.stroke();
}

function lightning(ctx, state) {
  const { config, model, phase, palette, scale, intensity } = state;
  const pen = poseAt(phase * model.maxTheta, config).pen;
  ctx.shadowColor = palette.glowColor; ctx.shadowBlur = Math.min(18, scale * .065);
  for (let i = 0; i < 6; i++) {
    const angle = i / 6 * TAU + phase * TAU;
    const endX = Math.cos(angle) * scale * .97, endY = Math.sin(angle) * scale * .97;
    const pulse = (.5 + .5 * Math.sin(phase * TAU * 3 + i * TAU / 6)) ** 5;
    const points = lightningPath(pen.x * scale, pen.y * scale, endX, endY, phase, i * 2.3, scale);
    ctx.globalAlpha = opacity((.07 + .85 * pulse) * intensity);
    ctx.strokeStyle = palette.colors[3]; ctx.lineWidth = Math.max(2.2, scale * .011); strokePoints(ctx, points);
    ctx.strokeStyle = '#fff9ff'; ctx.lineWidth = Math.max(1, scale * .0042); strokePoints(ctx, points);
    for (let branch = 0; branch < 2; branch++) {
      const origin = points[17 + branch * 9];
      const side = angle + (branch ? -.42 : .38);
      const branchX = origin.x + Math.cos(side) * scale * .24;
      const branchY = origin.y + Math.sin(side) * scale * .24;
      ctx.globalAlpha = opacity((.05 + .5 * pulse) * intensity);
      ctx.lineWidth = Math.max(.8, scale * .003);
      strokePoints(ctx, lightningPath(origin.x, origin.y, branchX, branchY, phase, i + branch * 3.7, scale * .5, 15));
    }
    ctx.globalAlpha = opacity(pulse * .8 * intensity); ctx.fillStyle = palette.pale[0]; dot(ctx, endX, endY, Math.max(1.2, scale * .005));
  }
}

function plasma(ctx, state) {
  const { phase, palette, scale, intensity } = state;
  ctx.shadowColor = palette.glowColor; ctx.shadowBlur = Math.min(14, scale * .045);
  for (let ribbon = 0; ribbon < 4; ribbon++) {
    ctx.globalAlpha = opacity((.45 + .18 * Math.sin(phase * TAU * 2 + ribbon)) * intensity);
    ctx.strokeStyle = palette.colors[ribbon + 1]; ctx.lineWidth = Math.max(1.3, scale * .006);
    ctx.beginPath();
    for (let i = 0; i <= 144; i++) {
      const angle = i / 144 * TAU;
      const radius = scale * (.94 + ribbon * .024 + .030 * Math.sin(angle * 6 + phase * TAU * 2 + ribbon * 1.6) + .013 * Math.sin(angle * 13 - phase * TAU * 3));
      const x = Math.cos(angle + phase * TAU) * radius;
      const y = Math.sin(angle + phase * TAU) * radius;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath(); ctx.stroke();
  }
  for (let i = 0; i < 18; i++) {
    const angle = i / 18 * TAU - phase * TAU;
    const radius = scale * (.995 + .03 * Math.sin(phase * TAU * 2 + i));
    ctx.globalAlpha = opacity((.15 + .5 * (.5 + .5 * Math.sin(phase * TAU * 4 + i))) * intensity);
    ctx.fillStyle = palette.pale[i % 6]; dot(ctx, Math.cos(angle) * radius, Math.sin(angle) * radius, Math.max(.8, scale * .003));
  }
}

function stardust(ctx, state) {
  const { phase, palette, scale, intensity } = state;
  ctx.shadowColor = palette.penGlow; ctx.shadowBlur = Math.min(11, scale * .032);
  for (let i = 0; i < 70; i++) {
    const angle = seed(i, 29) * TAU + .045 * Math.sin(phase * TAU + i);
    const radius = scale * (.12 + .93 * Math.sqrt(seed(i, 30)) + .025 * Math.sin(phase * TAU * 2 + i));
    const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
    const shimmer = (.5 + .5 * Math.sin(phase * TAU * (2 + i % 3) + seed(i, 31) * TAU)) ** 3;
    const star = scale * (.0025 + .005 * seed(i, 32));
    ctx.globalAlpha = opacity((.08 + shimmer * .72) * intensity);
    ctx.fillStyle = palette.pale[i % 6];
    if (i % 5) dot(ctx, x, y, Math.max(.6, star * .48));
    else {
      ctx.beginPath(); ctx.moveTo(x, y - star * 1.8); ctx.lineTo(x + star * .3, y - star * .3); ctx.lineTo(x + star * 1.25, y); ctx.lineTo(x + star * .3, y + star * .3); ctx.lineTo(x, y + star * 1.8); ctx.lineTo(x - star * .3, y + star * .3); ctx.lineTo(x - star * 1.25, y); ctx.lineTo(x - star * .3, y - star * .3); ctx.closePath(); ctx.fill();
    }
  }
  for (let i = 0; i < 7; i++) {
    const age = wrap(phase * 2 + i / 7);
    const angle = age * TAU + seed(i, 34) * TAU;
    const radius = scale * (.87 + .18 * seed(i, 35));
    const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
    ctx.globalAlpha = opacity(fade(age) * .65 * intensity);
    ctx.strokeStyle = palette.colors[(i + 2) % 6]; ctx.lineWidth = Math.max(.8, scale * .002);
    ctx.beginPath(); ctx.arc(0, 0, radius, angle - .10, angle); ctx.stroke();
    ctx.fillStyle = palette.pale[1]; dot(ctx, x, y, Math.max(.9, scale * .004));
  }
}

const DRAWERS = { sparks, 'molten-splash': moltenSplash, 'flame-corona': flameCorona, 'crystal-dust': crystalDust, ripple, fireflies, lightning, plasma, stardust };

/** Stateless, periodic effects shared by browser Canvas and the native video renderer. */
export function drawProceduralEffects(ctx, { size, config, phase, palette = DEFAULT_PALETTE, effectId = 'none', intensity = 1 }) {
  if (!Number.isFinite(size) || size <= 0 || !Number.isFinite(phase) || !Number.isFinite(intensity)) {
    throw new RangeError('Effects need a positive size and finite phase and intensity.');
  }
  effectById(effectId);
  if (effectId === 'none' || intensity <= 0) return;
  const model = geometry(config);
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.globalCompositeOperation = 'screen'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  DRAWERS[effectId](ctx, { size, config, model, phase: wrap(phase), palette, scale: size * .363, intensity: Math.min(1.5, intensity) });
  ctx.restore();
}
