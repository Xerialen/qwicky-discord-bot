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

// -- Chainable Supabase client mock -----------------------------------------

// Single mock object that persists across tests. The handler captures a
// reference to this at require() time via destructuring, so we must mutate
// it in-place rather than replacing it.
const mockSupabase = {
  from: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  in: vi.fn(),
  single: vi.fn(),
  // Per-test configuration set in beforeEach or inside each test
  _selectResult: { data: null, error: null },
  _updateResult: { error: null },
  _isUpdatePath: false,
};

// Wire up the Supabase query builder chain
function wireChain() {
  mockSupabase.from.mockImplementation(() => {
    mockSupabase._isUpdatePath = false;
    return mockSupabase;
  });
  mockSupabase.select.mockImplementation(() => mockSupabase);
  mockSupabase.update.mockImplementation(() => {
    mockSupabase._isUpdatePath = true;
    return mockSupabase;
  });
  mockSupabase.in.mockImplementation(() => mockSupabase);
  mockSupabase.eq.mockImplementation(() => {
    if (mockSupabase._isUpdatePath) {
      return mockSupabase._updateResult;
    }
    return mockSupabase;
  });
  mockSupabase.single.mockImplementation(() => Promise.resolve(mockSupabase._selectResult));
}

wireChain();

// -- Fake EmbedBuilder for discord.js ---------------------------------------

class FakeEmbed {
  constructor() {
    this._color = null;
    this._title = null;
    this._fields = [];
  }
  setColor(c) { this._color = c; return this; }
  setTitle(t) { this._title = t; return this; }
  setFields(f) { this._fields = [...f]; return this; }
  static from(existing) {
    const embed = new FakeEmbed();
    embed._color = existing._color || null;
    embed._title = existing._title || null;
    embed._fields = [...(existing.fields || existing._fields || [])];
    return embed;
  }
}

// -- Patch CJS require cache ------------------------------------------------

require(resolve(srcDir, 'services/supabase.js'));
require.cache[resolve(srcDir, 'services/supabase.js')].exports = {
  supabase: mockSupabase,
  getChannelRegistration: vi.fn(),
  insertSubmission: vi.fn(),
  updateSubmissionMessageId: vi.fn(),
};

const discordJsPath = require.resolve('discord.js');
require(discordJsPath);
require.cache[discordJsPath].exports = {
  ...require.cache[discordJsPath].exports,
  EmbedBuilder: FakeEmbed,
};

// Clear and re-require buttonHandler so it picks up our patched supabase
const buttonHandlerPath = resolve(srcDir, 'services/buttonHandler.js');
delete require.cache[buttonHandlerPath];
const { handleButtonInteraction } = require(buttonHandlerPath);

// -- Helpers ----------------------------------------------------------------

function makeInteraction(customId, overrides = {}) {
  return {
    customId,
    user: {
      username: 'AdminUser',
      displayName: 'Admin User',
    },
    memberPermissions: {
      has: vi.fn().mockReturnValue(true),
    },
    deferUpdate: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(undefined),
    message: {
      embeds: [
        {
          _color: 0xFFB300,
          _title: 'TeamA vs TeamB',
          fields: [
            { name: 'Score', value: '150 - 120', inline: true },
            { name: 'Mode', value: '4on4', inline: true },
          ],
        },
      ],
      edit: vi.fn().mockResolvedValue(undefined),
    },
    ...overrides,
  };
}

// -- Tests ------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});

  // Reset per-test state on the persistent mock object and re-wire chain
  mockSupabase._selectResult = { data: null, error: null };
  mockSupabase._updateResult = { error: null };
  mockSupabase._isUpdatePath = false;
  wireChain();
});

