# Project Instructions

## Project context

This is an independent browser toy: GEAR BLOOM / Amber Gear Drawing Machine. The user selected the visual style of https://x.com/p0/status/2089506588067520842 (reference/parallel-turbo-style.png): near-black grain, amber phosphor glow, seven-segment instruments and retro mechanical character. Keep the simulation mathematically tied to actual inner rolling gears and hypotrochoid geometry. The original poster is a style reference, not an app screenshot to reproduce literally. Keep changes within this project.

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

User design feedback (2026-10-11): the initial monochrome palette was not vivid enough. Keep amber mechanical instruments, but give the mathematical artwork a bright gold/coral/magenta/violet spectrum, luminous pen and stronger contrast. The browser and exported artwork must use the same vivid trace palette.

User language preference (2026-10-11): English only. All application copy, preset names, accessibility labels, browser metadata, help, export messages and project documentation must use English. Do not add Chinese copy.

User scope preference (2026-10-11): the generative-sigil skill must live and operate only inside this project. Do not install it globally or broaden its permissions. Produce nine differently colored videos in three groups of three for sharing; creating the files is authorized, posting them is a separate action.

User visual direction (2026-10-11): explore code-generated splashes, particles, lightning and other effects tied to the mechanical artwork. Keep the curve legible, use a distinct effect per curated video, and share deterministic effect rendering between browser play, PNGs and video exports.

User feedback (2026-10-11): the first video set felt flat (a static curve with a tiny moving dot). Videos now use the cinematic engine in `src/cinematic.js` (phosphor tail, color flow, bloom, chromatic aberration, 120 BPM beat pulses, ghost echoes, lens flare, motes, HUD). Keep every frame a pure function of loop phase and use whole cycles per loop so videos loop seamlessly; `laps` must be an integer. `--style classic` keeps the old renderer.

User request (2026-10-11): vary the gears per video. Each preset's `look.gears` sets it: 0 hides the ring and rolling gear, 1 is the plain mechanism, 2-4 add nested planetary layers (ring 36 = sun 12 + 2 x planet 12, with real planetary kinematics, recursing into each planet). Hidden: Ember Crown, Glacial Sigil, Void Ritual; nested: Tidal Orbit and Rose Nebula (4), Amber Relic and Verdant Alchemy (3), Solar Flare and Ultraviolet (2). The pen and curve math never change.

User request (2026-10-11): add sound. Videos carry a procedural soundtrack from `src/soundtrack.js`, synthesized locally (no samples, no external services), synced to the 120 BPM beat grid and loop-safe. Keep it deterministic and around -14 LUFS; `--no-audio` and `--mux` exist.

User request (2026-10-11): publish the skill, its runtime, examples and English usage documentation as the public `tutao0123/generative-sigils` GitHub repository. Keep `.agents/skills/generative-sigils` project-local and preserve its scope. Public source and generated examples use MIT; bundled fonts retain OFL. Never commit ignored reference images, private QA evidence, caches, generated full collections or credentials. Publishing this repository does not authorize the skill to upload or post future outputs.

The Orbit Clock example lives in `examples/clock.html` and `src/clock.js`/`src/clock.css`. Keep its time readable, reuse shared geometry and palettes, and preserve the original drawing instrument. Browser wall time belongs in the clock wrapper; cinematic exports remain deterministic functions of loop phase.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
