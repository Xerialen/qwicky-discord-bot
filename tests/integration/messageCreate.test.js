// vitest globals are enabled in vitest.config.js (describe, it, expect, vi, beforeEach)
//
// The source uses CJS require() which doesn't get intercepted by vitest's ESM
// vi.mock(). We patch the CJS require cache directly instead.

import { vi, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src');

// -- Define mock functions --------------------------------------------------

const mockGetChannelRegistration = vi.fn();
const mockInsertSubmission = vi.fn();
const mockUpdateSubmissionMessageId = vi.fn();
const mockFetchGameData = vi.fn();

// Minimal EmbedBuilder stub — chain methods and store data for assertions
class FakeEmbed {
  constructor() {
    this._color = null;
    this._title = null;
    this._description = null;
    this._fields = [];
    this._footer = null;
  }
  setColor(c) { this._color = c; return this; }
  setTitle(t) { this._title = t; return this; }
  setDescription(d) { this._description = d; return this; }
  addFields(...args) {
    const fields = args.flat();
    this._fields.push(...fields);
    return this;
  }
  setFooter(f) { this._footer = f; return this; }
}

// -- Patch CJS require cache ------------------------------------------------

// Load modules so they enter the cache, then replace their exports
require(resolve(srcDir, 'services/supabase.js'));
require(resolve(srcDir, 'services/hubApi.js'));
require(resolve(srcDir, 'utils/nameNormalizer.js'));

require.cache[resolve(srcDir, 'services/supabase.js')].exports = {
  supabase: {},
  getChannelRegistration: mockGetChannelRegistration,
  insertSubmission: mockInsertSubmission,
  updateSubmissionMessageId: mockUpdateSubmissionMessageId,
};

require.cache[resolve(srcDir, 'services/hubApi.js')].exports = {
  fetchGameData: mockFetchGameData,
};

require.cache[resolve(srcDir, 'utils/nameNormalizer.js')].exports = {
  cleanName: (name) => name,
};

// Patch discord.js — only EmbedBuilder is used by messageCreate
const discordJsPath = require.resolve('discord.js');
require(discordJsPath);
require.cache[discordJsPath].exports = {
  ...require.cache[discordJsPath].exports,
  EmbedBuilder: FakeEmbed,
};

// Clear and re-require messageCreate so it picks up our patched dependencies
const messageCreatePath = resolve(srcDir, 'listeners/messageCreate.js');
delete require.cache[messageCreatePath];
const { handleMessage } = require(messageCreatePath);

// -- Helpers ----------------------------------------------------------------

function makeMessage(content, overrides = {}) {
  return {
    content,
    channelId: overrides.channelId || 'chan-123',
    author: {
      id: 'user-1',
      bot: false,
      username: 'TestUser',
      displayName: 'Test User',
      ...overrides.author,
    },
    reply: vi.fn().mockResolvedValue({ id: 'reply-msg-1' }),
    ...overrides,
  };
}

// Hub row format — teams as objects with name/frags
const SAMPLE_GAME_DATA = {
  teams: [
    { name: 'TeamA', frags: 150 },
    { name: 'TeamB', frags: 120 },
  ],
  map: 'dm3',
  mode: '4on4',
};

// -- Tests ------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('handleMessage', () => {
  describe('valid hub URL processing', () => {
    it('processes a message with a valid hub URL and inserts a submission', async () => {
      mockGetChannelRegistration.mockResolvedValue({
        tournament_id: 'tourney-1',
        division_id: 'div-1',
      });
      mockFetchGameData.mockResolvedValue(SAMPLE_GAME_DATA);
      mockInsertSubmission.mockResolvedValue({ id: 'sub-1', duplicate: false });

      const msg = makeMessage('Check this: https://hub.quakeworld.nu/game/42');
      await handleMessage(msg);

      // Should have checked channel registration
      expect(mockGetChannelRegistration).toHaveBeenCalledWith('chan-123');

      // Should have fetched game data for the extracted game ID
      expect(mockFetchGameData).toHaveBeenCalledWith('42');

      // Should have inserted the submission with correct params
      expect(mockInsertSubmission).toHaveBeenCalledWith(expect.objectContaining({
        tournamentId: 'tourney-1',
        divisionId: 'div-1',
        gameId: '42',
        hubUrl: expect.stringContaining('hub.quakeworld.nu/game/42'),
        gameData: SAMPLE_GAME_DATA,
        discordUserId: 'user-1',
        channelId: 'chan-123',
      }));

      // Should have replied with embeds
      expect(msg.reply).toHaveBeenCalledTimes(1);
      const replyCall = msg.reply.mock.calls[0][0];
      expect(replyCall.embeds).toHaveLength(1);
      expect(replyCall.embeds[0]._title).toBe('TeamA vs TeamB \u2014 dm3');

      // Should have stored the Discord message ID on the submission
      expect(mockUpdateSubmissionMessageId).toHaveBeenCalledWith('sub-1', 'reply-msg-1');
    });

    it('processes multiple hub URLs in a single message', async () => {
      mockGetChannelRegistration.mockResolvedValue({
        tournament_id: 'tourney-1',
        division_id: 'div-1',
      });
      mockFetchGameData.mockResolvedValue(SAMPLE_GAME_DATA);
      mockInsertSubmission
        .mockResolvedValueOnce({ id: 'sub-1', duplicate: false })
        .mockResolvedValueOnce({ id: 'sub-2', duplicate: false });

      const msg = makeMessage(
        'Map 1: https://hub.quakeworld.nu/game/10 Map 2: https://hub.quakeworld.nu/game/20'
      );
      await handleMessage(msg);

      expect(mockFetchGameData).toHaveBeenCalledTimes(2);
      expect(mockInsertSubmission).toHaveBeenCalledTimes(2);

      const replyCall = msg.reply.mock.calls[0][0];
      expect(replyCall.embeds).toHaveLength(2);

      // Both submissions should have their message ID updated
      expect(mockUpdateSubmissionMessageId).toHaveBeenCalledWith('sub-1', 'reply-msg-1');
      expect(mockUpdateSubmissionMessageId).toHaveBeenCalledWith('sub-2', 'reply-msg-1');
    });
  });

  describe('no URLs in message', () => {
    it('does nothing when message has no hub URLs', async () => {
      const msg = makeMessage('gg wp nice game');
      await handleMessage(msg);

      expect(mockGetChannelRegistration).not.toHaveBeenCalled();
      expect(mockFetchGameData).not.toHaveBeenCalled();
      expect(mockInsertSubmission).not.toHaveBeenCalled();
      expect(msg.reply).not.toHaveBeenCalled();
    });

    it('does nothing for non-hub URLs', async () => {
      const msg = makeMessage('Check https://google.com/game/123');
      await handleMessage(msg);

      expect(mockGetChannelRegistration).not.toHaveBeenCalled();
      expect(mockInsertSubmission).not.toHaveBeenCalled();
    });
  });

  describe('unregistered channel', () => {
    it('does nothing when channel is not registered', async () => {
      mockGetChannelRegistration.mockResolvedValue(null);

      const msg = makeMessage('https://hub.quakeworld.nu/game/42');
      await handleMessage(msg);

      expect(mockGetChannelRegistration).toHaveBeenCalledWith('chan-123');
      expect(mockFetchGameData).not.toHaveBeenCalled();
      expect(mockInsertSubmission).not.toHaveBeenCalled();
      expect(msg.reply).not.toHaveBeenCalled();
    });
  });

  describe('duplicate submission handling', () => {
    it('handles duplicate gracefully with a warning embed', async () => {
      mockGetChannelRegistration.mockResolvedValue({
        tournament_id: 'tourney-1',
        division_id: 'div-1',
      });
      mockFetchGameData.mockResolvedValue(SAMPLE_GAME_DATA);
      mockInsertSubmission.mockResolvedValue({ duplicate: true });

      const msg = makeMessage('https://hub.quakeworld.nu/game/42');
      await handleMessage(msg);

      expect(mockInsertSubmission).toHaveBeenCalledTimes(1);

      // Should still reply, but with a duplicate embed
      expect(msg.reply).toHaveBeenCalledTimes(1);
      const embeds = msg.reply.mock.calls[0][0].embeds;
      expect(embeds).toHaveLength(1);
      expect(embeds[0]._title).toContain('Duplicate');
      expect(embeds[0]._color).toBe(0xFFA500); // orange

      // Should NOT attempt to update message ID for a duplicate
      expect(mockUpdateSubmissionMessageId).not.toHaveBeenCalled();
    });

    it('handles a mix of new and duplicate submissions', async () => {
      mockGetChannelRegistration.mockResolvedValue({
        tournament_id: 'tourney-1',
        division_id: 'div-1',
      });
      mockFetchGameData.mockResolvedValue(SAMPLE_GAME_DATA);
      mockInsertSubmission
        .mockResolvedValueOnce({ id: 'sub-1', duplicate: false })
        .mockResolvedValueOnce({ duplicate: true });

      const msg = makeMessage(
        'https://hub.quakeworld.nu/game/10 https://hub.quakeworld.nu/game/20'
      );
      await handleMessage(msg);

      const embeds = msg.reply.mock.calls[0][0].embeds;
      expect(embeds).toHaveLength(2);
      // First is a success embed, second is duplicate
      expect(embeds[0]._title).toContain('TeamA vs TeamB');
      expect(embeds[1]._title).toContain('Duplicate');

      // Only the non-duplicate gets message ID update
      expect(mockUpdateSubmissionMessageId).toHaveBeenCalledTimes(1);
      expect(mockUpdateSubmissionMessageId).toHaveBeenCalledWith('sub-1', 'reply-msg-1');
    });
  });

  describe('error handling', () => {
    it('replies with an error embed when fetchGameData throws', async () => {
      mockGetChannelRegistration.mockResolvedValue({
        tournament_id: 'tourney-1',
        division_id: 'div-1',
      });
      mockFetchGameData.mockRejectedValue(new Error('Game 42 not found'));

      const msg = makeMessage('https://hub.quakeworld.nu/game/42');
      await handleMessage(msg);

      expect(msg.reply).toHaveBeenCalledTimes(1);
      const embeds = msg.reply.mock.calls[0][0].embeds;
      expect(embeds).toHaveLength(1);
      expect(embeds[0]._title).toContain('Error');
      expect(embeds[0]._color).toBe(0xFF3366);
      expect(embeds[0]._description).toBe('Game 42 not found');
    });

    it('replies with an error embed when insertSubmission throws a non-duplicate error', async () => {
      mockGetChannelRegistration.mockResolvedValue({
        tournament_id: 'tourney-1',
        division_id: 'div-1',
      });
      mockFetchGameData.mockResolvedValue(SAMPLE_GAME_DATA);
      mockInsertSubmission.mockRejectedValue(new Error('Database connection lost'));

      const msg = makeMessage('https://hub.quakeworld.nu/game/42');
      await handleMessage(msg);

      expect(msg.reply).toHaveBeenCalledTimes(1);
      const embeds = msg.reply.mock.calls[0][0].embeds;
      expect(embeds[0]._title).toContain('Error');
      expect(embeds[0]._description).toBe('Database connection lost');
    });
  });

  describe('team score extraction', () => {
    it('handles ktxstats format with players array', async () => {
      mockGetChannelRegistration.mockResolvedValue({
        tournament_id: 'tourney-1',
        division_id: 'div-1',
      });
      const ktxstatsData = {
        teams: ['alpha', 'bravo'],
        map: 'dm2',
        mode: '4on4',
        players: [
          { team: 'alpha', stats: { frags: 30 } },
          { team: 'alpha', stats: { frags: 25 } },
          { team: 'bravo', stats: { frags: 20 } },
          { team: 'bravo', stats: { frags: 18 } },
        ],
      };
      mockFetchGameData.mockResolvedValue(ktxstatsData);
      mockInsertSubmission.mockResolvedValue({ id: 'sub-1', duplicate: false });

      const msg = makeMessage('https://hub.quakeworld.nu/game/99');
      await handleMessage(msg);

      const embeds = msg.reply.mock.calls[0][0].embeds;
      expect(embeds[0]._title).toBe('alpha vs bravo \u2014 dm2');
      // Score field: 55 - 38
      const scoreField = embeds[0]._fields.find(f => f.name === 'Score');
      expect(scoreField.value).toBe('55 - 38');
    });
  });
});
