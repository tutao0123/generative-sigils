import { useEffect, useRef } from 'react';
import { geometry, sampleCurve } from './core.js';
import { drawScene, drawDial, drawDigital, drawLuminousCurve } from './render.js';
import { drawProceduralEffects } from './effects.js';

export function SceneCanvas({ config, speed, paused, mechanism, restart, onStatus, onComplete, palette, effectId, effectIntensity }) {
  const canvasRef = useRef(null);
  const live = useRef({ speed, paused, mechanism, palette, effectId, effectIntensity });
  live.current = { speed, paused, mechanism, palette, effectId, effectIntensity };
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const points = sampleCurve(config);
    const model = geometry(config);
    const motion = {
      progress: 0, reportedProgress: 0, lastTime: 0, lastStatus: 0,
      completed: false, size: 600, dirty: true, mechanism, palette, effectId, effectIntensity,
    };
    let frame;
    function resize() {
      motion.size = Math.max(240, canvas.getBoundingClientRect().width);
      const density = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(motion.size * density);
      canvas.height = Math.round(motion.size * density);
      ctx.setTransform(density, 0, 0, density, 0, 0);
      motion.dirty = true;
    }
    const observer = new ResizeObserver(resize);
    observer.observe(canvas); resize();
    onStatus({ progress: 0, theta: 0, complete: false });
    function animate(time) {
      // Kinematics are evaluated directly: slow frames must not slow the clock.
      const delta = motion.lastTime ? Math.max((time - motion.lastTime) / 1000, 0) : 0;
      motion.lastTime = time;
      const previousProgress = motion.progress;
      if (!document.hidden && !live.current.paused && !motion.completed) {
        motion.progress = Math.min(1, motion.progress + delta * live.current.speed / 24);
      }
      if (motion.mechanism !== live.current.mechanism) {
        motion.mechanism = live.current.mechanism;
        motion.dirty = true;
      }
      const theta = motion.progress * model.maxTheta;
      if (motion.palette !== live.current.palette) {
        motion.palette = live.current.palette;
        motion.dirty = true;
      }
      if (motion.effectId !== live.current.effectId || motion.effectIntensity !== live.current.effectIntensity) {
        motion.effectId = live.current.effectId;
        motion.effectIntensity = live.current.effectIntensity;
        motion.dirty = true;
      }
      if (motion.dirty || motion.progress !== previousProgress) {
        drawScene(ctx, motion.size, config, points, motion.progress, motion.mechanism, motion.palette);
        drawProceduralEffects(ctx, { size: motion.size, config, phase: motion.progress, palette: motion.palette, effectId: motion.effectId, intensity: motion.effectIntensity });
        motion.dirty = false;
      }
      const justCompleted = motion.progress === 1 && !motion.completed;
      if (motion.progress !== motion.reportedProgress && time - motion.lastStatus > 120 || justCompleted) {
        onStatus({ progress: motion.progress, theta, complete: motion.progress === 1 });
        motion.reportedProgress = motion.progress;
        motion.lastStatus = time;
      }
      if (justCompleted) { motion.completed = true; onComplete(); }
      frame = requestAnimationFrame(animate);
    }
    function visibilityChanged() { motion.lastTime = 0; }
    document.addEventListener('visibilitychange', visibilityChanged);
    frame = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener('visibilitychange', visibilityChanged); };
  }, [config, restart, onStatus, onComplete]);
  return <canvas className="drawing-canvas" ref={canvasRef} aria-label="A pen traces a hypotrochoid as a small gear rolls inside a fixed ring" role="img" />;
}

export function Digital({ value }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    canvas.width = Math.max(90, value.length * 18) * 2; canvas.height = 72;
    const ctx = canvas.getContext('2d'); ctx.scale(2, 2);
    drawDigital(ctx, String(value), canvas.width / 2, 36);
  }, [value]);
  return <span className="digital-number" aria-label={String(value)}><canvas ref={ref} aria-hidden="true" /></span>;
}

export function Dial({ label, code, value, display, min, max, step, onChange }) {
  const ref = useRef(null);
  const drag = useRef(null);
  function normalize(v) { return Math.max(min, Math.min(max, Math.round(v / step) * step)); }
  useEffect(() => {
    const canvas = ref.current; canvas.width = 196; canvas.height = 196;
    const ctx = canvas.getContext('2d'); ctx.scale(2, 2); drawDial(ctx, (value - min) / (max - min));
  }, [value, min, max]);
  return <div className="dial-control"><div className="dial-caption"><span>{code}</span><span className="dial-value">{display}</span></div><canvas className="dial-face" ref={ref} role="slider" tabIndex={0} aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={display} onPointerDown={e => { e.currentTarget.focus(); e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, value }; }} onPointerMove={e => { if (!drag.current) return; const distance = e.clientX - drag.current.x + drag.current.y - e.clientY; onChange(Number(normalize(drag.current.value + distance * (max - min) / 160).toFixed(2))); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onKeyDown={e => { let next; if (e.key === 'ArrowUp' || e.key === 'ArrowRight') next = value + step; if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') next = value - step; if (e.key === 'Home') next = min; if (e.key === 'End') next = max; if (next !== undefined) { e.preventDefault(); onChange(Number(normalize(next).toFixed(2))); } }} /><label className="dial-label">{label}<input className="dial-range" type="range" min={min} max={max} step={step} value={value} aria-label={`${label} slider`} onChange={e => onChange(Number(e.target.value))} /></label></div>;
}

export function PresetPreview({ config, active, palette }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current; canvas.width = 300; canvas.height = 140;
    const ctx = canvas.getContext('2d');
    drawLuminousCurve(ctx, sampleCurve(config, 2200), 150, 70, 58, 1, active ? 1 : .6, palette);
  }, [config, active, palette]);
  return <canvas className="preset-graphic" ref={ref} aria-hidden="true" />;
}
