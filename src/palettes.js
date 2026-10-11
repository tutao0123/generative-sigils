// Shared by the live canvas, artwork export and deterministic video renderer.
function tint(hex, amount = .58) {
  const rgb = hex.match(/[a-f\d]{2}/gi).map(channel => parseInt(channel, 16));
  return `#${rgb.map(channel => Math.round(channel + (255 - channel) * amount).toString(16).padStart(2, '0')).join('')}`;
}

function rgba(hex, alpha) {
  return `rgba(${hex.match(/[a-f\d]{2}/gi).map(channel => parseInt(channel, 16)).join(',')},${alpha})`;
}

function theme(id, name, group, colors, glowColor, background, amber = '#ffc568') {
  return Object.freeze({
    id, name, group,
    colors: Object.freeze(colors), pale: Object.freeze(colors.map(color => tint(color))),
    glowColor, penGlow: colors[3], background,
    aura: Object.freeze([rgba(glowColor, .10), rgba(colors[4], .05), rgba(colors[4], 0)]),
    amber, accent: colors[2],
  });
}

export const DEFAULT_PALETTE = Object.freeze({
  id: 'spectrum', name: 'Neon Spectrum', group: 'Original',
  colors: Object.freeze(['#ffe46b', '#ffb13f', '#ff5f70', '#f346c3', '#a677ff', '#72e5ff']),
  pale: Object.freeze(['#fff2b0', '#ffe0a8', '#ffb9b2', '#ffb8ed', '#d4c7ff', '#c3f8ff']),
  glowColor: '#fc44a6', penGlow: '#ff66c4', background: '#100b15',
  aura: Object.freeze(['rgba(148,42,104,.09)', 'rgba(117,55,174,.045)', 'rgba(117,55,174,0)']),
  amber: '#ffc568', accent: '#ff5f70',
});

export const PALETTES = Object.freeze([
  DEFAULT_PALETTE,
  theme('solar-flare', 'Solar Flare', 'Fire', ['#fff9ab', '#fff06b', '#ffc23b', '#ff8e36', '#ff5d39', '#ff3759'], '#ff6735', '#150d08', '#ffdb7a'),
  theme('amber-relic', 'Amber Relic', 'Fire', ['#fff2c2', '#ffdb8a', '#ffc257', '#e69b36', '#d96b37', '#ff9664'], '#ffb23c', '#120d07', '#ffd58a'),
  theme('ember-crown', 'Ember Crown', 'Fire', ['#ffe878', '#ffa44e', '#ff663e', '#ff3459', '#f02682', '#ff90a0'], '#ff3759', '#160910', '#ffc568'),
  theme('glacial-sigil', 'Glacial Sigil', 'Tide', ['#f4feff', '#bdffff', '#62f4ed', '#3bd9ff', '#568dff', '#b9c4ff'], '#35caff', '#071017', '#c6f2ff'),
  theme('tidal-orbit', 'Tidal Orbit', 'Tide', ['#b3ffe0', '#58ffc0', '#20d9c2', '#35a7e8', '#6575ff', '#a9bcff'], '#23d7ce', '#071313', '#a5f5d9'),
  theme('verdant-alchemy', 'Verdant Alchemy', 'Tide', ['#ffff9b', '#d5ff52', '#91f93c', '#39de77', '#32cbb1', '#91f3d6'], '#8bff41', '#0b1309', '#d8ef8b'),
  theme('void-ritual', 'Void Ritual', 'Arcana', ['#ffda98', '#f3a9ff', '#e85bff', '#a83aff', '#6646f5', '#7fa0ff'], '#bf3cff', '#100917', '#e5b9ff'),
  theme('ultraviolet', 'Ultraviolet', 'Arcana', ['#e6f0ff', '#b0c5ff', '#7b83ff', '#8754ff', '#bc49ed', '#f68dff'], '#7c58ff', '#0b0b18', '#c8c5ff'),
  theme('rose-nebula', 'Rose Nebula', 'Arcana', ['#fff0b5', '#ffbdb8', '#ff79ad', '#f444b5', '#ca63ef', '#e6aeff'], '#ff4ab8', '#160b15', '#ffccb9'),
]);

export function paletteById(id) {
  const palette = PALETTES.find(item => item.id === id);
  if (!palette) throw new RangeError(`Unknown palette: ${id}`);
  return palette;
}
