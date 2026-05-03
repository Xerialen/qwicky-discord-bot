// vitest globals are enabled in vitest.config.js (describe, it, expect)
// Source uses CommonJS but vitest handles the interop
import { extractUrls } from '../../src/utils/parseUrl.js';

describe('extractUrls', () => {
  describe('standard /game/{id} URLs', () => {
    it('extracts gameId from a /game/ URL', () => {
      const result = extractUrls('https://hub.quakeworld.nu/game/12345');
      expect(result).toHaveLength(1);
      expect(result[0].gameId).toBe('12345');
      expect(result[0].url).toContain('hub.quakeworld.nu/game/12345');
    });

    it('extracts gameId from a URL without https://', () => {
      const result = extractUrls('hub.quakeworld.nu/game/99999');
      expect(result).toHaveLength(1);
      expect(result[0].gameId).toBe('99999');
    });
  });

  describe('QTV /qtv/{id} URLs', () => {
    it('extracts gameId from a /qtv/ URL', () => {
      const result = extractUrls('https://hub.quakeworld.nu/qtv/54321');
      expect(result).toHaveLength(1);
      expect(result[0].gameId).toBe('54321');
    });
  });

  describe('/games?gameId={id} query param URLs', () => {
    it('extracts gameId from query parameter', () => {
      const result = extractUrls('https://hub.quakeworld.nu/games?gameId=67890');
      expect(result).toHaveLength(1);
      expect(result[0].gameId).toBe('67890');
    });

    it('extracts gameId from /games/ with trailing slash', () => {
      const result = extractUrls('https://hub.quakeworld.nu/games/?gameId=11111');
      expect(result).toHaveLength(1);
      expect(result[0].gameId).toBe('11111');
    });
  });

  describe('multiple URLs in one message', () => {
    it('extracts all URLs from a message with multiple links', () => {
      const text = `Check these games:
        https://hub.quakeworld.nu/game/111
        https://hub.quakeworld.nu/game/222
        https://hub.quakeworld.nu/qtv/333`;
      const result = extractUrls(text);
      expect(result).toHaveLength(3);
      expect(result[0].gameId).toBe('111');
      expect(result[1].gameId).toBe('222');
      expect(result[2].gameId).toBe('333');
    });

    it('handles mixed URL formats', () => {
      const text = 'hub.quakeworld.nu/game/1 and hub.quakeworld.nu/games?gameId=2';
      const result = extractUrls(text);
      expect(result).toHaveLength(2);
      expect(result[0].gameId).toBe('1');
      expect(result[1].gameId).toBe('2');
    });
  });

  describe('messages with no URLs', () => {
    it('returns empty array for plain text', () => {
      expect(extractUrls('just a regular message')).toEqual([]);
    });

    it('returns empty array for empty string', () => {
      expect(extractUrls('')).toEqual([]);
    });

    it('returns empty array for non-hub URLs', () => {
      expect(extractUrls('https://google.com/game/123')).toEqual([]);
    });
  });

  describe('URLs embedded in other text', () => {
    it('extracts URL surrounded by text', () => {
      const text = 'gg wp https://hub.quakeworld.nu/game/42 was a close one';
      const result = extractUrls(text);
      expect(result).toHaveLength(1);
      expect(result[0].gameId).toBe('42');
    });

    it('extracts URL from Discord-style markdown', () => {
      const text = 'Results: <https://hub.quakeworld.nu/game/42>';
      const result = extractUrls(text);
      expect(result).toHaveLength(1);
      expect(result[0].gameId).toBe('42');
    });
  });
});
