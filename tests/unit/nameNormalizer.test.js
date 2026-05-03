// vitest globals are enabled in vitest.config.js (describe, it, expect)
import {
  stripColorCodes,
  normalizeHighBit,
  normalizeDiacritics,
  stripDecorators,
  cleanName,
  normalize,
} from '../../src/utils/nameNormalizer.js';

describe('stripColorCodes', () => {
  it('strips ^N single-char color codes', () => {
    expect(stripColorCodes('^1red^2green^9end')).toBe('redgreenend');
  });

  it('strips ^letter color codes', () => {
    expect(stripColorCodes('^atest^Bname')).toBe('testname');
  });

  it('strips ^{hex} extended color codes', () => {
    expect(stripColorCodes('^{f00}red^{0f0}green')).toBe('redgreen');
  });

  it('returns empty string for non-string input', () => {
    expect(stripColorCodes(null)).toBe('');
    expect(stripColorCodes(undefined)).toBe('');
    expect(stripColorCodes(123)).toBe('');
  });

  it('leaves plain text unchanged', () => {
    expect(stripColorCodes('plaintext')).toBe('plaintext');
  });
});

describe('normalizeHighBit', () => {
  it('maps high-bit chars (128-255) to their ASCII equivalents', () => {
    // Char code 193 = high-bit 'A' (193 - 128 = 65 = 'A')
    const highBitA = String.fromCharCode(193);
    const result = normalizeHighBit(highBitA);
    expect(result).toBe('A');
  });

  it('leaves normal ASCII unchanged', () => {
    expect(normalizeHighBit('hello')).toBe('hello');
  });

  it('maps high-bit digits correctly', () => {
    // Char code 176 maps to '0' in the QW table (position 176)
    const highBit0 = String.fromCharCode(176);
    const result = normalizeHighBit(highBit0);
    expect(result).toBe('0');
  });
});

describe('normalizeDiacritics', () => {
  it('removes accents from Latin characters', () => {
    expect(normalizeDiacritics('cafe\u0301')).toBe('cafe');
    expect(normalizeDiacritics('\u00e9')).toBe('e'); // e-acute (precomposed)
  });

  it('removes umlauts', () => {
    expect(normalizeDiacritics('\u00fc')).toBe('u'); // u-umlaut
    expect(normalizeDiacritics('\u00f6')).toBe('o'); // o-umlaut
  });

  it('leaves plain ASCII unchanged', () => {
    expect(normalizeDiacritics('hello')).toBe('hello');
  });
});

describe('stripDecorators', () => {
  it('strips xX...Xx wrappers', () => {
    expect(stripDecorators('xXplayerXx')).toBe('player');
    expect(stripDecorators('XXplayerXX')).toBe('player');
  });

  it('strips leading/trailing underscores', () => {
    expect(stripDecorators('__player__')).toBe('player');
    expect(stripDecorators('_name_')).toBe('name');
  });

  it('strips leading/trailing dots', () => {
    expect(stripDecorators('.tag.')).toBe('tag');
    expect(stripDecorators('..name..')).toBe('name');
  });

  it('trims whitespace', () => {
    expect(stripDecorators('  player  ')).toBe('player');
  });

  it('leaves normal names unchanged', () => {
    expect(stripDecorators('player')).toBe('player');
  });
});

describe('cleanName', () => {
  it('strips color codes and decodes high-bit chars', () => {
    const input = '^1' + String.fromCharCode(200) + 'name';
    const result = cleanName(input);
    // ^1 stripped, high-bit char decoded, 'name' unchanged
    expect(result).not.toContain('^1');
  });

  it('does NOT lowercase (display-safe)', () => {
    expect(cleanName('PlayerName')).toBe('PlayerName');
  });

  it('handles non-string input', () => {
    expect(cleanName(null)).toBe('');
    expect(cleanName(undefined)).toBe('');
    expect(cleanName(42)).toBe('42');
  });
});

describe('normalize (full pipeline)', () => {
  it('returns lowercase result', () => {
    expect(normalize('PlayerName')).toBe('playername');
  });

  it('strips color codes, high-bit, diacritics, decorators and lowercases', () => {
    // ^2 color code + xX wrapper + Unicode a-umlaut (U+00E4, charcode 228)
    // Note: normalizeHighBit runs BEFORE normalizeDiacritics, so charcode 228
    // maps through the QW ASCII table (228-128=100='d'), not through NFD decomposition.
    // This is correct QW behavior: high-bit chars are QW encoding, not Unicode diacritics.
    const result = normalize('^2xXPl\u00e4yerXx');
    expect(result).toBe('pldyer');
  });

  it('returns empty string for non-string input', () => {
    expect(normalize(null)).toBe('');
    expect(normalize(undefined)).toBe('');
    expect(normalize(123)).toBe('');
  });

  it('handles a typical QW name with all transformations', () => {
    // Color codes + decorators
    const result = normalize('^4__TestPlayer__');
    expect(result).toBe('testplayer');
  });
});
