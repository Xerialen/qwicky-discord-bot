// In Vitest v3 CJS mode, vi.mock() factories and module-export spies don't work
// reliably when command modules use destructured imports from supabase. The
// proven fix (same as buttonHandler.test.js): spy on supabase.from, the CLIENT
// OBJECT METHOD. Commands call helper functions that call supabase.from(), so
// the spy intercepts those calls even though the helper function references are
// captured via destructuring at module load time.

let announce, register, unregister, status;
let spySupabaseFrom;

// Build a chain that supports all supabase query builder patterns used by these
// commands: .select().eq().single(), .upsert().select().single(), .delete().eq()
// Making every method return `this` plus a .then() makes the chain awaitable at
// any point so both single()-terminal and eq()-terminal paths work.
function makeChain(result = { data: null, error: null }) {
  const chain = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.upsert = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(result);
  chain.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

beforeEach(() => {
  vi.resetModules();

  const supabaseModule = require('../services/supabase');
  spySupabaseFrom = vi.spyOn(supabaseModule.supabase, 'from');

  announce = require('../commands/announce');
  register = require('../commands/register');
  unregister = require('../commands/unregister');
  status = require('../commands/status');
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── /announce ────────────────────────────────────────────────────────────────

describe('announce command', () => {
  const DEFAULT_CHANNEL_ID = '1467942158135853218';
  let interaction;
  let mockChannel;

  beforeEach(() => {
    mockChannel = {
      isTextBased: vi.fn().mockReturnValue(true),
      send: vi.fn().mockResolvedValue({}),
    };
    interaction = {
      options: {
        getString: vi.fn().mockReturnValue('Hello world'),
        getChannel: vi.fn().mockReturnValue(null),
      },
      client: {
        channels: { fetch: vi.fn().mockResolvedValue(mockChannel) },
      },
      reply: vi.fn().mockResolvedValue({}),
    };
  });

  it('sends message to DEFAULT_CHANNEL_ID when no channel option given', async () => {
    await announce.execute(interaction);
    expect(interaction.client.channels.fetch).toHaveBeenCalledWith(DEFAULT_CHANNEL_ID);
    expect(mockChannel.send).toHaveBeenCalledWith({
      content: 'Hello world',
      allowedMentions: { parse: [] },
    });
    expect(interaction.reply).toHaveBeenCalledWith({
      content: `Message posted to <#${DEFAULT_CHANNEL_ID}>.`,
      ephemeral: true,
    });
  });

  it('sends message to the provided target channel', async () => {
    interaction.options.getChannel.mockReturnValue({ id: '9999888' });
    await announce.execute(interaction);
    expect(interaction.client.channels.fetch).toHaveBeenCalledWith('9999888');
    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'Message posted to <#9999888>.',
      ephemeral: true,
    });
  });

  it('replies with error when channel is not found', async () => {
    interaction.client.channels.fetch.mockResolvedValue(null);
    await announce.execute(interaction);
    expect(mockChannel.send).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Could not find'),
        ephemeral: true,
      })
    );
  });

  it('replies with error when channel is not text-based', async () => {
    mockChannel.isTextBased.mockReturnValue(false);
    await announce.execute(interaction);
    expect(mockChannel.send).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Could not find'),
        ephemeral: true,
      })
    );
  });

  it('handles errors from channels.fetch', async () => {
    interaction.client.channels.fetch.mockRejectedValue(new Error('Unknown channel'));
    await announce.execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Failed to send'),
        ephemeral: true,
      })
    );
  });
});

// ─── /register ────────────────────────────────────────────────────────────────

describe('register command', () => {
  let interaction;

  beforeEach(() => {
    interaction = {
      options: {
        getString: vi.fn((name) => (name === 'tournament-id' ? 'qwi-2025' : null)),
      },
      guildId: 'guild123',
      channelId: 'channel123',
      user: { id: 'user456' },
      reply: vi.fn().mockResolvedValue({}),
    };
  });

  it('calls registerChannel with correct params', async () => {
    spySupabaseFrom.mockReturnValue(makeChain({ data: {}, error: null }));
    await register.execute(interaction);
    expect(spySupabaseFrom).toHaveBeenCalledWith('tournament_channels');
    const chain = spySupabaseFrom.mock.results[0].value;
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        discord_guild_id: 'guild123',
        discord_channel_id: 'channel123',
        tournament_id: 'qwi-2025',
        registered_by: 'user456',
      }),
      expect.any(Object)
    );
  });

  it('confirms tournament name in reply', async () => {
    spySupabaseFrom.mockReturnValue(makeChain({ data: {}, error: null }));
    await register.execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('qwi-2025') })
    );
  });

  it('includes division scope in reply when divisionId provided', async () => {
    interaction.options.getString = vi.fn((name) => {
      if (name === 'tournament-id') return 'qwi-2025';
      if (name === 'division-id') return 'div-1';
      return null;
    });
    spySupabaseFrom.mockReturnValue(makeChain({ data: {}, error: null }));
    await register.execute(interaction);
    const replyContent = interaction.reply.mock.calls[0][0].content;
    expect(replyContent).toContain('div-1');
  });

  it('handles registerChannel failure', async () => {
    spySupabaseFrom.mockReturnValue(makeChain({ data: null, error: new Error('DB error') }));
    await register.execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Failed to register'),
        ephemeral: true,
      })
    );
  });
});

