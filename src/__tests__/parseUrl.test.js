const { extractUrls } = require('../utils/parseUrl');

describe('extractUrls', () => {
  it('returns empty array for empty string', () => {
    expect(extractUrls('')).toEqual([]);
  });

  it('returns empty array for text with no hub URLs', () => {
    expect(extractUrls('check out this link: https://example.com/game/42')).toEqual([]);
  });

  it('extracts /game/{id} format', () => {
    const result = extractUrls('hub.quakeworld.nu/game/12345');
    expect(result).toEqual([{ url: 'hub.quakeworld.nu/game/12345', gameId: '12345' }]);
  });

  it('extracts /qtv/{id} format', () => {
    const result = extractUrls('hub.quakeworld.nu/qtv/99');
    expect(result).toEqual([{ url: 'hub.quakeworld.nu/qtv/99', gameId: '99' }]);
  });

  it('extracts /games?gameId={id} format', () => {
    const result = extractUrls('hub.quakeworld.nu/games?gameId=777');
    expect(result).toEqual([{ url: 'hub.quakeworld.nu/games?gameId=777', gameId: '777' }]);
  });

  it('extracts /games/?gameId={id} format', () => {
    const result = extractUrls('hub.quakeworld.nu/games/?gameId=888');
    expect(result).toEqual([{ url: 'hub.quakeworld.nu/games/?gameId=888', gameId: '888' }]);
  });

  it('extracts URL embedded in a sentence', () => {
    const result = extractUrls('great game! https://hub.quakeworld.nu/game/555 gg');
    expect(result).toHaveLength(1);
    expect(result[0].gameId).toBe('555');
  });

  it('extracts multiple URLs from one message', () => {
    const text =
      'map1: hub.quakeworld.nu/game/1 map2: hub.quakeworld.nu/game/2 map3: hub.quakeworld.nu/qtv/3';
    const result = extractUrls(text);
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.gameId)).toEqual(['1', '2', '3']);
  });

  it('is idempotent across multiple calls (regex state reset)', () => {
    const text = 'hub.quakeworld.nu/game/42';
    expect(extractUrls(text)).toHaveLength(1);
    expect(extractUrls(text)).toHaveLength(1);
    expect(extractUrls(text)).toHaveLength(1);
  });

  it('does not match other quakeworld.nu paths', () => {
    expect(extractUrls('hub.quakeworld.nu/players/123')).toEqual([]);
    expect(extractUrls('hub.quakeworld.nu/tournaments')).toEqual([]);
  });
});
