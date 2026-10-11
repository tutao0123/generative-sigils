import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import { geometry, poseAt, sampleCurve } from '../src/core.js';
import { paletteById } from '../src/palettes.js';
import { VIDEO_GROUPS, VIDEO_PRESETS, videoPresetById } from '../src/video-presets.js';
import { drawLuminousCurve, drawSceneBackdrop, drawSceneMotion } from '../src/render.js';
import { drawProceduralEffects } from '../src/effects.js';
import { createCinematicScene } from '../src/cinematic.js';
import { renderSoundtrack, toWav } from '../src/soundtrack.js';

export const PROJECT_ROOT = fs.realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const TAU = 2 * Math.PI;

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

// Resolve the nearest existing ancestor too: lexical checks alone miss junctions.
export function projectPath(input) {
  const target = path.resolve(PROJECT_ROOT, input);
  if (!inside(PROJECT_ROOT, target)) throw new Error('Output must stay inside this project.');
  let ancestor = target;
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
  if (!inside(PROJECT_ROOT, fs.realpathSync(ancestor))) throw new Error('Output resolves outside this project.');
  return target;
}

function assertWorkingDirectory() {
  if (!inside(PROJECT_ROOT, fs.realpathSync(process.cwd()))) {
    throw new Error('Run this project-local generator from the project directory.');
  }
}

export function parseOptions(args) {
  const result = { duration: 15, size: 1080, fps: 30, out: 'exports', style: 'cinematic', phase: .17, proof: false, all: false, overwrite: false, audio: true, mux: false, worker: false, jobs: 0 };
  const values = new Set(['id', 'duration', 'size', 'fps', 'out', 'style', 'phase', 'jobs']);
  for (let i = 0; i < args.length; i++) {
    const key = args[i].replace(/^--/, '');
    if (!args[i].startsWith('--')) throw new Error(`Unexpected argument: ${args[i]}`);
    if (values.has(key)) {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
      result[key] = ['duration', 'size', 'fps', 'phase', 'jobs'].includes(key) ? Number(value) : value;
    } else if (['proof', 'all', 'overwrite', 'help', 'mux', 'worker'].includes(key)) result[key] = true;
    else if (key === 'no-audio') result.audio = false;
    else throw new Error(`Unknown option: --${key}`);
  }
  if (!Number.isInteger(result.jobs) || result.jobs < 0 || result.jobs > 16) throw new Error('Jobs must be an integer from 0 (auto) to 16.');
  if (!['cinematic', 'classic'].includes(result.style)) throw new Error('Style must be cinematic or classic.');
  if (!Number.isFinite(result.phase) || result.phase < 0 || result.phase >= 1) throw new Error('Phase must be in [0, 1).');
  if (result.id && result.all) throw new Error('Choose --id or --all, not both.');
  if (!Number.isFinite(result.duration) || result.duration < 2 || result.duration > 60) throw new Error('Duration must be 2–60 seconds.');
  if (!Number.isInteger(result.size) || result.size < 320 || result.size > 1080 || result.size % 2) throw new Error('Size must be an even integer from 320 to 1080.');
  if (![24, 30, 60].includes(result.fps)) throw new Error('FPS must be 24, 30 or 60.');
  result.frames = Math.round(result.duration * result.fps);
  result.duration = result.frames / result.fps;
  result.out = projectPath(result.out);
  return result;
}

export async function prepareAssets() {
  const assets = projectPath('public/assets');
  GlobalFonts.registerFromPath(path.join(assets, 'ChakraPetch-Regular.ttf'), 'Chakra Petch');
  GlobalFonts.registerFromPath(path.join(assets, 'ChakraPetch-SemiBold.ttf'), 'Chakra Petch');
  return loadImage(path.join(assets, 'instrument-grain.png'));
}

