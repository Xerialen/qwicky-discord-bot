// TC-10.23: Discovery scheduler checks cron
// Tests that checkAndRunDiscovery respects the hour gate (22:00 UTC),
// schedule type (daily/twice-weekly/weekly/manual), and calls the discovery API.

let checkAndRunDiscovery;
let spyFrom;

// Build a chainable Supabase query that resolves at .then() time.
function makeChain(result) {
  const chain = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

function makeDataChain(data, error = null) {
  return makeChain({ data, error });
}

beforeEach(() => {
  vi.resetModules();

  const supabaseModule = require('../services/supabase');
  spyFrom = vi.spyOn(supabaseModule.supabase, 'from');

  ({ checkAndRunDiscovery } = require('../services/discoveryScheduler'));

  // Mock global fetch used for the discovery API call
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
  delete global.fetch;
});

describe('checkAndRunDiscovery', () => {
  it('returns early without querying DB when hour is not 22', async () => {
    // Simulate 10:00 UTC — not the discovery hour
    vi.spyOn(Date.prototype, 'getUTCHours').mockReturnValue(10);
    vi.spyOn(Date.prototype, 'getUTCDay').mockReturnValue(0);

    await checkAndRunDiscovery();

    expect(spyFrom).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('queries tournaments when hour is 22', async () => {
    vi.spyOn(Date.prototype, 'getUTCHours').mockReturnValue(22);
    vi.spyOn(Date.prototype, 'getUTCDay').mockReturnValue(0); // Sunday

    spyFrom.mockReturnValue(makeDataChain([])); // no tournaments

    await checkAndRunDiscovery();

    expect(spyFrom).toHaveBeenCalledWith('tournaments');
  });

  it('skips tournament with discovery.enabled = false', async () => {
    vi.spyOn(Date.prototype, 'getUTCHours').mockReturnValue(22);
    vi.spyOn(Date.prototype, 'getUTCDay').mockReturnValue(0);

    const tournaments = [
      { id: 't1', settings: { discovery: { enabled: false, schedule: 'daily' } } },
    ];
    spyFrom.mockReturnValue(makeDataChain(tournaments));

    await checkAndRunDiscovery();

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('skips tournament with manual schedule', async () => {
    vi.spyOn(Date.prototype, 'getUTCHours').mockReturnValue(22);
    vi.spyOn(Date.prototype, 'getUTCDay').mockReturnValue(0);

    const tournaments = [
      { id: 't1', settings: { discovery: { enabled: true, schedule: 'manual' } } },
    ];
    spyFrom.mockReturnValue(makeDataChain(tournaments));

    await checkAndRunDiscovery();

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('runs daily schedule on any day of week', async () => {
    vi.spyOn(Date.prototype, 'getUTCHours').mockReturnValue(22);
    vi.spyOn(Date.prototype, 'getUTCDay').mockReturnValue(2); // Tuesday

    const tournaments = [
      { id: 't1', settings: { discovery: { enabled: true, schedule: 'daily' } } },
    ];
    spyFrom.mockReturnValue(makeDataChain(tournaments));
    global.fetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        candidatesFound: 2,
        posted: 1,
        autoImported: 0,
        skippedDuplicates: 1,
      }),
    });

    await checkAndRunDiscovery();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/discord?action=run-discovery'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('runs weekly schedule only on Sunday (day 0)', async () => {
    vi.spyOn(Date.prototype, 'getUTCHours').mockReturnValue(22);
    vi.spyOn(Date.prototype, 'getUTCDay').mockReturnValue(2); // Tuesday — wrong day

    const tournaments = [
      { id: 't1', settings: { discovery: { enabled: true, schedule: 'weekly' } } },
    ];
    spyFrom.mockReturnValue(makeDataChain(tournaments));

    await checkAndRunDiscovery();

    // Tuesday is not Sunday — should be skipped
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('runs weekly schedule on Sunday', async () => {
    vi.spyOn(Date.prototype, 'getUTCHours').mockReturnValue(22);
    vi.spyOn(Date.prototype, 'getUTCDay').mockReturnValue(0); // Sunday

    const tournaments = [
      { id: 't1', settings: { discovery: { enabled: true, schedule: 'weekly' } } },
    ];
    spyFrom.mockReturnValue(makeDataChain(tournaments));
    global.fetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        candidatesFound: 0,
        posted: 0,
        autoImported: 0,
        skippedDuplicates: 0,
      }),
    });

    await checkAndRunDiscovery();

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('runs twice-weekly schedule on Wednesday (day 3) and Sunday (day 0)', async () => {
    vi.spyOn(Date.prototype, 'getUTCHours').mockReturnValue(22);
    vi.spyOn(Date.prototype, 'getUTCDay').mockReturnValue(3); // Wednesday

    const tournaments = [
      { id: 't1', settings: { discovery: { enabled: true, schedule: 'twice-weekly' } } },
    ];
    spyFrom.mockReturnValue(makeDataChain(tournaments));
    global.fetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        candidatesFound: 1,
        posted: 0,
        autoImported: 0,
        skippedDuplicates: 0,
      }),
    });

    await checkAndRunDiscovery();

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('handles fetch errors gracefully without throwing', async () => {
    vi.spyOn(Date.prototype, 'getUTCHours').mockReturnValue(22);
    vi.spyOn(Date.prototype, 'getUTCDay').mockReturnValue(0);

    const tournaments = [
      { id: 't1', settings: { discovery: { enabled: true, schedule: 'daily' } } },
    ];
    spyFrom.mockReturnValue(makeDataChain(tournaments));
    global.fetch.mockRejectedValue(new Error('Network error'));

    await expect(checkAndRunDiscovery()).resolves.toBeUndefined();
  });
});
