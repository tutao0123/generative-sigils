import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, gcd, geometry, poseAt, sampleCurve, gearOutline } from '../src/core.js';

const TAU = 2 * Math.PI;
const near = (actual, expected, epsilon = 1e-10) => {
  assert.ok(Math.abs(actual - expected) < epsilon, `${actual} should equal ${expected}`);
};
const nearPoint = (a, b) => { near(a.x, b.x); near(a.y, b.y); };

test('integer tooth counts reduce to their greatest common divisor', () => {
  assert.equal(gcd(96, 36), 12);
  assert.equal(gcd(96, 45), 3);
  assert.equal(gcd(-96, 40), 8);
  assert.equal(gcd(0, 64), 64);
  assert.throws(() => gcd(96.5, 40), TypeError);
});

test('all presets share a module and use the smallest complete mechanical period', () => {
  assert.equal(PRESETS.length, 6);
  assert.equal(new Set(PRESETS.map((preset) => preset.id)).size, 6);
  for (const config of PRESETS) {
    const model = geometry(config);
    near(2 * model.R / config.outerTeeth, 2 * model.r / config.innerTeeth);
    assert.equal(model.turns, config.innerTeeth / gcd(config.outerTeeth, config.innerTeeth));
    assert.equal(model.symmetry, config.outerTeeth / gcd(config.outerTeeth, config.innerTeeth));
    near(model.maxTheta, TAU * model.turns);
    for (let orbit = 1; orbit < model.turns; orbit += 1) {
      // The center returns after any whole orbit; the gear orientation must
      // still differ until the relatively prime tooth-count period finishes.
      const rotation = poseAt(TAU * orbit, config).rotation / TAU;
      assert.ok(Math.abs(rotation - Math.round(rotation)) > 1e-8);
    }
  }
});

test('the pen follows the gear orientation and the contact point has no slip', () => {
  for (const config of PRESETS) {
    const model = geometry(config);
    for (const theta of [0, 0.37, 1.1, 5.4]) {
      const { center, pen, rotation } = poseAt(theta, config);
      nearPoint(center, { x: model.orbitRadius * Math.cos(theta), y: model.orbitRadius * Math.sin(theta) });
      near(Math.hypot(pen.x - center.x, pen.y - center.y), model.penRadius);
      nearPoint(pen, {
        x: center.x + model.penRadius * Math.cos(rotation),
        y: center.y + model.penRadius * Math.sin(rotation),
      });
      const angularVelocity = -model.orbitRadius / model.r;
      const contactVelocity = {
        x: -model.orbitRadius * Math.sin(theta) - angularVelocity * model.r * Math.sin(theta),
        y: model.orbitRadius * Math.cos(theta) + angularVelocity * model.r * Math.cos(theta),
      };
      nearPoint(contactVelocity, { x: 0, y: 0 });
    }
  }
});

test('the full pose closes and curve rotations agree with the tooth-count symmetry', () => {
  for (const config of PRESETS) {
    const { maxTheta } = geometry(config);
    const theta = 0.713;
    const start = poseAt(theta, config);
    const finish = poseAt(theta + maxTheta, config);
    nearPoint(start.pen, finish.pen);
    nearPoint(start.center, finish.center);
    near((finish.rotation - start.rotation) / TAU,
      -((config.outerTeeth - config.innerTeeth) / gcd(config.outerTeeth, config.innerTeeth)));
    const shift = TAU * config.innerTeeth / config.outerTeeth;
    const shifted = poseAt(theta + shift, config).pen;
    nearPoint(shifted, {
      x: start.pen.x * Math.cos(shift) - start.pen.y * Math.sin(shift),
      y: start.pen.x * Math.sin(shift) + start.pen.y * Math.cos(shift),
    });
  }
});

test('every sampled preset stays inside its analytic bounds and includes a shared endpoint', () => {
  for (const config of PRESETS) {
    const model = geometry(config);
    const points = sampleCurve(config);
    assert.ok(points.length >= 2 && points.length <= 24000);
    assert.deepEqual(points[0], points.at(-1));
    assert.notEqual(points[0], points.at(-1));
    for (const point of points) {
      assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
      const radius = Math.hypot(point.x, point.y);
      assert.ok(radius <= model.orbitRadius + model.penRadius + 1e-10);
      assert.ok(radius >= Math.abs(model.orbitRadius - model.penRadius) - 1e-10);
      assert.ok(radius <= model.R + 1e-10);
    }
  }
  assert.equal(sampleCurve(PRESETS[0], 101).length, 101);
  assert.equal(sampleCurve({ ...PRESETS[0], innerTeeth: 47 }, 100000).length, 24000);
});

test('inward ring teeth and outward pinion teeth have a common pitch and half-tooth phase', () => {
  for (const config of PRESETS) {
    const { R, r, orbitRadius } = geometry(config);
    const moduleSize = 2 * R / config.outerTeeth;
    const ring = gearOutline(config.outerTeeth, R, moduleSize, true);
    const pinion = gearOutline(config.innerTeeth, r, moduleSize);
    for (const [points, minimum, maximum] of [
      [ring, R - moduleSize, R + 1.25 * moduleSize],
      [pinion, r - 1.25 * moduleSize, r + moduleSize],
    ]) {
      assert.deepEqual(points[0], points.at(-1));
      near(Math.min(...points.map(({ x, y }) => Math.hypot(x, y))), minimum);
      near(Math.max(...points.map(({ x, y }) => Math.hypot(x, y))), maximum);
    }
    // At theta=0 the pinion tooth points right; the ring has a tooth gap
    // there. Both tooth tips would collide if the ring phase were not shifted.
    const pinionRight = pinion.find(({ x, y }) => x > 0 && Math.abs(y) < 1e-12);
    const ringRight = ring.find(({ x, y }) => x > 0 && Math.abs(y) < 1e-12);
    assert.ok(pinionRight && ringRight);
    near(pinionRight.x, r + moduleSize);
    near(ringRight.x, R + 1.25 * moduleSize);
    near(ringRight.x - (orbitRadius + pinionRight.x), moduleSize / 4);
  }
});

test('invalid mechanical configurations are rejected before drawing', () => {
  assert.throws(() => geometry({ ...PRESETS[0], innerTeeth: 96 }), RangeError);
  assert.throws(() => geometry({ ...PRESETS[0], innerTeeth: 35.5 }), RangeError);
  assert.throws(() => geometry({ ...PRESETS[0], offset: -0.1 }), RangeError);
  assert.throws(() => geometry({ ...PRESETS[0], offset: 1.1 }), RangeError);
  assert.throws(() => sampleCurve(PRESETS[0], Infinity), RangeError);
  assert.throws(() => gearOutline(40, 0, 0.02), RangeError);
});
