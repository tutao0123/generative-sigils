import { geometry, poseAt, sampleCurve, gearOutline } from './core.js';
import { paletteById } from './palettes.js';

const TAU = Math.PI * 2;
const CLOCK_GEAR = Object.freeze({ outerTeeth: 96, innerTeeth: 40, offset: 0.9 });

// Clock phases remain a pure function of a Date. Wall time is appropriate for a
// clock; the independent cinematic exporter keeps its normalized loop phase.
export function clockPhases(date, smooth = true) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
    throw new TypeError('A valid Date is required.');
  }
  const second = date.getSeconds() + (smooth ? date.getMilliseconds() / 1000 : 0);
  const minute = date.getMinutes() + second / 60;
  const hour = date.getHours() % 12 + minute / 60;
  return { hour: hour / 12, minute: minute / 60, second: second / 60 };
}

function pathFrom(points) {
  const path = new Path2D();
  points.forEach((point, index) => index ? path.lineTo(point.x, point.y) : path.moveTo(point.x, point.y));
  return path;
}

function initializeClock() {
  const canvas = document.querySelector('#clock-face');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    document.querySelector('#clock-mode').textContent = 'CANVAS UNAVAILABLE';
    return;
  }
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const digitalTime = document.querySelector('#digital-time');
  const calendarDate = document.querySelector('#calendar-date');
  const modeLabel = document.querySelector('#clock-mode');
  const freezeButton = document.querySelector('#freeze-time');
  const paletteButtons = [...document.querySelectorAll('[data-palette]')];
  const shape = geometry(CLOCK_GEAR);
  const curve = pathFrom(sampleCurve(CLOCK_GEAR, 1600));
  const ring = pathFrom(gearOutline(CLOCK_GEAR.outerTeeth, 1, 2 / CLOCK_GEAR.outerTeeth, true));
  const gear = pathFrom(gearOutline(CLOCK_GEAR.innerTeeth, shape.r, 2 / CLOCK_GEAR.outerTeeth));
  const dateFormatter = new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' });
  const timeFormatter = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  let palette = paletteById('spectrum');
  let frozenTime = null;
  let previousFrame = -Infinity;
  let previousReadout = '';
  let frameId;
  let pixelRatio = 1;

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  document.querySelector('#timezone').textContent = timezone?.replaceAll('_', ' ') || 'LOCAL';

  function updatePalette() {
    const colors = [palette.colors[0], palette.colors[2], palette.colors[5]];
    document.documentElement.style.setProperty('--accent', palette.penGlow);
    ['hour', 'minute', 'second'].forEach((name, index) => document.documentElement.style.setProperty(`--${name}`, colors[index]));
    paletteButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.palette === palette.id)));
  }

  function resize() {
    const width = canvas.getBoundingClientRect().width;
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const resolution = Math.max(1, Math.round(width * pixelRatio));
    canvas.width = resolution;
    canvas.height = resolution;
    previousFrame = -Infinity;
    paint(frozenTime || new Date());
  }

  function strokeLine(x1, y1, x2, y2, color, width = 1) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function radialPoint(radius, phase) {
    const angle = TAU * phase - Math.PI / 2;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  }

  function orbit(radius, phase, color, weight) {
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.strokeStyle = '#253142';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (phase > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, radius, -Math.PI / 2, TAU * phase - Math.PI / 2);
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.78;
      ctx.lineWidth = weight;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    const [x, y] = radialPoint(radius, phase);
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(x, y, weight + 1.3, 0, TAU);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(x, y, 1.4, 0, TAU);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  function drawMechanism(phases) {
    const radius = 138;
    const theta = shape.maxTheta * phases.second;
    const pose = poseAt(theta, CLOCK_GEAR);
    ctx.save();
    ctx.scale(radius, radius);
    ctx.strokeStyle = palette.colors[4];
    ctx.globalAlpha = .23;
    ctx.lineWidth = 1 / radius;
    ctx.stroke(ring);
    ctx.translate(pose.center.x, pose.center.y);
    ctx.rotate(pose.rotation);
    ctx.strokeStyle = palette.colors[5];
    ctx.globalAlpha = .31;
    ctx.stroke(gear);
    ctx.restore();

    ctx.save();
    ctx.scale(radius, radius);
    ctx.strokeStyle = palette.colors[3];
    ctx.lineWidth = .75 / radius;
    ctx.globalAlpha = .42;
    ctx.shadowColor = palette.glowColor;
    ctx.shadowBlur = 4;
    ctx.stroke(curve);
    ctx.restore();

    ctx.globalAlpha = .45;
    strokeLine(pose.center.x * radius, pose.center.y * radius, pose.pen.x * radius, pose.pen.y * radius, palette.colors[3], 1);
    ctx.globalAlpha = 1;
    ctx.fillStyle = palette.penGlow;
    ctx.shadowColor = palette.penGlow;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(pose.pen.x * radius, pose.pen.y * radius, 2.3, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function paint(date) {
    const phases = clockPhases(date, !reducedMotion.matches);
    const scale = canvas.width / 720;
    ctx.setTransform(scale, 0, 0, scale, canvas.width / 2, canvas.height / 2);
    ctx.clearRect(-360, -360, 720, 720);

    const aura = ctx.createRadialGradient(0, 0, 25, 0, 0, 310);
    aura.addColorStop(0, `${palette.colors[4]}16`);
    aura.addColorStop(.6, `${palette.glowColor}08`);
    aura.addColorStop(1, `${palette.glowColor}00`);
    ctx.fillStyle = aura;
    ctx.fillRect(-360, -360, 720, 720);

    ctx.strokeStyle = '#1c2637';
    ctx.lineWidth = 1;
    [182, 301, 320].forEach(radius => {
      ctx.beginPath(); ctx.arc(0, 0, radius, 0, TAU); ctx.stroke();
    });

    for (let tick = 0; tick < 60; tick++) {
      const major = tick % 5 === 0;
      const [x1, y1] = radialPoint(major ? 282 : 289, tick / 60);
      const [x2, y2] = radialPoint(296, tick / 60);
      strokeLine(x1, y1, x2, y2, major ? '#91a1ba' : '#44516b', major ? 1.5 : .7);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '13px Chakra, monospace';
    ctx.fillStyle = '#b7c5db';
    ['12', '03', '06', '09'].forEach((label, index) => {
      const [x, y] = radialPoint(337, index / 4); ctx.fillText(label, x, y);
    });

    orbit(270, phases.hour, palette.colors[0], 3.5);
    orbit(237, phases.minute, palette.colors[2], 2.8);
    orbit(204, phases.second, palette.colors[5], 1.8);
    drawMechanism(phases);

    // Small luminous hands make the face readable without interpreting arcs.
    const hourEnd = radialPoint(87, phases.hour);
    const minuteEnd = radialPoint(164, phases.minute);
    const secondEnd = radialPoint(190, phases.second);
    ctx.shadowColor = palette.colors[0];
    ctx.shadowBlur = 7;
    strokeLine(0, 0, ...hourEnd, '#fff2c7', 5);
    ctx.shadowColor = palette.colors[2];
    strokeLine(0, 0, ...minuteEnd, '#eaf4ff', 3);
    ctx.shadowBlur = 0;
    const secondBack = radialPoint(-24, phases.second);
    strokeLine(...secondBack, ...secondEnd, palette.colors[5], .9);
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fillStyle = '#071018'; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, 3, 0, TAU); ctx.fillStyle = '#f0f7ff'; ctx.fill();

    const formatted = timeFormatter.format(date);
    if (formatted !== previousReadout) {
      digitalTime.textContent = formatted;
      digitalTime.dateTime = date.toISOString();
      calendarDate.textContent = dateFormatter.format(date).toUpperCase();
      canvas.setAttribute('aria-label', `Local time ${formatted}; hour, minute and second light rings`);
      previousReadout = formatted;
    }
  }

  function schedule(timestamp) {
    const interval = reducedMotion.matches ? 1000 : 1000 / 30;
    if (!document.hidden && !frozenTime && timestamp - previousFrame >= interval) {
      previousFrame = timestamp;
      paint(new Date());
    }
    frameId = window.requestAnimationFrame(schedule);
  }

  paletteButtons.forEach(button => button.addEventListener('click', () => {
    palette = paletteById(button.dataset.palette);
    updatePalette();
    paint(frozenTime || new Date());
  }));
  freezeButton.addEventListener('click', () => {
    frozenTime = frozenTime ? null : new Date();
    freezeButton.setAttribute('aria-pressed', String(Boolean(frozenTime)));
    freezeButton.innerHTML = frozenTime ? '<span aria-hidden="true">▶</span> Resume clock' : '<span aria-hidden="true">Ⅱ</span> Freeze moment';
    modeLabel.textContent = frozenTime ? 'FROZEN / LOCAL' : 'LIVE / LOCAL';
    paint(frozenTime || new Date());
  });
  reducedMotion.addEventListener('change', () => { previousFrame = -Infinity; paint(frozenTime || new Date()); });
  document.addEventListener('visibilitychange', () => { previousFrame = -Infinity; });
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  window.addEventListener('pagehide', () => { window.cancelAnimationFrame(frameId); observer.disconnect(); }, { once: true });
  updatePalette();
  resize();
  frameId = window.requestAnimationFrame(schedule);
}

if (typeof document !== 'undefined') initializeClock();
