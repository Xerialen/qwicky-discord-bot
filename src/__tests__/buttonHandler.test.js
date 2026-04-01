// In Vitest v3 CJS mode, vi.mock() factories don't intercept transitive require()
// calls reliably. The fix for supabase: load the real module, spy on its client's
// `.from` method, THEN load buttonHandler. Since buttonHandler captures `supabase`
// as an object reference (not a destructured primitive), spying on `supabase.from`
// mutates the same object reference that buttonHandler holds.
//
// discord.js is still mocked with vi.mock() (hoisted) because EmbedBuilder.from()
// on a plain-object embed would throw with the real implementation, and the factory
// only calls mock methods inline (not in tests) so the CJS limitation doesn't apply.

vi.mock('discord.js', () => {
  const mockEmbedInstance = {
    setColor: vi.fn().mockReturnThis(),
    setTitle: vi.fn().mockReturnThis(),
    setFields: vi.fn().mockReturnThis(),
  };
  return {
    EmbedBuilder: {
      from: vi.fn().mockReturnValue(mockEmbedInstance),
    },
  };
});

let handleButtonInteraction;
let spySupabaseFrom;

beforeEach(() => {
  vi.resetModules();

  // Load supabase first, then spy on the client's .from method before buttonHandler loads
  const supabaseModule = require('../services/supabase');
  spySupabaseFrom = vi.spyOn(supabaseModule.supabase, 'from');

  ({ handleButtonInteraction } = require('../services/buttonHandler'));
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Build a Supabase select chain: .select().eq().in().single() → resolves to result
function makeSelectChain(result) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  };
}

// Build a Supabase update chain: .update({}).eq() → resolves to result
function makeUpdateChain(result) {
  return {
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue(result),
    }),
  };
}

function makeAdminInteraction(customId, overrides = {}) {
  return {
    customId,
    memberPermissions: { has: vi.fn().mockReturnValue(true) },
    deferUpdate: vi.fn().mockResolvedValue(),
    followUp: vi.fn().mockResolvedValue(),
    user: { username: 'admin', displayName: 'Admin' },
    message: {
      embeds: [{ fields: [{ name: 'Status', value: 'Pending' }] }],
      edit: vi.fn().mockResolvedValue(),
    },
    ...overrides,
  };
}

describe('handleButtonInteraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Routing and permissions ────────────────────────────────────────────────

  it('returns early for non-qwicky customId', async () => {
    const interaction = { customId: 'other:action:id' };
    await expect(handleButtonInteraction(interaction)).resolves.toBeUndefined();
  });

  it('returns early when customId has fewer than 3 parts', async () => {
    const interaction = { customId: 'qwicky:approve' };
    await expect(handleButtonInteraction(interaction)).resolves.toBeUndefined();
  });

  it('replies "Only admins" when member lacks ManageChannels permission', async () => {
    const interaction = {
      customId: 'qwicky:approve:game123',
      memberPermissions: { has: vi.fn().mockReturnValue(false) },
      reply: vi.fn().mockResolvedValue(),
    };
    await handleButtonInteraction(interaction);
    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'Only admins can do this.',
      ephemeral: true,
    });
  });

  it('replies "Only admins" when memberPermissions is null', async () => {
    const interaction = {
      customId: 'qwicky:approve:game123',
      memberPermissions: null,
      reply: vi.fn().mockResolvedValue(),
    };
    await handleButtonInteraction(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Only admins can do this.' })
    );
  });

  it('calls deferUpdate before processing an admin action', async () => {
    const interaction = makeAdminInteraction('qwicky:approve:game123');
    spySupabaseFrom.mockReturnValue(makeSelectChain({ data: null, error: null }));
    await handleButtonInteraction(interaction);
    expect(interaction.deferUpdate).toHaveBeenCalled();
  });

  // ─── Approve ────────────────────────────────────────────────────────────────

  it('approve: followsUp "No pending submission" when game is not found', async () => {
    const interaction = makeAdminInteraction('qwicky:approve:game123');
    spySupabaseFrom.mockReturnValue(makeSelectChain({ data: null, error: null }));
    await handleButtonInteraction(interaction);
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('No pending submission') })
    );
  });

  it('approve: updates status to approved and edits embed on success', async () => {
    const interaction = makeAdminInteraction('qwicky:approve:game123');
    const submission = {
      id: 'sub1',
      status: 'pending',
      tournament_id: 'qwi-2025',
      discord_channel_id: 'c1',
    };
    spySupabaseFrom
      .mockReturnValueOnce(makeSelectChain({ data: submission, error: null }))
      .mockReturnValueOnce(makeUpdateChain({ error: null }));

    await handleButtonInteraction(interaction);

    expect(spySupabaseFrom).toHaveBeenCalledWith('match_submissions');
    expect(interaction.message.edit).toHaveBeenCalledWith(
      expect.objectContaining({ components: [] })
    );
  });

  // ─── Reject ─────────────────────────────────────────────────────────────────

  it('reject: followsUp "No pending submission" when game is not found', async () => {
    const interaction = makeAdminInteraction('qwicky:reject:game123');
    spySupabaseFrom.mockReturnValue(makeSelectChain({ data: null, error: null }));
    await handleButtonInteraction(interaction);
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('No pending submission') })
    );
  });

  it('reject: updates status to rejected and edits embed on success', async () => {
    const interaction = makeAdminInteraction('qwicky:reject:game456');
    const submission = { id: 'sub2', status: 'pending' };
    spySupabaseFrom
      .mockReturnValueOnce(makeSelectChain({ data: submission, error: null }))
      .mockReturnValueOnce(makeUpdateChain({ error: null }));

    await handleButtonInteraction(interaction);

    expect(interaction.message.edit).toHaveBeenCalledWith(
      expect.objectContaining({ components: [] })
    );
  });

  // ─── Confirm schedule ────────────────────────────────────────────────────────

  it('confirm-schedule: parses matchId|date|time payload and updates match', async () => {
    const interaction = makeAdminInteraction('qwicky:confirm-schedule:match42|2025-04-01|20:00');
    spySupabaseFrom.mockReturnValue(makeUpdateChain({ error: null }));

    await handleButtonInteraction(interaction);

    expect(spySupabaseFrom).toHaveBeenCalledWith('matches');
    expect(interaction.message.edit).toHaveBeenCalledWith(
      expect.objectContaining({ components: [] })
    );
  });

  // ─── Cancel schedule ─────────────────────────────────────────────────────────

  it('cancel-schedule: edits embed and removes buttons', async () => {
    const interaction = makeAdminInteraction('qwicky:cancel-schedule:x');
    await handleButtonInteraction(interaction);
    expect(interaction.message.edit).toHaveBeenCalledWith(
      expect.objectContaining({ components: [] })
    );
  });

  // ─── Unknown action ──────────────────────────────────────────────────────────

  it('unknown action: does not throw', async () => {
    const interaction = makeAdminInteraction('qwicky:foobar:id123');
    await expect(handleButtonInteraction(interaction)).resolves.toBeUndefined();
  });

  // ─── Error handling ──────────────────────────────────────────────────────────

  it('followsUp with error message when a supabase update fails', async () => {
    const interaction = makeAdminInteraction('qwicky:approve:game999');
    const submission = { id: 'sub3', status: 'pending' };
    spySupabaseFrom
      .mockReturnValueOnce(makeSelectChain({ data: submission, error: null }))
      .mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: new Error('write failed') }),
        }),
      });

    await handleButtonInteraction(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('write failed'), ephemeral: true })
    );
  });
});
