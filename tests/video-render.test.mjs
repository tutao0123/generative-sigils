import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createCanvas } from '@napi-rs/canvas';
import {
  PROJECT_ROOT, projectPath, parseOptions, prepareAssets, buildVideoScene, validateVideoMetadata,
} from '../scripts/render-sigils.mjs';
import { VIDEO_PRESETS } from '../src/video-presets.js';
import { paletteById } from '../src/palettes.js';
import { EFFECTS, drawProceduralEffects } from '../src/effects.js';

const scratchParent = path.join(PROJECT_ROOT, '.cache');
fs.mkdirSync(scratchParent, { recursive: true });
const scratch = fs.mkdtempSync(path.join(scratchParent, 'video-render-test-'));
const bytesHash = canvas => createHash('sha256').update(canvas.toBuffer('image/png')).digest('hex');

test.after(() => {
  // The resolved target has been checked before recursive removal on Windows.
  assert.equal(path.dirname(fs.realpathSync(scratch)), fs.realpathSync(scratchParent));
  fs.rmSync(scratch, { recursive: true, force: true });
});

test('output paths resolve inside the project and reject lexical escapes', () => {
  assert.equal(projectPath('exports/test-collection'), path.join(PROJECT_ROOT, 'exports', 'test-collection'));
  assert.equal(projectPath(path.join(scratch, 'new', 'nested')), path.join(scratch, 'new', 'nested'));
  for (const candidate of ['../outside', '../../outside', path.dirname(PROJECT_ROOT)]) {
    assert.throws(() => projectPath(candidate), /must stay inside this project/);
  }
});

test('output paths reject an existing junction and its nonexistent descendants outside the project', () => {
  const junction = path.join(scratch, 'outside-junction');
  fs.symlinkSync(path.dirname(PROJECT_ROOT), junction, process.platform === 'win32' ? 'junction' : 'dir');
  try {
    assert.throws(() => projectPath(junction), /resolves outside this project/);
    assert.throws(() => projectPath(path.join(junction, 'never-created-output', 'nested')), /resolves outside this project/);
  } finally {
    // Remove only the link; never recursively remove its outside target.
    fs.unlinkSync(junction);
  }
});

test('video options enforce codec-compatible dimensions, frame rate and bounded duration', () => {
  const defaults = parseOptions([]);
  assert.equal(defaults.size, 1080);
  assert.equal(defaults.fps, 30);
  assert.equal(defaults.duration, 15);
  assert.equal(defaults.frames, 450);
  const rounded = parseOptions(['--id', '07-void-ritual', '--duration', '2.011', '--size', '320', '--fps', '60', '--out', scratch]);
  assert.equal(rounded.frames, 121);
  assert.equal(rounded.duration, rounded.frames / rounded.fps);
  for (const args of [
    ['--duration', 'NaN'], ['--duration', 'Infinity'], ['--duration', '1.9'], ['--duration', '60.1'],
    ['--size', '319'], ['--size', '321'], ['--size', '1082'], ['--size', '720.5'],
    ['--fps', '25'], ['--fps', '0'], ['--id', '07-void-ritual', '--all'],
    ['--duration'], ['--out', '--proof'], ['--unknown'], ['stray'], ['--out', '../outside'],
  ]) assert.throws(() => parseOptions(args), Error, args.join(' '));
});

test('all nine rendered scenes close exactly while intermediate frames contain real motion', async () => {
  const grain = await prepareAssets();
  const hashes = new Set();
  for (const preset of VIDEO_PRESETS) {
    const scene = buildVideoScene(preset, 320, grain);
    const zero = bytesHash(scene.frame(0));
    assert.equal(bytesHash(scene.frame(1)), zero, `${preset.id} does not close at one period`);
    assert.equal(bytesHash(scene.frame(2)), zero, `${preset.id} does not repeat at two periods`);
    assert.equal(bytesHash(scene.frame(-.25)), bytesHash(scene.frame(.75)), `${preset.id} does not wrap negative phase`);
    assert.notEqual(bytesHash(scene.frame(.137)), zero, `${preset.id} has no visible animation`);
    assert.notEqual(bytesHash(scene.frame(.5)), zero, `${preset.id} has no midpoint motion`);
    assert.notEqual(bytesHash(scene.frame(449 / 450)), zero, `${preset.id} freezes before its final frame`);
    hashes.add(zero);
  }
  assert.equal(hashes.size, 9, 'each collection scene must have distinct rendered artwork');
});

