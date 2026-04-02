// In Vitest v3 CJS mode, spying on module-level exported functions does NOT
// work reliably when combined with vi.resetModules() + vi.restoreAllMocks().
// The underlying issue: vi.spyOn patches Vitest's module registry copy, but
// messageCreate's captured reference points to a different (Node-native cached)
// copy of the module. The proven fix used throughout this repo (buttonHandler,
// commands, etc.): spy on the SUPABASE CLIENT OBJECT's .from() method. The
// client object is shared across all require() paths, so the spy is always seen.
//
// fetchGameData (from hubApi) has the same CJS destructuring issue — vi.spyOn
// does NOT intercept it. Tests that call handleMessage() mock global.fetch
// directly so the real fetchGameData runs through a controlled response.
//
// discord.js is NOT mocked — the real EmbedBuilder is used and embed.data.color
// / embed.data.title are inspected directly (same pattern as buttonHandler.test.js).

let getTeamScores, handleMessage;
let spyFrom; // supabase.from spy (proven pattern from commands/buttonHandler tests)

beforeEach(() => {
  vi.resetModules();

  // Prevent unhandled rejections from supabase client's async auth refresh on createClient()
  // Include .text() and .headers because the Supabase client calls both during internal requests.
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({}),
    text: async () => '',
    headers: { get: vi.fn().mockReturnValue(null) },
  });

  // Spy on the supabase client's .from() method — intercepted by all helper functions
  // (getChannelRegistration, insertSubmission, updateSubmissionMessageId) that call
  // supabase.from() internally, regardless of how they were captured via destructuring.
  const supabaseModule = require('../services/supabase');
  spyFrom = vi.spyOn(supabaseModule.supabase, 'from');

  // Load messageCreate after spies are in place
  ({ handleMessage, getTeamScores } = require('../listeners/messageCreate'));
});

afterEach(() => {
  delete global.fetch;
  vi.restoreAllMocks();
});

describe('getTeamScores', () => {
  describe('Hub row format (teams as objects)', () => {
    it('extracts name and frags from team objects', () => {
      const gameData = {
        teams: [
          { name: 'Thunderbolts', frags: 42 },
          { name: 'Rockets', frags: 37 },
        ],
      };
      expect(getTeamScores(gameData)).toEqual({
        t1Name: 'Thunderbolts',
        t2Name: 'Rockets',
        t1Score: 42,
        t2Score: 37,
      });
    });

    it('falls back to ? when team object has no name', () => {
      const gameData = {
        teams: [{ frags: 10 }, { frags: 5 }],
      };
      const result = getTeamScores(gameData);
      expect(result.t1Name).toBe('?');
      expect(result.t2Name).toBe('?');
    });

    it('falls back to ? when team object has no frags', () => {
      const gameData = {
        teams: [{ name: 'Alpha' }, { name: 'Beta' }],
      };
      const result = getTeamScores(gameData);
      expect(result.t1Score).toBe('?');
      expect(result.t2Score).toBe('?');
    });

    it('handles missing second team gracefully', () => {
      const gameData = {
        teams: [{ name: 'Solo', frags: 20 }],
      };
      const result = getTeamScores(gameData);
      expect(result.t1Name).toBe('Solo');
      expect(result.t1Score).toBe(20);
      expect(result.t2Name).toBe('?');
      expect(result.t2Score).toBe('?');
    });
  });

  describe('ktxstats format with team_stats', () => {
    it('sums frags from team_stats', () => {
      const gameData = {
        teams: ['axemen', 'bishops'],
        team_stats: {
          axemen: { frags: 55 },
          bishops: { frags: 48 },
        },
      };
      const result = getTeamScores(gameData);
      expect(result.t1Name).toBe('axemen');
      expect(result.t2Name).toBe('bishops');
      expect(result.t1Score).toBe(55);
      expect(result.t2Score).toBe(48);
    });

    it('strips QW color codes from team names', () => {
      const gameData = {
        teams: ['^1red^0team', '^4blue^0team'],
        team_stats: {
          '^1red^0team': { frags: 30 },
          '^4blue^0team': { frags: 20 },
        },
      };
      const result = getTeamScores(gameData);
      expect(result.t1Name).toBe('redteam');
      expect(result.t2Name).toBe('blueteam');
    });

    it('falls back to ? when team_stats entry is missing', () => {
      const gameData = {
        teams: ['alpha', 'beta'],
        team_stats: {
          alpha: { frags: 10 },
          // beta missing
        },
      };
      const result = getTeamScores(gameData);
      expect(result.t1Score).toBe(10);
      expect(result.t2Score).toBe('?');
    });
  });

  describe('ktxstats format with players array', () => {
    it('sums frags per team from players with stats.frags', () => {
      const gameData = {
        teams: ['alpha', 'beta'],
        players: [
          { team: 'alpha', stats: { frags: 10 } },
          { team: 'alpha', stats: { frags: 15 } },
          { team: 'beta', stats: { frags: 8 } },
        ],
      };
      const result = getTeamScores(gameData);
      expect(result.t1Score).toBe(25);
      expect(result.t2Score).toBe(8);
    });

    it('sums frags per team from players with top-level frags field', () => {
      const gameData = {
        teams: ['alpha', 'beta'],
        players: [
          { team: 'alpha', frags: 7 },
          { team: 'beta', frags: 3 },
          { team: 'beta', frags: 9 },
        ],
      };
      const result = getTeamScores(gameData);
      expect(result.t1Score).toBe(7);
      expect(result.t2Score).toBe(12);
    });
  });

  describe('fallback when no score data', () => {
    it('returns ? for scores when no teams, team_stats, or players', () => {
      const result = getTeamScores({});
      expect(result).toEqual({ t1Name: '?', t2Name: '?', t1Score: '?', t2Score: '?' });
    });

    it('handles empty teams array', () => {
      const result = getTeamScores({ teams: [] });
      expect(result.t1Score).toBe('?');
      expect(result.t2Score).toBe('?');
    });
  });
});

