---
name: generative-sigils
description: Create themed mechanical sigil images and videos with this GEAR BLOOM project's local renderer and procedural effects, including nine-video sets arranged as three groups of three.
---

# Generative Sigils

Use GEAR BLOOM's actual rolling-gear mathematics and shared rendering palette to make luminous mechanical sigils. Keep interface copy, artwork labels, filenames and sharing drafts in English.

For concrete invocation prompts, render recipes and the existing nine-design preview, read [references/examples.md](references/examples.md).

## Project scope

The project root is the directory three levels above this skill folder, containing `package.json` and `src/core.js`. Run commands from that root. Keep this skill here at `.agents/skills/generative-sigils`; do not install, copy or link it into a global skills directory.

Read and modify this project's files only. Resolve output paths inside the project and reject paths that escape it, including traversal, symlinks or junctions. Use `exports/` by default. Use existing local runtimes and project dependencies; do not change global configuration, request broader permissions, add external services, or upload, publish or post anything. A request to produce shareable files authorizes local generation only.

This skill provides project-scoped instructions, not an operating-system sandbox. It does not grant permissions or alter the host's existing permission settings. The local renderer's output-path checks provide an additional boundary for generated files.

## Render workflow

Read `src/video-presets.js` for the current curated IDs, effect assignments and grouping, `src/palettes.js` for supported colors, and `src/effects.js` for supported procedural effects. Read `scripts/render-sigils.mjs` when its options or behavior need verification. Reuse these sources rather than duplicating presets or drawing formulas in this skill.

Rendering uses the project's `@napi-rs/canvas` development dependency. MP4 export and `--mux` additionally need existing `ffmpeg`/`ffprobe` executables on PATH; PNG proofs do not. It does not require Remotion, an AI API or a remote service. If a dependency is missing, report it rather than installing or configuring a global runtime. Keep any explicitly authorized dependency/cache setup inside this project.

For the curated nine-video collection:

```powershell
node scripts/render-sigils.mjs --all --duration 15 --size 1080 --fps 30 --out exports/example-nine-sigils
```

For one design, replace `<id>` with an ID from `src/video-presets.js`:

```powershell
node scripts/render-sigils.mjs --id <id> --duration 15 --size 1080 --fps 30 --out exports/custom
```

Use `--proof` with `--id` or `--all` for quick PNG stills/contact-sheet review before a longer render. It also writes the manifest and posting draft, but does not render MP4 files. Defaults are 15 seconds, 1080 × 1080, 30 fps, cinematic rendering and H.264/yuv420p MP4 with a deterministic procedural stereo AAC soundtrack from `src/soundtrack.js`. The soundtrack is synthesized locally on the shared 120 BPM beat grid. Prefer the defaults unless the user's requested format requires a change. Supported values are 2–60 seconds, an even square size from 320 to 1080, and 24, 30 or 60 fps.

Use `--no-audio` for silent video, `--mux` to add the procedural soundtrack to existing MP4s in the selected output folder without re-encoding the picture, and `--style classic` for the earlier renderer. `--style cinematic` is the default; `--phase` selects the poster/proof phase in [0, 1), and `--jobs N` controls parallel renders. Check `--help` for current options.

`--id` and `--all` are mutually exclusive. Existing MP4 files are protected by default; choose a new output folder for a variation. Use `--overwrite` only when replacing the selected local videos is part of the user's request. Proof PNGs and collection metadata are refreshed when rerunning in the same output folder. Use `--help` to confirm the current CLI.

For a new color or pattern request, translate the desired mood into the project's existing palette and gear parameters. If needed, edit the shared palette/preset sources so browser artwork and exports agree. Preserve mathematically closed curves and deliberate loop transitions; a full path returning to its start does not alone make its animation seamless.

The cinematic renderer in `src/cinematic.js` adds phosphor tails, color flow, bloom and beat pulses. Preserve deterministic phase-based frames and integer `look.laps` so the pen and gear motion close at the loop boundary. Each preset's `look.gears` controls hidden or nested planetary mechanisms; its `sound` controls the local soundtrack.

## Procedural effects

Compose particles, splashes and electrical light locally with the shared Canvas effects layer. Select an existing preset's `effectId`, or update its shared assignment to a supported ID from `src/effects.js`, then render it with `--id`. Do not invent a `--effect` option. The browser's effects toggle and video export use the same implementation:

```js
drawProceduralEffects(ctx, { size, config, phase, palette, effectId, intensity: 1 });
```

Supported IDs are `none`, `sparks`, `molten-splash`, `flame-corona`, `crystal-dust`, `ripple`, `fireflies`, `lightning`, `plasma` and `stardust`; `src/effects.js` is authoritative for their current names and behavior. Use sparks, molten droplets and a flame crown for gold/red designs; ripples for water; crystal dust for glacial colors; fireflies for living green; lightning and plasma for violet energy; and stardust for rose or cosmic designs. Keep effect particles, strokes and glow subordinate to the mathematical curve: leave recognizable gaps, preserve the pen path and avoid washing out the artwork with a bright central blob. Use short lightning accents rather than a full-screen flash. Select `none` for pure geometry.

Effects must be deterministic functions of normalized frame phase, configuration and preset identity. Derive export phase from the frame index and total frame count; use stable seeded variation and periodic motion/lifetimes so the loop joins cleanly. Do not use wall-clock time, unseeded `Math.random()`, accumulating particle state or live timers to decide exported frames. The same input phase must produce the same image, including when frames are rendered out of order.

Preview several phases and the loop boundary before rerendering a collection. A still image cannot establish that particles move smoothly or that an effect loops. Keep effect code and outputs in this project; this workflow requires no new global configuration, external assets or broader permissions.

## Review and handoff

Inspect actual stills and at least the beginning, middle and end of each new animation. Check effect motion, the loop join and curve readability, then verify file count, duration, dimensions, frame rate and codec from the rendered output. The nine-video collection uses `fire/`, `tide/` and `arcana/` subfolders, with three numbered designs each. The renderer writes `contact-sheet.png`, `manifest.json` and `posting-plan.md`, plus `index.html` after a video run. Report any failed renders accurately; do not count placeholders or proof images as finished videos.

Return clickable local output paths and, when requested, English captions for each group. Leave posting and upload to the user. If the renderer or a required local dependency is unavailable, preserve the work, report the specific limitation, and avoid expanding this project's scope to work around it.
