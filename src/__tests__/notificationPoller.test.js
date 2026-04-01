// In Vitest v3 CJS mode, vi.mock() factories and module-export spies do NOT
// intercept destructured imports in transitive requires. The only reliable fix
// (same as buttonHandler.test.js and commands.test.js): spy on the SUPABASE
// CLIENT OBJECT's methods. All helper functions close over the same client
// object, so mutations on it are seen by all closures even when they captured
// the helper via destructuring at load time.
//
// - claimNotifications      → supabase.rpc(...)
// - completeNotification    → supabase.from(...).update(...).eq(...)
// - failNotification        → supabase.from(...).update(...).eq(...)
//
// handleAnnouncement is NOT mocked at the module level. We pass a mock Discord
// client to pollOnce(); since handleAnnouncement only calls
// client.channels.fetch(), controlling the client controls the handler.

let pollOnce;
let spyRpc, spyFrom;

// Chainable + thenable builder for supabase.from(...) call chains used by
// completeNotification and failNotification.
function makeFromChain(result = { error: null }) {
  const chain = {};
  chain.update = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

beforeEach(() => {
  vi.resetModules();

  const supabaseModule = require('../services/supabase');
  spyRpc = vi.spyOn(supabaseModule.supabase, 'rpc');
  spyFrom = vi.spyOn(supabaseModule.supabase, 'from');

  ({ pollOnce } = require('../services/notificationPoller'));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('pollOnce', () => {
  const client = {};

  it('returns early without any side effects when no notifications are claimed', async () => {
    spyRpc.mockResolvedValue({ data: [], error: null });
    await pollOnce(client);
    expect(spyFrom).not.toHaveBeenCalled();
  });

  it('dispatches announcement notification to handleAnnouncement', async () => {
    const notification = {
      id: 'notif1',
      notification_type: 'announcement',
      channel_id: 'chan1',
      payload: { content: 'hi' },
    };
    const mockChannel = { send: vi.fn().mockResolvedValue({}) };
    const mockClient = { channels: { fetch: vi.fn().mockResolvedValue(mockChannel) } };
    const chain = makeFromChain();

    spyRpc.mockResolvedValue({ data: [notification], error: null });
    spyFrom.mockReturnValue(chain);

    await pollOnce(mockClient);

    expect(mockClient.channels.fetch).toHaveBeenCalledWith('chan1');
    expect(mockChannel.send).toHaveBeenCalledWith({
      content: 'hi',
      allowedMentions: { parse: [] },
    });
    expect(spyFrom).toHaveBeenCalledWith('discord_notifications');
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));
    expect(chain.eq).toHaveBeenCalledWith('id', 'notif1');
  });

  it('fails notification when handler throws', async () => {
    const notification = {
      id: 'notif2',
      notification_type: 'announcement',
      channel_id: 'chan1',
      payload: { content: 'hi' },
    };
    // fetch rejects → handleAnnouncement throws → pollOnce calls failNotification
    const mockClient = {
      channels: { fetch: vi.fn().mockRejectedValue(new Error('channel unavailable')) },
    };
    const chain = makeFromChain();

    spyRpc.mockResolvedValue({ data: [notification], error: null });
    spyFrom.mockReturnValue(chain);

    await pollOnce(mockClient);

    expect(chain.update).toHaveBeenCalledWith({
      status: 'failed',
      error: 'channel unavailable',
    });
    expect(chain.eq).toHaveBeenCalledWith('id', 'notif2');
    // completeNotification update is never called
    expect(chain.update).not.toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));
  });

  it('fails notification for unknown notification_type', async () => {
    const notification = { id: 'notif3', notification_type: 'unknown_type' };
    const chain = makeFromChain();

    spyRpc.mockResolvedValue({ data: [notification], error: null });
    spyFrom.mockReturnValue(chain);

    await pollOnce(client);

    expect(chain.update).toHaveBeenCalledWith({
      status: 'failed',
      error: 'Unknown notification type: unknown_type',
    });
    expect(chain.eq).toHaveBeenCalledWith('id', 'notif3');
  });

  it('does not throw when claimNotifications fails', async () => {
    spyRpc.mockRejectedValue(new Error('DB down'));
    await expect(pollOnce(client)).resolves.toBeUndefined();
    expect(spyFrom).not.toHaveBeenCalled();
  });

  it('processes multiple notifications sequentially', async () => {
    const notifications = [
      { id: 'n1', notification_type: 'announcement', channel_id: 'c1', payload: { content: 'a' } },
      { id: 'n2', notification_type: 'announcement', channel_id: 'c2', payload: { content: 'b' } },
    ];
    const mockChannel = { send: vi.fn().mockResolvedValue({}) };
    const mockClient = { channels: { fetch: vi.fn().mockResolvedValue(mockChannel) } };

    spyRpc.mockResolvedValue({ data: notifications, error: null });
    // Each from() call gets its own chain so we can inspect them independently
    spyFrom.mockImplementation(() => makeFromChain());

    await pollOnce(mockClient);

    expect(mockClient.channels.fetch).toHaveBeenCalledTimes(2);
    expect(spyFrom).toHaveBeenCalledTimes(2);

    const chain1 = spyFrom.mock.results[0].value;
    const chain2 = spyFrom.mock.results[1].value;
    expect(chain1.eq).toHaveBeenCalledWith('id', 'n1');
    expect(chain2.eq).toHaveBeenCalledWith('id', 'n2');
    expect(chain1.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));
    expect(chain2.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));
  });

  it('continues to next notification when one handler fails', async () => {
    const notifications = [
      { id: 'n1', notification_type: 'announcement', channel_id: 'c1', payload: { content: 'a' } },
      { id: 'n2', notification_type: 'announcement', channel_id: 'c2', payload: { content: 'b' } },
    ];
    const mockChannel = { send: vi.fn().mockResolvedValue({}) };
    const mockClient = {
      channels: {
        fetch: vi
          .fn()
          .mockRejectedValueOnce(new Error('channel gone'))
          .mockResolvedValueOnce(mockChannel),
      },
    };

    spyRpc.mockResolvedValue({ data: notifications, error: null });
    spyFrom.mockImplementation(() => makeFromChain());

    await pollOnce(mockClient);

    expect(spyFrom).toHaveBeenCalledTimes(2);
    const chain1 = spyFrom.mock.results[0].value;
    const chain2 = spyFrom.mock.results[1].value;
    expect(chain1.update).toHaveBeenCalledWith({ status: 'failed', error: 'channel gone' });
    expect(chain1.eq).toHaveBeenCalledWith('id', 'n1');
    expect(chain2.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));
    expect(chain2.eq).toHaveBeenCalledWith('id', 'n2');
  });
});