// ─── /unregister ──────────────────────────────────────────────────────────────

describe('unregister command', () => {
  let interaction;

  beforeEach(() => {
    interaction = {
      channelId: 'channel123',
      reply: vi.fn().mockResolvedValue({}),
    };
  });

  it('replies "not linked" when channel has no registration', async () => {
    // PGRST116 = no rows, getChannelRegistration returns null
    spySupabaseFrom.mockReturnValue(makeChain({ data: null, error: { code: 'PGRST116' } }));
    await unregister.execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('not linked'),
        ephemeral: true,
      })
    );
    // Only one from() call (getChannelRegistration), unregisterChannel not reached
    expect(spySupabaseFrom).toHaveBeenCalledTimes(1);
  });

  it('unregisters channel and confirms tournament in reply', async () => {
    // Both getChannelRegistration and unregisterChannel use the same table;
    // the chain resolves with the registration data for single() and with no
    // error when awaited directly (delete().eq()).
    spySupabaseFrom.mockReturnValue(
      makeChain({ data: { tournament_id: 'qwi-2025' }, error: null })
    );
    await unregister.execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('qwi-2025') })
    );
  });

  it('handles errors gracefully', async () => {
    spySupabaseFrom.mockReturnValue(makeChain({ data: null, error: new Error('DB error') }));
    await unregister.execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Failed to unregister'),
        ephemeral: true,
      })
    );
  });
});

// ─── /status ──────────────────────────────────────────────────────────────────

describe('status command', () => {
  let interaction;

  beforeEach(() => {
    interaction = {
      channelId: 'channel123',
      reply: vi.fn().mockResolvedValue({}),
    };
  });

  it('replies "not linked" when channel has no registration', async () => {
    spySupabaseFrom.mockReturnValue(makeChain({ data: null, error: { code: 'PGRST116' } }));
    await status.execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('not linked'),
        ephemeral: true,
      })
    );
  });

  it('shows tournament and registered_by in reply', async () => {
    spySupabaseFrom.mockReturnValue(
      makeChain({
        data: {
          tournament_id: 'qwi-2025',
          division_id: null,
          registered_by: 'user456',
          created_at: '2025-01-01T00:00:00.000Z',
        },
        error: null,
      })
    );
    await status.execute(interaction);
    const content = interaction.reply.mock.calls[0][0].content;
    expect(content).toContain('qwi-2025');
    expect(content).toContain('user456');
  });

  it('shows division when present', async () => {
    spySupabaseFrom.mockReturnValue(
      makeChain({
        data: {
          tournament_id: 'qwi-2025',
          division_id: 'div-1',
          registered_by: 'user456',
          created_at: '2025-01-01T00:00:00.000Z',
        },
        error: null,
      })
    );
    await status.execute(interaction);
    const content = interaction.reply.mock.calls[0][0].content;
    expect(content).toContain('div-1');
  });

  it('does not show division when absent', async () => {
    spySupabaseFrom.mockReturnValue(
      makeChain({
        data: {
          tournament_id: 'qwi-2025',
          division_id: null,
          registered_by: 'user456',
          created_at: '2025-01-01T00:00:00.000Z',
        },
        error: null,
      })
    );
    await status.execute(interaction);
    const content = interaction.reply.mock.calls[0][0].content;
    expect(content).not.toContain('Division');
  });

  it('handles errors gracefully', async () => {
    spySupabaseFrom.mockReturnValue(makeChain({ data: null, error: new Error('DB error') }));
    await status.execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Failed to fetch status'),
        ephemeral: true,
      })
    );
  });
});