test('encoded metadata must match the requested duration and rational frame rate', () => {
  const options = parseOptions(['--duration', '15', '--fps', '30', '--size', '720']);
  const metadata = {
    streams: [{ codec_name: 'h264', pix_fmt: 'yuv420p', width: 720, height: 720, nb_frames: '450', avg_frame_rate: '30/1' }],
    format: { duration: '15.000000' },
  };
  assert.doesNotThrow(() => validateVideoMetadata(metadata, options));
  assert.doesNotThrow(() => validateVideoMetadata({ ...metadata, streams: [{ ...metadata.streams[0], avg_frame_rate: '60/2' }] }, options));
  for (const avg_frame_rate of ['24/1', '30000/1001', '30/0', '0/0', '', 'NaN/1']) {
    assert.throws(() => validateVideoMetadata({ ...metadata, streams: [{ ...metadata.streams[0], avg_frame_rate }] }, options), /does not match/, avg_frame_rate);
  }
  for (const duration of ['14.9', '15.1', 'NaN', 'Infinity', undefined]) {
    assert.throws(() => validateVideoMetadata({ ...metadata, format: { duration } }, options), /does not match/, String(duration));
  }
  assert.throws(() => validateVideoMetadata({ streams: [], format: metadata.format }, options), /does not match/);
});

test('each curated procedural effect visibly animates and repeats on the native renderer', () => {
  const effectIds = EFFECTS.filter(effect => effect.id !== 'none').map(effect => effect.id);
  assert.equal(effectIds.length, 9);
  assert.deepEqual(new Set(VIDEO_PRESETS.map(preset => preset.effectId)), new Set(effectIds));
  const images = new Set();
  for (const config of VIDEO_PRESETS) {
    const canvas = createCanvas(320, 320), ctx = canvas.getContext('2d');
    const palette = paletteById(config.paletteId);
    const frame = phase => {
      ctx.clearRect(0, 0, 320, 320);
      drawProceduralEffects(ctx, { size: 320, config, phase, palette, effectId: config.effectId });
      const pixels = ctx.getImageData(0, 0, 320, 320).data;
      let visible = 0;
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) visible++;
      assert.ok(visible > 30, `${config.effectId} is invisible at phase ${phase}`);
      assert.equal(ctx.globalAlpha, 1, `${config.effectId} leaks alpha state`);
      assert.equal(ctx.globalCompositeOperation, 'source-over', `${config.effectId} leaks composite state`);
      return bytesHash(canvas);
    };
    const start = frame(0);
    assert.equal(frame(1), start, `${config.effectId} is not periodic`);
    assert.equal(frame(2), start, `${config.effectId} changes between cycles`);
    assert.equal(frame(-.25), frame(.75), `${config.effectId} fails negative phase wrap`);
    assert.notEqual(frame(.137), start, `${config.effectId} is static`);
    assert.notEqual(frame(.5), start, `${config.effectId} has no midpoint movement`);
    frame(449 / 450);
    images.add(start);
  }
  assert.equal(images.size, 9, 'nine effects should have distinct rendered layers');
});

test('effect input validation rejects nonfinite state and disabled effects paint no pixels', () => {
  const canvas = createCanvas(320, 320), ctx = canvas.getContext('2d');
  const state = { size: 320, config: VIDEO_PRESETS[0], phase: 0, effectId: 'sparks', intensity: 1 };
  for (const invalid of [
    { size: 0 }, { size: -1 }, { size: NaN }, { size: Infinity },
    { phase: NaN }, { phase: Infinity }, { intensity: NaN }, { intensity: Infinity },
    { effectId: 'unknown-effect' },
  ]) assert.throws(() => drawProceduralEffects(ctx, { ...state, ...invalid }), RangeError);
  const empty = bytesHash(canvas);
  for (const disabled of [{ effectId: 'none' }, { intensity: 0 }, { intensity: -1 }]) {
    drawProceduralEffects(ctx, { ...state, ...disabled });
    assert.equal(bytesHash(canvas), empty);
  }
});

