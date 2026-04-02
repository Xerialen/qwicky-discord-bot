// TC-10.22: Daily reminder generation
// Tests that generateDailyNotifications queries registered channels,
// groups by tournament, and enqueues game-day reminders based on settings.

let generateDailyNotifications;
let spyFrom;

// Build a chainable Supabase query that resolves with `result` at .then() time.
// Supports: .select().eq().single() and .select() (array result).
function makeChain(result) {
  const chain = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(result);
  chain.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

// Convenience: build a chain that resolves with { data, error } when awaited.
function makeDataChain(data, error = null) {
  return makeChain({ data, error });
}

beforeEach(() => {
  vi.resetModules();

  const supabaseModule = require('../services/supabase');
  spyFrom = vi.spyOn(supabaseModule.supabase, 'from');

  ({ generateDailyNotifications } = require('../services/dailyReminders'));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('generateDailyNotifications', () => {
  it('returns early when there are no registered channels', async () => {
    spyFrom.mockReturnValue(makeDataChain([]));

    await generateDailyNotifications('2026-04-02');

    // Only one supabase.from() call for tournament_channels
    expect(spyFrom).toHaveBeenCalledTimes(1);
    expect(spyFrom).toHaveBeenCalledWith('tournament_channels');
  });

  it('returns early when channel query fails', async () => {
    spyFrom.mockReturnValue(makeDataChain(null, new Error('DB error')));

    await generateDailyNotifications('2026-04-02');

    // Stops after the error — no tournament or match queries
    expect(spyFrom).toHaveBeenCalledTimes(1);
  });

  it('queries tournament settings for each tournament found in channels', async () => {
    const channels = [
      { tournament_id: 'qwi-2025', discord_channel_id: 'chan1' },
      { tournament_id: 'qwi-2025', discord_channel_id: 'chan2' },
    ];

    const tournamentSettings = {
      settings: {
        discord: { gameDayReminders: { enabled: false } },
      },
    };

    spyFrom
      .mockReturnValueOnce(makeDataChain(channels)) // tournament_channels
      .mockReturnValueOnce(makeDataChain(tournamentSettings)); // tournaments

    await generateDailyNotifications('2026-04-02');

    expect(spyFrom).toHaveBeenCalledWith('tournaments');
  });

  it('enqueues game-day reminders when gameDayReminders.enabled is true', async () => {
    const channels = [{ tournament_id: 'qwi-2025', discord_channel_id: 'chan1' }];

    const tournamentData = {
      settings: {
        discord: { gameDayReminders: { enabled: true } },
      },
    };

    const todayMatches = [
      {
        team1: 'Alpha',
        team2: 'Beta',
        match_date: '2026-04-02',
        match_time: '20:00',
        best_of: 3,
        round: 'group',
        group: 'A',
        round_num: 1,
        division_id: null,
      },
    ];

    spyFrom
      .mockReturnValueOnce(makeDataChain(channels)) // tournament_channels
      .mockReturnValueOnce(makeDataChain(tournamentData)) // tournaments.single()
      .mockReturnValueOnce(makeDataChain(todayMatches)) // matches (today)
      .mockReturnValueOnce(makeDataChain(null)); // discord_notifications insert

    await generateDailyNotifications('2026-04-02');

    // Should have queried matches for today's date
    expect(spyFrom).toHaveBeenCalledWith('matches');
  });

  it('does not enqueue game-day reminders when settings are disabled', async () => {
    const channels = [{ tournament_id: 'qwi-2025', discord_channel_id: 'chan1' }];

    const tournamentData = {
      settings: {
        discord: {
          gameDayReminders: { enabled: false },
          unscheduledAlerts: { enabled: false },
          adminAlerts: { enabled: false },
        },
      },
    };

    spyFrom
      .mockReturnValueOnce(makeDataChain(channels))
      .mockReturnValueOnce(makeDataChain(tournamentData));

    await generateDailyNotifications('2026-04-02');

    // Only 2 from() calls: tournament_channels + tournaments
    // No matches or notifications queries
    expect(spyFrom).toHaveBeenCalledTimes(2);
  });

  it('groups channels by tournament correctly', async () => {
    const channels = [
      { tournament_id: 'qwi-2025', discord_channel_id: 'chan1' },
      { tournament_id: 'qwi-2026', discord_channel_id: 'chan2' },
      { tournament_id: 'qwi-2025', discord_channel_id: 'chan3' }, // second channel for qwi-2025
    ];

    const disabledSettings = {
      settings: {
        discord: {
          gameDayReminders: { enabled: false },
          unscheduledAlerts: { enabled: false },
          adminAlerts: { enabled: false },
        },
      },
    };

    // One call per unique tournament
    spyFrom
      .mockReturnValueOnce(makeDataChain(channels))
      .mockReturnValueOnce(makeDataChain(disabledSettings)) // qwi-2025
      .mockReturnValueOnce(makeDataChain(disabledSettings)); // qwi-2026

    await generateDailyNotifications('2026-04-02');

    // tournament_channels (1) + 2x tournaments = 3 from() calls
    expect(spyFrom).toHaveBeenCalledTimes(3);
  });
});
