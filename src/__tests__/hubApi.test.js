const { fetchGameData } = require('../services/hubApi');

describe('fetchGameData', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  const makeHubResponse = (data, ok = true) => ({
    ok,
    status: ok ? 200 : 404,
    json: vi.fn().mockResolvedValue(data),
  });

  const makeStatsResponse = (data, ok = true) => ({
    ok,
    status: ok ? 200 : 404,
    json: vi.fn().mockResolvedValue(data),
  });

  const validGame = {
    id: '123',
    demo_sha256: 'abc123def456ghij',
  };
  const statsData = { teams: ['alpha', 'beta'], map: 'dm2' };

  it('returns ktxstats JSON on successful fetch', async () => {
    fetchMock
      .mockResolvedValueOnce(makeHubResponse([validGame]))
      .mockResolvedValueOnce(makeStatsResponse(statsData));
    const result = await fetchGameData('123');
    expect(result).toEqual(statsData);
  });

  it('builds stats URL from first 3 chars of demo_sha256', async () => {
    fetchMock
      .mockResolvedValueOnce(makeHubResponse([validGame]))
      .mockResolvedValueOnce(makeStatsResponse(statsData));
    await fetchGameData('123');
    const statsUrl = fetchMock.mock.calls[1][0];
    expect(statsUrl).toBe('https://d.quake.world/abc/abc123def456ghij.mvd.ktxstats.json');
  });

  it('throws when hub DB response is not ok', async () => {
    fetchMock.mockResolvedValueOnce(makeHubResponse(null, false));
    await expect(fetchGameData('999')).rejects.toThrow('Hub DB returned 404 for game 999');
  });

  it('throws when game is not found (empty array)', async () => {
    fetchMock.mockResolvedValueOnce(makeHubResponse([]));
    await expect(fetchGameData('999')).rejects.toThrow('Game 999 not found');
  });

  it('uses demo_source_url as fallback when no demo_sha256', async () => {
    const game = { id: '123', demo_source_url: 'https://example.com/demo.mvd.ktxstats.json' };
    fetchMock
      .mockResolvedValueOnce(makeHubResponse([game]))
      .mockResolvedValueOnce(makeStatsResponse(statsData));
    await fetchGameData('123');
    expect(fetchMock.mock.calls[1][0]).toBe('https://example.com/demo.mvd.ktxstats.json');
  });

  it('uses game.url as fallback when no sha256 or demo_source_url', async () => {
    const game = { id: '123', url: 'https://example.com/game.json' };
    fetchMock
      .mockResolvedValueOnce(makeHubResponse([game]))
      .mockResolvedValueOnce(makeStatsResponse(statsData));
    await fetchGameData('123');
    expect(fetchMock.mock.calls[1][0]).toBe('https://example.com/game.json');
  });

  it('throws when no demo path exists on the game record', async () => {
    const game = { id: '123' };
    fetchMock.mockResolvedValueOnce(makeHubResponse([game]));
    await expect(fetchGameData('123')).rejects.toThrow('No demo path found for game 123');
  });

  it('throws when stats fetch returns non-ok status', async () => {
    fetchMock
      .mockResolvedValueOnce(makeHubResponse([validGame]))
      .mockResolvedValueOnce({ ok: false, status: 404 });
    await expect(fetchGameData('123')).rejects.toThrow('Stats fetch failed (404) for game 123');
  });

  it('includes Authorization header in hub DB request', async () => {
    fetchMock
      .mockResolvedValueOnce(makeHubResponse([validGame]))
      .mockResolvedValueOnce(makeStatsResponse(statsData));
    await fetchGameData('123');
    const hubCallOptions = fetchMock.mock.calls[0][1];
    expect(hubCallOptions.headers).toHaveProperty('apikey');
    expect(hubCallOptions.headers).toHaveProperty('Authorization');
  });
});