test('upper effect intensity remains renderable and preserves the caller canvas state', () => {
  for (const config of VIDEO_PRESETS) {
    const canvas = createCanvas(320, 320), ctx = canvas.getContext('2d');
    const state = { size: 320, config, phase: .137, palette: paletteById(config.paletteId), effectId: config.effectId };
    ctx.globalAlpha = .42;
    ctx.globalCompositeOperation = 'xor';
    ctx.shadowBlur = 5;
    ctx.lineCap = 'butt';
    const callerAlpha = ctx.globalAlpha; // The native canvas may quantize alpha.
    const render = intensity => {
      ctx.clearRect(0, 0, 320, 320);
      assert.doesNotThrow(() => drawProceduralEffects(ctx, { ...state, intensity }));
      assert.equal(ctx.globalAlpha, callerAlpha);
      assert.equal(ctx.globalCompositeOperation, 'xor');
      assert.equal(ctx.shadowBlur, 5);
      assert.equal(ctx.lineCap, 'butt');
      return bytesHash(canvas);
    };
    const upper = render(1.5);
    assert.equal(render(1000), upper, `${config.effectId} does not bound excessive intensity`);
    assert.notEqual(render(1), upper, `${config.effectId} ignores its strength setting`);
  }
});

test('the CLI refuses an outside working directory before creating outputs', () => {
  const output = path.join(scratch, 'outside-cwd-output');
  const result = spawnSync(process.execPath, [path.join(PROJECT_ROOT, 'scripts', 'render-sigils.mjs'), '--all', '--proof', '--out', output], {
    cwd: path.dirname(PROJECT_ROOT), windowsHide: true, encoding: 'utf8', timeout: 20000,
  });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /project-local generator from the project directory/);
  assert.equal(fs.existsSync(output), false);
});

test('the CLI refuses unknown presets before creating outputs', () => {
  const output = path.join(scratch, 'unknown-preset-output');
  const result = spawnSync(process.execPath, [path.join(PROJECT_ROOT, 'scripts', 'render-sigils.mjs'), '--id', 'not-a-preset', '--proof', '--out', output], {
    cwd: PROJECT_ROOT, windowsHide: true, encoding: 'utf8', timeout: 20000,
  });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /Unknown video preset/);
  assert.equal(fs.existsSync(output), false);
});

test('existing videos are rejected before any poster or manifest is overwritten', () => {
  const output = path.join(scratch, 'existing-video-output');
  const group = path.join(output, 'fire');
  fs.mkdirSync(group, { recursive: true });
  const destination = path.join(group, '01-solar-flare.mp4');
  const poster = path.join(group, '01-solar-flare.png');
  const manifest = path.join(output, 'manifest.json');
  fs.writeFileSync(destination, 'existing-video-fixture');
  fs.writeFileSync(poster, 'existing-poster-fixture');
  fs.writeFileSync(manifest, 'existing-manifest-fixture');
  const result = spawnSync(process.execPath, [path.join(PROJECT_ROOT, 'scripts', 'render-sigils.mjs'), '--id', '01-solar-flare', '--out', output], {
    cwd: PROJECT_ROOT, windowsHide: true, encoding: 'utf8', timeout: 20000,
  });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /Already exists/);
  assert.equal(fs.readFileSync(destination, 'utf8'), 'existing-video-fixture');
  assert.equal(fs.readFileSync(poster, 'utf8'), 'existing-poster-fixture');
  assert.equal(fs.readFileSync(manifest, 'utf8'), 'existing-manifest-fixture');
});

test('a missing encoder exits promptly without an unhandled rejection or a finished-video claim', () => {
  const output = path.join(scratch, 'missing-encoder-output');
  const emptyPath = path.join(scratch, 'empty-path');
  fs.mkdirSync(emptyPath);
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.toLowerCase() === 'path') delete env[key];
  env[process.platform === 'win32' ? 'Path' : 'PATH'] = emptyPath;
  const result = spawnSync(process.execPath, [path.join(PROJECT_ROOT, 'scripts', 'render-sigils.mjs'), '--id', '01-solar-flare', '--duration', '2', '--size', '320', '--fps', '24', '--out', output], {
    cwd: PROJECT_ROOT, windowsHide: true, encoding: 'utf8', env, timeout: 15000,
  });
  assert.equal(result.error, undefined, `encoder failure did not exit promptly: ${result.error?.message}`);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /ENOENT|spawn ffmpeg|Encoder stopped|write EPIPE/i);
  assert.doesNotMatch(result.stderr, /UnhandledPromiseRejection|unhandledRejection|node:internal\/process\/promises/i);
  assert.doesNotMatch(result.stdout, /Completed|Saved \d+ videos/);
  assert.equal(fs.existsSync(path.join(output, 'fire', '01-solar-flare.mp4')), false);
  assert.equal(fs.existsSync(path.join(output, 'manifest.json')), false);
  assert.equal(fs.existsSync(path.join(output, 'index.html')), false);
});
