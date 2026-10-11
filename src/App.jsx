import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PRESETS, geometry } from './core.js';
import { SceneCanvas, Dial, Digital, PresetPreview } from './Instrument.jsx';
import { exportArtwork } from './render.js';
import { PALETTES, DEFAULT_PALETTE, paletteById } from './palettes.js';
import { EFFECTS } from './effects.js';

const initial = { outerTeeth: 96, innerTeeth: 36, offset: 0.82 };

export function App() {
  const [innerTeeth, setInnerTeeth] = useState(initial.innerTeeth);
  const [offset, setOffset] = useState(initial.offset);
  const [speed, setSpeed] = useState(1);
  const [paletteId, setPaletteId] = useState(DEFAULT_PALETTE.id);
  const [effectId, setEffectId] = useState('sparks');
  const [effectIntensity, setEffectIntensity] = useState(.9);
  const [paused, setPaused] = useState(false);
  const [mechanism, setMechanism] = useState(true);
  const [immersive, setImmersive] = useState(false);
  const [restart, setRestart] = useState(0);
  const [help, setHelp] = useState(false);
  const [toast, setToast] = useState('');
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState({ progress: 0, theta: 0, complete: false });
  const helpButton = useRef(null);
  const helpClose = useRef(null);
  const config = useMemo(() => ({ outerTeeth: 96, innerTeeth, offset }), [innerTeeth, offset]);
  const model = useMemo(() => geometry(config), [config]);
  const palette = useMemo(() => paletteById(paletteId), [paletteId]);
  const selected = PRESETS.find(p => p.innerTeeth === innerTeeth && Math.abs(p.offset - offset) < 0.005);
  const onStatus = useCallback(s => setStatus(s), []);
  const onComplete = useCallback(() => setPaused(true), []);

  function redraw() { setRestart(r => r + 1); setPaused(false); }
  function togglePlay() {
    if (status.complete) redraw();
    else setPaused(p => !p);
  }
  function choosePreset(p) {
    setInnerTeeth(p.innerTeeth); setOffset(p.offset); setSpeed(p.speed ?? 1);
    setRestart(r => r + 1); setPaused(false);
  }
  function updateParameter(setter, value) { setter(value); setPaused(false); }
  async function save() {
    if (exporting) return;
    setExporting(true);
    try {
      await exportArtwork(config, selected?.label || 'CUSTOM ORBIT', palette, { effectId, intensity: effectIntensity, phase: status.progress });
      setToast('Artwork exported · 1600 × 1800 PNG');
    } catch (error) {
      console.error(error); setToast('Export failed. Please try again.');
    } finally { setExporting(false); }
  }

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (help) helpClose.current?.focus();
  }, [help]);
  useEffect(() => {
    function keydown(e) {
      if (e.key === 'Escape') {
        if (help) { setHelp(false); helpButton.current?.focus(); }
        else setImmersive(false);
        return;
      }
      if (help) {
        if (e.key === 'Tab') {
          const items = [...document.querySelectorAll('.help-dialog button, .help-dialog a')];
          const first = items[0], last = items.at(-1);
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
        }
        return;
      }
      if (/INPUT|TEXTAREA|SELECT|BUTTON|A/.test(e.target.tagName) || e.target.getAttribute('role') === 'slider') return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      if (e.key.toLowerCase() === 'r') redraw();
      if (e.key.toLowerCase() === 'm') setMechanism(m => !m);
      if (e.key.toLowerCase() === 'f') setImmersive(f => !f);
    }
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [help, status.complete]);

  return (
    <main className={`app-shell${immersive ? ' is-capture' : ''}`}>
      <header className="topbar">
        <div className="brand">
          <div className="brand-kicker">AMBER KINETIC INSTRUMENTS <span>/</span> NO. 001</div>
          <h1 className="brand-wordmark">GEAR BLOOM</h1>
          <p className="brand-caption">Amber gear drawing machine <span>—</span> Let motion bloom</p>
        </div>
        <div className="system-meta">
          <span><i className="status-dot" /> ALL SYSTEMS READY</span>
          <button ref={helpButton} className="button button--small" onClick={() => setHelp(true)}>How it works <span aria-hidden="true">↗</span></button>
        </div>
      </header>

      <div className="workbench">
        <section className="instrument" aria-label="Live gear drawing machine">
          <div className="instrument-header">
            <div><span className="eyebrow">HYPOTROCHOID ENGINE</span><h2 className="instrument-title">Motion into form <span>/ TRACE CHAMBER</span></h2></div>
            <span className={`live-pill${paused ? ' is-paused' : ''}`}><i className="status-dot" />{status.complete ? 'COMPLETE' : paused ? 'STANDBY' : 'TRACING'}</span>
          </div>
          <div className="canvas-stage">
            <SceneCanvas config={config} palette={palette} effectId={effectId} effectIntensity={effectIntensity} speed={speed} paused={paused} mechanism={mechanism} restart={restart} onStatus={onStatus} onComplete={onComplete} />
            <div className="stage-corner stage-corner--tl"><span>FIXED RING</span><strong>96 T</strong></div>
            <div className="stage-corner stage-corner--tr"><span>PATTERN</span><strong>{selected?.label || 'CUSTOM'}</strong></div>
            <div className="stage-corner stage-corner--bl"><span>ORBIT {Math.min(model.turns, status.theta / (2 * Math.PI)).toFixed(2)} / {model.turns}</span><strong>{mechanism ? 'MECHANISM VISIBLE' : 'ARTWORK VIEW'}</strong></div>
            <div className="stage-readout"><span className="stage-readout-label">CYCLE</span><Digital value={String(Math.floor(status.progress * 100)).padStart(3, '0')} /><span className="unit">%</span></div>
          </div>
          <div className="progress-line" role="progressbar" aria-label="Drawing progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(status.progress * 100)}><span style={{ width: `${status.progress * 100}%` }} /></div>
          <div className="transport">
            <div className="transport-main">
              <button className="button button--primary" onClick={togglePlay} aria-label={status.complete ? 'Draw again' : paused ? 'Start drawing' : 'Pause drawing'}><span aria-hidden="true">{paused ? '▶' : 'Ⅱ'}</span> {status.complete ? 'Draw again' : paused ? 'Start' : 'Pause'}</button>
              <button className="button" onClick={redraw} aria-label="Reset drawing">Reset</button>
            </div>
            <div className="transport-actions">
              <button className="button" aria-pressed={!mechanism} onClick={() => setMechanism(m => !m)}>{mechanism ? 'Hide gears' : 'Show gears'}</button>
              <button className="button" aria-pressed={immersive} onClick={() => setImmersive(f => !f)}>{immersive ? 'Exit focus' : 'Focus mode'}</button>
            </div>
          </div>
          <div className="instrument-footer"><span>{status.complete ? 'Curve complete · Change a setting to discover the next form' : 'Turn the dials to explore how motion creates a curve'}</span><span>PRECISION / PLAY</span></div>
        </section>

        <aside className="params" aria-label="Drawing settings">
          <div className="panel-heading"><span className="panel-index">01</span><h2 className="panel-title">Settings <span>CONTROL PANEL</span></h2></div>
          <div className="readout-grid">
            <div className="digital-stat"><span className="digital-label">GEAR RATIO</span><Digital value={`96:${innerTeeth}`} /><span className="unit">teeth</span></div>
            <div className="digital-stat"><span className="digital-label">SYMMETRY</span><Digital value={String(model.symmetry).padStart(2, '0')} /><span className="unit">fold</span></div>
            <div className="digital-stat"><span className="digital-label">ORBITS</span><Digital value={String(model.turns).padStart(2, '0')} /><span className="unit">to close</span></div>
          </div>
          <div className="dial-bank">
            <Dial label="Inner teeth" code="TEETH" value={innerTeeth} display={String(innerTeeth)} min={24} max={72} step={1} onChange={v => updateParameter(setInnerTeeth, v)} />
            <Dial label="Pen offset" code="OFFSET" value={offset} display={`${Math.round(offset * 100)}%`} min={0.1} max={1} step={0.01} onChange={v => updateParameter(setOffset, v)} />
            <Dial label="Draw speed" code="SPEED" value={speed} display={`${speed.toFixed(1)}×`} min={0.3} max={2.5} step={0.1} onChange={setSpeed} />
          </div>
          <p className="dial-hint">Drag a dial or slider · Arrow keys fine-tune</p>
          <div className="preset-bank">
            <div className="panel-heading"><span className="panel-index">02</span><h2 className="panel-title">Patterns <span>PATTERN ARCHIVE</span></h2></div>
            <div className="preset-grid">{PRESETS.map((p, i) => <button key={p.id} className={`preset-button${selected?.id === p.id ? ' active' : ''}`} onClick={() => choosePreset(p)} aria-pressed={selected?.id === p.id} aria-label={`Select ${p.name} pattern`}><PresetPreview config={p} palette={palette} active={selected?.id === p.id} /><span className="preset-name">{p.name}</span><span className="preset-code">0{i + 1} / {p.outerTeeth}:{p.innerTeeth} · {Math.round(p.offset * 100)}% OFFSET</span></button>)}</div>
          </div>
          <section className="palette-bank" aria-labelledby="palette-title">
            <div className="panel-heading"><span className="panel-index">03</span><h2 id="palette-title" className="panel-title">Color <span>LIGHT SPECTRUM</span></h2></div>
            <div className="palette-grid">{PALETTES.map(item => <button key={item.id} className="palette-button" aria-label={`Use ${item.name} colors`} aria-pressed={paletteId === item.id} onClick={() => setPaletteId(item.id)}><span className="palette-swatch" aria-hidden="true" style={{ background: `linear-gradient(100deg, ${item.colors.join(', ')})` }} /><span>{item.name}</span></button>)}</div>
            <p className="palette-hint">{palette.name} · Change the light, keep the motion</p>
          </section>
          <section className="effect-bank" aria-labelledby="effect-title">
            <div className="panel-heading"><span className="panel-index">04</span><h2 id="effect-title" className="panel-title">Effects <span>ENERGY FIELD</span></h2></div>
            <label className="effect-label" htmlFor="effect-select">Visual effect</label>
            <select id="effect-select" className="effect-select" value={effectId} onChange={e => setEffectId(e.target.value)}>
              {EFFECTS.map(effect => <option key={effect.id} value={effect.id}>{effect.name}</option>)}
            </select>
            <label className="effect-strength" htmlFor="effect-strength">Effect strength <span>{Math.round(effectIntensity * 100)}%</span></label>
            <input id="effect-strength" className="effect-range" type="range" min={.25} max={1.5} step={.05} value={effectIntensity} disabled={effectId === 'none'} onChange={e => setEffectIntensity(Number(e.target.value))} />
            <p className="palette-hint">Follow the pen. Light up the geometry.</p>
          </section>
          <div className="insight"><span className="eyebrow">A SIMPLE RULE. ENDLESS FORMS.</span><h3 className="insight-title">Two gears. One pen.</h3><p className="insight-text">Teeth set the rhythm. Offset shapes the curve. Color sets the atmosphere. Every pattern grows from the same simple mechanical motion.</p></div>
          <button className="button button--export" onClick={save} disabled={exporting}>{exporting ? 'Exporting…' : 'Export artwork'} <span className="export-format">PNG ↗</span></button>
        </aside>
      </div>
      <footer className="project-footer"><span>MOTION INTO MATHEMATICS. MATHEMATICS INTO ART.</span><div className="footer-shortcuts"><span><kbd>SPACE</kbd> Pause</span><span><kbd>R</kbd> Reset</span><span><kbd>M</kbd> Gears</span><span><kbd>F</kbd> Focus</span></div></footer>
      <div className={`toast${toast ? ' visible' : ''}`} role="status" aria-live="polite">{toast}</div>
      {help && <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) { setHelp(false); helpButton.current?.focus(); } }}><section className="help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title"><span className="eyebrow">INSIDE THE MACHINE</span><h2 id="help-title">How does a curve take shape?</h2><p>A small gear rolls inside a fixed ring with 96 teeth. A pen attached to the gear traces a curve as the gear orbits and rotates. This curve is called a hypotrochoid.</p><p>The tooth count changes the ratio of the two rotations. Moving the pen away from the gear's center changes the bends and crossings. Speed changes the drawing time; the completed pattern stays the same.</p><dl><div><dt>Gear ratio</dt><dd>96 : {innerTeeth}</dd></div><div><dt>Full closure</dt><dd>{model.turns} orbits</dd></div><div><dt>Rotational symmetry</dt><dd>{model.symmetry}-fold</dd></div></dl><p className="help-note">Presets use a nonzero pen offset. Closure is calculated from the greatest common divisor of the tooth counts.</p><a href="https://mathworld.wolfram.com/Hypotrochoid.html" target="_blank" rel="noreferrer">Explore the mathematics ↗</a><button ref={helpClose} className="button button--primary" onClick={() => { setHelp(false); helpButton.current?.focus(); }}>Back to the machine</button></section></div>}
    </main>
  );
}