describe('handleButtonInteraction', () => {
  describe('approve button', () => {
    it('approves a pending submission and updates the embed to green', async () => {
      mockSupabase._selectResult = {
        data: { id: 'sub-1', status: 'pending', tournament_id: 'tourney-1', discord_channel_id: 'chan-1' },
        error: null,
      };
      mockSupabase._updateResult = { error: null };

      const interaction = makeInteraction('qwicky:approve:game-42');
      await handleButtonInteraction(interaction);

      // Should defer the update first
      expect(interaction.deferUpdate).toHaveBeenCalled();

      // Should query for the submission
      expect(mockSupabase.from).toHaveBeenCalledWith('match_submissions');

      // Should update with approved status
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'approved',
          reviewed_at: expect.any(String),
        })
      );

      // Should edit the message to remove buttons and set green color
      expect(interaction.message.edit).toHaveBeenCalledWith(
        expect.objectContaining({
          components: [],
          embeds: expect.arrayContaining([
            expect.objectContaining({ _color: 0x00C853 }),
          ]),
        })
      );
    });
  });

  describe('reject button', () => {
    it('rejects a pending submission and updates the embed to red', async () => {
      mockSupabase._selectResult = {
        data: { id: 'sub-1', status: 'pending' },
        error: null,
      };
      mockSupabase._updateResult = { error: null };

      const interaction = makeInteraction('qwicky:reject:game-42');
      await handleButtonInteraction(interaction);

      expect(interaction.deferUpdate).toHaveBeenCalled();

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'rejected',
          reviewed_at: expect.any(String),
        })
      );

      expect(interaction.message.edit).toHaveBeenCalledWith(
        expect.objectContaining({
          components: [],
          embeds: expect.arrayContaining([
            expect.objectContaining({ _color: 0xFF3366 }),
          ]),
        })
      );
    });
  });

  describe('unknown action', () => {
    it('does nothing for an unknown action (no DB update, no message edit)', async () => {
      const interaction = makeInteraction('qwicky:foobar:some-id');
      await handleButtonInteraction(interaction);

      // Should still defer the update (happens before the switch)
      expect(interaction.deferUpdate).toHaveBeenCalled();

      // Should NOT update anything or edit the message
      expect(mockSupabase.update).not.toHaveBeenCalled();
      expect(interaction.message.edit).not.toHaveBeenCalled();
      expect(interaction.followUp).not.toHaveBeenCalled();
    });

    it('ignores interactions whose customId does not start with qwicky:', async () => {
      const interaction = makeInteraction('other-bot:action:123');
      await handleButtonInteraction(interaction);

      // Should return immediately without deferring
      expect(interaction.deferUpdate).not.toHaveBeenCalled();
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('ignores interactions with too few parts in customId', async () => {
      const interaction = makeInteraction('qwicky:incomplete');
      await handleButtonInteraction(interaction);

      expect(interaction.deferUpdate).not.toHaveBeenCalled();
    });
  });

  describe('missing permission', () => {
    it('sends an ephemeral error when user lacks ManageChannels permission', async () => {
      const interaction = makeInteraction('qwicky:approve:game-42', {
        memberPermissions: {
          has: vi.fn().mockReturnValue(false),
        },
      });
      await handleButtonInteraction(interaction);

      // Should NOT defer -- permission check happens first
      expect(interaction.deferUpdate).not.toHaveBeenCalled();

      // Should reply with ephemeral message
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Only admins can do this.',
          ephemeral: true,
        })
      );

      // Should NOT touch the database
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });
  });

  describe('submission not found', () => {
    it('sends an ephemeral error when no pending submission exists', async () => {
      mockSupabase._selectResult = { data: null, error: { code: 'PGRST116' } };

      const interaction = makeInteraction('qwicky:approve:game-99');
      await handleButtonInteraction(interaction);

      expect(interaction.deferUpdate).toHaveBeenCalled();
      expect(interaction.followUp).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('No pending submission found'),
          ephemeral: true,
        })
      );

      // Should NOT try to update anything
      expect(mockSupabase.update).not.toHaveBeenCalled();
      expect(interaction.message.edit).not.toHaveBeenCalled();
    });
  });

  describe('database error on update', () => {
    it('follows up with an error message when update fails', async () => {
      mockSupabase._selectResult = {
        data: { id: 'sub-1', status: 'pending' },
        error: null,
      };
      mockSupabase._updateResult = { error: { message: 'Connection timeout' } };

      const interaction = makeInteraction('qwicky:approve:game-42');
      await handleButtonInteraction(interaction);

      expect(interaction.followUp).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Connection timeout'),
          ephemeral: true,
        })
      );
    });
  });
});
