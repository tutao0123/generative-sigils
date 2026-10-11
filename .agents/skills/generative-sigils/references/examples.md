# Generative Sigils / Examples

Run these recipes from the repository root. Keep the skill at `.agents/skills/generative-sigils`, and choose output folders inside this project. None of these workflows installs a global skill, changes permissions or uploads anything.

## Invoke the skill

Open this repository as your Codex project, then use a prompt such as:

```text
$generative-sigils Create nine 15-second mechanical sigil videos in three
groups of three, with distinct Fire, Tide and Arcana palettes, procedural
effects and sound. Start with PNG proofs, then render to exports/my-nine-sigils.
```

```text
$generative-sigils Create a glacial blue sigil with crystal dust, hide the
gears and keep the curve readable. Render a proof and a 1080 × 1080
cinematic loop to exports/my-glacial-sigil.
```

```text
$generative-sigils Create a violet mechanical sigil with short lightning
accents and a procedural soundtrack. Review the start, middle and loop
join, and save the video and an English caption draft to exports/my-violet-sigil.
```

For customized requests, the skill edits shared project palettes and presets as needed. The recipes below use the existing curated designs.

## Set up local dependencies

Requires Node.js 20.19+ or 22.12+ and npm. From the project root:

```sh
npm ci --cache .cache/npm
```

PNG proofs use the project dependencies. MP4 generation also needs existing `ffmpeg` and `ffprobe` on PATH, with `libx264` and AAC encoding support. If either tool is unavailable, report the missing dependency and keep the proof artwork; do not install or configure a global runtime as a workaround.

## Render recipes

One cinematic design with the default procedural soundtrack:

```sh
node scripts/render-sigils.mjs --id 01-solar-flare --duration 15 --size 1080 --fps 30 --out exports/example-solar-flare
```

PNG proofs and a contact sheet for all nine designs:

```sh
node scripts/render-sigils.mjs --all --proof --size 1080 --phase 0.17 --out exports/example-nine-proofs
```

Nine videos arranged into three chapter folders:

```sh
node scripts/render-sigils.mjs --all --duration 15 --size 1080 --fps 30 --out exports/example-nine-sigils
```

A silent lightning design:

```sh
node scripts/render-sigils.mjs --id 07-void-ritual --no-audio --out exports/example-void-silent
```

Use `--style classic` for the earlier visual renderer or `--jobs 1` to render serially. The CLI accepts durations from 2 to 60 seconds, even square dimensions from 320 to 1080, and 24, 30 or 60 fps. Defaults are 15 seconds, 1080 square and 30 fps. `--help` is authoritative for current options.

To add procedural audio to already rendered videos, select the same IDs and output folder and use `--mux --duration <original-duration>`. This modifies those MP4s while stream-copying the picture. Regular video rendering preserves existing MP4s unless explicitly requested with `--overwrite`; prefer a fresh folder. Proofs and collection metadata are refreshed on reruns.

## Included previews

The repository contains a nine-design image and one short preview per chapter:

- [Nine-design contact sheet](../../../../examples/nine-sigils.png)
- [Solar Flare / Fire](../../../../examples/solar-flare.mp4)
- [Tidal Orbit / Tide](../../../../examples/tidal-orbit.mp4)
- [Void Ritual / Arcana](../../../../examples/void-ritual.mp4)
- [Preview and clock details](../../../../examples/README.md)

These are compact examples; render the full collection with the commands above. Full-resolution videos and local galleries are generated into ignored `exports/`, so a clean clone does not depend on another user's local exports.

| Chapter folder | Preset IDs |
| --- | --- |
| `fire/` | `01-solar-flare`, `02-amber-relic`, `03-ember-crown` |
| `tide/` | `04-glacial-sigil`, `05-tidal-orbit`, `06-verdant-alchemy` |
| `arcana/` | `07-void-ritual`, `08-ultraviolet`, `09-rose-nebula` |

Each video run writes MP4s and PNG posters plus `contact-sheet.png`, `manifest.json`, `index.html` and `posting-plan.md`. Proof runs omit MP4s and the playback gallery. The posting plan is an editable English draft, and sharing remains a separate manual step.

## Customize a design

Use `src/palettes.js` for color and `src/video-presets.js` for gear parameters, effects, cinematic motion and sound. Supported `effectId` values are `none`, `sparks`, `molten-splash`, `flame-corona`, `crystal-dust`, `ripple`, `fireflies`, `lightning`, `plasma` and `stardust`; select the ID in a preset, then render with `--id`. There is no `--effect` flag.

Keep curves mathematically closed and `look.laps` an integer. Exported particles and electrical effects must remain functions of normalized frame phase and stable preset inputs. Review several phases and the loop join, then check actual MP4 duration, dimensions, frame rate and codecs before reporting an export as finished.

The [browser clock](../../../../examples/clock.html) is a separate example using hours, minutes and seconds rings and four shared palettes. Run the project's browser server and open `/examples/clock.html`; it is not a video-render CLI option.

```text
$generative-sigils Customize the existing Orbit Clock with a glacial palette
and a subtler central sigil. Keep the hours, minutes and seconds readable,
reuse the shared gear geometry, and work only inside this project.
```

Use `src/clock.js` for the time mapping and Canvas face, and `src/clock.css`
for the responsive layout. Browser wall time belongs in the clock wrapper;
video export remains deterministic from explicit time or normalized phase.
