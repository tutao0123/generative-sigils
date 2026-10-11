import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PALETTE, PALETTES, paletteById } from '../src/palettes.js';
import { VIDEO_GROUPS, VIDEO_PRESETS, videoPresetById } from '../src/video-presets.js';
import { geometry, poseAt } from '../src/core.js';

test('every theme supplies valid six-stop colors for live and exported curves', () => {
  const ids = new Set();
  for (const palette of PALETTES) {
    assert.ok(!ids.has(palette.id)); ids.add(palette.id);
    assert.equal(palette.colors.length, 6);
    assert.equal(palette.pale.length, 6);
    for (const color of [...palette.colors, ...palette.pale, palette.background, palette.glowColor, palette.penGlow, palette.amber, palette.accent]) {
      assert.match(color, /^#[a-f\d]{6}$/i);
    }
    assert.equal(paletteById(palette.id), palette);
  }
  assert.equal(paletteById('spectrum'), DEFAULT_PALETTE);
  assert.throws(() => paletteById('missing-theme'), RangeError);
});

test('the nine-video collection has three chapters with three distinct works each', () => {
  assert.equal(VIDEO_PRESETS.length, 9);
  assert.equal(new Set(VIDEO_PRESETS.map(p => p.id)).size, 9);
  assert.equal(new Set(VIDEO_PRESETS.map(p => p.paletteId)).size, 9);
  assert.equal(new Set(VIDEO_PRESETS.map(p => `${p.innerTeeth}:${p.offset}`)).size, 9);
  for (const group of VIDEO_GROUPS) {
    assert.equal(VIDEO_PRESETS.filter(p => p.group === group.id).length, 3);
  }
  for (const preset of VIDEO_PRESETS) {
    assert.equal(videoPresetById(preset.id), preset);
    assert.ok(paletteById(preset.paletteId));
    const model = geometry(preset);
    const start = poseAt(0, preset), end = poseAt(model.maxTheta, preset);
    assert.ok(Math.hypot(end.pen.x - start.pen.x, end.pen.y - start.pen.y) < 1e-12);
    assert.ok(Math.hypot(end.center.x - start.center.x, end.center.y - start.center.y) < 1e-12);
  }
  assert.throws(() => videoPresetById('missing-work'), RangeError);
});