export function buildVideoScene(preset, size, grain, options = {}) {
  if (options.style !== 'classic') {
    return createCinematicScene({ preset, palette: paletteById(preset.paletteId), size, duration: options.duration ?? 15, createCanvas, grain });
  }
  const palette = paletteById(preset.paletteId), model = geometry(preset);
  const canvas = createCanvas(size, size), ctx = canvas.getContext('2d');
  const base = createCanvas(size, size), bg = base.getContext('2d');
  const u = size / 720, stageSize = Math.round(size * .86);
  const left = (size - stageSize) / 2, top = size * .105;
  const center = stageSize / 2, scale = stageSize * .363;
  const points = sampleCurve(preset);
  bg.fillStyle = palette.background; bg.fillRect(0, 0, size, size);
  if (grain) { bg.globalAlpha = .18; bg.drawImage(grain, 0, 0, size, size); bg.globalAlpha = 1; }
  bg.strokeStyle = palette.accent; bg.globalAlpha = .3; bg.lineWidth = u;
  bg.strokeRect(18 * u, 18 * u, size - 36 * u, size - 36 * u); bg.globalAlpha = 1;
  bg.save(); bg.translate(left, top); drawSceneBackdrop(bg, stageSize, palette);
  drawLuminousCurve(bg, points, center, center, scale, 1, .95, palette); bg.restore();
  bg.textAlign = 'left'; bg.fillStyle = palette.amber;
  bg.font = `${10 * u}px "Chakra Petch"`; bg.fillText('GEAR BLOOM / GENERATIVE SIGILS', 34 * u, 43 * u);
  bg.font = `600 ${23 * u}px "Chakra Petch"`; bg.fillText(preset.title.toUpperCase(), 33 * u, 72 * u);
  bg.textAlign = 'right'; bg.font = `${11 * u}px "Chakra Petch"`;
  bg.fillStyle = palette.pale[3]; bg.fillText(`${preset.group.toUpperCase()} / ${String(preset.number).padStart(2, '0')}`, size - 34 * u, 43 * u);
  bg.textAlign = 'left'; bg.fillStyle = palette.amber; bg.globalAlpha = .72;
  bg.font = `${11 * u}px "Chakra Petch"`;
  bg.fillText(`96 : ${preset.innerTeeth} TEETH / ${Math.round(preset.offset * 100)}% OFFSET`, 34 * u, size - 47 * u);
  bg.textAlign = 'right'; bg.fillText(`${model.symmetry}-FOLD / ${model.turns} ORBITS`, size - 34 * u, size - 47 * u);
  bg.textAlign = 'left'; bg.globalAlpha = .45; bg.font = `${9 * u}px "Chakra Petch"`;
  bg.fillText('MOTION INTO MATHEMATICS. MATHEMATICS INTO ART.', 34 * u, size - 29 * u); bg.globalAlpha = 1;

  function frame(rawPhase) {
    const phase = ((rawPhase % 1) + 1) % 1;
    ctx.clearRect(0, 0, size, size); ctx.drawImage(base, 0, 0);
    ctx.save(); ctx.translate(left, top);
    // Short energized trail follows the same mathematical pen, including closure.
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = .75;
    ctx.lineWidth = 2 * u; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = palette.pale[3]; ctx.shadowColor = palette.penGlow; ctx.shadowBlur = 15 * u;
    ctx.beginPath();
    for (let i = 0; i <= 48; i++) {
      const trailPhase = ((phase - .018 + i / 48 * .018) % 1 + 1) % 1;
      const pen = poseAt(trailPhase * model.maxTheta, preset).pen;
      const x = center + pen.x * scale, y = center + pen.y * scale;
      if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke(); ctx.restore();
    // Fire exposes the gears; the other chapters emphasize the luminous sigil.
    drawSceneMotion(ctx, stageSize, preset, phase, preset.group === 'fire', palette);
    drawProceduralEffects(ctx, { size: stageSize, config: preset, phase, palette, effectId: preset.effectId });
    ctx.restore();
    return canvas;
  }
  return { canvas, frame, model, palette };
}

export function validateVideoMetadata(metadata, options) {
  const stream = metadata.streams?.[0];
  const [numerator, denominator] = (stream?.avg_frame_rate || '').split('/').map(Number);
  const frameRate = numerator / denominator;
  const duration = Number(metadata.format?.duration);
  if (!stream || stream.codec_name !== 'h264' || stream.pix_fmt !== 'yuv420p'
    || stream.width !== options.size || stream.height !== options.size
    || Number(stream.nb_frames) !== options.frames || !Number.isFinite(frameRate)
    || Math.abs(frameRate - options.fps) > 1e-6 || !Number.isFinite(duration)
    || Math.abs(duration - options.duration) > .5 / options.fps) {
    throw new Error('Video metadata does not match the requested export.');
  }
}

function probeVideo(file) {
  const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,profile,pix_fmt,width,height,avg_frame_rate,nb_frames:format=duration,size', '-of', 'json', file], { windowsHide: true, encoding: 'utf8' });
  if (probe.status !== 0) throw new Error(`FFprobe failed: ${probe.stderr}`);
  return JSON.parse(probe.stdout);
}

async function encodeVideo(scene, preset, options, destination) {
  projectPath(destination);
  if (fs.existsSync(destination) && !options.overwrite) throw new Error(`Already exists: ${destination}. Use a new --out folder or --overwrite.`);
  const partial = projectPath(destination.replace(/\.mp4$/, '.partial.mp4'));
  const encoder = spawn('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pixel_format', 'rgba',
    '-video_size', `${options.size}x${options.size}`, '-framerate', String(options.fps), '-i', 'pipe:0',
    '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-profile:v', 'high',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-threads', '2', partial,
  ], { cwd: PROJECT_ROOT, windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
  let errors = '';
  encoder.stderr.on('data', chunk => { errors = (errors + chunk).slice(-8000); });
  const done = new Promise(resolve => {
    encoder.once('error', error => resolve({ error }));
    encoder.once('close', code => resolve({ code }));
  });
  // A pipe failure is reported with the encoder result rather than as an uncaught event.
  let pipeError;
  encoder.stdin.on('error', error => { pipeError = error; });
  let encoded = false;
  try {
    for (let frame = 0; frame < options.frames; frame++) {
      if (pipeError) throw pipeError;
      const pixels = scene.frame(frame / options.frames, frame).getContext('2d').getImageData(0, 0, options.size, options.size).data;
      if (!encoder.stdin.write(Buffer.from(pixels.buffer, pixels.byteOffset, pixels.byteLength))) {
        await Promise.race([
          once(encoder.stdin, 'drain'),
          done.then(result => { throw result.error || new Error(`Encoder stopped early: ${errors || result.code}`); }),
        ]);
      }
      if (frame && frame % (options.fps * 5) === 0) console.log(`  ${preset.id}: ${Math.round(frame / options.frames * 100)}%`);
    }
    encoder.stdin.end();
    const result = await done;
    if (result.error || result.code !== 0 || pipeError) throw new Error(`FFmpeg failed: ${errors || result.error?.message || pipeError?.message || result.code}`);
    encoded = true;
  } finally {
    if (!encoded) {
      encoder.stdin.destroy();
      if (encoder.exitCode === null) encoder.kill();
      await done;
    }
  }
  fs.renameSync(partial, destination);
  const metadata = probeVideo(destination);
  validateVideoMetadata(metadata, options);
  return metadata;
}

// Adds the procedural soundtrack to a finished video; the picture is stream-copied.
export function addAudio(videoPath, preset, options) {
  projectPath(videoPath);
  const wav = projectPath(videoPath.replace(/\.mp4$/, '.wav')), partial = projectPath(videoPath.replace(/\.mp4$/, '.audio.mp4'));
  fs.writeFileSync(wav, toWav(renderSoundtrack(preset, options.duration)));
  try {
    const run = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', videoPath, '-i', wav, '-map', '0:v:0', '-map', '1:a:0',
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', String(options.duration), '-movflags', '+faststart', partial], { windowsHide: true, encoding: 'utf8' });
    if (run.status !== 0) throw new Error(`FFmpeg audio mux failed: ${run.stderr}`);
    fs.renameSync(partial, videoPath);
  } finally { fs.rmSync(wav, { force: true }); fs.rmSync(partial, { force: true }); }
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,channels,sample_rate:format=duration', '-of', 'json', videoPath], { windowsHide: true, encoding: 'utf8' });
  const info = JSON.parse(probe.stdout), audio = info.streams.find(stream => stream.codec_type === 'audio');
  if (!audio || audio.codec_name !== 'aac' || audio.channels !== 2 || Math.abs(Number(info.format.duration) - options.duration) > .1) throw new Error('Audio verification failed.');
  return audio;
}

export function galleryHtml(presets, options) {
  const sections = VIDEO_GROUPS.map(group => {
    const cards = presets.filter(p => p.group === group.id).map(p => `<article><video aria-label="${p.title} video" loop playsinline preload="metadata" poster="${p.group}/${p.id}.png" src="${p.group}/${p.id}.mp4"></video><div class="playback"><button type="button" aria-label="Play ${p.title} video">Play</button><input type="range" aria-label="Seek ${p.title} video" min="0" max="${options.duration}" step="0.01" value="0"><output>0:00</output></div><h3>${p.title}</h3><p>${p.effectName}</p><a href="${p.group}/${p.id}.mp4" download aria-label="Download ${p.title} MP4">Download MP4 ↗</a></article>`).join('');
    return cards ? `<section><h2>0${group.number} / ${group.title}</h2><p>${group.subtitle}</p><div class="grid">${cards}</div></section>` : '';
  }).join('');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GEAR BLOOM / Nine Sigils</title><style>body{margin:0;background:#100b15;color:#ffdaad;font:15px system-ui;line-height:1.6}main{max-width:1180px;margin:auto;padding:32px 24px}h1{font-size:clamp(30px,5vw,60px);margin-bottom:4px}h2{margin-top:44px;color:#f4afec}p{color:#ae9cae}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}article{border:1px solid #4b334f;padding:12px;background:#170f1b}video{display:block;width:100%;aspect-ratio:1;background:#0b0810}h3{margin:12px 0 4px}a{color:#ffba9b}small{color:#8e8296}.playback{display:flex;align-items:center;gap:8px;margin-top:8px}.playback button{min-width:64px;min-height:44px;background:#34203c;color:#ffdaad;border:1px solid #765079;cursor:pointer}.playback input{width:100%;min-width:0;min-height:44px;accent-color:#ed8cd8}.playback output{font-size:12px;font-variant-numeric:tabular-nums}.playback :focus-visible{outline:2px solid #ffbc8b;outline-offset:2px}article>p{font-size:13px;margin:0 0 8px}@media(max-width:650px){.grid{grid-template-columns:1fr}} </style><main><small>AMBER KINETIC INSTRUMENTS / COLLECTION 001</small><h1>GEAR BLOOM / NINE SIGILS</h1><p>Nine mathematical rituals. Three visual chapters. ${options.duration}s seamless loops · ${options.size} × ${options.size} · ${options.fps}fps · H.264 MP4 with stereo audio (tap Play for sound).</p><p>One chapter per X post: attach its three individual videos. <a href="posting-plan.md">Posting plan</a> · <a href="contact-sheet.png">Contact sheet</a></p>${sections}</main><script>
document.querySelectorAll('article').forEach(card => {
  const video = card.querySelector('video'), button = card.querySelector('button'), seek = card.querySelector('input'), time = card.querySelector('output');
  const title = card.querySelector('h3').textContent;
  const sync = () => { button.textContent = video.paused ? 'Play' : 'Pause'; button.setAttribute('aria-label', (video.paused ? 'Play ' : 'Pause ') + title + ' video'); };
  button.addEventListener('click', async () => { if (video.paused) { try { await video.play(); } catch { time.textContent = 'Playback unavailable'; } } else video.pause(); sync(); });
  video.addEventListener('play', sync); video.addEventListener('pause', sync);
  video.addEventListener('loadedmetadata', () => { seek.max = video.duration; });
  video.addEventListener('timeupdate', () => { seek.value = video.currentTime; time.textContent = Math.floor(video.currentTime / 60) + ':' + String(Math.floor(video.currentTime % 60)).padStart(2, '0'); });
  seek.addEventListener('input', () => { if (Number.isFinite(video.duration)) video.currentTime = Number(seek.value); });
});
</script></html>`;
}

function postingPlan(presets) {
  return `# GEAR BLOOM / Posting plan\n\nThree posts, three videos each. Upload the individual MP4 files, not the preview images. All wording below is an editable draft; nothing has been posted.\n\n${VIDEO_GROUPS.map(group => `## Post ${group.number} / ${group.title}\n\n${group.id === 'fire' ? 'Two gears. One pen. Sparks, molten splashes, a crown of fire. Built with Codex; drawn by mathematics.' : group.id === 'tide' ? 'The same machine, a different element. Crystal dust, ripples, fireflies — every sigil follows a real closed curve.' : 'Mechanical motion, arcane light. Lightning, plasma, stardust. Nine sigils, one mathematical engine. Which one would you summon?'}\n\n${presets.filter(p => p.group === group.id).map(p => `- ${p.group}/${p.id}.mp4 — ${p.title} / ${p.effectName}`).join('\n')}\n`).join('\n')}\nOfficial mixed-media reference: https://blog.x.com/en_us/topics/product/2022/introducing-mixed-media-videos-images-gifs-together-one-tweet\n`;
}

function autoJobs(count) {
  return Math.max(1, Math.min(count, 6, Math.floor(os.cpus().length / 2)));
}

// Each video renders in its own Node process (frame drawing is single-threaded),
// so several videos use several CPU cores at once.
async function renderInParallel(presets, options, jobs) {
  console.log(`Rendering ${presets.length} videos with ${Math.min(jobs, presets.length)} parallel jobs...`);
  const base = ['--duration', String(options.duration), '--size', String(options.size), '--fps', String(options.fps),
    '--style', options.style, '--phase', String(options.phase), '--out', options.out, '--worker'];
  if (!options.audio) base.push('--no-audio');
  if (options.overwrite) base.push('--overwrite');
  const queue = [...presets];
  const failures = [];
  const runNext = async () => {
    while (queue.length && !failures.length) {
      const preset = queue.shift();
      const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--id', preset.id, ...base], { cwd: PROJECT_ROOT, windowsHide: true, stdio: ['ignore', 'inherit', 'inherit'] });
      const [code] = await once(child, 'close');
      if (code !== 0) failures.push(preset.id);
    }
  };
  await Promise.all(Array.from({ length: Math.min(jobs, presets.length) }, runNext));
  if (failures.length) throw new Error(`Render failed for: ${failures.join(', ')}`);
}

export async function main(args = process.argv.slice(2)) {
  assertWorkingDirectory();
  const options = parseOptions(args);
  if (options.help) {
    console.log('Project-only sigil renderer\nnode scripts/render-sigils.mjs --all [--proof] [--duration 15] [--size 1080] [--fps 30] [--style cinematic|classic] [--phase .17] [--no-audio] [--mux] [--jobs N] [--out exports] [--overwrite]\nnode scripts/render-sigils.mjs --id 07-void-ritual --out exports/custom');
    return;
  }
  const presets = options.id ? [videoPresetById(options.id)] : VIDEO_PRESETS;
  if (options.mux) {
    for (const preset of presets) {
      const file = projectPath(path.join(options.out, preset.group, `${preset.id}.mp4`));
      if (!fs.existsSync(file)) throw new Error(`Missing video to add audio to: ${file}`);
      const audio = addAudio(file, preset, options);
      console.log(`${preset.id}: ${audio.codec_name} ${audio.channels}ch ${audio.sample_rate}Hz`);
    }
    fs.writeFileSync(projectPath(path.join(options.out, 'index.html')), galleryHtml(presets, options));
    console.log(`Added soundtracks to ${presets.length} videos in ${options.out}`);
    return;
  }
  if (!options.proof && !options.overwrite) {
    for (const preset of presets) {
      const destination = projectPath(path.join(options.out, preset.group, `${preset.id}.mp4`));
      if (fs.existsSync(destination)) throw new Error(`Already exists: ${destination}. Use a new --out folder or --overwrite.`);
    }
  }
  fs.mkdirSync(options.out, { recursive: true }); projectPath(options.out);
  const grain = await prepareAssets(), entries = [];
  const contact = createCanvas(1080, 1136), contactCtx = contact.getContext('2d');
  contactCtx.fillStyle = '#100b15'; contactCtx.fillRect(0, 0, 1080, 1136);
  contactCtx.fillStyle = '#ffd390'; contactCtx.font = '600 24px "Chakra Petch"'; contactCtx.fillText('GEAR BLOOM / NINE SIGILS', 24, 38);
  const parallel = !options.worker && !options.proof && presets.length > 1 && (options.jobs || autoJobs(presets.length)) > 1;
  if (parallel) await renderInParallel(presets, options, options.jobs || autoJobs(presets.length));
  for (let i = 0; i < presets.length; i++) {
    const preset = presets[i], directory = projectPath(path.join(options.out, preset.group));
    fs.mkdirSync(directory, { recursive: true });
    const pngPath = projectPath(path.join(directory, `${preset.id}.png`)), mp4Path = projectPath(path.join(directory, `${preset.id}.mp4`));
    let proof, metadata;
    if (parallel) {
      proof = await loadImage(pngPath); metadata = probeVideo(mp4Path);
    } else {
      const scene = buildVideoScene(preset, options.size, grain, options);
      proof = scene.frame(options.phase, 0);
      fs.writeFileSync(pngPath, proof.toBuffer('image/png'));
      if (!options.proof) {
        console.log(`Rendering ${preset.id} (${options.frames} frames)...`);
        metadata = await encodeVideo(scene, preset, options, mp4Path);
        if (options.audio) { addAudio(mp4Path, preset, options); console.log(`  ${preset.id}: soundtrack added`); }
        console.log(`Completed ${preset.id}`);
      }
    }
    contactCtx.drawImage(proof, 12 + i % 3 * 356, 56 + Math.floor(i / 3) * 356, 344, 344);
    entries.push({ ...preset, duration: options.duration, size: options.size, fps: options.fps, mechanism: (preset.look?.gears ?? 1) > 0, file: `${preset.group}/${preset.id}.mp4`, poster: `${preset.group}/${preset.id}.png`, metadata });
  }
  if (options.worker) return;
  fs.writeFileSync(projectPath(path.join(options.out, 'contact-sheet.png')), contact.toBuffer('image/png'));
  const publicOptions = { ...options, out: path.relative(PROJECT_ROOT, options.out).split(path.sep).join('/') || '.' };
  fs.writeFileSync(projectPath(path.join(options.out, 'manifest.json')), JSON.stringify({ proofOnly: options.proof, options: publicOptions, entries }, null, 2));
  fs.writeFileSync(projectPath(path.join(options.out, 'posting-plan.md')), postingPlan(presets));
  if (!options.proof) fs.writeFileSync(projectPath(path.join(options.out, 'index.html')), galleryHtml(presets, options));
  console.log(`Saved ${presets.length} ${options.proof ? 'proofs' : 'videos'} to ${options.out}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
