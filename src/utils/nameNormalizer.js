// src/utils/nameNormalizer.js (CommonJS)
// Port of qwicky/src/utils/nameNormalizer.js for use in the Discord bot.
// THIS FILE MUST STAY IN SYNC WITH qwicky/src/utils/nameNormalizer.js
//
// Stages 1-4 match the frontend exactly. Stages 5-7 (leet, clan tags) are
// included for completeness but not used by the bot directly.

// ── Stage 1: QW color code stripping ─────────────────────────────────────────
// Matches ^0-^9, ^a-^z, ^A-^Z, AND extended ^{hex3} codes.
const QW_COLOR_REGEX = /\^[0-9a-zA-Z]|\^\{[0-9a-fA-F]{3}\}/g;

// ── Stage 2: Quake character table (all 256 byte values) ─────────────────────
// From quakeworld/quake_text charset.rs — the authoritative 256-char lookup.
// Bytes 0-127 are the base charset; 128-255 are their high-bit (brown) mirrors.
// prettier-ignore
const QW_ASCII_TABLE = '________________[]0123456789____ !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_\'abcdefghijklmnopqrstuvwxyz{|}~_________________[]0123456789____ !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_\'abcdefghijklmnopqrstuvwxyz{|}~_';

function stripColorCodes(name) {
  if (typeof name !== 'string') return '';
  return name.replace(QW_COLOR_REGEX, '');
}

function normalizeHighBit(name) {
  if (typeof name !== 'string') return name;
  return [...name]
    .map((c) => {
      const code = c.charCodeAt(0);
      return code < 256 ? QW_ASCII_TABLE[code] : c;
    })
    .join('');
}

function normalizeDiacritics(name) {
  if (typeof name !== 'string') return name;
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Stage 4: Strip decorators.
 * xXnameXx → name, .name. → name, _name_ → name.
 */
function stripDecorators(name) {
  if (typeof name !== 'string') return name;
  return name
    .replace(/^[xX]{2,}([^xX].+[^xX])[xX]{2,}$/, '$1')
    .replace(/^_+|_+$/g, '')
    .replace(/^\.+|\.+$/g, '')
    .trim();
}

/**
 * Display-safe clean: strips color codes + decodes high-bit chars.
 * Does NOT lowercase — suitable for display in Discord embeds.
 */
function cleanName(name) {
  if (typeof name !== 'string') return String(name || '');
  return normalizeHighBit(stripColorCodes(name)).trim();
}

/**
 * Full normalization for matching (stages 1-4 + lowercase).
 * Identical to the frontend's normalize() function.
 */
function normalize(rawName) {
  if (typeof rawName !== 'string') return '';
  let name = stripColorCodes(rawName);
  name = normalizeHighBit(name);
  name = normalizeDiacritics(name);
  name = stripDecorators(name);
  return name.toLowerCase().trim();
}

module.exports = {
  stripColorCodes,
  normalizeHighBit,
  normalizeDiacritics,
  stripDecorators,
  cleanName,
  normalize,
};
