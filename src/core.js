// Hypotrochoid kinematics: https://mathworld.wolfram.com/Hypotrochoid.html
// Coordinates use Canvas's orientation: positive angles turn clockwise.
const TAU = 2 * Math.PI;
const PRESSURE_ANGLE = (20 * Math.PI) / 180;
const involute = (angle) => Math.tan(angle) - angle;

export const PRESETS = [
  { id: 'bloom', name: 'Octave Bloom', label: 'OCTAVE BLOOM', outerTeeth: 96, innerTeeth: 36, offset: 0.82, speed: 1 },
  { id: 'star', name: 'Twelve Stars', label: 'TWELVE STARS', outerTeeth: 96, innerTeeth: 40, offset: 0.9, speed: 1 },
  { id: 'sun', name: 'Solar Crown', label: 'SOLAR CROWN', outerTeeth: 96, innerTeeth: 30, offset: 0.72, speed: 1 },
  { id: 'weave', name: 'Light Weave', label: 'LIGHT WEAVE', outerTeeth: 96, innerTeeth: 45, offset: 0.86, speed: 1 },
  { id: 'lotus', name: 'Orbital Lotus', label: 'ORBITAL LOTUS', outerTeeth: 96, innerTeeth: 56, offset: 0.88, speed: 1 },
  { id: 'trefoil', name: 'Amber Trefoil', label: 'AMBER TREFOIL', outerTeeth: 96, innerTeeth: 64, offset: 0.68, speed: 1 },
];

export function gcd(a, b) {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) {
    throw new TypeError('Tooth counts must be safe integers.');
  }
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

export function geometry(config = PRESETS[1]) {
  const { outerTeeth, innerTeeth, offset } = config;
  if (!Number.isSafeInteger(outerTeeth) || !Number.isSafeInteger(innerTeeth)
    || innerTeeth < 3 || outerTeeth <= innerTeeth) {
    throw new RangeError('The inner gear must have fewer integer teeth than the fixed ring.');
  }
  if (!Number.isFinite(offset) || offset < 0 || offset > 1) {
    throw new RangeError('The pen offset must lie between 0 and 1.');
  }
  const divisor = gcd(outerTeeth, innerTeeth);
  const R = 1;
  const r = innerTeeth / outerTeeth;
  const turns = innerTeeth / divisor;
  return {
    R,
    r,
    orbitRadius: R - r,
    penRadius: r * offset,
    turns,
    symmetry: outerTeeth / divisor,
    maxTheta: TAU * turns,
  };
}

export function poseAt(theta, config = PRESETS[1]) {
  const { r, orbitRadius, penRadius } = geometry(config);
  const rotation = -(orbitRadius / r) * theta;
  const center = {
    x: orbitRadius * Math.cos(theta),
    y: orbitRadius * Math.sin(theta),
  };
  return {
    center,
    pen: {
      x: center.x + penRadius * Math.cos(rotation),
      y: center.y + penRadius * Math.sin(rotation),
    },
    rotation,
  };
}

export function sampleCurve(config = PRESETS[1], count) {
  const { r, orbitRadius, penRadius, maxTheta } = geometry(config);
  const ratio = orbitRadius / r;
  // Bound arc spacing by the maximum first derivative. The cap also makes
  // relatively prime tooth counts practical for a live Canvas preview.
  const derivativeBound = orbitRadius + penRadius * ratio;
  const requested = count ?? Math.ceil(maxTheta * derivativeBound / 0.004) + 1;
  if (!Number.isFinite(requested)) throw new RangeError('Sample count must be finite.');
  const length = Math.max(2, Math.min(24000, Math.ceil(requested)));
  const points = Array.from({ length }, (_, index) => {
    const theta = maxTheta * index / (length - 1);
    const rotation = -ratio * theta;
    return {
      x: orbitRadius * Math.cos(theta) + penRadius * Math.cos(rotation),
      y: orbitRadius * Math.sin(theta) + penRadius * Math.sin(rotation),
    };
  });
  // Store the shared endpoint exactly, so exported paths have no seam.
  points[length - 1] = { ...points[0] };
  return points;
}

export function gearOutline(teeth, pitchRadius, moduleSize = 2 * pitchRadius / teeth, internal = false) {
  if (!Number.isSafeInteger(teeth) || teeth < 3 || !Number.isFinite(pitchRadius)
    || pitchRadius <= 0 || !Number.isFinite(moduleSize) || moduleSize <= 0) {
    throw new RangeError('A gear needs an integer tooth count and positive radius and module.');
  }
  const baseRadius = pitchRadius * Math.cos(PRESSURE_ANGLE);
  const tipRadius = pitchRadius + (internal ? -moduleSize : moduleSize);
  const rootRadius = pitchRadius + (internal ? 1.25 : -1.25) * moduleSize;
  if (Math.min(tipRadius, rootRadius) <= 0) throw new RangeError('Module is too large for this gear.');
  const pitchAngle = TAU / teeth;
  const halfTooth = Math.PI / (2 * teeth);
  const pitchInvolute = involute(PRESSURE_ANGLE);
  const halfWidth = (radius) => {
    const profileAngle = Math.acos(Math.min(1, baseRadius / radius));
    const width = halfTooth + (internal ? -1 : 1) * (pitchInvolute - involute(profileAngle));
    return Math.max(0.01 * pitchAngle, Math.min(0.49 * pitchAngle, width));
  };
  const flankRoot = internal ? rootRadius : Math.max(rootRadius, baseRadius);
  const rootHalf = halfWidth(flankRoot);
  const tipHalf = halfWidth(tipRadius);
  const phase = internal ? pitchAngle / 2 : 0;
  const points = [];
  const add = (radius, angle) => points.push({ x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
  const flankSteps = 7;
  const arcSteps = 4;

  for (let tooth = 0; tooth < teeth; tooth += 1) {
    const centerAngle = tooth * pitchAngle + phase;
    add(rootRadius, centerAngle - rootHalf);
    // Below the external base circle the flank is extended radially. This
    // visual profile omits the cutter's root fillet, but preserves the true
    // involute above the base circle and the shared module at the mesh.
    for (let step = 0; step <= flankSteps; step += 1) {
      const radius = flankRoot + (tipRadius - flankRoot) * step / flankSteps;
      add(radius, centerAngle - halfWidth(radius));
    }
    for (let step = 1; step <= arcSteps; step += 1) {
      add(tipRadius, centerAngle - tipHalf + 2 * tipHalf * step / arcSteps);
    }
    for (let step = flankSteps - 1; step >= 0; step -= 1) {
      const radius = flankRoot + (tipRadius - flankRoot) * step / flankSteps;
      add(radius, centerAngle + halfWidth(radius));
    }
    add(rootRadius, centerAngle + rootHalf);
    const gapEnd = centerAngle + pitchAngle - rootHalf;
    for (let step = 1; step <= arcSteps; step += 1) {
      add(rootRadius, centerAngle + rootHalf + (gapEnd - centerAngle - rootHalf) * step / arcSteps);
    }
  }
  points.push({ ...points[0] });
  return points;
}