// ─── TC-10.18: Duplicate submission handling ──────────────────────────────────

describe('handleMessage — duplicate submission', () => {
  const makeMessage = (content, channelId = 'chan1') => ({
    content,
    channelId,
    author: { id: 'user1', displayName: 'TestUser', username: 'testuser' },
    reply: vi.fn().mockResolvedValue({ id: 'msg-reply-1' }),
  });

  // Chain for getChannelRegistration: supabase.from().select().eq().single()
  function makeTcChain(result) {
    const c = {};
    c.select = vi.fn().mockReturnValue(c);
    c.eq = vi.fn().mockReturnValue(c);
    c.single = vi.fn().mockResolvedValue(result);
    return c;
  }

  // Chain for insertSubmission: supabase.from().insert().select().single()
  function makeMsInsertChain(result) {
    const c = {};
    c.insert = vi.fn().mockReturnValue(c);
    c.select = vi.fn().mockReturnValue(c);
    c.single = vi.fn().mockResolvedValue(result);
    return c;
  }

  beforeEach(() => {
    // spyFetchGameData cannot intercept the destructured fetchGameData in
    // messageCreate.js due to the CJS module spy limitation (see header comment).
    // Mock global.fetch instead so the real fetchGameData completes successfully.
    global.fetch = vi.fn().mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes('v1_games')) {
        const m = u.match(/id=eq\.(\d+)/);
        const id = m ? m[1] : '0';
        return {
          ok: true,
          json: async () => [{ id, demo_sha256: 'abcde12345678901234567890abcdef0' }],
        };
      }
      if (u.includes('d.quake.world')) {
        return {
          ok: true,
          json: async () => ({
            teams: [
              { name: 'Alpha', frags: 10 },
              { name: 'Beta', frags: 8 },
            ],
            map: 'dm2',
            mode: '4on4',
          }),
        };
      }
      // Default: supabase internal auth calls
      return {
        ok: true,
        json: async () => ({}),
        text: async () => '',
        headers: { get: vi.fn().mockReturnValue(null) },
      };
    });
  });

  it('creates a duplicate embed with orange color when insertSubmission returns 23505 error', async () => {
    spyFrom
      .mockReturnValueOnce(
        makeTcChain({ data: { tournament_id: 'qwi-2025', division_id: null }, error: null })
      )
      .mockReturnValueOnce(makeMsInsertChain({ data: null, error: { code: '23505' } }));

    const message = makeMessage('check https://hub.quakeworld.nu/game/12345');
    await handleMessage(message);

    expect(message.reply).toHaveBeenCalledWith(
      expect.objectContaining({ embeds: expect.any(Array) })
    );
    const replyArgs = message.reply.mock.calls[0][0];
    expect(replyArgs.embeds).toHaveLength(1);
    // Use real EmbedBuilder .data to check color and title (same pattern as buttonHandler.test.js)
    expect(replyArgs.embeds[0].data.color).toBe(0xffa500);
    expect(replyArgs.embeds[0].data.title).toBe('Game 12345 — Duplicate');
  });

  it('does not call updateSubmissionMessageId for duplicate submissions', async () => {
    spyFrom
      .mockReturnValueOnce(
        makeTcChain({ data: { tournament_id: 'qwi-2025', division_id: null }, error: null })
      )
      .mockReturnValueOnce(makeMsInsertChain({ data: null, error: { code: '23505' } }));

    const message = makeMessage('https://hub.quakeworld.nu/game/99999');
    await handleMessage(message);

    // Only 2 from() calls: tournament_channels + match_submissions insert
    // updateSubmissionMessageId would add a 3rd call — verify it wasn't made
    expect(spyFrom).toHaveBeenCalledTimes(2);
  });

  it('does nothing when channel is not registered', async () => {
    spyFrom.mockReturnValueOnce(makeTcChain({ data: null, error: { code: 'PGRST116' } }));

    const message = makeMessage('https://hub.quakeworld.nu/game/12345');
    await handleMessage(message);

    expect(message.reply).not.toHaveBeenCalled();
    expect(spyFrom).toHaveBeenCalledTimes(1);
  });
});
