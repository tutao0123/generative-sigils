// Nine curated geometry/color combinations, arranged as three visual chapters.
export const VIDEO_GROUPS = Object.freeze([
  { id: 'fire', number: 1, title: 'Fire', subtitle: 'Solar sparks. Molten splashes. A crown of flame.' },
  { id: 'tide', number: 2, title: 'Tide', subtitle: 'Crystal dust. Tidal ripples. Alchemy fireflies.' },
  { id: 'arcana', number: 3, title: 'Arcana', subtitle: 'Arc lightning. Violet plasma. Nebula stardust.' },
]);

export const VIDEO_PRESETS = Object.freeze([
  { id: '01-solar-flare', number: 1, title: 'Solar Flare', group: 'fire', paletteId: 'solar-flare', effectId: 'sparks', effectName: 'Solar Sparks', outerTeeth: 96, innerTeeth: 28, offset: .91, look: { gears: 2, laps: 3, tail: .4, rays: 24, echoes: 2, mechanism: .6, flow: 2, shake: 1.3 }, sound: { root: 55, scale: 'minor' } },
  { id: '02-amber-relic', number: 2, title: 'Amber Relic', group: 'fire', paletteId: 'amber-relic', effectId: 'molten-splash', effectName: 'Molten Splash', outerTeeth: 96, innerTeeth: 36, offset: .84, look: { gears: 3, laps: 2, tail: .4, rays: 12, echoes: 1, mechanism: .75, flow: 1.5, chroma: 1.6 }, sound: { root: 49, scale: 'phrygian' } },
  { id: '03-ember-crown', number: 3, title: 'Ember Crown', group: 'fire', paletteId: 'ember-crown', effectId: 'flame-corona', effectName: 'Flame Corona', outerTeeth: 96, innerTeeth: 40, offset: .98, look: { gears: 0, laps: 2, fx: .55, tail: .35, rays: 36, echoes: 2, mechanism: .5, flow: 2.5, shake: 1.4 }, sound: { root: 58.27, scale: 'minor' } },
  { id: '04-glacial-sigil', number: 4, title: 'Glacial Sigil', group: 'tide', paletteId: 'glacial-sigil', effectId: 'crystal-dust', effectName: 'Crystal Dust', outerTeeth: 96, innerTeeth: 56, offset: .92, look: { gears: 0, laps: 2, tail: .3, rays: 0, echoes: 2, mechanism: .35, drift: 1, chroma: 3.2 }, sound: { root: 65.41, scale: 'lydian' } },
  { id: '05-tidal-orbit', number: 5, title: 'Tidal Orbit', group: 'tide', paletteId: 'tidal-orbit', effectId: 'ripple', effectName: 'Tidal Ripples', outerTeeth: 96, innerTeeth: 60, offset: .68, look: { gears: 4, laps: 2, tail: .35, rays: 0, echoes: 3, spin: -1, mechanism: .4, drift: 1, flow: 1.5 }, sound: { root: 61.74, scale: 'dorian' } },
  { id: '06-verdant-alchemy', number: 6, title: 'Verdant Alchemy', group: 'tide', paletteId: 'verdant-alchemy', effectId: 'fireflies', effectName: 'Alchemy Fireflies', outerTeeth: 96, innerTeeth: 44, offset: .96, look: { gears: 3, laps: 2, tail: .3, rays: 16, echoes: 1, mechanism: .5, flow: 2 }, sound: { root: 55, scale: 'lydian' } },
  { id: '07-void-ritual', number: 7, title: 'Void Ritual', group: 'arcana', paletteId: 'void-ritual', effectId: 'lightning', effectName: 'Arc Lightning', outerTeeth: 96, innerTeeth: 45, offset: .92, look: { gears: 0, laps: 1, tail: .2, rays: 32, echoes: 1, mechanism: .4, chroma: 3.4, shake: 1.7 }, sound: { root: 46.25, scale: 'phrygian' } },
  { id: '08-ultraviolet', number: 8, title: 'Ultraviolet', group: 'arcana', paletteId: 'ultraviolet', effectId: 'plasma', effectName: 'Violet Plasma', outerTeeth: 96, innerTeeth: 54, offset: .76, look: { gears: 2, laps: 2, tail: .3, rays: 0, echoes: 2, mechanism: .3, flow: 3, chroma: 2.8 }, sound: { root: 51.91, scale: 'minor' } },
  { id: '09-rose-nebula', number: 9, title: 'Rose Nebula', group: 'arcana', paletteId: 'rose-nebula', effectId: 'stardust', effectName: 'Nebula Stardust', outerTeeth: 96, innerTeeth: 66, offset: .88, look: { gears: 4, laps: 2, tail: .3, rays: 18, echoes: 2, mechanism: .4, drift: 1, spin: -1 }, sound: { root: 58.27, scale: 'dorian' } },
].map(preset => Object.freeze(preset)));

export function videoPresetById(id) {
  const preset = VIDEO_PRESETS.find(item => item.id === id);
  if (!preset) throw new RangeError(`Unknown video preset: ${id}`);
  return preset;
}
